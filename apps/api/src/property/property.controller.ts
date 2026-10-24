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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { PropertyService } from './property.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { CraetePropertyDto } from './dto/create-property.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import {
  tempStorage,
  imageFileFilter,
  MAX_PROPERTY_PHOTO_SIZE,
  MAX_PHOTO_DIMENSION,
  OptimizeImagePipe,
  UPLOAD_THROTTLE,
} from '@libs/common';
import { UpdatePropertyDetailsDto } from './dto/update-property-details.dto';
import { GetUserPropertiesQueryDto } from './dto/get-user-properties-query.dto';
import { GetAllPropertiesQueryDto } from './dto/get-all-properties-query.dto';
import { UpdatePropertyPhotosDto } from './dto/update-property-photos.dto';

@Controller('property')
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FilesInterceptor('photos', 8, {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: {
        fileSize: MAX_PROPERTY_PHOTO_SIZE,
      },
    }),
  )
  async createProperty(
    @Body() dto: CraetePropertyDto,
    @UploadedFiles(new OptimizeImagePipe({ photos: MAX_PHOTO_DIMENSION }))
    photos: Express.Multer.File[],
    @GetUser('id') id: string,
  ) {
    if (!photos || photos.length === 0) {
      throw new BadRequestException('At least 1 property photo is required');
    }

    return this.propertyService.createProperty(id, dto, photos);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updatePropertyDetails(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) propertyId: string,
    @Body() dto: UpdatePropertyDetailsDto,
  ) {
    return this.propertyService.updatePropertyDetails(userId, propertyId, dto);
  }

  @Patch(':id/photos')
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FilesInterceptor('photos', 8, {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: {
        fileSize: MAX_PROPERTY_PHOTO_SIZE,
      },
    }),
  )
  async updatePropertyPhotos(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) propertyId: string,
    @UploadedFiles(new OptimizeImagePipe({ photos: MAX_PHOTO_DIMENSION }))
    newPhotos: Express.Multer.File[],
    @Body() dto: UpdatePropertyPhotosDto,
  ) {
    const photos = newPhotos ?? [];
    const removals = dto.photosToRemove ?? [];

    if (photos.length === 0 && removals.length === 0) {
      return { message: 'No changes requested', data: null };
    }

    return this.propertyService.updatePropertyPhotos(
      userId,
      propertyId,
      photos,
      removals,
    );
  }

  @Patch(':id/mark-rented')
  @UseGuards(JwtAuthGuard)
  async markPropertyAsRented(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) propertyId: string,
  ) {
    return this.propertyService.markPropertyAsRented(userId, propertyId);
  }

  @Patch(':id/mark-inactive')
  @UseGuards(JwtAuthGuard)
  async markPropertyAsInactive(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) propertyId: string,
  ) {
    return this.propertyService.markPropertyAsInactive(userId, propertyId);
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async likeProperty(
    @GetUser() user: any,
    @Param('id', ParseUUIDPipe) propertyId: string,
  ) {
    return this.propertyService.likeProperty(user, propertyId);
  }

  @Delete(':id/like')
  @UseGuards(JwtAuthGuard)
  async unlikeProperty(
    @GetUser('id') userId: string,
    @Param('id') propertyId: string,
  ) {
    return this.propertyService.unlikeProperty(userId, propertyId);
  }

  @Get('user')
  @UseGuards(JwtAuthGuard)
  async getUserProperties(
    @GetUser('id') userId: string,
    @Query() query: GetUserPropertiesQueryDto,
  ) {
    return this.propertyService.getUserProperties(userId, query);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async getAllProperties(
    @Query() query: GetAllPropertiesQueryDto,
    @GetUser('id') userId?: string,
  ) {
    return this.propertyService.getAllProperties(query, userId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getPropertyById(
    @Param('id', ParseUUIDPipe) propertyId: string,
    @GetUser('id') userId?: string,
  ) {
    return this.propertyService.getPropertyById(propertyId, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteProperty(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) propertyId: string,
  ) {
    return this.propertyService.deleteProperty(userId, propertyId);
  }
}
