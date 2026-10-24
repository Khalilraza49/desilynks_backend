import { Test, TestingModule } from '@nestjs/testing';
import {
  NOTIFICATION_QUEUE,
  NOTIFICATION_QUEUE_CHAT,
  NotificationJobName,
} from '@libs/common';
import { NotificationQueueService } from './notification-queue.service';

describe('NotificationQueueService', () => {
  let service: NotificationQueueService;
  let notificationQueue: { add: jest.Mock; addBulk: jest.Mock };
  let chatQueue: { add: jest.Mock };

  const baseParams = {
    type: 'POST_LIKED',
    actorId: 'actor',
    title: 'New Like on Your Post',
    body: 'John Doe liked your post.',
    referenceIds: { postId: 'post' },
  };

  beforeEach(async () => {
    notificationQueue = {
      add: jest.fn().mockResolvedValue(undefined),
      addBulk: jest.fn().mockResolvedValue([]),
    };
    chatQueue = { add: jest.fn().mockResolvedValue(undefined) };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationQueueService,
        {
          provide: `BullQueue_${NOTIFICATION_QUEUE}`,
          useValue: notificationQueue,
        },
        {
          provide: `BullQueue_${NOTIFICATION_QUEUE_CHAT}`,
          useValue: chatQueue,
        },
      ],
    }).compile();

    service = app.get<NotificationQueueService>(NotificationQueueService);
  });

  describe('queueNotification', () => {
    it('should skip notifications to the actor', async () => {
      await service.queueNotification({ ...baseParams, recipientId: 'actor' });

      expect(notificationQueue.add).not.toHaveBeenCalled();
    });

    it('should use the notificationId as the job id', async () => {
      await service.queueNotification({
        ...baseParams,
        recipientId: 'recipient',
      });

      const [name, data, opts] = notificationQueue.add.mock.calls[0];
      expect(name).toBe(NotificationJobName.SEND_NOTIFICATION);
      expect(data.notificationId).toEqual(expect.any(String));
      expect(opts.jobId).toBe(data.notificationId);
    });

    it('should not throw when the queue is unavailable', async () => {
      notificationQueue.add.mockRejectedValue(new Error('Redis is down'));

      await expect(
        service.queueNotification({ ...baseParams, recipientId: 'recipient' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('queueBulkNotifications', () => {
    it('should dedupe recipients and exclude the actor', async () => {
      await service.queueBulkNotifications(baseParams, [
        'user-1',
        'user-2',
        'user-1',
        'actor',
      ]);

      const jobs = notificationQueue.addBulk.mock.calls[0][0];
      expect(jobs.map((job) => job.data.recipientId)).toEqual([
        'user-1',
        'user-2',
      ]);
      expect(jobs[0].opts.jobId).toBe(jobs[0].data.notificationId);
    });

    it('should split recipients into chunks of 500', async () => {
      const recipientIds = Array.from({ length: 1200 }, (_, i) => `user-${i}`);

      await service.queueBulkNotifications(baseParams, recipientIds);

      expect(
        notificationQueue.addBulk.mock.calls.map(([jobs]) => jobs.length),
      ).toEqual([500, 500, 200]);
    });

    it('should not throw when the queue is unavailable', async () => {
      notificationQueue.addBulk.mockRejectedValue(new Error('Redis is down'));

      await expect(
        service.queueBulkNotifications(baseParams, ['user-1']),
      ).resolves.toBeUndefined();
    });
  });

  describe('queueDeleteNotification', () => {
    it('should skip jobs without reference ids', async () => {
      await service.queueDeleteNotification({
        type: 'POST_LIKED',
        actorId: 'actor',
        referenceIds: { postId: undefined },
      });

      expect(notificationQueue.add).not.toHaveBeenCalled();
    });

    it('should queue jobs with reference ids', async () => {
      await service.queueDeleteNotification({
        referenceIds: { postId: 'post' },
      });

      expect(notificationQueue.add).toHaveBeenCalledWith(
        NotificationJobName.DELETE_NOTIFICATION,
        { referenceIds: { postId: 'post' } },
        expect.any(Object),
      );
    });
  });

  describe('queueChatPush', () => {
    it('should not throw when the queue is unavailable', async () => {
      chatQueue.add.mockRejectedValue(new Error('Redis is down'));

      await expect(
        service.queueChatPush({
          receiverId: 'receiver',
          senderId: 'sender',
          senderName: 'John Doe',
          content: 'Hello',
          conversationId: 'conversation',
          messageId: 'message',
        }),
      ).resolves.toBeUndefined();
    });
  });
});
