import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { UserModerationController } from './user-moderation.controller';
import { UserModerationService } from './user-moderation.service';

@Module({
  controllers: [ReportController, UserModerationController],
  providers: [ReportService, UserModerationService],
})
export class ModerationModule {}
