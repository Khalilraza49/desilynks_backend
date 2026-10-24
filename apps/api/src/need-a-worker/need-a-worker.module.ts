import { Module } from '@nestjs/common';
import { NeedAWorkerController } from './need-a-worker.controller';
import { NeedAWorkerService } from './need-a-worker.service';

@Module({
  controllers: [NeedAWorkerController],
  providers: [NeedAWorkerService],
})
export class NeedAWorkerModule {}
