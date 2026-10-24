import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '@libs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { GetCommentsQueryDto } from './dto/get-comments-query.dto';
import { GetMyCommentsQueryDto } from './dto/get-my-comments-query.dto';
import {
  CommunityPostStatus,
  CommunityPostVisibility,
  CommunityGroupMemberStatus,
  NotificationType,
} from '@generated/prisma';
import { NotificationQueueService } from '../../../notification/notification-queue.service';
import { BlockService } from '../../../moderation/block.service';

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationQueue: NotificationQueueService,
    private readonly blockService: BlockService,
  ) {}

  async createComment(user: any, dto: CreateCommentDto) {
    const userId = user.id;
    const { postId, content, parentId } = dto;

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
          'You must be an active member of this group to comment on this post',
        );
      }
    }

    const parentComment = parentId
      ? await this.prisma.communityPostComment.findUnique({
          where: { id: parentId },
        })
      : null;

    if (parentId && (!parentComment || parentComment.postId !== postId)) {
      throw new NotFoundException('Parent comment not found in this post');
    }

    try {
      const comment = await this.prisma.$transaction(async (tx) => {
        const newComment = await tx.communityPostComment.create({
          data: {
            content,
            postId,
            userId,
            parentId: parentId || null,
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhoto: { select: { url: true } },
              },
            },
          },
        });

        await tx.communityPost.update({
          where: { id: postId },
          data: { commentsCount: { increment: 1 } },
        });

        return newComment;
      });

      if (parentComment && parentComment.userId !== userId) {
        await this.notificationQueue.queueNotification({
          type: NotificationType.COMMENT_REPLIED,
          recipientId: parentComment.userId,
          actorId: userId,
          title: 'New Reply to Your Comment',
          body: `${user.firstName} ${user.lastName} replied to your comment.`,
          referenceIds: { postId, commentId: comment.id },
          data: { parentCommentId: parentComment.id },
        });
      }

      if (post.authorId !== userId && post.authorId !== parentComment?.userId) {
        await this.notificationQueue.queueNotification({
          type: NotificationType.POST_COMMENTED,
          recipientId: post.authorId,
          actorId: userId,
          title: 'New Comment on Your Post',
          body: `${user.firstName} ${user.lastName} commented on your post.`,
          referenceIds: { postId, commentId: comment.id },
        });
      }

      return {
        message: 'Your comment is posted',
        data: comment,
      };
    } catch (error) {
      this.logger.error(`Error creating comment: ${error.message}`);
      throw new InternalServerErrorException('Failed to create comment');
    }
  }

  async getMyComments(userId: string, query: GetMyCommentsQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where = { userId };

    try {
      const [count, comments] = await Promise.all([
        this.prisma.communityPostComment.count({ where }),
        this.prisma.communityPostComment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            post: {
              select: {
                id: true,
                type: true,
                content: true,
                author: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    profilePhoto: {
                      select: { url: true },
                    },
                  },
                },
              },
            },
            _count: {
              select: { replies: true },
            },
          },
        }),
      ]);

      return {
        data: comments.map(({ _count, ...rest }) => ({
          ...rest,
          repliesCount: _count.replies,
        })),
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching user comments: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch user comments');
    }
  }

  async getComments(
    userId: string,
    postId: string,
    query: GetCommentsQueryDto,
  ) {
    const { page = 1, limit = 10, parentId } = query;
    const skip = (page - 1) * limit;

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
          'You must be an active member of this group to view comments',
        );
      }
    }

    const blockedUserIds = await this.blockService.getBlockedUserIds(userId);

    const where: any = { postId, userId: { notIn: blockedUserIds } };

    if (parentId) {
      where.parentId = parentId;
    } else {
      where.parentId = null;
    }

    try {
      const [count, comments] = await Promise.all([
        this.prisma.communityPostComment.count({ where }),
        this.prisma.communityPostComment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhoto: { select: { url: true } },
              },
            },
            _count: {
              select: { replies: true },
            },
          },
        }),
      ]);

      return {
        data: comments.map(({ _count, ...rest }) => {
          return {
            ...rest,
            repliesCount: _count.replies,
          };
        }),
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching comments: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch comments');
    }
  }

  async deleteComment(userId: string, commentId: string) {
    const comment = await this.prisma.communityPostComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.communityPostComment.delete({
          where: { id: commentId },
        });

        await tx.communityPost.update({
          where: { id: comment.postId },
          data: { commentsCount: { decrement: 1 } },
        });
      });

      await this.notificationQueue.queueDeleteNotification({
        referenceIds: { postId: comment.postId, commentId },
      });

      return { message: 'Comment deleted successfully' };
    } catch (error) {
      this.logger.error(`Error deleting comment: ${error.message}`);
      throw new InternalServerErrorException('Failed to delete comment');
    }
  }
}
