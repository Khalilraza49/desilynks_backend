import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import {
  NOTIFICATION_QUEUE,
  NOTIFICATION_QUEUE_CHAT,
  NotificationJobName,
  SEND_NOTIFICATION_JOB_OPTIONS,
  QueueNotificationParams,
  DeleteNotificationJobData,
  FanoutNotificationJobData,
  SendChatPushJobData,
} from '@libs/common';

const BULK_CHUNK_SIZE = 500;

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);

  constructor(
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,

    @InjectQueue(NOTIFICATION_QUEUE_CHAT)
    private readonly chatQueue: Queue,
  ) {}

  async queueNotification(params: QueueNotificationParams): Promise<void> {
    if (params.recipientId === params.actorId) return;

    const notificationId = randomUUID();

    try {
      await this.notificationQueue.add(
        NotificationJobName.SEND_NOTIFICATION,
        { ...params, notificationId },
        { ...SEND_NOTIFICATION_JOB_OPTIONS, jobId: notificationId },
      );

      this.logger.debug(
        `Queued notification: ${params.type} → user ${params.recipientId.substring(0, 8)}...`,
      );
    } catch (error) {
      this.logger.error(
        `Error queueing notification ${params.type}: ${error.message}`,
      );
    }
  }

  async queueBulkNotifications(
    params: Omit<QueueNotificationParams, 'recipientId'>,
    recipientIds: string[],
  ): Promise<void> {
    const uniqueRecipientIds = [...new Set(recipientIds)].filter(
      (recipientId) => recipientId !== params.actorId,
    );

    try {
      for (let i = 0; i < uniqueRecipientIds.length; i += BULK_CHUNK_SIZE) {
        const chunk = uniqueRecipientIds.slice(i, i + BULK_CHUNK_SIZE);

        await this.notificationQueue.addBulk(
          chunk.map((recipientId) => {
            const notificationId = randomUUID();
            return {
              name: NotificationJobName.SEND_NOTIFICATION,
              data: { ...params, recipientId, notificationId },
              opts: { ...SEND_NOTIFICATION_JOB_OPTIONS, jobId: notificationId },
            };
          }),
        );
      }

      this.logger.debug(
        `Queued ${uniqueRecipientIds.length} notifications: ${params.type}`,
      );
    } catch (error) {
      this.logger.error(
        `Error queueing bulk notifications ${params.type}: ${error.message}`,
      );
    }
  }

  async queueFanoutNotification(
    params: FanoutNotificationJobData,
  ): Promise<void> {
    try {
      await this.notificationQueue.add(
        NotificationJobName.FANOUT_NOTIFICATION,
        params,
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 86400 },
          removeOnFail: { age: 604800 },
        },
      );
    } catch (error) {
      this.logger.error(
        `Error queueing fanout notification ${params.notification.type}: ${error.message}`,
      );
    }
  }

  async queueDeleteNotification(
    params: DeleteNotificationJobData,
  ): Promise<void> {
    const hasReference = Object.values(params.referenceIds ?? {}).some(
      (value) => !!value,
    );

    if (!hasReference) {
      this.logger.warn(
        `Skipped delete notification without reference ids: ${params.type}`,
      );
      return;
    }

    try {
      await this.notificationQueue.add(
        NotificationJobName.DELETE_NOTIFICATION,
        params,
        {
          attempts: 2,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { age: 3600 },
        },
      );
    } catch (error) {
      this.logger.error(
        `Error queueing delete notification ${params.type}: ${error.message}`,
      );
    }
  }

  async queueChatPush(params: SendChatPushJobData): Promise<void> {
    try {
      await this.chatQueue.add(NotificationJobName.SEND_CHAT_PUSH, params, {
        attempts: 2,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 3600 },
        priority: 1,
      });
    } catch (error) {
      this.logger.error(`Error queueing chat push: ${error.message}`);
    }
  }
}
