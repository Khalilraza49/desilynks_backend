import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@libs/common';
import { Prisma, ReportTargetType } from '@generated/prisma';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createReport(userId: string, dto: CreateReportDto) {
    const reportedUserId = await this.findTargetOwnerId(
      userId,
      dto.targetType,
      dto.targetId,
    );

    if (reportedUserId === userId) {
      throw new BadRequestException('You cannot report your own content');
    }

    try {
      const report = await this.prisma.report.create({
        data: {
          reporterId: userId,
          reportedUserId,
          targetType: dto.targetType,
          targetId: dto.targetId,
          reason: dto.reason,
          details: dto.details,
        },
      });

      return {
        message: 'Report submitted successfully',
        data: { id: report.id, status: report.status },
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('You have already reported this');
      }

      this.logger.error(`Error creating report: ${error.message}`);
      throw new InternalServerErrorException('Failed to submit report');
    }
  }

  private async findTargetOwnerId(
    userId: string,
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<string | null> {
    switch (targetType) {
      case ReportTargetType.USER: {
        const user = await this.prisma.user.findUnique({
          where: { id: targetId },
          select: { id: true, deletedAt: true },
        });
        if (!user || user.deletedAt) break;
        return user.id;
      }
      case ReportTargetType.COMMUNITY_POST: {
        const post = await this.prisma.communityPost.findUnique({
          where: { id: targetId },
          select: { authorId: true },
        });
        if (!post) break;
        return post.authorId;
      }
      case ReportTargetType.COMMUNITY_COMMENT: {
        const comment = await this.prisma.communityPostComment.findUnique({
          where: { id: targetId },
          select: { userId: true },
        });
        if (!comment) break;
        return comment.userId;
      }
      case ReportTargetType.COMMUNITY_GROUP: {
        const group = await this.prisma.communityGroup.findUnique({
          where: { id: targetId },
          select: { creatorId: true },
        });
        if (!group) break;
        return group.creatorId;
      }
      case ReportTargetType.COMMUNITY_EVENT: {
        const event = await this.prisma.communityEvent.findUnique({
          where: { id: targetId },
          select: { organizerUserId: true },
        });
        if (!event) break;
        return event.organizerUserId;
      }
      case ReportTargetType.MESSAGE: {
        const message = await this.prisma.message.findUnique({
          where: { id: targetId },
          select: {
            senderId: true,
            conversation: {
              select: { participantOneId: true, participantTwoId: true },
            },
          },
        });
        if (
          !message ||
          (message.conversation.participantOneId !== userId &&
            message.conversation.participantTwoId !== userId)
        ) {
          break;
        }
        return message.senderId;
      }
      case ReportTargetType.PRODUCT_AD: {
        const productAd = await this.prisma.productAd.findUnique({
          where: { id: targetId },
          select: { sellerId: true },
        });
        if (!productAd) break;
        return productAd.sellerId;
      }
      case ReportTargetType.PROPERTY: {
        const property = await this.prisma.property.findUnique({
          where: { id: targetId },
          select: { ownerId: true },
        });
        if (!property) break;
        return property.ownerId;
      }
      case ReportTargetType.JOB: {
        const job = await this.prisma.job.findUnique({
          where: { id: targetId },
          select: { employerId: true },
        });
        if (!job) break;
        return job.employerId;
      }
      case ReportTargetType.BUSINESS_LISTING: {
        const businessListing = await this.prisma.businessListing.findUnique({
          where: { id: targetId },
          select: { ownerId: true },
        });
        if (!businessListing) break;
        return businessListing.ownerId;
      }
      case ReportTargetType.NEED_A_WORKER: {
        const needAWorker = await this.prisma.needAWorker.findUnique({
          where: { id: targetId },
          select: { requesterId: true },
        });
        if (!needAWorker) break;
        return needAWorker.requesterId;
      }
      case ReportTargetType.WORKER_PROFILE: {
        const workerProfile = await this.prisma.workerProfile.findUnique({
          where: { id: targetId },
          select: { workerId: true },
        });
        if (!workerProfile) break;
        return workerProfile.workerId;
      }
      case ReportTargetType.BANNER_AD: {
        const bannerAd = await this.prisma.bannerAd.findUnique({
          where: { id: targetId },
          select: { creatorId: true },
        });
        if (!bannerAd) break;
        return bannerAd.creatorId;
      }
    }

    throw new NotFoundException('Reported content not found');
  }
}
