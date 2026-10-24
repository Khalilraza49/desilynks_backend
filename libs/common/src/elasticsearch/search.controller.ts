import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SearchService } from './search.service';
import { SearchPropertiesDto } from './dto/search-properties.dto';
import { SearchJobsDto } from './dto/search-jobs.dto';
import { SearchWorkerProfilesDto } from './dto/search-worker-profiles.dto';
import { SearchProductAdsDto } from './dto/search-product-ads.dto';
import { SearchNeedAWorkerDto } from './dto/search-need-a-worker.dto';
import { SearchBusinessListingsDto } from './dto/search-business-listings.dto';
import { SuggestQueryDto } from './dto/suggest-query.dto';
import { SEARCH_THROTTLE } from '../throttler/throttler.config';

@Throttle(SEARCH_THROTTLE)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('properties')
  async searchProperties(@Query() dto: SearchPropertiesDto) {
    return this.searchService.searchProperties(dto);
  }

  @Get('jobs')
  async searchJobs(@Query() dto: SearchJobsDto) {
    return this.searchService.searchJobs(dto);
  }

  @Get('worker-profiles')
  async searchWorkerProfiles(@Query() dto: SearchWorkerProfilesDto) {
    return this.searchService.searchWorkerProfiles(dto);
  }

  @Get('product-ads')
  async searchProductAds(@Query() dto: SearchProductAdsDto) {
    return this.searchService.searchProductAds(dto);
  }

  @Get('need-worker')
  async searchNeedAWorkerPosts(@Query() dto: SearchNeedAWorkerDto) {
    return this.searchService.searchNeedAWorkerPosts(dto);
  }

  @Get('business-listings')
  async searchBusinessListings(@Query() dto: SearchBusinessListingsDto) {
    return this.searchService.searchBusinessListings(dto);
  }

  @Get('suggest')
  async suggest(@Query() dto: SuggestQueryDto) {
    return this.searchService.suggest(dto);
  }
}
