import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@libs/common';
import {
  CommunityPostStatus,
  CommunityPostVisibility,
  CommunityGroupMemberStatus,
  NotificationType,
} from '@generated/prisma';
import { NotificationQueueService } from '../../../notification/notification-queue.service';

@Injectable()
export class InteractionService {
  private readonly logger = new Logger(InteractionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationQueue: NotificationQueueService,
  ) {}

  async likePost(user: any, postId: string) {
    const userId = user.id;
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
    });

    if (!post || post.status !== CommunityPostStatus.ACTIVE) {
      throw new NotFoundException('Post not found');
    }

    if (
      post.visibility === CommunityPostVisibility.PRIVATE &&
      post.authorId !== userId
    ) {
      throw new NotFoundException('Post not found');
    }

    if (post.visibility === CommunityPostVisibility.GROUP) {
      const member = await this.prisma.communityGroupMember.findUnique({
        where: {
          groupId_userId: { groupId: post.groupId!, userId },
        },
      });

      if (!member || member.status !== CommunityGroupMemberStatus.ACTIVE) {
        throw new ForbiddenException(
          'You must be an active member of this group to like this post',
        );
      }
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const existingLike = await tx.communityPostLike.findUnique({
          where: { postId_userId: { postId, userId } },
        });

        if (existingLike) {
          throw new BadRequestException('You have already liked this post');
        }

        await tx.communityPostLike.create({
          data: { postId, userId },
        });

        await tx.communityPost.update({
          where: { id: postId },
          data: { likesCount: { increment: 1 } },
        });
      });

      if (user && post.authorId !== userId) {
        await this.notificationQueue.queueNotification({
          type: NotificationType.POST_LIKED,
          recipientId: post.authorId,
          actorId: userId,
          title: 'New Like on Your Post',
          body: `${user.firstName} ${user.lastName} liked your post.`,
          referenceIds: { postId },
        });
      }

      return { message: 'Post liked successfully' };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error liking post: ${error.message}`);
      throw new InternalServerErrorException('Failed to like post');
    }
  }

  async unlikePost(user: any, postId: string) {
    const userId = user.id;
    try {
      await this.prisma.$transaction(async (tx) => {
        const existingLike = await tx.communityPostLike.findUnique({
          where: { postId_userId: { postId, userId } },
        });

        if (!existingLike) {
          throw new BadRequestException('You have not liked this post');
        }

        await tx.communityPostLike.delete({
          where: { postId_userId: { postId, userId } },
        });

        await tx.communityPost.update({
          where: { id: postId },
          data: { likesCount: { decrement: 1 } },
        });
      });

      const post = await this.prisma.communityPost.findUnique({
        where: { id: postId },
        select: { authorId: true },
      });

      if (post && post.authorId !== userId) {
        await this.notificationQueue.queueDeleteNotification({
          type: NotificationType.POST_LIKED,
          recipientId: post.authorId,
          actorId: userId,
          referenceIds: { postId },
        });
      }

      return { message: 'Post unliked successfully' };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error unliking post: ${error.message}`);
      throw new InternalServerErrorException('Failed to unlike post');
    }
  }

  async sharePost(user: any, postId: string) {
    const userId = user.id;
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
    });

    if (!post || post.status !== CommunityPostStatus.ACTIVE) {
      throw new NotFoundException('Post not found');
    }

    if (
      post.visibility === CommunityPostVisibility.PRIVATE &&
      post.authorId !== userId
    ) {
      throw new NotFoundException('Post not found');
    }

    if (post.visibility === CommunityPostVisibility.GROUP) {
      const member = await this.prisma.communityGroupMember.findUnique({
        where: {
          groupId_userId: { groupId: post.groupId!, userId },
        },
      });

      if (!member || member.status !== CommunityGroupMemberStatus.ACTIVE) {
        throw new ForbiddenException(
          'You must be an active member of this group to share this post',
        );
      }
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.communityPostShare.create({
          data: { postId, userId },
        });

        await tx.communityPost.update({
          where: { id: postId },
          data: { sharesCount: { increment: 1 } },
        });
      });

      if (user && post.authorId !== userId) {
        await this.notificationQueue.queueNotification({
          type: NotificationType.POST_SHARED,
          recipientId: post.authorId,
          actorId: userId,
          title: 'Your Post was Shared',
          body: `${user.firstName} ${user.lastName} shared your post.`,
          referenceIds: { postId },
        });
      }

      return { message: 'Post shared successfully' };
    } catch (error) {
      this.logger.error(`Error sharing post: ${error.message}`);
      throw new InternalServerErrorException('Failed to share post');
    }
  }
}
