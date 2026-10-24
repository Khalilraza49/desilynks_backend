import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { ProductAdService } from './product-ad.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import {
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  imageFileFilter,
  imageOrVideoFileFilter,
  MAX_PRODUCT_PHOTO_SIZE,
  MAX_PRODUCT_VIDEO_SIZE,
  MAX_PHOTO_DIMENSION,
  OptimizeImagePipe,
  tempStorage,
  videoFileFilter,
  UPLOAD_THROTTLE,
} from '@libs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { CreateProductAdDto } from './dto/create-product-ad.dto';
import { UpdateProductAdDto } from './dto/update-product-ad.dto';
import { UpdateProductAdVideoDto } from './dto/update-product-ad-video.dto';
import { GetUserProductAdsQueryDto } from './dto/get-user-product-ads-query.dto';
import { GetAllProductAdsQueryDto } from './dto/get-all-product-ads-query.dto';
import { SendProductAdOfferDto } from './dto/send-product-ad-offer.dto';
import { GetMySendedOffersQueryDto } from './dto/get-my-sended-offers-query.dto';
import { GetOffersOnMyAdQueryDto } from './dto/get-offers-on-my-ad-query.dto';
import { UpdateProductAdStatusDto } from './dto/update-product-ad-status.dto';
import { UpdateProductAdPhotosDto } from './dto/update-product-ad-photos.dto';

@Controller('product-ad')
export class ProductAdController {
  constructor(private readonly productAdService: ProductAdService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'photos', maxCount: 8 },
        { name: 'video', maxCount: 1 },
      ],
      {
        storage: tempStorage,
        fileFilter: imageOrVideoFileFilter,
        limits: {
          fileSize: MAX_PRODUCT_VIDEO_SIZE,
        },
      },
    ),
  )
  async createProductAd(
    @GetUser('id') userId: string,
    @Body() dto: CreateProductAdDto,
    @UploadedFiles(new OptimizeImagePipe({ photos: MAX_PHOTO_DIMENSION }))
    files: {
      photos?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ) {
    if (!files?.photos || files.photos.length === 0) {
      throw new BadRequestException('At least 1 product photo is required');
    }

    return this.productAdService.createProductAd(userId, dto, files);
  }

  @Get('my-ads')
  @UseGuards(JwtAuthGuard)
  async getUserProductAds(
    @GetUser('id') userId: string,
    @Query() query: GetUserProductAdsQueryDto,
  ) {
    return this.productAdService.getUserProductAds(userId, query);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async getAllProductAds(
    @GetUser('id') userId: string | undefined,
    @Query() query: GetAllProductAdsQueryDto,
  ) {
    return this.productAdService.getAllProductAds(query, userId);
  }

  // --- Ad Offer Routes ---

  @Get('my-offers')
  @UseGuards(JwtAuthGuard)
  async getMySentOffers(
    @GetUser('id') userId: string,
    @Query() query: GetMySendedOffersQueryDto,
  ) {
    return this.productAdService.getMySentOffers(userId, query);
  }

  @Post(':id/send-offer')
  @UseGuards(JwtAuthGuard)
  async sendProductAdOffer(
    @GetUser() user: any,
    @Param('id', ParseUUIDPipe) productAdId: string,
    @Body() dto: SendProductAdOfferDto,
  ) {
    return this.productAdService.sendProductAdOffer(user, productAdId, dto);
  }

  @Patch(':id/cancel-offer')
  @UseGuards(JwtAuthGuard)
  async cancelProductAdOffer(
    @GetUser() user: any,
    @Param('id', ParseUUIDPipe) productAdId: string,
  ) {
    return this.productAdService.cancelProductAdOffer(user, productAdId);
  }

  @Get(':id/offers')
  @UseGuards(JwtAuthGuard)
  async getOffersOnMyProductAd(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) productAdId: string,
    @Query() query: GetOffersOnMyAdQueryDto,
  ) {
    return this.productAdService.getOffersOnMyProductAd(
      userId,
      productAdId,
      query,
    );
  }

  @Patch('offers/:id/accept')
  @UseGuards(JwtAuthGuard)
  async acceptProductAdOffer(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) offerId: string,
  ) {
    return this.productAdService.acceptProductAdOffer(userId, offerId);
  }

  @Patch('offers/:id/reject')
  @UseGuards(JwtAuthGuard)
  async rejectProductAdOffer(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) offerId: string,
  ) {
    return this.productAdService.rejectProductAdOffer(userId, offerId);
  }

  // --- Product Ad Save Routes ---

  @Post(':id/save')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async saveProductAd(
    @GetUser() user: any,
    @Param('id', ParseUUIDPipe) productAdId: string,
  ) {
    return this.productAdService.saveProductAd(user, productAdId);
  }

  @Delete(':id/save')
  @UseGuards(JwtAuthGuard)
  async unsaveProductAd(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) productAdId: string,
  ) {
    return this.productAdService.unsaveProductAd(userId, productAdId);
  }

  // --- Product Ad Dynamic Routes ---

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getProductAdById(
    @GetUser('id') userId: string | undefined,
    @Param('id', ParseUUIDPipe) productAdId: string,
  ) {
    return this.productAdService.getProductAdById(productAdId, userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateProductAdDetails(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) productAdId: string,
    @Body() dto: UpdateProductAdDto,
  ) {
    return this.productAdService.updateProductAdDetails(
      userId,
      productAdId,
      dto,
    );
  }

  @Patch(':id/photos')
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FilesInterceptor('photos', 8, {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: {
        fileSize: MAX_PRODUCT_PHOTO_SIZE,
      },
    }),
  )
  async updateProductAdPhotos(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) productAdId: string,
    @UploadedFiles(new OptimizeImagePipe({ photos: MAX_PHOTO_DIMENSION }))
    newPhotos: Express.Multer.File[],
    @Body() dto: UpdateProductAdPhotosDto,
  ) {
    const photos = newPhotos ?? [];
    const removals = dto.photosToRemove ?? [];

    if (photos.length === 0 && removals.length === 0) {
      return { message: 'No changes requested', data: null };
    }

    return this.productAdService.updateProductAdPhotos(
      userId,
      productAdId,
      photos,
      removals,
    );
  }

  @Patch(':id/video')
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileInterceptor('video', {
      storage: tempStorage,
      fileFilter: videoFileFilter,
      limits: { fileSize: MAX_PRODUCT_VIDEO_SIZE },
    }),
  )
  async updateProductAdVideo(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) productAdId: string,
    @UploadedFile() newVideo?: Express.Multer.File,
    @Body() dto?: UpdateProductAdVideoDto,
  ) {
    if (!newVideo && !dto?.removeVideo) {
      throw new BadRequestException(
        'Provide a "video" file to upload, or set "removeVideo" to true to delete the existing video',
      );
    }

    return this.productAdService.updateProductAdVideo(
      userId,
      productAdId,
      newVideo,
      dto ?? {},
    );
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateProductAdStatus(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) productAdId: string,
    @Body() dto: UpdateProductAdStatusDto,
  ) {
    return this.productAdService.updateProductAdStatus(
      userId,
      productAdId,
      dto.status,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteProductAd(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) productAdId: string,
  ) {
    return this.productAdService.deleteProductAd(userId, productAdId);
  }
}
