import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue, UnrecoverableError } from 'bullmq';
import { randomUUID } from 'crypto';
import {
  PrismaService,
  RedisService,
  FirebaseService,
  FcmTokenService,
  NOTIFICATION_QUEUE,
  NOTIFICATION_REALTIME_CHANNEL,
  NotificationJobName,
  SEND_NOTIFICATION_JOB_OPTIONS,
  SendNotificationJobData,
  DeleteNotificationJobData,
  FanoutNotificationJobData,
  NotificationReferenceIds,
  userPresenceKey,
} from '@libs/common';
import {
  CommunityGroupMemberStatus,
  NotificationType,
  Prisma,
  WorkerService,
} from '@generated/prisma';
import { BadgeService } from '../services/badge.service';

const FANOUT_PAGE_SIZE = 500;

@Processor(NOTIFICATION_QUEUE, {
  concurrency: 5,
})
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly firebaseService: FirebaseService,
    private readonly fcmTokenService: FcmTokenService,
    private readonly badgeService: BadgeService,
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case NotificationJobName.SEND_NOTIFICATION:
        return this.handleSendNotification(job.data as SendNotificationJobData);
      case NotificationJobName.DELETE_NOTIFICATION:
        return this.handleDeleteNotification(
          job.data as DeleteNotificationJobData,
        );
      case NotificationJobName.FANOUT_NOTIFICATION:
        return this.handleFanoutNotification(
          job.id!,
          job.data as FanoutNotificationJobData,
        );
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleSendNotification(
    data: SendNotificationJobData,
  ): Promise<void> {
    const notification = await this.createNotification(
      data.notificationId ?? randomUUID(),
      data,
    );

    const tokens = await this.fcmTokenService.getTokensByUserId(
      data.recipientId,
    );

    if (tokens.length > 0) {
      const badgeCount = await this.badgeService.getBadgeCount(
        data.recipientId,
      );

      await this.firebaseService.sendMulticastNotification(
        tokens,
        data.title,
        data.body,
        {
          type: data.type,
          notificationId: notification.id,
          ...this.getDefinedReferenceIds(data.referenceIds),
          ...(data.data || {}),
        },
        badgeCount,
      );
    }

    const isOnline = await this.redis.exists(userPresenceKey(data.recipientId));

    if (isOnline) {
      await this.redis.getClient().publish(
        NOTIFICATION_REALTIME_CHANNEL,
        JSON.stringify({
          recipientId: data.recipientId,
          notification,
        }),
      );
    }

    this.logger.log(
      `Processed: ${data.type} → user ${data.recipientId.substring(0, 8)}...`,
    );
  }

  private async createNotification(
    notificationId: string,
    data: SendNotificationJobData,
  ) {
    try {
      return await this.prisma.notification.upsert({
        where: { id: notificationId },
        create: {
          id: notificationId,
          type: data.type as NotificationType,
          recipientId: data.recipientId,
          actorId: data.actorId,
          title: data.title,
          body: data.body,
          data: data.data,
          ...data.referenceIds,
        },
        update: {},
        include: {
          actor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePhoto: { select: { url: true } },
            },
          },
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2003'
      ) {
        throw new UnrecoverableError(
          `Recipient or actor no longer exists for ${data.type}`,
        );
      }
      throw err;
    }
  }

  private async handleDeleteNotification(
    data: DeleteNotificationJobData,
  ): Promise<void> {
    const referenceIds = this.getDefinedReferenceIds(data.referenceIds);

    if (Object.keys(referenceIds).length === 0) {
      this.logger.warn(
        `Skipped delete notification without reference ids: ${data.type}`,
      );
      return;
    }

    const result = await this.prisma.notification.deleteMany({
      where: {
        ...referenceIds,
        ...(data.recipientId && { recipientId: data.recipientId }),
        ...(data.actorId && { actorId: data.actorId }),
        ...(data.type && { type: data.type as NotificationType }),
      },
    });

    this.logger.log(
      `Deleted ${result.count} notification(s): ${data.type ?? 'ALL'} for ${JSON.stringify(referenceIds)}`,
    );
  }

  private async handleFanoutNotification(
    jobId: string,
    data: FanoutNotificationJobData,
  ): Promise<void> {
    const { audience, excludeUserIds = [], notification } = data;
    const excludedIds = [...new Set([...excludeUserIds, notification.actorId])];
    let cursor: string | undefined;
    let total = 0;

    while (true) {
      const recipients = await this.findFanoutRecipients(
        audience,
        excludedIds,
        cursor,
      );

      if (recipients.length === 0) break;

      await this.notificationQueue.addBulk(
        recipients.map((recipient) => ({
          name: NotificationJobName.SEND_NOTIFICATION,
          data: {
            ...notification,
            recipientId: recipient.userId,
            notificationId: randomUUID(),
          },
          opts: {
            ...SEND_NOTIFICATION_JOB_OPTIONS,
            jobId: `fanout-${jobId}-${recipient.userId}`,
          },
        })),
      );

      total += recipients.length;
      cursor = recipients[recipients.length - 1].id;

      if (recipients.length < FANOUT_PAGE_SIZE) break;
    }

    this.logger.log(
      `Fanout: ${notification.type} → ${total} recipient(s) (${audience.kind})`,
    );
  }

  private async findFanoutRecipients(
    audience: FanoutNotificationJobData['audience'],
    excludedIds: string[],
    cursor?: string,
  ): Promise<{ id: string; userId: string }[]> {
    const pagination = {
      orderBy: { id: 'asc' as const },
      take: FANOUT_PAGE_SIZE,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    };

    switch (audience.kind) {
      case 'GROUP_MEMBERS':
        return this.prisma.communityGroupMember.findMany({
          where: {
            groupId: audience.groupId,
            status: CommunityGroupMemberStatus.ACTIVE,
            userId: { notIn: excludedIds },
          },
          select: { id: true, userId: true },
          ...pagination,
        });
      case 'WORKER_SERVICE': {
        const workerProfiles = await this.prisma.workerProfile.findMany({
          where: {
            service: audience.service as WorkerService,
            workerId: { notIn: excludedIds },
          },
          select: { id: true, workerId: true },
          ...pagination,
        });

        return workerProfiles.map((workerProfile) => ({
          id: workerProfile.id,
          userId: workerProfile.workerId,
        }));
      }
    }
  }

  private getDefinedReferenceIds(
    referenceIds: NotificationReferenceIds = {},
  ): Record<string, string> {
    return Object.fromEntries(
      Object.entries(referenceIds).filter(([, value]) => !!value),
    );
  }
}
