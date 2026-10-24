import { Module } from '@nestjs/common';
import { ResourceHubController } from './resource-hub.controller';
import { ResourceHubService } from './resource-hub.service';

@Module({
  controllers: [ResourceHubController],
  providers: [ResourceHubService],
})
export class ResourceHubModule {}
