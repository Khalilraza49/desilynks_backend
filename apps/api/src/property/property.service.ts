import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaService,
  RedisService,
  SearchService,
  ES_INDEX,
  moveFileToPropertyPhotos,
  deletePropertyPhoto,
  deleteTempFile,
  MAX_PROPERTY_PHOTO_SIZE,
} from '@libs/common';
import { CraetePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDetailsDto } from './dto/update-property-details.dto';
import { GetUserPropertiesQueryDto } from './dto/get-user-properties-query.dto';
import { GetAllPropertiesQueryDto } from './dto/get-all-properties-query.dto';
import { CategoryStatus, NotificationType, Prisma } from '@generated/prisma';
import { NotificationQueueService } from '../notification/notification-queue.service';

@Injectable()
export class PropertyService {
  private readonly logger = new Logger(PropertyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly searchService: SearchService,
    private readonly notificationQueue: NotificationQueueService,
  ) {}

  async createProperty(
    userId: string,
    dto: CraetePropertyDto,
    photos: Express.Multer.File[],
  ) {
    for (const photo of photos) {
      if (photo.size > MAX_PROPERTY_PHOTO_SIZE) {
        this._cleanupTempFiles([...photos]);
        throw new BadRequestException(
          `Photo "${photo.originalname}" exceeds the 3 MB size limit`,
        );
      }
    }

    if (await this._hasInvalidFeatureIds(dto.featureIds)) {
      this._cleanupTempFiles(photos);
      throw new BadRequestException('Invalid property feature/amenity');
    }

    const movedPhotoFilenames: string[] = [];

    try {
      const photoRecords = photos.map((photo) => {
        const url = moveFileToPropertyPhotos(photo.filename);
        movedPhotoFilenames.push(photo.filename);
        return {
          url,
          filename: photo.filename,
          mimetype: photo.mimetype,
        };
      });

      const property = await this.prisma.property.create({
        data: {
          ownerId: userId,
          type: dto.type,
          title: dto.title,
          description: dto.description,
          monthlyRent: dto.monthlyRent,
          availableFrom: dto.availableFrom,
          location: dto.location,
          noOfBedRooms: dto.noOfBedRooms,
          noOfBathRooms: dto.noOfBathRooms,
          featuresAndAmenities: {
            connect: dto.featureIds.map((id) => ({ id })),
          },
          propertyPhotos: {
            createMany: { data: photoRecords },
          },
          contactPreference: dto.contactPreference,
        },
        include: {
          propertyPhotos: { select: { id: true, url: true } },
          featuresAndAmenities: { select: { id: true, title: true } },
        },
      });

      await this.searchService.indexDocument(
        ES_INDEX.PROPERTIES,
        property.id,
        property,
      );

      return {
        message: 'Property posted successfully',
        data: property,
      };
    } catch (err) {
      for (const filename of movedPhotoFilenames) {
        deletePropertyPhoto(filename);
      }

      for (const photo of photos) {
        if (!movedPhotoFilenames.includes(photo.filename)) {
          deleteTempFile(photo.filename);
        }
      }

      if (err instanceof BadRequestException) throw err;
      this.logger.error('Failed to create property', err);
      throw new InternalServerErrorException(
        'Failed to create property. Please try again',
      );
    }
  }

  async updatePropertyDetails(
    userId: string,
    propertyId: string,
    dto: UpdatePropertyDetailsDto,
  ) {
    const property = await this.prisma.property.findFirst({
      where: {
        ownerId: userId,
        id: propertyId,
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found or access denied');
    }

    const { featureIds, ...rest } = dto;

    if (await this._hasInvalidFeatureIds(featureIds)) {
      throw new BadRequestException('Invalid property feature/amenity');
    }

    const updatedProperty = await this.prisma.property.update({
      where: {
        id: propertyId,
      },
      data: {
        ...rest,
        featuresAndAmenities: {
          set: featureIds.map((id) => ({ id })),
        },
      },
      include: {
        propertyPhotos: { select: { id: true, url: true } },
        featuresAndAmenities: { select: { id: true, title: true } },
      },
    });

    await this.searchService.updateDocument(
      ES_INDEX.PROPERTIES,
      propertyId,
      updatedProperty,
    );

    return {
      message: 'Property details updated successfully',
      data: updatedProperty,
    };
  }

  async updatePropertyPhotos(
    userId: string,
    propertyId: string,
    newPhotoFiles: Express.Multer.File[],
    photoIdsToRemove: string[],
  ) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, ownerId: userId },
      include: { propertyPhotos: true },
    });

    if (!property) {
      this._cleanupTempFiles(newPhotoFiles);
      throw new NotFoundException('Property not found or access denied');
    }

    const existingPhotos = property.propertyPhotos;

    const photosToDelete = existingPhotos.filter((p) =>
      photoIdsToRemove.includes(p.id),
    );

    const invalidIds = photoIdsToRemove.filter(
      (id) => !existingPhotos.some((p) => p.id === id),
    );
    if (invalidIds.length > 0) {
      this._cleanupTempFiles(newPhotoFiles);
      throw new BadRequestException(
        `The following photo IDs do not belong to this property: ${invalidIds.join(', ')}`,
      );
    }

    const remainingCount = existingPhotos.length - photosToDelete.length;
    const totalAfterUpdate = remainingCount + newPhotoFiles.length;

    if (totalAfterUpdate > 8) {
      this._cleanupTempFiles(newPhotoFiles);
      throw new BadRequestException(
        `A property can have at most 8 photos. ` +
          `After removal you would have ${remainingCount} photo(s); ` +
          `adding ${newPhotoFiles.length} more would exceed the limit`,
      );
    }

    if (totalAfterUpdate < 1) {
      this._cleanupTempFiles(newPhotoFiles);
      throw new BadRequestException('A property must retain at least 1 photo');
    }

    for (const photo of newPhotoFiles) {
      if (photo.size > MAX_PROPERTY_PHOTO_SIZE) {
        this._cleanupTempFiles(newPhotoFiles);
        throw new BadRequestException(
          `Photo "${photo.originalname}" exceeds the 3 MB size limit`,
        );
      }
    }

    const movedFilenames: string[] = [];
    try {
      const newPhotoRecords = newPhotoFiles.map((photo) => {
        const url = moveFileToPropertyPhotos(photo.filename);
        movedFilenames.push(photo.filename);
        return {
          url,
          filename: photo.filename,
          mimetype: photo.mimetype,
          propertyId,
        };
      });

      await this.prisma.$transaction(async (tx) => {
        if (photosToDelete.length > 0) {
          await tx.propertyPhoto.deleteMany({
            where: { id: { in: photosToDelete.map((p) => p.id) } },
          });
        }

        if (newPhotoRecords.length > 0) {
          await tx.propertyPhoto.createMany({ data: newPhotoRecords });
        }
      });

      for (const photo of photosToDelete) {
        deletePropertyPhoto(photo.filename);
      }

      const updatedProperty = await this.prisma.property.findUnique({
        where: { id: propertyId },
        include: {
          propertyPhotos: { select: { id: true, url: true } },
          featuresAndAmenities: { select: { id: true, title: true } },
        },
      });

      if (updatedProperty) {
        await this.searchService.updateDocument(
          ES_INDEX.PROPERTIES,
          propertyId,
          updatedProperty,
        );
      }

      return {
        message: 'Property photos updated successfully',
        data: updatedProperty,
      };
    } catch (err) {
      for (const filename of movedFilenames) {
        deletePropertyPhoto(filename);
      }

      for (const photo of newPhotoFiles) {
        if (!movedFilenames.includes(photo.filename)) {
          deleteTempFile(photo.filename);
        }
      }

      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      this.logger.error('Failed to update property photos', err);
      throw new InternalServerErrorException(
        'Failed to update property photos. Please try again',
      );
    }
  }

  async markPropertyAsRented(userId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        ownerId: userId,
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found or access denied');
    }

    if (property.status !== 'PUBLISHED') {
      throw new BadRequestException(
        'Property only with Published status can be marked as Rented',
      );
    }

    await this.prisma.property.update({
      where: {
        id: propertyId,
      },
      data: {
        status: 'RENTED',
      },
    });

    await this.searchService.updateDocument(ES_INDEX.PROPERTIES, propertyId, {
      status: 'RENTED',
    });

    return {
      message: 'Property successfully marked as Rented',
    };
  }

  async markPropertyAsInactive(userId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        ownerId: userId,
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found or access denied');
    }

    if (property.status !== 'PUBLISHED') {
      throw new BadRequestException(
        'Property only with Published status can be marked as Inactive',
      );
    }

    await this.prisma.property.update({
      where: {
        id: propertyId,
      },
      data: {
        status: 'INACTIVE',
      },
    });

    await this.searchService.updateDocument(ES_INDEX.PROPERTIES, propertyId, {
      status: 'INACTIVE',
    });

    return {
      message: 'Property successfully marked as Inactive',
    };
  }

  async likeProperty(user: any, propertyId: string) {
    const userId = user.id;
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { ownerId: true, title: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const existingLike = await this.prisma.propertyLikes.findUnique({
      where: {
        userId_propertyId: { userId, propertyId },
      },
    });

    await this.prisma.propertyLikes.upsert({
      where: {
        userId_propertyId: { userId, propertyId },
      },
      update: {},
      create: {
        userId,
        propertyId,
      },
    });

    if (!existingLike) {
      await this.notificationQueue.queueNotification({
        type: NotificationType.PROPERTY_LIKED,
        recipientId: property.ownerId,
        actorId: userId,
        title: 'New Like on Your Property',
        body: `${user.firstName} ${user.lastName} liked your property ${property.title}.`,
        referenceIds: { propertyId },
      });
    }

    return {
      liked: true,
    };
  }

  async unlikeProperty(userId: string, propertyId: string) {
    const result = await this.prisma.propertyLikes.deleteMany({
      where: {
        userId,
        propertyId,
      },
    });

    if (result.count > 0) {
      await this.notificationQueue.queueDeleteNotification({
        type: NotificationType.PROPERTY_LIKED,
        actorId: userId,
        referenceIds: { propertyId },
      });
    }

    return {
      liked: false,
    };
  }

  async getUserProperties(userId: string, query: GetUserPropertiesQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where = {
      ownerId: userId,
    };

    const [properties, count] = await Promise.all([
      this.prisma.property.findMany({
        where,
        include: {
          propertyPhotos: { select: { id: true, url: true } },
          featuresAndAmenities: { select: { id: true, title: true } },
          _count: {
            select: { likes: true },
          },
          likes: {
            where: {
              userId,
            },
            select: {
              id: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      data: properties.map(({ _count, likes, ...rest }) => ({
        ...rest,
        likesCount: _count.likes,
        isLiked: likes.length > 0,
      })),
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getAllProperties(dto: GetAllPropertiesQueryDto, userId?: string) {
    const { page = 1, limit = 10, type } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.PropertyWhereInput = {
      status: {
        in: ['PUBLISHED', 'RENTED'],
      },
    };

    if (type) where.type = type;

    const [properties, count] = await Promise.all([
      this.prisma.property.findMany({
        where,
        include: {
          propertyPhotos: { select: { id: true, url: true } },
          featuresAndAmenities: { select: { id: true, title: true } },
          _count: { select: { likes: true } },
          ...(userId && {
            likes: {
              where: { userId },
              select: { id: true },
            },
          }),
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      data: properties.map(({ _count, likes, ...rest }: any) => ({
        ...rest,
        likesCount: _count.likes,
        isLiked: userId ? (likes?.length ?? 0) > 0 : false,
      })),
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getPropertyById(propertyId: string, userId?: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        propertyPhotos: { select: { id: true, url: true } },
        featuresAndAmenities: { select: { id: true, title: true } },
        _count: { select: { likes: true } },
        ...(userId && {
          likes: {
            where: { userId },
            select: { id: true },
          },
        }),
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.status === 'PUBLISHED') {
      this.incrementViewCount(propertyId).catch((err) => {
        this.logger.error('Failed to increment view count', err);
      });
    }

    let isLiked = false;
    if (userId && (property as any).likes) {
      isLiked = (property as any).likes.length > 0;
    }

    const viewsCountStr = await this.redis.get(`property:views:${propertyId}`);
    const redisViews = viewsCountStr ? parseInt(viewsCountStr, 10) : 0;
    const totalViews = property.viewsCount + redisViews;

    const { likes, ...restProperty } = property as any;

    return {
      data: {
        ...restProperty,
        likesCount: property._count.likes,
        isLiked,
        viewsCount: totalViews,
      },
    };
  }

  async deleteProperty(userId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, ownerId: userId },
      include: {
        propertyPhotos: { select: { filename: true } },
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found or access denied');
    }

    const photoFilenames = property.propertyPhotos.map((p) => p.filename);

    await this.prisma.property.delete({
      where: { id: propertyId },
    });

    for (const filename of photoFilenames) {
      deletePropertyPhoto(filename);
    }

    await this.searchService.removeDocument(ES_INDEX.PROPERTIES, propertyId);

    await this.notificationQueue.queueDeleteNotification({
      referenceIds: { propertyId },
    });

    await this.redis
      .del(`property:views:${propertyId}`)
      .catch((err) =>
        this.logger.warn('Failed to clear cached view count', err),
      );

    return {
      message: 'Property deleted successfully',
    };
  }

  private async incrementViewCount(propertyId: string): Promise<void> {
    await this.redis.incr(`property:views:${propertyId}`);
    await this.redis.sadd('properties:updated_views', propertyId);
  }

  private _cleanupTempFiles(files: Express.Multer.File[]): void {
    for (const file of files) {
      deleteTempFile(file.filename);
    }
  }

  private async _hasInvalidFeatureIds(featureIds: string[]): Promise<boolean> {
    const features = await this.prisma.propertyFeatureAndAmenity.findMany({
      where: { id: { in: featureIds } },
    });

    const validActiveIds = new Set(
      features
        .filter((f) => f.status === CategoryStatus.ACTIVE)
        .map((f) => f.id),
    );

    return featureIds.some((id) => !validActiveIds.has(id));
  }
}
