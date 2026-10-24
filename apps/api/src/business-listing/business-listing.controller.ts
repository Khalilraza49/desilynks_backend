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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { BusinessListingService } from './business-listing.service';
import { CreateBusinessListingDto } from './dto/create-business-listing.dto';
import { UpdateBusinessListingDto } from './dto/update-business-listing.dto';
import { UpdateBusinessListingStatusDto } from './dto/update-business-listing-status.dto';
import { GetUserBusinessListingsQueryDto } from './dto/get-user-business-listings-query.dto';
import { GetAllBusinessListingsQueryDto } from './dto/get-all-business-listings-query.dto';
import {
  tempStorage,
  imageFileFilter,
  MAX_BUSINESS_COVER_PHOTO_SIZE,
  MAX_BUSINESS_GALLERY_PHOTO_SIZE,
  MAX_PHOTO_DIMENSION,
  MAX_BANNER_DIMENSION,
  OptimizeImagePipe,
  UPLOAD_THROTTLE,
} from '@libs/common';
import { UpdateBusinessListingGalleryDto } from './dto/update-business-listing-gallery.dto';
import { GetBusinessListingAnalyticsQueryDto } from './dto/get-business-listing-analytics-query.dto';

@Controller('business-listing')
export class BusinessListingController {
  constructor(
    private readonly businessListingService: BusinessListingService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'coverPhoto', maxCount: 1 },
        { name: 'gallery', maxCount: 10 },
      ],
      {
        storage: tempStorage,
        fileFilter: imageFileFilter,
        limits: {
          fileSize: MAX_BUSINESS_COVER_PHOTO_SIZE,
        },
      },
    ),
  )
  async createBusinessListing(
    @Body() dto: CreateBusinessListingDto,
    @UploadedFiles(
      new OptimizeImagePipe({
        coverPhoto: MAX_BANNER_DIMENSION,
        gallery: MAX_PHOTO_DIMENSION,
      }),
    )
    files: {
      coverPhoto?: Express.Multer.File[];
      gallery?: Express.Multer.File[];
    },
    @GetUser('id') userId: string,
  ) {
    if (!files?.coverPhoto || files.coverPhoto.length === 0) {
      throw new BadRequestException('Business cover photo is required');
    }

    return this.businessListingService.createBusinessListing(
      userId,
      dto,
      files,
    );
  }

  @Get('my-listings')
  @UseGuards(JwtAuthGuard)
  async getUserBusinessListings(
    @GetUser('id') userId: string,
    @Query() query: GetUserBusinessListingsQueryDto,
  ) {
    return this.businessListingService.getUserBusinessListings(userId, query);
  }

  @Get()
  async getAllBusinessListings(@Query() query: GetAllBusinessListingsQueryDto) {
    return this.businessListingService.getAllBusinessListings(query);
  }

  @Get(':id/analytics')
  @UseGuards(JwtAuthGuard)
  async getBusinessListingAnalytics(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) businessListingId: string,
    @Query() query: GetBusinessListingAnalyticsQueryDto,
  ) {
    return this.businessListingService.getBusinessListingAnalytics(
      userId,
      businessListingId,
      query.period,
    );
  }

  @Get(':id')
  async getBusinessListingById(
    @Param('id', ParseUUIDPipe) businessListingId: string,
  ) {
    return this.businessListingService.getBusinessListingById(
      businessListingId,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateBusinessListingDetails(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) businessListingId: string,
    @Body() dto: UpdateBusinessListingDto,
  ) {
    return this.businessListingService.updateBusinessListingDetails(
      userId,
      businessListingId,
      dto,
    );
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateBusinessListingStatus(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) businessListingId: string,
    @Body() dto: UpdateBusinessListingStatusDto,
  ) {
    return this.businessListingService.updateBusinessListingStatus(
      userId,
      businessListingId,
      dto.status,
    );
  }

  @Patch(':id/cover-photo')
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileInterceptor('coverPhoto', {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_BUSINESS_COVER_PHOTO_SIZE },
    }),
  )
  async updateBusinessCoverPhoto(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) businessListingId: string,
    @UploadedFile(new OptimizeImagePipe({ coverPhoto: MAX_BANNER_DIMENSION }))
    coverPhoto?: Express.Multer.File,
  ) {
    if (!coverPhoto) {
      throw new BadRequestException('Provide a "coverPhoto" file to upload');
    }

    return this.businessListingService.updateBusinessCoverPhoto(
      userId,
      businessListingId,
      coverPhoto,
    );
  }

  @Patch(':id/gallery')
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FilesInterceptor('gallery', 10, {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: {
        fileSize: MAX_BUSINESS_GALLERY_PHOTO_SIZE,
      },
    }),
  )
  async updateBusinessGallery(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) businessListingId: string,
    @UploadedFiles(new OptimizeImagePipe({ gallery: MAX_PHOTO_DIMENSION }))
    newGalleryPhotos: Express.Multer.File[],
    @Body() dto: UpdateBusinessListingGalleryDto,
  ) {
    const photos = newGalleryPhotos ?? [];
    const removals = dto.photosToRemove ?? [];

    if (photos.length === 0 && removals.length === 0) {
      return { message: 'No changes requested', data: null };
    }

    return this.businessListingService.updateBusinessGallery(
      userId,
      businessListingId,
      photos,
      removals,
    );
  }

  @Post(':id/click')
  async recordBusinessListingClick(
    @Param('id', ParseUUIDPipe) businessListingId: string,
  ) {
    return this.businessListingService.recordBusinessListingClick(
      businessListingId,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteBusinessListing(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) businessListingId: string,
  ) {
    return this.businessListingService.deleteBusinessListing(
      userId,
      businessListingId,
    );
  }
}
