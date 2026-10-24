import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Ip,
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
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { BannerAdService } from './banner-ad.service';
import { CreateBannerAdDto } from './dto/create-banner-ad.dto';
import { UpdateBannerAdDto } from './dto/update-banner-ad.dto';
import { GetMyBannerAdsQueryDto } from './dto/get-my-banner-ads-query.dto';
import { GetAllBannerAdsQueryDto } from './dto/get-all-banner-ads-query.dto';
import { UpdateBannerAdStatusDto } from './dto/update-banner-ad-status.dto';
import {
  tempStorage,
  imageFileFilter,
  MAX_BANNER_AD_PHOTO_SIZE,
  MAX_BANNER_DIMENSION,
  OptimizeImagePipe,
  UPLOAD_THROTTLE,
} from '@libs/common';

@Controller('banner-ad')
export class BannerAdController {
  constructor(private readonly bannerAdService: BannerAdService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_BANNER_AD_PHOTO_SIZE },
    }),
  )
  async createBannerAd(
    @GetUser('id') userId: string,
    @Body() dto: CreateBannerAdDto,
    @UploadedFile(new OptimizeImagePipe({ photo: MAX_BANNER_DIMENSION }))
    photo?: Express.Multer.File,
  ) {
    if (!photo) {
      throw new BadRequestException('Banner ad photo is required');
    }

    return this.bannerAdService.createBannerAd(userId, dto, photo);
  }

  @Get('my-ads')
  @UseGuards(JwtAuthGuard)
  async getMyBannerAds(
    @GetUser('id') userId: string,
    @Query() query: GetMyBannerAdsQueryDto,
  ) {
    return this.bannerAdService.getMyBannerAds(userId, query);
  }

  @Get()
  async getAllBannerAds(@Query() query: GetAllBannerAdsQueryDto) {
    return this.bannerAdService.getAllBannerAds(query);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getBannerAdById(
    @GetUser('id') userId: string | undefined,
    @Param('id', ParseUUIDPipe) bannerAdId: string,
  ) {
    return this.bannerAdService.getBannerAdById(bannerAdId, userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateBannerAdDetails(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) bannerAdId: string,
    @Body() dto: UpdateBannerAdDto,
  ) {
    return this.bannerAdService.updateBannerAdDetails(userId, bannerAdId, dto);
  }

  @Patch(':id/photo')
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_BANNER_AD_PHOTO_SIZE },
    }),
  )
  async updateBannerAdPhoto(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) bannerAdId: string,
    @UploadedFile(new OptimizeImagePipe({ photo: MAX_BANNER_DIMENSION }))
    photo?: Express.Multer.File,
  ) {
    if (!photo) {
      throw new BadRequestException('Provide a "photo" file to upload');
    }

    return this.bannerAdService.updateBannerAdPhoto(userId, bannerAdId, photo);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateBannerAdStatus(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) bannerAdId: string,
    @Body() dto: UpdateBannerAdStatusDto,
  ) {
    return this.bannerAdService.updateBannerAdStatus(
      userId,
      bannerAdId,
      dto.status,
    );
  }

  @Patch(':id/renew')
  @UseGuards(JwtAuthGuard)
  async renewBannerAd(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) bannerAdId: string,
  ) {
    return this.bannerAdService.renewBannerAd(userId, bannerAdId);
  }

  @Post(':id/view')
  @UseGuards(OptionalJwtAuthGuard)
  async recordBannerAdView(
    @GetUser('id') userId: string | undefined,
    @Param('id', ParseUUIDPipe) bannerAdId: string,
    @Ip() ip: string,
  ) {
    return this.bannerAdService.recordBannerAdView(bannerAdId, userId, ip);
  }

  @Post(':id/click')
  @UseGuards(OptionalJwtAuthGuard)
  async recordBannerAdClick(
    @GetUser('id') userId: string | undefined,
    @Param('id', ParseUUIDPipe) bannerAdId: string,
    @Ip() ip: string,
  ) {
    return this.bannerAdService.recordBannerAdClick(bannerAdId, userId, ip);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteBannerAd(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) bannerAdId: string,
  ) {
    return this.bannerAdService.deleteBannerAd(userId, bannerAdId);
  }
}
