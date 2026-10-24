import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import {
  Logger,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { PrismaService, RedisService } from '@libs/common';
import { UserStatus } from '@generated/prisma';
import { NotificationQueueService } from '../notification/notification-queue.service';
import { SendMessageDto } from './dto/send-message.dto';
import { DeleteMessageDto } from './dto/delete-message.dto';
import { MarkAsReadDto } from './dto/mark-as-read.dto';
import { TypingDto } from './dto/typing.dto';

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

interface AuthenticatedSocket extends Socket {
  userId: string;
  userName: string;
  sessionExpiryTimer?: NodeJS.Timeout;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notificationQueue: NotificationQueueService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      const payload = this.jwtService.verify<{ sub: string; exp: number }>(
        token,
        {
          secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        },
      );

      if (await this.redis.exists(`blacklist:${token}`)) {
        throw new UnauthorizedException('Token has been revoked');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          deletedAt: true,
        },
      });

      if (!user || user.deletedAt || user.status === UserStatus.SUSPENDED) {
        throw new UnauthorizedException('User not found');
      }

      client.userId = user.id;
      client.userName = `${user.firstName} ${user.lastName}`;
      client.sessionExpiryTimer = setTimeout(
        () => {
          client.emit('sessionExpired', {
            message: 'Session expired, reconnect with a fresh token',
          });
          client.disconnect(true);
        },
        Math.min(Math.max(payload.exp * 1000 - Date.now(), 0), MAX_TIMEOUT_MS),
      );

      client.join(`user:${user.id}`);

      await this.chatService.setUserOnline(user.id, client.id);

      this.logger.log(`User connected: ${user.firstName} (${client.id})`);
    } catch (error: any) {
      this.logger.error(`Connection rejected: ${error.message}`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    clearTimeout(client.sessionExpiryTimer);

    if (client.userId) {
      await this.chatService.setUserOffline(client.userId, client.id);
      this.logger.log(`User disconnected: ${client.userId} (${client.id})`);
    }
  }

  @UsePipes(new ValidationPipe())
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SendMessageDto,
  ) {
    try {
      const { receiverId, content } = data;

      if (receiverId === client.userId) {
        return {
          event: 'error',
          data: { message: 'Cannot send message to yourself' },
        };
      }

      if (await this.chatService.isMessageRateLimited(client.userId)) {
        return {
          event: 'error',
          data: { message: 'You are sending messages too quickly' },
        };
      }

      const result = await this.chatService.sendMessage(
        client.userId,
        receiverId,
        content.trim(),
      );

      const isReceiverOnline = await this.chatService.isUserOnline(receiverId);

      if (isReceiverOnline) {
        this.server.to(`user:${receiverId}`).emit('newMessage', {
          message: result.message,
          conversationId: result.conversationId,
        });
      } else {
        await this.notificationQueue.queueChatPush({
          receiverId,
          senderId: client.userId,
          senderName: client.userName,
          content: content.trim(),
          conversationId: result.conversationId,
          messageId: result.message.id,
        });
      }

      return {
        event: 'messageSent',
        data: {
          message: result.message,
          conversationId: result.conversationId,
        },
      };
    } catch (error: any) {
      this.logger.error(`sendMessage error: ${error.message}`);
      return { event: 'error', data: { message: error.message } };
    }
  }

  @UsePipes(new ValidationPipe())
  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: MarkAsReadDto,
  ) {
    try {
      const { conversationId } = data;

      const result = await this.chatService.markAsRead(
        client.userId,
        conversationId,
      );

      if (result.count > 0) {
        this.server.to(`user:${result.otherUserId}`).emit('messagesRead', {
          conversationId: result.conversationId,
          readBy: result.readBy,
        });
      }

      return { event: 'messagesMarkedAsRead', data: result };
    } catch (error: any) {
      this.logger.error(`markAsRead error: ${error.message}`);
      return { event: 'error', data: { message: error.message } };
    }
  }

  @UsePipes(new ValidationPipe())
  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TypingDto,
  ) {
    const { conversationId, receiverId } = data;

    this.server.to(`user:${receiverId}`).emit('userTyping', {
      conversationId,
      userId: client.userId,
    });
  }

  @UsePipes(new ValidationPipe())
  @SubscribeMessage('stopTyping')
  async handleStopTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TypingDto,
  ) {
    const { conversationId, receiverId } = data;

    this.server.to(`user:${receiverId}`).emit('userStopTyping', {
      conversationId,
      userId: client.userId,
    });
  }

  @UsePipes(new ValidationPipe())
  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: DeleteMessageDto,
  ) {
    try {
      const { messageId, scope } = data;

      const result = await this.chatService.deleteMessage(
        client.userId,
        messageId,
        scope,
      );

      if (scope === 'FOR_EVERYONE' && result.otherUserId) {
        this.server.to(`user:${result.otherUserId}`).emit('messageDeleted', {
          messageId: result.messageId,
          conversationId: result.conversationId,
        });
      }

      return { event: 'messageDeletedAck', data: result };
    } catch (error: any) {
      this.logger.error(`deleteMessage error: ${error.message}`);
      return { event: 'error', data: { message: error.message } };
    }
  }
}
