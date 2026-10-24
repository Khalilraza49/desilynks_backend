import { Module } from '@nestjs/common';
import { SearchController } from '@libs/common';
import { SearchReindexService } from './search-reindex.service';

@Module({
  controllers: [SearchController],
  providers: [SearchReindexService],
  exports: [SearchReindexService],
})
export class SearchModule {}
