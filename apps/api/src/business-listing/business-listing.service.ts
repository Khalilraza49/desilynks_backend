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
  ES_INDEX,
  MAX_BUSINESS_COVER_PHOTO_SIZE,
  MAX_BUSINESS_GALLERY_PHOTO_SIZE,
  moveFileToBusinessCoverPhotos,
  moveFileToBusinessGallery,
  deleteTempFile,
  deleteBusinessCoverPhoto,
  deleteBusinessGalleryPhoto,
} from '@libs/common';
import { CreateBusinessListingDto } from './dto/create-business-listing.dto';
import { UpdateBusinessListingDto } from './dto/update-business-listing.dto';
import { GetUserBusinessListingsQueryDto } from './dto/get-user-business-listings-query.dto';
import { GetAllBusinessListingsQueryDto } from './dto/get-all-business-listings-query.dto';
import { AnalyticsPeriod } from './dto/get-business-listing-analytics-query.dto';
import {
  BusinessListingStatus,
  CategoryStatus,
  Prisma,
} from '@generated/prisma';
import { SearchService } from '@libs/common';

@Injectable()
export class BusinessListingService {
  private readonly logger = new Logger(BusinessListingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly searchService: SearchService,
  ) {}

  async createBusinessListing(
    userId: string,
    dto: CreateBusinessListingDto,
    files: {
      coverPhoto?: Express.Multer.File[];
      gallery?: Express.Multer.File[];
    },
  ) {
    const coverPhotoFile = files.coverPhoto?.[0];
    const galleryFiles = files.gallery ?? [];

    const allFiles = [
      ...(coverPhotoFile ? [coverPhotoFile] : []),
      ...galleryFiles,
    ];

    const category = await this.prisma.businessCategory.findUnique({
      where: {
        id: dto.categoryId,
      },
    });

    if (!category || category.status !== CategoryStatus.ACTIVE) {
      this._cleanupTempFiles(allFiles);
      throw new BadRequestException('Invalid business category');
    }

    if (coverPhotoFile && coverPhotoFile.size > MAX_BUSINESS_COVER_PHOTO_SIZE) {
      this._cleanupTempFiles(allFiles);
      throw new BadRequestException(
        `Business cover photo exceeds the 4 MB size limit`,
      );
    }

    for (const photo of galleryFiles) {
      if (photo.size > MAX_BUSINESS_GALLERY_PHOTO_SIZE) {
        this._cleanupTempFiles(allFiles);
        throw new BadRequestException(
          `Gallery photo "${photo.originalname}" exceeds the 3 MB size limit`,
        );
      }
    }

    let movedCoverPhotoFilename: string | null = null;
    const movedGalleryFilenames: string[] = [];

    try {
      let coverPhotoRecord: {
        url: string;
        filename: string;
        mimetype: string;
      } | null = null;
      if (coverPhotoFile) {
        const url = moveFileToBusinessCoverPhotos(coverPhotoFile.filename);
        movedCoverPhotoFilename = coverPhotoFile.filename;
        coverPhotoRecord = {
          url,
          filename: coverPhotoFile.filename,
          mimetype: coverPhotoFile.mimetype,
        };
      }

      const galleryRecords = galleryFiles.map((photo) => {
        const url = moveFileToBusinessGallery(photo.filename);
        movedGalleryFilenames.push(photo.filename);
        return {
          url,
          filename: photo.filename,
          mimetype: photo.mimetype,
        };
      });

      const businessListing = await this.prisma.businessListing.create({
        data: {
          ownerId: userId,
          name: dto.name,
          categoryId: dto.categoryId,
          address: dto.address,
          phone: dto.phone,
          whatsApp: dto.whatsApp,
          description: dto.description,
          businessHours: {
            create: {
              monToFriStartTime: dto.monToFriStartTime,
              monToFriEndTime: dto.monToFriEndTime,
              saturdayStartTime: dto.saturdayStartTime,
              saturdayEndTime: dto.saturdayEndTime,
              sundayStartTime: dto.sundayStartTime,
              sundayEndTime: dto.sundayEndTime,
              isClosedOnSunday: dto.isClosedOnSunday,
            },
          },
          ...(coverPhotoRecord && {
            coverPhoto: { create: coverPhotoRecord },
          }),
          ...(galleryRecords.length > 0 && {
            businessGalleries: { createMany: { data: galleryRecords } },
          }),
        },
        include: {
          businessHours: true,
          coverPhoto: { select: { id: true, url: true } },
          businessGalleries: { select: { id: true, url: true } },
          category: { select: { id: true, title: true } },
        },
      });

      await this.searchService.indexDocument(
        ES_INDEX.BUSINESS_LISTINGS,
        businessListing.id,
        businessListing,
      );

      return {
        message: 'Business listing created successfully',
        data: businessListing,
      };
    } catch (err) {
      if (movedCoverPhotoFilename) {
        deleteBusinessCoverPhoto(movedCoverPhotoFilename);
      }
      for (const filename of movedGalleryFilenames) {
        deleteBusinessGalleryPhoto(filename);
      }

      for (const file of allFiles) {
        if (
          file.filename !== movedCoverPhotoFilename &&
          !movedGalleryFilenames.includes(file.filename)
        ) {
          deleteTempFile(file.filename);
        }
      }

      if (err instanceof BadRequestException) throw err;

      this.logger.error('Failed to create business listing', err);
      throw new InternalServerErrorException(
        'Failed to create business listing. Please try again',
      );
    }
  }

  async getUserBusinessListings(
    userId: string,
    query: GetUserBusinessListingsQueryDto,
  ) {
    const { page = 1, limit = 10, status, categoryId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.BusinessListingWhereInput = {
      ownerId: userId,
      ...(status && { status }),
      ...(categoryId && { categoryId }),
    };

    try {
      const [businessListings, count] = await Promise.all([
        this.prisma.businessListing.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            businessHours: true,
            coverPhoto: { select: { id: true, url: true } },
            businessGalleries: { select: { id: true, url: true } },
            category: { select: { id: true, title: true } },
          },
        }),
        this.prisma.businessListing.count({ where }),
      ]);

      return {
        data: businessListings,
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (err) {
      this.logger.error('Failed to retrieve user business listings', err);
      throw new InternalServerErrorException(
        'Failed to retrieve business listings. Please try again',
      );
    }
  }

  async getAllBusinessListings(query: GetAllBusinessListingsQueryDto) {
    const { page = 1, limit = 10, categoryId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.BusinessListingWhereInput = {
      status: BusinessListingStatus.ACTIVE,
      ...(categoryId && { categoryId }),
    };

    try {
      const [businessListings, count] = await Promise.all([
        this.prisma.businessListing.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            businessHours: true,
            coverPhoto: { select: { id: true, url: true } },
            businessGalleries: { select: { id: true, url: true } },
            category: { select: { id: true, title: true } },
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhoto: { select: { url: true } },
              },
            },
          },
        }),
        this.prisma.businessListing.count({ where }),
      ]);

      return {
        data: businessListings,
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (err) {
      this.logger.error('Failed to retrieve all business listings', err);
      throw new InternalServerErrorException(
        'Failed to retrieve business listings. Please try again',
      );
    }
  }

  async getBusinessListingById(businessListingId: string) {
    const businessListing = await this.prisma.businessListing.findUnique({
      where: { id: businessListingId },
      include: {
        businessHours: true,
        coverPhoto: { select: { id: true, url: true } },
        businessGalleries: { select: { id: true, url: true } },
        category: { select: { id: true, title: true } },
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            profilePhoto: { select: { url: true } },
          },
        },
      },
    });

    if (!businessListing) {
      throw new NotFoundException('Business listing not found');
    }

    if (businessListing.status === BusinessListingStatus.ACTIVE) {
      this.incrementViewCount(businessListingId).catch((err) => {
        this.logger.error('Failed to increment view count', err);
      });
    }

    const viewsCountStr = await this.redis.get(
      `business-listing:views:${businessListingId}`,
    );
    const redisViews = viewsCountStr ? parseInt(viewsCountStr, 10) : 0;
    const totalViews = businessListing.viewsCount + redisViews;

    const clicksCountStr = await this.redis.get(
      `business-listing:clicks:${businessListingId}`,
    );
    const redisClicks = clicksCountStr ? parseInt(clicksCountStr, 10) : 0;
    const totalClicks = businessListing.clicks + redisClicks;

    return {
      data: {
        ...businessListing,
        viewsCount: totalViews,
        clicks: totalClicks,
      },
    };
  }

  async updateBusinessListingDetails(
    userId: string,
    businessListingId: string,
    dto: UpdateBusinessListingDto,
  ) {
    const businessListing = await this.prisma.businessListing.findFirst({
      where: {
        id: businessListingId,
        ownerId: userId,
      },
    });

    if (!businessListing) {
      throw new NotFoundException(
        'Business listing not found or access denied',
      );
    }

    if (businessListing.categoryId !== dto.categoryId) {
      const category = await this.prisma.businessCategory.findUnique({
        where: {
          id: dto.categoryId,
        }
      });

      if (!category || category.status !== CategoryStatus.ACTIVE) {
        throw new BadRequestException('Invalid business category');
      }
    }

    try {
      const {
        monToFriStartTime,
        monToFriEndTime,
        saturdayStartTime,
        saturdayEndTime,
        sundayStartTime,
        sundayEndTime,
        isClosedOnSunday,
        ...listingData
      } = dto;

      const updatedListing = await this.prisma.businessListing.update({
        where: {
          id: businessListingId,
        },
        data: {
          ...listingData,
          businessHours: {
            update: {
              monToFriStartTime,
              monToFriEndTime,
              saturdayStartTime,
              saturdayEndTime,
              sundayStartTime,
              sundayEndTime,
              isClosedOnSunday,
            },
          },
        },
        include: {
          businessHours: true,
          coverPhoto: { select: { id: true, url: true } },
          businessGalleries: { select: { id: true, url: true } },
          category: { select: { id: true, title: true } },
        },
      });

      await this.searchService.updateDocument(
        ES_INDEX.BUSINESS_LISTINGS,
        businessListingId,
        updatedListing,
      );

      return {
        message: 'Business listing details updated successfully',
        data: updatedListing,
      };
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      this.logger.error('Failed to update business listing details', err);
      throw new InternalServerErrorException(
        'Failed to update business listing details. Please try again',
      );
    }
  }

  async updateBusinessListingStatus(
    userId: string,
    businessListingId: string,
    status: BusinessListingStatus,
  ) {
    const businessListing = await this.prisma.businessListing.findFirst({
      where: {
        id: businessListingId,
        ownerId: userId,
      },
    });

    if (!businessListing) {
      throw new NotFoundException(
        'Business listing not found or access denied',
      );
    }

    try {
      const updatedListing = await this.prisma.businessListing.update({
        where: { id: businessListingId },
        data: { status },
        include: {
          businessHours: true,
          coverPhoto: { select: { id: true, url: true } },
          businessGalleries: { select: { id: true, url: true } },
          category: { select: { id: true, title: true } },
        },
      });

      await this.searchService.updateDocument(
        ES_INDEX.BUSINESS_LISTINGS,
        businessListingId,
        updatedListing,
      );

      return {
        message: 'Business listing status updated successfully',
        data: updatedListing,
      };
    } catch (err) {
      this.logger.error('Failed to update business listing status', err);
      throw new InternalServerErrorException(
        'Failed to update business listing status. Please try again',
      );
    }
  }

  async updateBusinessCoverPhoto(
    userId: string,
    businessListingId: string,
    newCoverPhotoFile: Express.Multer.File,
  ) {
    const businessListing = await this.prisma.businessListing.findFirst({
      where: { id: businessListingId, ownerId: userId },
      include: { coverPhoto: true },
    });

    if (!businessListing) {
      deleteTempFile(newCoverPhotoFile.filename);
      throw new NotFoundException(
        'Business listing not found or access denied',
      );
    }

    if (newCoverPhotoFile.size > MAX_BUSINESS_COVER_PHOTO_SIZE) {
      deleteTempFile(newCoverPhotoFile.filename);
      throw new BadRequestException(
        `Business cover photo exceeds the 4 MB size limit`,
      );
    }

    const existingCoverPhoto = businessListing.coverPhoto;
    let movedCoverPhotoFilename: string | null = null;

    try {
      const url = moveFileToBusinessCoverPhotos(newCoverPhotoFile.filename);
      movedCoverPhotoFilename = newCoverPhotoFile.filename;

      const newCoverPhotoRecord = {
        url,
        filename: newCoverPhotoFile.filename,
        mimetype: newCoverPhotoFile.mimetype,
      };

      await this.prisma.$transaction(async (tx) => {
        if (existingCoverPhoto) {
          await tx.businessCoverPhoto.delete({
            where: { id: existingCoverPhoto.id },
          });
        }
        await tx.businessCoverPhoto.create({
          data: { ...newCoverPhotoRecord, businessId: businessListingId },
        });
      });

      if (existingCoverPhoto) {
        deleteBusinessCoverPhoto(existingCoverPhoto.filename);
      }

      const updatedListing = await this.prisma.businessListing.findUnique({
        where: { id: businessListingId },
        include: {
          businessHours: true,
          coverPhoto: { select: { id: true, url: true } },
          businessGalleries: { select: { id: true, url: true } },
          category: { select: {  id: true, title: true } },
        },
      });

      if (updatedListing) {
        await this.searchService.updateDocument(
          ES_INDEX.BUSINESS_LISTINGS,
          businessListingId,
          updatedListing,
        );
      }

      return {
        message: 'Business cover photo updated successfully',
        data: updatedListing,
      };
    } catch (err) {
      if (movedCoverPhotoFilename) {
        deleteBusinessCoverPhoto(movedCoverPhotoFilename);
      } else {
        deleteTempFile(newCoverPhotoFile.filename);
      }

      this.logger.error('Failed to update business cover photo', err);
      throw new InternalServerErrorException(
        'Failed to update business cover photo. Please try again',
      );
    }
  }

  async updateBusinessGallery(
    userId: string,
    businessListingId: string,
    newGalleryPhotos: Express.Multer.File[],
    photoIdsToRemove: string[],
  ) {
    const businessListing = await this.prisma.businessListing.findFirst({
      where: { id: businessListingId, ownerId: userId },
      include: { businessGalleries: true },
    });

    if (!businessListing) {
      this._cleanupTempFiles(newGalleryPhotos);
      throw new NotFoundException(
        'Business listing not found or access denied',
      );
    }

    const existingPhotos = businessListing.businessGalleries;

    const photosToDelete = existingPhotos.filter((p) =>
      photoIdsToRemove.includes(p.id),
    );

    const invalidIds = photoIdsToRemove.filter(
      (id) => !existingPhotos.some((p) => p.id === id),
    );
    if (invalidIds.length > 0) {
      this._cleanupTempFiles(newGalleryPhotos);
      throw new BadRequestException(
        `The following photo IDs do not belong to this business listing: ${invalidIds.join(', ')}`,
      );
    }

    const remainingCount = existingPhotos.length - photosToDelete.length;
    const totalAfterUpdate = remainingCount + newGalleryPhotos.length;

    if (totalAfterUpdate > 10) {
      this._cleanupTempFiles(newGalleryPhotos);
      throw new BadRequestException(
        `A business listing can have at most 10 gallery photos. ` +
          `After removal you would have ${remainingCount} photo(s); ` +
          `adding ${newGalleryPhotos.length} more would exceed the limit`,
      );
    }

    for (const photo of newGalleryPhotos) {
      if (photo.size > MAX_BUSINESS_GALLERY_PHOTO_SIZE) {
        this._cleanupTempFiles(newGalleryPhotos);
        throw new BadRequestException(
          `Gallery photo "${photo.originalname}" exceeds the 3 MB size limit`,
        );
      }
    }

    const movedFilenames: string[] = [];
    try {
      const newPhotoRecords = newGalleryPhotos.map((photo) => {
        const url = moveFileToBusinessGallery(photo.filename);
        movedFilenames.push(photo.filename);
        return {
          url,
          filename: photo.filename,
          mimetype: photo.mimetype,
          businessId: businessListingId,
        };
      });

      await this.prisma.$transaction(async (tx) => {
        if (photosToDelete.length > 0) {
          await tx.businessGallery.deleteMany({
            where: { id: { in: photosToDelete.map((p) => p.id) } },
          });
        }

        if (newPhotoRecords.length > 0) {
          await tx.businessGallery.createMany({ data: newPhotoRecords });
        }
      });

      for (const photo of photosToDelete) {
        deleteBusinessGalleryPhoto(photo.filename);
      }

      const updatedListing = await this.prisma.businessListing.findUnique({
        where: { id: businessListingId },
        include: {
          businessHours: true,
          coverPhoto: { select: { id: true, url: true } },
          businessGalleries: { select: { id: true, url: true } },
          category: { select: { id: true, title: true } },
        },
      });

      if (updatedListing) {
        await this.searchService.updateDocument(
          ES_INDEX.BUSINESS_LISTINGS,
          businessListingId,
          updatedListing,
        );
      }

      return {
        message: 'Business gallery updated successfully',
        data: updatedListing,
      };
    } catch (err) {
      for (const filename of movedFilenames) {
        deleteBusinessGalleryPhoto(filename);
      }

      for (const photo of newGalleryPhotos) {
        if (!movedFilenames.includes(photo.filename)) {
          deleteTempFile(photo.filename);
        }
      }

      this.logger.error('Failed to update business gallery', err);
      throw new InternalServerErrorException(
        'Failed to update business gallery. Please try again',
      );
    }
  }

  async recordBusinessListingClick(businessListingId: string) {
    const businessListing = await this.prisma.businessListing.findUnique({
      where: { id: businessListingId },
      select: { id: true, status: true },
    });

    if (!businessListing) {
      throw new NotFoundException('Business listing not found');
    }

    if (businessListing.status === BusinessListingStatus.ACTIVE) {
      await this.incrementClickCount(businessListingId);
    }

    return { message: 'Click recorded' };
  }

  async deleteBusinessListing(
    userId: string,
    businessListingId: string,
  ): Promise<{ message: string }> {
    const businessListing = await this.prisma.businessListing.findFirst({
      where: { id: businessListingId, ownerId: userId },
      include: {
        coverPhoto: true,
        businessGalleries: true,
      },
    });

    if (!businessListing) {
      throw new NotFoundException(
        'Business listing not found or access denied',
      );
    }

    await this.prisma.businessListing.delete({
      where: { id: businessListingId },
    });

    if (businessListing.coverPhoto) {
      deleteBusinessCoverPhoto(businessListing.coverPhoto.filename);
    }

    if (
      businessListing.businessGalleries &&
      businessListing.businessGalleries.length > 0
    ) {
      for (const photo of businessListing.businessGalleries) {
        deleteBusinessGalleryPhoto(photo.filename);
      }
    }

    await this.searchService.removeDocument(
      ES_INDEX.BUSINESS_LISTINGS,
      businessListingId,
    );

    await this.redis
      .del(`business-listing:views:${businessListingId}`)
      .catch((err) =>
        this.logger.warn('Failed to clear cached view count', err),
      );
    await this.redis
      .del(`business-listing:clicks:${businessListingId}`)
      .catch((err) =>
        this.logger.warn('Failed to clear cached click count', err),
      );

    return { message: 'Business listing deleted successfully' };
  }

  async getBusinessListingAnalytics(
    userId: string,
    businessListingId: string,
    period: AnalyticsPeriod,
  ) {
    const businessListing = await this.prisma.businessListing.findFirst({
      where: { id: businessListingId, ownerId: userId },
      select: { id: true },
    });

    if (!businessListing) {
      throw new NotFoundException(
        'Business listing not found or access denied',
      );
    }

    const { currentStart, currentEnd, previousStart, previousEnd } =
      this._getDateRanges(period);

    const [currentStats, previousStats] = await Promise.all([
      this._aggregateAnalytics(businessListingId, currentStart, currentEnd),
      this._aggregateAnalytics(businessListingId, previousStart, previousEnd),
    ]);

    const viewsPercent = this._calcPercentChange(
      previousStats.views,
      currentStats.views,
    );
    const clicksPercent = this._calcPercentChange(
      previousStats.clicks,
      currentStats.clicks,
    );

    return {
      data: {
        period,
        currentPeriod: {
          startDate: currentStart.toISOString().split('T')[0],
          endDate: currentEnd.toISOString().split('T')[0],
          views: currentStats.views,
          clicks: currentStats.clicks,
        },
        previousPeriod: {
          startDate: previousStart.toISOString().split('T')[0],
          endDate: previousEnd.toISOString().split('T')[0],
          views: previousStats.views,
          clicks: previousStats.clicks,
        },
        change: {
          viewsPercent,
          clicksPercent,
        },
      },
    };
  }

  private async incrementViewCount(businessListingId: string): Promise<void> {
    await this.redis.incr(`business-listing:views:${businessListingId}`);
    await this.redis.sadd('business-listings:updated_views', businessListingId);
  }

  private async incrementClickCount(businessListingId: string): Promise<void> {
    await this.redis.incr(`business-listing:clicks:${businessListingId}`);
    await this.redis.sadd(
      'business-listings:updated_clicks',
      businessListingId,
    );
  }

  private _cleanupTempFiles(files: Express.Multer.File[]): void {
    for (const file of files) {
      deleteTempFile(file.filename);
    }
  }

  private _getDateRanges(period: AnalyticsPeriod) {
    const now = new Date();
    let currentStart: Date;
    let currentEnd: Date;
    let previousStart: Date;
    let previousEnd: Date;

    switch (period) {
      case AnalyticsPeriod.THIS_MONTH: {
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousEnd = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          now.getDate(),
        );
        break;
      }
      case AnalyticsPeriod.LAST_MONTH: {
        currentStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        currentEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        previousStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0);
        break;
      }
      case AnalyticsPeriod.LAST_THREE_MONTHS: {
        currentStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        previousStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth() - 3, 0);
        break;
      }
    }

    return { currentStart, currentEnd, previousStart, previousEnd };
  }

  private async _aggregateAnalytics(
    businessId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ views: number; clicks: number }> {
    const result = await this.prisma.businessListingDailyAnalytics.aggregate({
      where: {
        businessId,
        date: { gte: startDate, lte: endDate },
      },
      _sum: {
        views: true,
        clicks: true,
      },
    });

    return {
      views: result._sum.views ?? 0,
      clicks: result._sum.clicks ?? 0,
    };
  }

  private _calcPercentChange(previous: number, current: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 100 * 100) / 100;
  }
}
