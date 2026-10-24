import { Global, Module } from '@nestjs/common';
import { ContentRemovalService } from './content-removal.service';

@Global()
@Module({
  providers: [ContentRemovalService],
  exports: [ContentRemovalService],
})
export class ContentRemovalModule {}
