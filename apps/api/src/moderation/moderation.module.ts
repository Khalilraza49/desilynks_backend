import { Module } from '@nestjs/common';
import { BlockController } from './block.controller';
import { BlockService } from './block.service';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  controllers: [BlockController, ReportController],
  providers: [BlockService, ReportService],
  exports: [BlockService],
})
export class ModerationModule {}
