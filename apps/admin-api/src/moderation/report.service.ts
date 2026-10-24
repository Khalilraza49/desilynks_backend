import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentRemovalService, PrismaService } from '@libs/common';
import {
  CommunityGroupStatus,
  CommunityPostStatus,
  Prisma,
  ReportStatus,
  ReportTargetType,
} from '@generated/prisma';
import { GetReportsQueryDto } from './dto/get-reports-query.dto';
import { ActionReportDto } from './dto/action-report.dto';
import { UserModerationService } from './user-moderation.service';

const personSelect = {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    profilePhoto: { select: { url: true } },
  },
};

const mediaSelect = { select: { url: true } };

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentRemoval: ContentRemovalService,
    private readonly userModerationService: UserModerationService,
  ) {}

  async getReports(query: GetReportsQueryDto) {
    const { page = 1, limit = 20, status, targetType, reason } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ReportWhereInput = {
      ...(status && { status }),
      ...(targetType && { targetType }),
      ...(reason && { reason }),
    };

    const [reports, count] = await Promise.all([
      this.prisma.report.findMany({
        where,
        include: {
          reporter: personSelect,
          reportedUser: personSelect,
          reviewedByAdmin: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      data: reports,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getReportById(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        reporter: personSelect,
        reportedUser: personSelect,
        reviewedByAdmin: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const target = await this.getTarget(report.targetType, report.targetId);

    return { data: { ...report, target } };
  }

  async dismissReport(adminId: string, id: string) {
    await this.findPendingReport(id);

    const report = await this.prisma.report.update({
      where: { id },
      data: {
        status: ReportStatus.DISMISSED,
        reviewedByAdminId: adminId,
        reviewedAt: new Date(),
      },
    });

    return {
      message: 'Report dismissed successfully',
      data: report,
    };
  }

  async actionReport(adminId: string, id: string, dto: ActionReportDto) {
    const report = await this.findPendingReport(id);

    await this.removeTarget(report.targetType, report.targetId);

    if (
      dto.suspendUser &&
      report.reportedUserId &&
      report.targetType !== ReportTargetType.USER
    ) {
      await this.userModerationService.suspendUser(report.reportedUserId);
    }

    await this.prisma.report.updateMany({
      where: {
        targetType: report.targetType,
        targetId: report.targetId,
        status: ReportStatus.PENDING,
      },
      data: {
        status: ReportStatus.ACTIONED,
        reviewedByAdminId: adminId,
        reviewedAt: new Date(),
      },
    });

    return {
      message: 'Report actioned successfully',
    };
  }

  private async findPendingReport(id: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.status !== ReportStatus.PENDING) {
      throw new BadRequestException('Report has already been reviewed');
    }

    return report;
  }

  private async removeTarget(targetType: ReportTargetType, targetId: string) {
    switch (targetType) {
      case ReportTargetType.USER:
        await this.userModerationService.suspendUser(targetId);
        return;
      case ReportTargetType.COMMUNITY_POST:
        await this.prisma.communityPost.updateMany({
          where: { id: targetId },
          data: { status: CommunityPostStatus.REMOVED },
        });
        return;
      case ReportTargetType.COMMUNITY_COMMENT:
        await this.removeComment(targetId);
        return;
      case ReportTargetType.COMMUNITY_GROUP:
        await this.prisma.communityGroup.updateMany({
          where: { id: targetId },
          data: { status: CommunityGroupStatus.SUSPENDED },
        });
        return;
      case ReportTargetType.COMMUNITY_EVENT:
        await this.contentRemoval.removeCommunityEvents([targetId]);
        return;
      case ReportTargetType.MESSAGE:
        await this.prisma.message.updateMany({
          where: { id: targetId },
          data: { isDeleted: true, content: '', deletedAt: new Date() },
        });
        return;
      case ReportTargetType.PRODUCT_AD:
        await this.contentRemoval.removeProductAds([targetId]);
        return;
      case ReportTargetType.PROPERTY:
        await this.contentRemoval.removeProperties([targetId]);
        return;
      case ReportTargetType.JOB:
        await this.contentRemoval.removeJobs([targetId]);
        return;
      case ReportTargetType.BUSINESS_LISTING:
        await this.contentRemoval.removeBusinessListings([targetId]);
        return;
      case ReportTargetType.NEED_A_WORKER:
        await this.contentRemoval.removeNeedAWorkerPosts([targetId]);
        return;
      case ReportTargetType.WORKER_PROFILE:
        await this.contentRemoval.removeWorkerProfiles([targetId]);
        return;
      case ReportTargetType.BANNER_AD:
        await this.contentRemoval.removeBannerAds([targetId]);
        return;
    }
  }

  private async removeComment(commentId: string) {
    const comment = await this.prisma.communityPostComment.findUnique({
      where: { id: commentId },
      select: { postId: true },
    });

    if (!comment) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.communityPostComment.delete({ where: { id: commentId } });

      const commentsCount = await tx.communityPostComment.count({
        where: { postId: comment.postId },
      });

      await tx.communityPost.update({
        where: { id: comment.postId },
        data: { commentsCount },
      });
    });

    await this.prisma.notification.deleteMany({ where: { commentId } });
  }

  private getTarget(targetType: ReportTargetType, targetId: string) {
    const where = { id: targetId };

    switch (targetType) {
      case ReportTargetType.USER:
        return this.prisma.user.findUnique({
          where,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            status: true,
            deletedAt: true,
            createdAt: true,
            profilePhoto: mediaSelect,
          },
        });
      case ReportTargetType.COMMUNITY_POST:
        return this.prisma.communityPost.findUnique({
          where,
          select: {
            id: true,
            type: true,
            visibility: true,
            status: true,
            content: true,
            createdAt: true,
            photos: mediaSelect,
            video: mediaSelect,
            author: personSelect,
          },
        });
      case ReportTargetType.COMMUNITY_COMMENT:
        return this.prisma.communityPostComment.findUnique({
          where,
          select: {
            id: true,
            content: true,
            postId: true,
            createdAt: true,
            user: personSelect,
          },
        });
      case ReportTargetType.COMMUNITY_GROUP:
        return this.prisma.communityGroup.findUnique({
          where,
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            privacy: true,
            coverPhoto: mediaSelect,
            creator: personSelect,
          },
        });
      case ReportTargetType.COMMUNITY_EVENT:
        return this.prisma.communityEvent.findUnique({
          where,
          select: {
            id: true,
            name: true,
            description: true,
            location: true,
            startDate: true,
            banner: mediaSelect,
            organizerUser: personSelect,
          },
        });
      case ReportTargetType.MESSAGE:
        return this.prisma.message.findUnique({
          where,
          select: {
            id: true,
            content: true,
            isDeleted: true,
            createdAt: true,
            sender: personSelect,
          },
        });
      case ReportTargetType.PRODUCT_AD:
        return this.prisma.productAd.findUnique({
          where,
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            price: true,
            photos: mediaSelect,
            video: mediaSelect,
            seller: personSelect,
          },
        });
      case ReportTargetType.PROPERTY:
        return this.prisma.property.findUnique({
          where,
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            location: true,
            propertyPhotos: mediaSelect,
            owner: personSelect,
          },
        });
      case ReportTargetType.JOB:
        return this.prisma.job.findUnique({
          where,
          select: {
            id: true,
            title: true,
            companyName: true,
            description: true,
            status: true,
            poster: mediaSelect,
            employer: personSelect,
          },
        });
      case ReportTargetType.BUSINESS_LISTING:
        return this.prisma.businessListing.findUnique({
          where,
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            phone: true,
            coverPhoto: mediaSelect,
            owner: personSelect,
          },
        });
      case ReportTargetType.NEED_A_WORKER:
        return this.prisma.needAWorker.findUnique({
          where,
          select: {
            id: true,
            description: true,
            location: true,
            referencePhotos: mediaSelect,
            requester: personSelect,
          },
        });
      case ReportTargetType.WORKER_PROFILE:
        return this.prisma.workerProfile.findUnique({
          where,
          select: {
            id: true,
            service: true,
            about: true,
            areaCovered: true,
            profilePhoto: mediaSelect,
            workPhotos: mediaSelect,
            certificates: mediaSelect,
            worker: personSelect,
          },
        });
      case ReportTargetType.BANNER_AD:
        return this.prisma.bannerAd.findUnique({
          where,
          select: {
            id: true,
            title: true,
            description: true,
            destinationLink: true,
            status: true,
            photo: mediaSelect,
            creator: personSelect,
          },
        });
    }
  }
}
