import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  RedisService,
  FirebaseService,
  FcmTokenService,
  NOTIFICATION_QUEUE_CHAT,
  NotificationJobName,
  SendChatPushJobData,
  userPresenceKey,
} from '@libs/common';
import { BadgeService } from '../services/badge.service';

@Processor(NOTIFICATION_QUEUE_CHAT, {
  concurrency: 10,
})
export class ChatNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(ChatNotificationProcessor.name);

  constructor(
    private readonly redis: RedisService,
    private readonly firebaseService: FirebaseService,
    private readonly fcmTokenService: FcmTokenService,
    private readonly badgeService: BadgeService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === NotificationJobName.SEND_CHAT_PUSH) {
      return this.handleChatPush(job.data as SendChatPushJobData);
    }

    this.logger.warn(`Unknown job name: ${job.name}`);
  }

  private async handleChatPush(data: SendChatPushJobData): Promise<void> {
    const isOnline = await this.redis.exists(userPresenceKey(data.receiverId));

    if (isOnline) return;

    const tokens = await this.fcmTokenService.getTokensByUserId(
      data.receiverId,
    );

    if (tokens.length === 0) return;

    const truncatedContent =
      data.content.length > 100
        ? data.content.substring(0, 100) + '...'
        : data.content;

    const badgeCount = await this.badgeService.getBadgeCount(data.receiverId);

    await this.firebaseService.sendMulticastNotification(
      tokens,
      data.senderName,
      truncatedContent,
      {
        type: 'CHAT_MESSAGE',
        conversationId: data.conversationId,
        ...(data.senderId && { senderId: data.senderId }),
        ...(data.messageId && { messageId: data.messageId }),
      },
      badgeCount,
    );

    this.logger.log(
      `Chat push sent to user ${data.receiverId.substring(0, 8)}...`,
    );
  }
}
