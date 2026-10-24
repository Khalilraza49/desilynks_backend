import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ContentRemovalService, PrismaService } from '@libs/common';
import {
  CommunityPostStatus,
  ReportStatus,
  ReportTargetType,
} from '@generated/prisma';
import { ReportService } from './report.service';
import { UserModerationService } from './user-moderation.service';

describe('ReportService (admin)', () => {
  let reportService: ReportService;
  let prisma: {
    report: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    communityPost: { updateMany: jest.Mock };
  };
  let contentRemoval: { removeProductAds: jest.Mock };
  let userModerationService: { suspendUser: jest.Mock };

  const pendingReport = (targetType: ReportTargetType) => ({
    id: 'report-1',
    status: ReportStatus.PENDING,
    targetType,
    targetId: 'target-1',
    reportedUserId: 'owner-1',
  });

  beforeEach(async () => {
    prisma = {
      report: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      communityPost: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    contentRemoval = {
      removeProductAds: jest.fn().mockResolvedValue(undefined),
    };
    userModerationService = {
      suspendUser: jest.fn().mockResolvedValue({}),
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: PrismaService, useValue: prisma },
        { provide: ContentRemovalService, useValue: contentRemoval },
        { provide: UserModerationService, useValue: userModerationService },
      ],
    }).compile();

    reportService = app.get<ReportService>(ReportService);
  });

  describe('actionReport', () => {
    it('should remove a reported post and close every pending report on it', async () => {
      prisma.report.findUnique.mockResolvedValue(
        pendingReport(ReportTargetType.COMMUNITY_POST),
      );

      await reportService.actionReport('admin-1', 'report-1', {});

      expect(prisma.communityPost.updateMany).toHaveBeenCalledWith({
        where: { id: 'target-1' },
        data: { status: CommunityPostStatus.REMOVED },
      });
      expect(prisma.report.updateMany).toHaveBeenCalledWith({
        where: {
          targetType: ReportTargetType.COMMUNITY_POST,
          targetId: 'target-1',
          status: ReportStatus.PENDING,
        },
        data: expect.objectContaining({
          status: ReportStatus.ACTIONED,
          reviewedByAdminId: 'admin-1',
        }),
      });
      expect(userModerationService.suspendUser).not.toHaveBeenCalled();
    });

    it('should remove a reported product ad and suspend its owner on request', async () => {
      prisma.report.findUnique.mockResolvedValue(
        pendingReport(ReportTargetType.PRODUCT_AD),
      );

      await reportService.actionReport('admin-1', 'report-1', {
        suspendUser: true,
      });

      expect(contentRemoval.removeProductAds).toHaveBeenCalledWith([
        'target-1',
      ]);
      expect(userModerationService.suspendUser).toHaveBeenCalledWith('owner-1');
    });

    it('should suspend a reported user', async () => {
      prisma.report.findUnique.mockResolvedValue(
        pendingReport(ReportTargetType.USER),
      );

      await reportService.actionReport('admin-1', 'report-1', {});

      expect(userModerationService.suspendUser).toHaveBeenCalledWith(
        'target-1',
      );
    });

    it('should not action a report that was already reviewed', async () => {
      prisma.report.findUnique.mockResolvedValue({
        ...pendingReport(ReportTargetType.PRODUCT_AD),
        status: ReportStatus.DISMISSED,
      });

      await expect(
        reportService.actionReport('admin-1', 'report-1', {}),
      ).rejects.toThrow(BadRequestException);
      expect(contentRemoval.removeProductAds).not.toHaveBeenCalled();
    });
  });

  describe('dismissReport', () => {
    it('should throw when the report does not exist', async () => {
      prisma.report.findUnique.mockResolvedValue(null);

      await expect(
        reportService.dismissReport('admin-1', 'missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should mark the report as dismissed', async () => {
      prisma.report.findUnique.mockResolvedValue(
        pendingReport(ReportTargetType.JOB),
      );

      await reportService.dismissReport('admin-1', 'report-1');

      expect(prisma.report.update).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        data: expect.objectContaining({
          status: ReportStatus.DISMISSED,
          reviewedByAdminId: 'admin-1',
        }),
      });
    });
  });
});
