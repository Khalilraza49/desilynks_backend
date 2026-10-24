import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import {
  PrismaModule,
  RedisModule,
  FirebaseModule,
  NOTIFICATION_QUEUE,
  NOTIFICATION_QUEUE_CHAT,
  WorkerEnvironmentVariables,
  validateEnv,
} from '@libs/common';
import { NotificationProcessor } from './processors/notification.processor';
import { ChatNotificationProcessor } from './processors/chat-notification.processor';
import { BadgeService } from './services/badge.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv(WorkerEnvironmentVariables),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: NOTIFICATION_QUEUE },
      { name: NOTIFICATION_QUEUE_CHAT },
    ),
    PrismaModule,
    RedisModule,
    FirebaseModule,
  ],
  providers: [NotificationProcessor, ChatNotificationProcessor, BadgeService],
})
export class WorkerModule {}
