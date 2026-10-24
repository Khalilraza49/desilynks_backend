import { Module } from '@nestjs/common';
import { ExploreCountryController } from './explore-country.controller';
import { ExploreCountryService } from './explore-country.service';
import { EmergencyNumberController } from './emergency-number/emergency-number.controller';
import { EmergencyNumberService } from './emergency-number/emergency-number.service';
import { PopularCityController } from './popular-city/popular-city.controller';
import { PopularCityService } from './popular-city/popular-city.service';

@Module({
  controllers: [
    ExploreCountryController,
    EmergencyNumberController,
    PopularCityController,
  ],
  providers: [
    ExploreCountryService,
    EmergencyNumberService,
    PopularCityService,
  ],
})
export class ExploreCountryModule {}
