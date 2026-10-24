import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ExploreCountryService } from './explore-country.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import {
  tempStorage,
  imageFileFilter,
  MAX_EXPLORE_COUNTRY_BANNER_SIZE,
  MAX_BANNER_DIMENSION,
  OptimizeImagePipe,
  UPLOAD_THROTTLE,
} from '@libs/common';
import { CreateExploreCountryDto } from './dto/create-explore-country.dto';
import { UpdateExploreCountryDetailsDto } from './dto/update-explore-country-details.dto';
import { GetAllExploreCountriesQueryDto } from './dto/get-all-explore-countries-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('explore-country')
export class ExploreCountryController {
  constructor(private readonly exploreCountryService: ExploreCountryService) {}

  @Post()
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileInterceptor('banner', {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_EXPLORE_COUNTRY_BANNER_SIZE },
    }),
  )
  async createExploreCountry(
    @Body() dto: CreateExploreCountryDto,
    @UploadedFile(new OptimizeImagePipe({ banner: MAX_BANNER_DIMENSION }))
    banner?: Express.Multer.File,
  ) {
    if (!banner) {
      throw new BadRequestException('Banner image is required');
    }
    return this.exploreCountryService.createExploreCountry(dto, banner);
  }

  @Get()
  async getAllExploreCountries(@Query() query: GetAllExploreCountriesQueryDto) {
    return this.exploreCountryService.getAllExploreCountries(query);
  }

  @Get(':id')
  async getExploreCountryById(@Param('id', ParseUUIDPipe) id: string) {
    return this.exploreCountryService.getExploreCountryById(id);
  }

  @Patch(':id')
  async updateExploreCountryDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExploreCountryDetailsDto,
  ) {
    return this.exploreCountryService.updateExploreCountryDetails(id, dto);
  }

  @Patch(':id/banner')
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileInterceptor('banner', {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_EXPLORE_COUNTRY_BANNER_SIZE },
    }),
  )
  async updateExploreCountryBanner(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(new OptimizeImagePipe({ banner: MAX_BANNER_DIMENSION }))
    banner?: Express.Multer.File,
  ) {
    if (!banner) {
      throw new BadRequestException('Banner image is required');
    }
    return this.exploreCountryService.updateExploreCountryBanner(id, banner);
  }

  @Delete(':id')
  async deleteExploreCountry(@Param('id', ParseUUIDPipe) id: string) {
    return this.exploreCountryService.deleteExploreCountry(id);
  }
}
