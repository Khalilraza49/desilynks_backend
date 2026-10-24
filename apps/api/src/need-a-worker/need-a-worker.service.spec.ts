import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService, SearchService } from '@libs/common';
import {
  BudgetType,
  CategoryStatus,
  NotificationType,
} from '@generated/prisma';
import { NeedAWorkerService } from './need-a-worker.service';
import { NotificationQueueService } from '../notification/notification-queue.service';

describe('NeedAWorkerService', () => {
  let needAWorkerService: NeedAWorkerService;
  let prisma: {
    needAWorkerType: { findUnique: jest.Mock };
    needAWorker: { findUnique: jest.Mock; create: jest.Mock };
    needAWorkerApplication: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let notificationQueue: {
    queueNotification: jest.Mock;
    queueFanoutNotification: jest.Mock;
  };

  const worker = { id: 'worker', firstName: 'John', lastName: 'Doe' };
  const workRequest = {
    requesterId: 'requester',
    workerType: { title: 'Construction Worker' },
  };
  const pendingApplication = {
    id: 'application',
    workerId: 'worker',
    workRequestId: 'post',
    status: 'PENDING',
    workRequest,
  };

  beforeEach(async () => {
    prisma = {
      needAWorkerType: { findUnique: jest.fn() },
      needAWorker: { findUnique: jest.fn(), create: jest.fn() },
      needAWorkerApplication: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    notificationQueue = {
      queueNotification: jest.fn().mockResolvedValue(undefined),
      queueFanoutNotification: jest.fn().mockResolvedValue(undefined),
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        NeedAWorkerService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: SearchService,
          useValue: { indexDocument: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: NotificationQueueService, useValue: notificationQueue },
      ],
    }).compile();

    needAWorkerService = app.get<NeedAWorkerService>(NeedAWorkerService);
  });

  describe('createNeedAWorker', () => {
    const dto = {
      workerTypeId: 'type',
      location: 'Toronto',
      dateNeeded: new Date('2026-12-01'),
      budget: '100',
      budgetType: BudgetType.FIXED,
      isUrgentRequest: true,
      description: 'Need help with a wall',
    };

    const mockWorkerType = (title: string) => {
      prisma.needAWorkerType.findUnique.mockResolvedValue({
        title,
        status: CategoryStatus.ACTIVE,
      });
      prisma.needAWorker.create.mockResolvedValue({
        id: 'post',
        location: 'Toronto',
        isUrgentRequest: true,
        workerType: { title },
      });
    };

    it('should fan out to workers whose service matches the worker type title', async () => {
      mockWorkerType('Construction Worker');

      await needAWorkerService.createNeedAWorker('requester', dto, []);

      expect(notificationQueue.queueFanoutNotification).toHaveBeenCalledWith({
        audience: { kind: 'WORKER_SERVICE', service: 'CONSTRUCTION_WORKER' },
        excludeUserIds: ['requester'],
        notification: {
          type: NotificationType.NEED_A_WORKER_POSTED,
          actorId: 'requester',
          title: 'Urgent Work Request',
          body: 'Construction Worker needed in Toronto.',
          referenceIds: { workRequestId: 'post' },
        },
      });
    });

    it('should not fan out when the worker type title matches no service', async () => {
      mockWorkerType('Ac Technician');

      await needAWorkerService.createNeedAWorker('requester', dto, []);

      expect(notificationQueue.queueFanoutNotification).not.toHaveBeenCalled();
    });
  });

  describe('applyOnNeedAWorkerPost', () => {
    it('should notify the requester about the application', async () => {
      prisma.needAWorker.findUnique.mockResolvedValue({
        id: 'post',
        ...workRequest,
      });
      prisma.needAWorkerApplication.findUnique.mockResolvedValue(null);
      prisma.needAWorkerApplication.create.mockResolvedValue({
        id: 'application',
      });

      await needAWorkerService.applyOnNeedAWorkerPost(worker, 'post', {});

      expect(notificationQueue.queueNotification).toHaveBeenCalledWith({
        type: NotificationType.WORKER_APPLICATION_RECEIVED,
        recipientId: 'requester',
        actorId: 'worker',
        title: 'New Application',
        body: 'John Doe applied for your Construction Worker request.',
        referenceIds: {
          workRequestId: 'post',
          needAWorkerAppId: 'application',
        },
      });
    });
  });

  describe('withdrawNeedAWorkerApplication', () => {
    it('should notify the requester about the withdrawal', async () => {
      prisma.needAWorkerApplication.findUnique.mockResolvedValue(
        pendingApplication,
      );

      await needAWorkerService.withdrawNeedAWorkerApplication(
        worker,
        'application',
      );

      expect(notificationQueue.queueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.WORKER_APPLICATION_WITHDRAWN,
          recipientId: 'requester',
          body: 'John Doe withdrew their application for your Construction Worker request.',
        }),
      );
    });
  });

  describe('acceptWorkerApplication', () => {
    it('should notify the accepted worker and every auto-rejected worker', async () => {
      prisma.needAWorkerApplication.findUnique.mockResolvedValue(
        pendingApplication,
      );
      prisma.needAWorkerApplication.findMany.mockResolvedValue([
        { id: 'other-application', workerId: 'other-worker' },
      ]);

      await needAWorkerService.acceptWorkerApplication(
        'requester',
        'application',
      );

      const notifications = notificationQueue.queueNotification.mock.calls.map(
        ([params]) => [params.type, params.recipientId, params.body],
      );
      expect(notifications).toEqual([
        [
          NotificationType.WORKER_APPLICATION_ACCEPTED,
          'worker',
          'Your application for the Construction Worker request was accepted.',
        ],
        [
          NotificationType.WORKER_APPLICATION_REJECTED,
          'other-worker',
          'The Construction Worker request you applied for has been filled.',
        ],
      ]);
    });
  });

  describe('rejectWorkerApplication', () => {
    it('should notify the rejected worker', async () => {
      prisma.needAWorkerApplication.findUnique.mockResolvedValue(
        pendingApplication,
      );

      await needAWorkerService.rejectWorkerApplication(
        'requester',
        'application',
      );

      expect(notificationQueue.queueNotification).toHaveBeenCalledWith({
        type: NotificationType.WORKER_APPLICATION_REJECTED,
        recipientId: 'worker',
        actorId: 'requester',
        title: 'Application Rejected',
        body: 'Your application for the Construction Worker request was rejected.',
        referenceIds: {
          workRequestId: 'post',
          needAWorkerAppId: 'application',
        },
      });
    });
  });
});
