import { Test, TestingModule } from '@nestjs/testing';
import { Job, UnrecoverableError } from 'bullmq';
import {
  PrismaService,
  RedisService,
  FirebaseService,
  FcmTokenService,
  NOTIFICATION_QUEUE,
  NOTIFICATION_REALTIME_CHANNEL,
  NotificationJobName,
} from '@libs/common';
import { Prisma } from '@generated/prisma';
import { NotificationProcessor } from './notification.processor';
import { BadgeService } from '../services/badge.service';

describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;
  let prisma: {
    notification: { upsert: jest.Mock; deleteMany: jest.Mock };
    communityGroupMember: { findMany: jest.Mock };
    workerProfile: { findMany: jest.Mock };
  };
  let redis: { exists: jest.Mock; getClient: jest.Mock };
  let publish: jest.Mock;
  let firebaseService: { sendMulticastNotification: jest.Mock };
  let fcmTokenService: { getTokensByUserId: jest.Mock };
  let notificationQueue: { addBulk: jest.Mock };

  const createJob = (name: string, data: unknown, id = 'job-1') =>
    ({ id, name, data }) as Job;

  const sendData = {
    notificationId: 'notification-1',
    type: 'POST_COMMENTED',
    recipientId: 'recipient-1',
    actorId: 'actor-1',
    title: 'New Comment on Your Post',
    body: 'John Doe commented on your post.',
    referenceIds: { postId: 'post-1', commentId: 'comment-1' },
  };

  beforeEach(async () => {
    publish = jest.fn().mockResolvedValue(1);
    prisma = {
      notification: {
        upsert: jest.fn().mockResolvedValue({ id: 'notification-1' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      communityGroupMember: { findMany: jest.fn() },
      workerProfile: { findMany: jest.fn() },
    };
    redis = {
      exists: jest.fn().mockResolvedValue(true),
      getClient: jest.fn().mockReturnValue({ publish }),
    };
    firebaseService = {
      sendMulticastNotification: jest.fn().mockResolvedValue(undefined),
    };
    fcmTokenService = {
      getTokensByUserId: jest.fn().mockResolvedValue(['token-1']),
    };
    notificationQueue = { addBulk: jest.fn().mockResolvedValue([]) };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: FirebaseService, useValue: firebaseService },
        { provide: FcmTokenService, useValue: fcmTokenService },
        {
          provide: BadgeService,
          useValue: { getBadgeCount: jest.fn().mockResolvedValue(7) },
        },
        {
          provide: `BullQueue_${NOTIFICATION_QUEUE}`,
          useValue: notificationQueue,
        },
      ],
    }).compile();

    processor = app.get<NotificationProcessor>(NotificationProcessor);
  });

  describe('send notification', () => {
    it('should upsert by notificationId and push reference ids', async () => {
      await processor.process(
        createJob(NotificationJobName.SEND_NOTIFICATION, sendData),
      );

      expect(prisma.notification.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'notification-1' },
          update: {},
          create: expect.objectContaining({
            id: 'notification-1',
            postId: 'post-1',
            commentId: 'comment-1',
          }),
        }),
      );
      expect(firebaseService.sendMulticastNotification).toHaveBeenCalledWith(
        ['token-1'],
        sendData.title,
        sendData.body,
        {
          type: 'POST_COMMENTED',
          notificationId: 'notification-1',
          postId: 'post-1',
          commentId: 'comment-1',
        },
        7,
      );
      expect(publish).toHaveBeenCalledWith(
        NOTIFICATION_REALTIME_CHANNEL,
        expect.any(String),
      );
    });

    it('should not retry when the recipient no longer exists', async () => {
      prisma.notification.upsert.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Foreign key failed', {
          code: 'P2003',
          clientVersion: 'test',
        }),
      );

      await expect(
        processor.process(
          createJob(NotificationJobName.SEND_NOTIFICATION, sendData),
        ),
      ).rejects.toBeInstanceOf(UnrecoverableError);
    });
  });

  describe('delete notification', () => {
    it('should skip jobs without reference ids', async () => {
      await processor.process(
        createJob(NotificationJobName.DELETE_NOTIFICATION, {
          type: 'POST_LIKED',
          actorId: 'actor-1',
          referenceIds: { postId: undefined },
        }),
      );

      expect(prisma.notification.deleteMany).not.toHaveBeenCalled();
    });

    it('should only filter by the fields provided', async () => {
      await processor.process(
        createJob(NotificationJobName.DELETE_NOTIFICATION, {
          referenceIds: { postId: 'post-1', commentId: undefined },
        }),
      );

      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { postId: 'post-1' },
      });
    });
  });

  describe('fanout notification', () => {
    it('should page through group members and queue a job per member', async () => {
      const firstPage = Array.from({ length: 500 }, (_, i) => ({
        id: `member-${i}`,
        userId: `user-${i}`,
      }));
      prisma.communityGroupMember.findMany
        .mockResolvedValueOnce(firstPage)
        .mockResolvedValueOnce([{ id: 'member-500', userId: 'user-500' }]);

      await processor.process(
        createJob(
          NotificationJobName.FANOUT_NOTIFICATION,
          {
            audience: { kind: 'GROUP_MEMBERS', groupId: 'group-1' },
            excludeUserIds: ['creator-1'],
            notification: {
              type: 'GROUP_EVENT_CREATED',
              actorId: 'creator-1',
              title: 'New Group Event',
              body: 'Cricket Club has a new event: Final.',
              referenceIds: { eventId: 'event-1', groupId: 'group-1' },
            },
          },
          'fanout-job',
        ),
      );

      expect(notificationQueue.addBulk).toHaveBeenCalledTimes(2);
      const secondCall = prisma.communityGroupMember.findMany.mock.calls[1][0];
      expect(secondCall.cursor).toEqual({ id: 'member-499' });
      expect(secondCall.where.userId).toEqual({ notIn: ['creator-1'] });

      const [lastJob] = notificationQueue.addBulk.mock.calls[1][0];
      expect(lastJob.name).toBe(NotificationJobName.SEND_NOTIFICATION);
      expect(lastJob.data.recipientId).toBe('user-500');
      expect(lastJob.opts.jobId).toBe('fanout-fanout-job-user-500');
    });

    it('should queue a job per worker profile with the matching service', async () => {
      prisma.workerProfile.findMany.mockResolvedValueOnce([
        { id: 'profile-1', workerId: 'worker-1' },
        { id: 'profile-2', workerId: 'worker-2' },
      ]);

      await processor.process(
        createJob(
          NotificationJobName.FANOUT_NOTIFICATION,
          {
            audience: { kind: 'WORKER_SERVICE', service: 'ELECTRICIAN' },
            excludeUserIds: ['requester-1'],
            notification: {
              type: 'NEED_A_WORKER_POSTED',
              actorId: 'requester-1',
              title: 'New Work Request',
              body: 'Electrician needed in Toronto.',
              referenceIds: { workRequestId: 'post-1' },
            },
          },
          'worker-fanout',
        ),
      );

      expect(prisma.workerProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            service: 'ELECTRICIAN',
            workerId: { notIn: ['requester-1'] },
          },
        }),
      );
      expect(prisma.communityGroupMember.findMany).not.toHaveBeenCalled();

      const jobs = notificationQueue.addBulk.mock.calls[0][0];
      expect(jobs.map((job) => job.data.recipientId)).toEqual([
        'worker-1',
        'worker-2',
      ]);
      expect(jobs[1].opts.jobId).toBe('fanout-worker-fanout-worker-2');
    });
  });
});
