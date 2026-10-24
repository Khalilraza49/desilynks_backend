import { Module } from '@nestjs/common';
import { BusinessListingController } from './business-listing.controller';
import { BusinessListingService } from './business-listing.service';

@Module({
  controllers: [BusinessListingController],
  providers: [BusinessListingService],
})
export class BusinessListingModule {}
