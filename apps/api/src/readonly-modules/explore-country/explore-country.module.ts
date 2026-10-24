import { Module } from '@nestjs/common';
import { ExploreCountryController } from './explore-country.controller';
import { ExploreCountryService } from './explore-country.service';

@Module({
  controllers: [ExploreCountryController],
  providers: [ExploreCountryService],
})
export class ExploreCountryModule {}
