import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@libs/common';
import {
  CommunityPostStatus,
  CommunityPostVisibility,
  NotificationType,
} from '@generated/prisma';
import { CommentService } from './comment.service';
import { NotificationQueueService } from '../../../notification/notification-queue.service';
import { BlockService } from '../../../moderation/block.service';

describe('CommentService', () => {
  let commentService: CommentService;
  let prisma: {
    communityPost: { findUnique: jest.Mock };
    communityPostComment: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: {
    communityPostComment: { create: jest.Mock; delete: jest.Mock };
    communityPost: { update: jest.Mock };
  };
  let notificationQueue: {
    queueNotification: jest.Mock;
    queueDeleteNotification: jest.Mock;
  };

  const user = { id: 'commenter', firstName: 'John', lastName: 'Doe' };

  beforeEach(async () => {
    tx = {
      communityPostComment: {
        create: jest.fn().mockResolvedValue({ id: 'new-comment' }),
        delete: jest.fn().mockResolvedValue({}),
      },
      communityPost: { update: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      communityPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'post',
          authorId: 'post-author',
          status: CommunityPostStatus.ACTIVE,
          visibility: CommunityPostVisibility.PUBLIC,
        }),
      },
      communityPostComment: { findUnique: jest.fn() },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    notificationQueue = {
      queueNotification: jest.fn().mockResolvedValue(undefined),
      queueDeleteNotification: jest.fn().mockResolvedValue(undefined),
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        { provide: PrismaService, useValue: prisma },
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

    commentService = app.get<CommentService>(CommentService);
  });

  describe('createComment', () => {
    it('should notify the post author about a top-level comment', async () => {
      await commentService.createComment(user, {
        postId: 'post',
        content: 'Nice post',
      });

      expect(notificationQueue.queueNotification).toHaveBeenCalledTimes(1);
      expect(notificationQueue.queueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.POST_COMMENTED,
          recipientId: 'post-author',
          actorId: 'commenter',
          referenceIds: { postId: 'post', commentId: 'new-comment' },
        }),
      );
    });

    it('should notify the parent comment author and the post author about a reply', async () => {
      prisma.communityPostComment.findUnique.mockResolvedValue({
        id: 'parent',
        postId: 'post',
        userId: 'parent-author',
      });

      await commentService.createComment(user, {
        postId: 'post',
        content: 'Agreed',
        parentId: 'parent',
      });

      const notifications = notificationQueue.queueNotification.mock.calls.map(
        ([params]) => [params.type, params.recipientId],
      );
      expect(notifications).toEqual([
        [NotificationType.COMMENT_REPLIED, 'parent-author'],
        [NotificationType.POST_COMMENTED, 'post-author'],
      ]);
    });

    it('should notify the post author only once when replying to their comment', async () => {
      prisma.communityPostComment.findUnique.mockResolvedValue({
        id: 'parent',
        postId: 'post',
        userId: 'post-author',
      });

      await commentService.createComment(user, {
        postId: 'post',
        content: 'Agreed',
        parentId: 'parent',
      });

      expect(notificationQueue.queueNotification).toHaveBeenCalledTimes(1);
      expect(notificationQueue.queueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.COMMENT_REPLIED,
          recipientId: 'post-author',
        }),
      );
    });

    it('should not notify the author about their own comment', async () => {
      await commentService.createComment(
        { ...user, id: 'post-author' },
        { postId: 'post', content: 'Thanks everyone' },
      );

      expect(notificationQueue.queueNotification).not.toHaveBeenCalled();
    });
  });

  describe('deleteComment', () => {
    it('should delete the notifications of the comment', async () => {
      prisma.communityPostComment.findUnique.mockResolvedValue({
        id: 'comment',
        postId: 'post',
        userId: 'commenter',
      });

      await commentService.deleteComment('commenter', 'comment');

      expect(notificationQueue.queueDeleteNotification).toHaveBeenCalledWith({
        referenceIds: { postId: 'post', commentId: 'comment' },
      });
    });
  });
});
