import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ExploreCountryService } from './explore-country.service';
import { GetAllExploreCountriesQueryDto } from './dto/get-all-explore-countries-query.dto';

@Controller('explore-country')
export class ExploreCountryController {
  constructor(private readonly exploreCountryService: ExploreCountryService) {}

  @Get()
  async getAllExploreCountries(@Query() query: GetAllExploreCountriesQueryDto) {
    return this.exploreCountryService.getAllExploreCountries(query);
  }

  @Get(':id')
  async getExploreCountryById(@Param('id', ParseUUIDPipe) id: string) {
    return this.exploreCountryService.getExploreCountryById(id);
  }
}
