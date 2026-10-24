import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { NOTIFICATION_REALTIME_CHANNEL } from '@libs/common';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class NotificationRealtimeListener
  implements OnModuleInit, OnModuleDestroy
{
  private subscriber: Redis;
  private readonly logger = new Logger(NotificationRealtimeListener.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly chatGateway: ChatGateway,
  ) {}

  onModuleInit() {
    this.subscriber = new Redis({
      host: this.configService.getOrThrow<string>('REDIS_HOST'),
      port: this.configService.getOrThrow<number>('REDIS_PORT'),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
    });

    this.subscriber.subscribe(NOTIFICATION_REALTIME_CHANNEL);

    this.subscriber.on('message', (channel: string, message: string) => {
      if (channel === NOTIFICATION_REALTIME_CHANNEL) {
        try {
          const { recipientId, notification } = JSON.parse(message);
          this.chatGateway.server
            .to(`user:${recipientId}`)
            .emit('newNotification', notification);
        } catch (err: any) {
          this.logger.error(
            `Failed to process realtime notification: ${err?.message}`,
          );
        }
      }
    });

    this.logger.log(`Subscribed to ${NOTIFICATION_REALTIME_CHANNEL} channel`);
  }

  onModuleDestroy() {
    this.subscriber?.disconnect();
  }
}
