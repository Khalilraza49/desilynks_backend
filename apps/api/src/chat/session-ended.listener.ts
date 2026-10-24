import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { USER_SESSIONS_ENDED_CHANNEL } from '@libs/common';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class SessionEndedListener implements OnModuleInit, OnModuleDestroy {
  private subscriber: Redis;
  private readonly logger = new Logger(SessionEndedListener.name);

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

    this.subscriber.subscribe(USER_SESSIONS_ENDED_CHANNEL);

    this.subscriber.on('message', (channel: string, message: string) => {
      if (channel === USER_SESSIONS_ENDED_CHANNEL) {
        try {
          const { userId } = JSON.parse(message);
          this.chatGateway.server?.in(`user:${userId}`).disconnectSockets(true);
        } catch (err: any) {
          this.logger.error(`Failed to end user sessions: ${err?.message}`);
        }
      }
    });

    this.logger.log(`Subscribed to ${USER_SESSIONS_ENDED_CHANNEL} channel`);
  }

  onModuleDestroy() {
    this.subscriber?.disconnect();
  }
}
