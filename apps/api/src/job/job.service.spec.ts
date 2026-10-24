import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService, SearchService } from '@libs/common';
import { JobApplicationStatus, NotificationType } from '@generated/prisma';
import { JobService } from './job.service';
import { NotificationQueueService } from '../notification/notification-queue.service';

describe('JobService', () => {
  let jobService: JobService;
  let prisma: {
    job: { findUnique: jest.Mock };
    jobApplications: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let notificationQueue: { queueNotification: jest.Mock };

  const applicant = { id: 'applicant', firstName: 'John', lastName: 'Doe' };
  const job = { employerId: 'employer', title: 'Electrician' };

  beforeEach(async () => {
    prisma = {
      job: { findUnique: jest.fn() },
      jobApplications: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn(),
      },
    };
    notificationQueue = {
      queueNotification: jest.fn().mockResolvedValue(undefined),
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        JobService,
        { provide: PrismaService, useValue: prisma },
        { provide: SearchService, useValue: {} },
        { provide: NotificationQueueService, useValue: notificationQueue },
      ],
    }).compile();

    jobService = app.get<JobService>(JobService);
  });

  describe('applyForJob', () => {
    it('should notify the employer about the new application', async () => {
      prisma.job.findUnique.mockResolvedValue({
        id: 'job',
        status: 'OPEN',
        ...job,
      });
      prisma.jobApplications.findUnique.mockResolvedValue(null);
      prisma.jobApplications.create.mockResolvedValue({ id: 'application' });

      await jobService.applyForJob(applicant, 'job', {});

      expect(notificationQueue.queueNotification).toHaveBeenCalledWith({
        type: NotificationType.JOB_APPLICATION_RECEIVED,
        recipientId: 'employer',
        actorId: 'applicant',
        title: 'New Job Application',
        body: 'John Doe applied for Electrician.',
        referenceIds: { jobApplicationId: 'application' },
        data: { jobId: 'job' },
      });
    });
  });

  describe('updateApplicationStatus', () => {
    it('should notify the applicant when the status changes', async () => {
      prisma.jobApplications.findUnique.mockResolvedValue({
        id: 'application',
        jobId: 'job',
        applicantId: 'applicant',
        status: JobApplicationStatus.PENDING,
        job,
      });

      await jobService.updateApplicationStatus('employer', 'application', {
        status: JobApplicationStatus.SHORTLISTED,
      });

      expect(notificationQueue.queueNotification).toHaveBeenCalledWith({
        type: NotificationType.JOB_APPLICATION_STATUS_UPDATED,
        recipientId: 'applicant',
        actorId: 'employer',
        title: 'Application Status Updated',
        body: 'You have been shortlisted for Electrician.',
        referenceIds: { jobApplicationId: 'application' },
        data: { jobId: 'job', status: JobApplicationStatus.SHORTLISTED },
      });
    });

    it('should not notify when the status is unchanged', async () => {
      prisma.jobApplications.findUnique.mockResolvedValue({
        id: 'application',
        jobId: 'job',
        applicantId: 'applicant',
        status: JobApplicationStatus.SHORTLISTED,
        job,
      });

      await jobService.updateApplicationStatus('employer', 'application', {
        status: JobApplicationStatus.SHORTLISTED,
      });

      expect(notificationQueue.queueNotification).not.toHaveBeenCalled();
    });
  });

  describe('bulkUpdateApplicationStatus', () => {
    it('should notify each applicant whose status changed', async () => {
      prisma.jobApplications.findMany.mockResolvedValue([
        {
          id: 'application-1',
          jobId: 'job',
          applicantId: 'applicant-1',
          status: JobApplicationStatus.PENDING,
          job,
        },
        {
          id: 'application-2',
          jobId: 'job',
          applicantId: 'applicant-2',
          status: JobApplicationStatus.INTERVIEW,
          job,
        },
      ]);
      prisma.jobApplications.updateMany.mockResolvedValue({ count: 2 });

      await jobService.bulkUpdateApplicationStatus('employer', {
        applicationIds: ['application-1', 'application-2'],
        status: JobApplicationStatus.INTERVIEW,
      });

      expect(notificationQueue.queueNotification).toHaveBeenCalledTimes(1);
      expect(notificationQueue.queueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'applicant-1',
          body: 'You have been invited to interview for Electrician.',
          referenceIds: { jobApplicationId: 'application-1' },
        }),
      );
    });
  });

  describe('withDrawJobApplication', () => {
    it('should notify the employer about the withdrawal', async () => {
      prisma.jobApplications.findUnique.mockResolvedValue({
        id: 'application',
        jobId: 'job',
        applicantId: 'applicant',
        status: JobApplicationStatus.PENDING,
        job,
      });

      await jobService.withDrawJobApplication(applicant, 'application');

      expect(notificationQueue.queueNotification).toHaveBeenCalledWith({
        type: NotificationType.JOB_APPLICATION_WITHDRAWN,
        recipientId: 'employer',
        actorId: 'applicant',
        title: 'Application Withdrawn',
        body: 'John Doe withdrew their application for Electrician.',
        referenceIds: { jobApplicationId: 'application' },
        data: { jobId: 'job' },
      });
    });
  });
});
