import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService, RedisService, userPresenceKey } from '@libs/common';
import { MessageStatus } from '@generated/prisma';
import { BlockService } from '../moderation/block.service';

const PRESENCE_TTL_SECONDS = 86400;
const MESSAGE_RATE_LIMIT = 20;
const MESSAGE_RATE_WINDOW_MS = 10 * 1000;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly blockService: BlockService,
  ) {}

  async findOrCreateConversation(userOneId: string, userTwoId: string) {
    if (userOneId === userTwoId) {
      throw new BadRequestException(
        'Cannot create a conversation with yourself',
      );
    }

    const [participantOneId, participantTwoId] =
      userOneId < userTwoId ? [userOneId, userTwoId] : [userTwoId, userOneId];

    let conversation = await this.prisma.conversation.findUnique({
      where: {
        participantOneId_participantTwoId: {
          participantOneId,
          participantTwoId,
        },
      },
    });

    if (!conversation) {
      const [userOne, userTwo] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: participantOneId } }),
        this.prisma.user.findUnique({ where: { id: participantTwoId } }),
      ]);

      if (!userOne || !userTwo) {
        throw new NotFoundException('One or both users not found');
      }

      conversation = await this.prisma.conversation.create({
        data: { participantOneId, participantTwoId },
      });
    }

    return conversation;
  }

  async sendMessage(senderId: string, receiverId: string, content: string) {
    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverId },
      select: { deletedAt: true },
    });

    if (!receiver || receiver.deletedAt) {
      throw new NotFoundException('This user is no longer available');
    }

    if (await this.blockService.isBlockedBetween(senderId, receiverId)) {
      throw new ForbiddenException('You cannot message this user');
    }

    const conversation = await this.findOrCreateConversation(
      senderId,
      receiverId,
    );

    if (conversation.isDeletedByOne || conversation.isDeletedByTwo) {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { isDeletedByOne: false, isDeletedByTwo: false },
      });
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        content,
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: { select: { url: true } },
          },
        },
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageId: message.id },
    });

    return {
      message,
      conversationId: conversation.id,
      receiverId,
    };
  }

  async getConversations(userId: string) {
    const blockedUserIds = await this.blockService.getBlockedUserIds(userId);

    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [
          {
            participantOneId: userId,
            isDeletedByOne: false,
            participantTwoId: { notIn: blockedUserIds },
          },
          {
            participantTwoId: userId,
            isDeletedByTwo: false,
            participantOneId: { notIn: blockedUserIds },
          },
        ],
      },
      include: {
        participantOne: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: { select: { url: true } },
          },
        },
        participantTwo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: { select: { url: true } },
          },
        },
        lastMessage: {
          select: {
            id: true,
            content: true,
            senderId: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return conversations.map((conv) => {
      const otherParticipant =
        conv.participantOneId === userId
          ? conv.participantTwo
          : conv.participantOne;

      return {
        id: conv.id,
        otherParticipant,
        lastMessage: conv.lastMessage,
        updatedAt: conv.updatedAt,
        createdAt: conv.createdAt,
      };
    });
  }

  async getMessages(
    userId: string,
    conversationId: string,
    cursor?: string,
    limit: number = 30,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (
      conversation.participantOneId !== userId &&
      conversation.participantTwoId !== userId
    ) {
      throw new ForbiddenException(
        'You are not a participant of this conversation',
      );
    }

    let cursorFilter = {};
    if (cursor) {
      const cursorMessage = await this.prisma.message.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      });

      if (cursorMessage) {
        cursorFilter = { createdAt: { lt: cursorMessage.createdAt } };
      }
    }

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        isDeleted: false,
        ...cursorFilter,
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: { select: { url: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const results = hasMore ? messages.slice(0, limit) : messages;

    return {
      messages: results,
      hasMore,
      nextCursor: hasMore ? results[results.length - 1].id : null,
    };
  }

  async markAsRead(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (
      conversation.participantOneId !== userId &&
      conversation.participantTwoId !== userId
    ) {
      throw new ForbiddenException(
        'You are not a participant of this conversation',
      );
    }

    const result = await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        status: { not: MessageStatus.READ },
      },
      data: { status: MessageStatus.READ },
    });

    const otherUserId =
      conversation.participantOneId === userId
        ? conversation.participantTwoId
        : conversation.participantOneId;

    return {
      conversationId,
      readBy: userId,
      otherUserId,
      count: result.count,
    };
  }

  async deleteConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isParticipantOne = conversation.participantOneId === userId;
    const isParticipantTwo = conversation.participantTwoId === userId;

    if (!isParticipantOne && !isParticipantTwo) {
      throw new ForbiddenException(
        'You are not a participant of this conversation',
      );
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        ...(isParticipantOne ? { isDeletedByOne: true } : {}),
        ...(isParticipantTwo ? { isDeletedByTwo: true } : {}),
      },
    });

    return { message: 'Conversation deleted successfully' };
  }

  async deleteMessage(
    userId: string,
    messageId: string,
    scope: 'FOR_ME' | 'FOR_EVERYONE',
  ) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const conversation = message.conversation;
    if (
      conversation.participantOneId !== userId &&
      conversation.participantTwoId !== userId
    ) {
      throw new ForbiddenException(
        'You are not a participant of this conversation',
      );
    }

    if (scope === 'FOR_EVERYONE') {
      if (message.senderId !== userId) {
        throw new ForbiddenException(
          'You can only delete your own messages for everyone',
        );
      }

      await this.prisma.message.update({
        where: { id: messageId },
        data: {
          isDeleted: true,
          content: '',
          deletedAt: new Date(),
        },
      });

      const otherUserId =
        conversation.participantOneId === userId
          ? conversation.participantTwoId
          : conversation.participantOneId;

      return {
        messageId,
        conversationId: conversation.id,
        scope: 'FOR_EVERYONE',
        otherUserId,
      };
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    return {
      messageId,
      conversationId: conversation.id,
      scope: 'FOR_ME',
    };
  }

  async setUserOnline(userId: string, socketId: string): Promise<void> {
    await this.redis.sadd(userPresenceKey(userId), socketId);
    await this.redis.expire(userPresenceKey(userId), PRESENCE_TTL_SECONDS);
  }

  async setUserOffline(userId: string, socketId: string): Promise<void> {
    await this.redis.srem(userPresenceKey(userId), socketId);
  }

  async isUserOnline(userId: string): Promise<boolean> {
    return this.redis.exists(userPresenceKey(userId));
  }

  async isMessageRateLimited(userId: string): Promise<boolean> {
    const { count } = await this.redis.incrementWithTtl(
      `chat:message-rate:${userId}`,
      MESSAGE_RATE_WINDOW_MS,
    );

    return count > MESSAGE_RATE_LIMIT;
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.message.count({
      where: {
        conversation: {
          OR: [{ participantOneId: userId }, { participantTwoId: userId }],
        },
        senderId: { not: userId },
        status: { not: MessageStatus.READ },
        isDeleted: false,
      },
    });
  }
}
