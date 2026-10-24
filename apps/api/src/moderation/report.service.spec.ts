import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@libs/common';
import { Prisma, ReportReason, ReportTargetType } from '@generated/prisma';
import { ReportService } from './report.service';

describe('ReportService', () => {
  let reportService: ReportService;
  let prisma: {
    communityPost: { findUnique: jest.Mock };
    message: { findUnique: jest.Mock };
    report: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      communityPost: { findUnique: jest.fn() },
      message: { findUnique: jest.fn() },
      report: { create: jest.fn() },
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [ReportService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    reportService = app.get<ReportService>(ReportService);
  });

  const reportPost = () =>
    reportService.createReport('reporter', {
      targetType: ReportTargetType.COMMUNITY_POST,
      targetId: 'post-1',
      reason: ReportReason.SPAM,
    });

  it('should store the owner of the reported content', async () => {
    prisma.communityPost.findUnique.mockResolvedValue({ authorId: 'author' });
    prisma.report.create.mockResolvedValue({
      id: 'report-1',
      status: 'PENDING',
    });

    await reportPost();

    expect(prisma.report.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reporterId: 'reporter',
        reportedUserId: 'author',
        targetType: ReportTargetType.COMMUNITY_POST,
        targetId: 'post-1',
      }),
    });
  });

  it('should not allow reporting your own content', async () => {
    prisma.communityPost.findUnique.mockResolvedValue({ authorId: 'reporter' });

    await expect(reportPost()).rejects.toThrow(BadRequestException);
    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it('should reject a report for content that does not exist', async () => {
    prisma.communityPost.findUnique.mockResolvedValue(null);

    await expect(reportPost()).rejects.toThrow(NotFoundException);
  });

  it('should only let conversation participants report a message', async () => {
    prisma.message.findUnique.mockResolvedValue({
      senderId: 'sender',
      conversation: { participantOneId: 'sender', participantTwoId: 'other' },
    });

    await expect(
      reportService.createReport('reporter', {
        targetType: ReportTargetType.MESSAGE,
        targetId: 'message-1',
        reason: ReportReason.HARASSMENT,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject a duplicate report', async () => {
    prisma.communityPost.findUnique.mockResolvedValue({ authorId: 'author' });
    prisma.report.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(reportPost()).rejects.toThrow(ConflictException);
  });
});
