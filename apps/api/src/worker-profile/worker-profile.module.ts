import { Module } from '@nestjs/common';
import { WorkerProfileController } from './worker-profile.controller';
import { WorkerProfileService } from './worker-profile.service';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [ModerationModule],
  controllers: [WorkerProfileController],
  providers: [WorkerProfileService],
})
export class WorkerProfileModule {}
