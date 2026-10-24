import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { FcmTokenController } from './fcm-token.controller';
import { SessionEndedListener } from './session-ended.listener';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
    ModerationModule,
  ],
  controllers: [ChatController, FcmTokenController],
  providers: [ChatService, ChatGateway, SessionEndedListener],
  exports: [ChatGateway],
})
export class ChatModule {}
