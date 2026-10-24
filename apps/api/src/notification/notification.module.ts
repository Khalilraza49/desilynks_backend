import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationService } from './notification.service';
import { NotificationQueueService } from './notification-queue.service';
import { NotificationRealtimeListener } from './notification-realtime.listener';
import { NotificationController } from './notification.controller';
import { ChatModule } from '../chat/chat.module';
import { NOTIFICATION_QUEUE, NOTIFICATION_QUEUE_CHAT } from '@libs/common';

@Global()
@Module({
  imports: [
    ChatModule,
    BullModule.registerQueue(
      { name: NOTIFICATION_QUEUE },
      { name: NOTIFICATION_QUEUE_CHAT },
    ),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationQueueService,
    NotificationRealtimeListener,
  ],
  exports: [NotificationService, NotificationQueueService],
})
export class NotificationModule {}
