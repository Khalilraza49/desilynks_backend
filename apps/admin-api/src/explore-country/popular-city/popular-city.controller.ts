import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { PopularCityService } from './popular-city.service';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import {
  tempStorage,
  imageFileFilter,
  MAX_EXPLORE_COUNTRY_CITY_BANNER_SIZE,
  MAX_BANNER_DIMENSION,
  OptimizeImagePipe,
  UPLOAD_THROTTLE,
} from '@libs/common';
import { CreatePopularCityDto } from './dto/create-popular-city.dto';
import { UpdatePopularCityDto } from './dto/update-popular-city.dto';

@UseGuards(JwtAuthGuard)
@Controller('popular-cities')
export class PopularCityController {
  constructor(private readonly popularCityService: PopularCityService) {}

  @Post(':countryId')
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileInterceptor('banner', {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_EXPLORE_COUNTRY_CITY_BANNER_SIZE },
    }),
  )
  async addPopularCity(
    @Param('countryId', ParseUUIDPipe) countryId: string,
    @Body() dto: CreatePopularCityDto,
    @UploadedFile(new OptimizeImagePipe({ banner: MAX_BANNER_DIMENSION }))
    banner?: Express.Multer.File,
  ) {
    if (!banner) {
      throw new BadRequestException('Banner image is required');
    }
    return this.popularCityService.addPopularCity(countryId, dto, banner);
  }

  @Patch(':id')
  async updatePopularCityName(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePopularCityDto,
  ) {
    return this.popularCityService.updatePopularCityName(id, dto);
  }

  @Patch(':id/banner')
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileInterceptor('banner', {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_EXPLORE_COUNTRY_CITY_BANNER_SIZE },
    }),
  )
  async updatePopularCityBanner(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(new OptimizeImagePipe({ banner: MAX_BANNER_DIMENSION }))
    banner?: Express.Multer.File,
  ) {
    if (!banner) {
      throw new BadRequestException('Banner image is required');
    }
    return this.popularCityService.updatePopularCityBanner(id, banner);
  }

  @Delete(':id')
  async deletePopularCity(@Param('id', ParseUUIDPipe) id: string) {
    return this.popularCityService.deletePopularCity(id);
  }
}
