import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService, SearchService } from '@libs/common';
import {
  NotificationType,
  WorkerService,
  WorkRequestType,
} from '@generated/prisma';
import { WorkerProfileService } from './worker-profile.service';
import { NotificationQueueService } from '../notification/notification-queue.service';
import { BlockService } from '../moderation/block.service';

describe('WorkerProfileService', () => {
  let workerProfileService: WorkerProfileService;
  let prisma: {
    workerProfile: { findUnique: jest.Mock; delete: jest.Mock };
    workRequest: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let notificationQueue: {
    queueNotification: jest.Mock;
    queueDeleteNotification: jest.Mock;
  };

  const worker = { id: 'worker', firstName: 'John', lastName: 'Doe' };
  const requester = { id: 'requester', firstName: 'Jane', lastName: 'Smith' };
  const workerProfile = {
    id: 'profile',
    workerId: 'worker',
    service: WorkerService.ELECTRICIAN,
  };
  const pendingWorkRequest = {
    id: 'request',
    requesterId: 'requester',
    workerProfileId: 'profile',
    status: 'PENDING',
    workerProfile: { workerId: 'worker' },
  };

  beforeEach(async () => {
    prisma = {
      workerProfile: {
        findUnique: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      },
      workRequest: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    notificationQueue = {
      queueNotification: jest.fn().mockResolvedValue(undefined),
      queueDeleteNotification: jest.fn().mockResolvedValue(undefined),
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        WorkerProfileService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: SearchService,
          useValue: { removeDocument: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: NotificationQueueService, useValue: notificationQueue },
        {
          provide: BlockService,
          useValue: {
            assertNotBlocked: jest.fn().mockResolvedValue(undefined),
            getBlockedUserIds: jest.fn().mockResolvedValue([]),
            isBlockedBetween: jest.fn().mockResolvedValue(false),
          },
        },
      ],
    }).compile();

    workerProfileService = app.get<WorkerProfileService>(WorkerProfileService);
  });

  describe('madeWorkRequest', () => {
    const dto = {
      service: WorkerService.ELECTRICIAN,
      description: 'Fix the wiring',
      location: 'Toronto',
      budget: '100',
      type: WorkRequestType.ONETIME,
      schedule: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    it('should notify the worker about the work request', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue(workerProfile);
      prisma.workRequest.create.mockResolvedValue({ id: 'request' });

      await workerProfileService.madeWorkRequest(requester, 'profile', dto);

      expect(notificationQueue.queueNotification).toHaveBeenCalledWith({
        type: NotificationType.WORK_REQUEST_RECEIVED,
        recipientId: 'worker',
        actorId: 'requester',
        title: 'New Work Request',
        body: 'Jane Smith sent you a work request.',
        referenceIds: { workerProfileId: 'profile', workRequestId: 'request' },
      });
    });

    it('should not notify when the request is sent to own profile', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue(workerProfile);

      await expect(
        workerProfileService.madeWorkRequest(worker, 'profile', dto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(notificationQueue.queueNotification).not.toHaveBeenCalled();
    });

    it('should not notify when a pending request already exists', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue(workerProfile);
      prisma.workRequest.findFirst.mockResolvedValue({ id: 'request' });

      await expect(
        workerProfileService.madeWorkRequest(requester, 'profile', dto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(notificationQueue.queueNotification).not.toHaveBeenCalled();
    });
  });

  describe('acceptWorkRequest', () => {
    it('should notify the requester about the acceptance', async () => {
      prisma.workRequest.findUnique.mockResolvedValue(pendingWorkRequest);

      await workerProfileService.acceptWorkRequest(worker, 'request');

      expect(notificationQueue.queueNotification).toHaveBeenCalledWith({
        type: NotificationType.WORK_REQUEST_ACCEPTED,
        recipientId: 'requester',
        actorId: 'worker',
        title: 'Work Request Accepted',
        body: 'John Doe accepted your work request.',
        referenceIds: { workerProfileId: 'profile', workRequestId: 'request' },
      });
    });

    it('should not notify when the work request is not pending', async () => {
      prisma.workRequest.findUnique.mockResolvedValue({
        ...pendingWorkRequest,
        status: 'WITHDRAWN',
      });

      await expect(
        workerProfileService.acceptWorkRequest(worker, 'request'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(notificationQueue.queueNotification).not.toHaveBeenCalled();
    });
  });

  describe('rejectWorkRequest', () => {
    it('should notify the requester about the rejection', async () => {
      prisma.workRequest.findUnique.mockResolvedValue(pendingWorkRequest);

      await workerProfileService.rejectWorkRequest(worker, 'request');

      expect(notificationQueue.queueNotification).toHaveBeenCalledWith({
        type: NotificationType.WORK_REQUEST_REJECTED,
        recipientId: 'requester',
        actorId: 'worker',
        title: 'Work Request Rejected',
        body: 'John Doe rejected your work request.',
        referenceIds: { workerProfileId: 'profile', workRequestId: 'request' },
      });
    });
  });

  describe('withdrawWorkRequest', () => {
    it('should notify the worker about the withdrawal', async () => {
      prisma.workRequest.findUnique.mockResolvedValue(pendingWorkRequest);

      await workerProfileService.withdrawWorkRequest(requester, 'request');

      expect(notificationQueue.queueNotification).toHaveBeenCalledWith({
        type: NotificationType.WORK_REQUEST_WITHDRAWN,
        recipientId: 'worker',
        actorId: 'requester',
        title: 'Work Request Withdrawn',
        body: 'Jane Smith withdrew their work request.',
        referenceIds: { workerProfileId: 'profile', workRequestId: 'request' },
      });
    });

    it('should not notify when someone else withdraws the request', async () => {
      prisma.workRequest.findUnique.mockResolvedValue(pendingWorkRequest);

      await expect(
        workerProfileService.withdrawWorkRequest(worker, 'request'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(notificationQueue.queueNotification).not.toHaveBeenCalled();
    });
  });

  describe('bulkAcceptWorkRequests', () => {
    it('should notify the requester of every pending work request', async () => {
      prisma.workRequest.findMany.mockResolvedValue([
        pendingWorkRequest,
        { ...pendingWorkRequest, id: 'accepted-request', status: 'ACCEPTED' },
        {
          ...pendingWorkRequest,
          id: 'other-request',
          requesterId: 'other-requester',
        },
      ]);

      await workerProfileService.bulkAcceptWorkRequests(worker, [
        'request',
        'accepted-request',
        'other-request',
      ]);

      expect(prisma.workRequest.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['request', 'other-request'] } },
        data: { status: 'ACCEPTED' },
      });

      const notifications = notificationQueue.queueNotification.mock.calls.map(
        ([params]) => [params.type, params.recipientId, params.referenceIds],
      );
      expect(notifications).toEqual([
        [
          NotificationType.WORK_REQUEST_ACCEPTED,
          'requester',
          { workerProfileId: 'profile', workRequestId: 'request' },
        ],
        [
          NotificationType.WORK_REQUEST_ACCEPTED,
          'other-requester',
          { workerProfileId: 'profile', workRequestId: 'other-request' },
        ],
      ]);
    });

    it('should not notify when a work request belongs to another worker', async () => {
      prisma.workRequest.findMany.mockResolvedValue([
        { ...pendingWorkRequest, workerProfile: { workerId: 'other-worker' } },
      ]);

      await expect(
        workerProfileService.bulkAcceptWorkRequests(worker, ['request']),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(notificationQueue.queueNotification).not.toHaveBeenCalled();
    });
  });

  describe('bulkRejectWorkRequests', () => {
    it('should notify the requester of every pending work request', async () => {
      prisma.workRequest.findMany.mockResolvedValue([
        pendingWorkRequest,
        { ...pendingWorkRequest, id: 'withdrawn-request', status: 'WITHDRAWN' },
      ]);

      await workerProfileService.bulkRejectWorkRequests(worker, [
        'request',
        'withdrawn-request',
      ]);

      expect(prisma.workRequest.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['request'] } },
        data: { status: 'REJECTED' },
      });
      expect(notificationQueue.queueNotification).toHaveBeenCalledTimes(1);
      expect(notificationQueue.queueNotification).toHaveBeenCalledWith({
        type: NotificationType.WORK_REQUEST_REJECTED,
        recipientId: 'requester',
        actorId: 'worker',
        title: 'Work Request Rejected',
        body: 'John Doe rejected your work request.',
        referenceIds: { workerProfileId: 'profile', workRequestId: 'request' },
      });
    });
  });

  describe('deleteWorkerProfile', () => {
    it('should delete every notification of the worker profile', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue({
        ...workerProfile,
        profilePhoto: null,
        workPhotos: [],
        certificates: [],
      });

      await workerProfileService.deleteWorkerProfile('worker', 'profile');

      expect(notificationQueue.queueDeleteNotification).toHaveBeenCalledWith({
        referenceIds: { workerProfileId: 'profile' },
      });
    });
  });
});
