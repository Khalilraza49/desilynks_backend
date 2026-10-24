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
  moveFileToBannerAdPhotos,
  deleteTempFile,
  deleteBannerAdPhoto,
} from '@libs/common';
import { BannerAdStatus, Prisma } from '@generated/prisma';
import { CreateBannerAdDto } from './dto/create-banner-ad.dto';
import { UpdateBannerAdDto } from './dto/update-banner-ad.dto';
import { GetMyBannerAdsQueryDto } from './dto/get-my-banner-ads-query.dto';
import { GetAllBannerAdsQueryDto } from './dto/get-all-banner-ads-query.dto';

const BANNER_AD_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RUNNING_BANNER_ADS = 3;
const VIEW_DEDUP_TTL_SECONDS = 60 * 60;
const CLICK_DEDUP_TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class BannerAdService {
  private readonly logger = new Logger(BannerAdService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async createBannerAd(
    userId: string,
    dto: CreateBannerAdDto,
    photo: Express.Multer.File,
  ) {
    let photoData: {
      url: string;
      filename: string;
      mimetype: string;
    } | null = null;

    try {
      const finalUrl = moveFileToBannerAdPhotos(photo.filename);
      photoData = {
        url: finalUrl,
        filename: photo.filename,
        mimetype: photo.mimetype,
      };
    } catch (error) {
      this.logger.error(`Error saving banner ad photo: ${error.message}`);
      deleteTempFile(photo.filename);
      throw new InternalServerErrorException(
        'Failed to process banner ad photo',
      );
    }

    try {
      const bannerAd = await this.prisma.$transaction(async (tx) => {
        await this._assertRunningLimit(tx, userId);

        return tx.bannerAd.create({
          data: {
            creatorId: userId,
            title: dto.title,
            description: dto.description,
            ctaButtonText: dto.ctaButtonText,
            destinationLink: dto.destinationLink,
            position: dto.position,
            expiresAt: new Date(Date.now() + BANNER_AD_DURATION_MS),
            photo: {
              create: photoData,
            },
          },
          include: {
            photo: { select: { id: true, url: true } },
          },
        });
      });

      return {
        message: 'Banner ad created successfully',
        data: bannerAd,
      };
    } catch (error) {
      if (photoData) {
        deleteBannerAdPhoto(photoData.filename);
      }
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Error creating banner ad: ${error.message}`);
      throw new InternalServerErrorException('Failed to create banner ad');
    }
  }

  async updateBannerAdDetails(
    userId: string,
    bannerAdId: string,
    dto: UpdateBannerAdDto,
  ) {
    const bannerAd = await this.prisma.bannerAd.findFirst({
      where: { id: bannerAdId, creatorId: userId },
    });

    if (!bannerAd) {
      throw new NotFoundException('Banner ad not found or access denied');
    }

    try {
      const updatedBannerAd = await this.prisma.bannerAd.update({
        where: { id: bannerAdId },
        data: {
          ...dto,
        },
        include: {
          photo: { select: { id: true, url: true } },
        },
      });

      return {
        message: 'Banner ad updated successfully',
        data: updatedBannerAd,
      };
    } catch (error) {
      this.logger.error(`Error updating banner ad: ${error.message}`);
      throw new InternalServerErrorException('Failed to update banner ad');
    }
  }

  async updateBannerAdPhoto(
    userId: string,
    bannerAdId: string,
    photo: Express.Multer.File,
  ) {
    const bannerAd = await this.prisma.bannerAd.findFirst({
      where: { id: bannerAdId, creatorId: userId },
      include: { photo: true },
    });

    if (!bannerAd) {
      deleteTempFile(photo.filename);
      throw new NotFoundException('Banner ad not found or access denied');
    }

    const oldPhoto = bannerAd.photo;
    let newPhotoData: {
      url: string;
      filename: string;
      mimetype: string;
    } | null = null;

    try {
      const finalUrl = moveFileToBannerAdPhotos(photo.filename);
      newPhotoData = {
        url: finalUrl,
        filename: photo.filename,
        mimetype: photo.mimetype,
      };
    } catch (error) {
      this.logger.error(`Error saving new banner ad photo: ${error.message}`);
      deleteTempFile(photo.filename);
      throw new InternalServerErrorException(
        'Failed to process new banner ad photo',
      );
    }

    try {
      const updatedBannerAd = await this.prisma.bannerAd.update({
        where: { id: bannerAdId },
        data: {
          photo: {
            upsert: {
              create: newPhotoData,
              update: newPhotoData,
            },
          },
        },
        include: {
          photo: { select: { id: true, url: true } },
        },
      });

      if (oldPhoto) {
        deleteBannerAdPhoto(oldPhoto.filename);
      }

      return {
        message: 'Banner ad photo updated successfully',
        data: updatedBannerAd,
      };
    } catch (error) {
      this.logger.error(
        `Error updating banner ad photo in DB: ${error.message}`,
      );
      if (newPhotoData) {
        deleteBannerAdPhoto(newPhotoData.filename);
      }
      throw new InternalServerErrorException(
        'Failed to update banner ad photo',
      );
    }
  }

  async getMyBannerAds(userId: string, query: GetMyBannerAdsQueryDto) {
    const { page = 1, limit = 10, status } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.BannerAdWhereInput = {
      creatorId: userId,
      ...(status && { status }),
    };

    try {
      const [bannerAds, count] = await Promise.all([
        this.prisma.bannerAd.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            photo: { select: { id: true, url: true } },
          },
        }),
        this.prisma.bannerAd.count({ where }),
      ]);

      return {
        data: bannerAds,
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching user banner ads: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch banner ads');
    }
  }

  async getAllBannerAds(query: GetAllBannerAdsQueryDto) {
    const { page = 1, limit = 10, position } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.BannerAdWhereInput = {
      status: BannerAdStatus.RUNNING,
      ...(position && { position }),
      expiresAt: { gt: new Date() },
    };

    try {
      const [bannerAds, count] = await Promise.all([
        this.prisma.bannerAd.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            photo: { select: { id: true, url: true } },
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhoto: { select: { url: true } },
              },
            },
          },
        }),
        this.prisma.bannerAd.count({ where }),
      ]);

      return {
        data: bannerAds,
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching banner ads: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch banner ads');
    }
  }

  async getBannerAdById(bannerAdId: string, userId?: string) {
    const bannerAd = await this.prisma.bannerAd.findUnique({
      where: { id: bannerAdId },
      include: {
        photo: { select: { id: true, url: true } },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: { select: { url: true } },
          },
        },
      },
    });

    if (!bannerAd) {
      throw new NotFoundException('Banner ad not found');
    }

    if (!this._isRunning(bannerAd) && bannerAd.creatorId !== userId) {
      throw new NotFoundException('Banner ad is no longer running');
    }

    return {
      data: bannerAd,
    };
  }

  async recordBannerAdView(bannerAdId: string, userId?: string, ip?: string) {
    const bannerAd = await this.prisma.bannerAd.findUnique({
      where: { id: bannerAdId },
      select: { id: true, status: true, expiresAt: true, creatorId: true },
    });

    if (!bannerAd) {
      throw new NotFoundException('Banner ad not found');
    }

    if (
      this._isRunning(bannerAd) &&
      bannerAd.creatorId !== userId &&
      (await this._isFirstInteraction('view', bannerAdId, userId, ip))
    ) {
      await this.incrementViewCount(bannerAdId);
    }

    return { message: 'View recorded' };
  }

  async recordBannerAdClick(bannerAdId: string, userId?: string, ip?: string) {
    const bannerAd = await this.prisma.bannerAd.findUnique({
      where: { id: bannerAdId },
      select: { id: true, status: true, expiresAt: true, creatorId: true },
    });

    if (!bannerAd) {
      throw new NotFoundException('Banner ad not found');
    }

    if (
      this._isRunning(bannerAd) &&
      bannerAd.creatorId !== userId &&
      (await this._isFirstInteraction('click', bannerAdId, userId, ip))
    ) {
      await this.incrementClickCount(bannerAdId);
    }

    return { message: 'Click recorded' };
  }

  async updateBannerAdStatus(
    userId: string,
    bannerAdId: string,
    status: BannerAdStatus,
  ) {
    const bannerAd = await this.prisma.bannerAd.findFirst({
      where: { id: bannerAdId, creatorId: userId },
    });

    if (!bannerAd) {
      throw new NotFoundException('Banner ad not found or access denied');
    }

    if (
      bannerAd.status === BannerAdStatus.EXPIRED ||
      bannerAd.expiresAt <= new Date()
    ) {
      throw new BadRequestException(
        'Banner ad has expired. Renew it to run again',
      );
    }

    try {
      const updatedBannerAd = await this.prisma.$transaction(async (tx) => {
        if (
          status === BannerAdStatus.RUNNING &&
          bannerAd.status !== BannerAdStatus.RUNNING
        ) {
          await this._assertRunningLimit(tx, userId);
        }

        return tx.bannerAd.update({
          where: { id: bannerAdId },
          data: { status },
          include: {
            photo: { select: { id: true, url: true } },
          },
        });
      });

      return {
        message: 'Banner ad status updated successfully',
        data: updatedBannerAd,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Error updating banner ad status: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to update banner ad status',
      );
    }
  }

  async renewBannerAd(userId: string, bannerAdId: string) {
    const bannerAd = await this.prisma.bannerAd.findFirst({
      where: { id: bannerAdId, creatorId: userId },
    });

    if (!bannerAd) {
      throw new NotFoundException('Banner ad not found or access denied');
    }

    if (
      bannerAd.status !== BannerAdStatus.EXPIRED &&
      bannerAd.expiresAt > new Date()
    ) {
      throw new BadRequestException('Only expired banner ads can be renewed');
    }

    try {
      const renewedBannerAd = await this.prisma.$transaction(async (tx) => {
        await this._assertRunningLimit(tx, userId);

        return tx.bannerAd.update({
          where: { id: bannerAdId },
          data: {
            status: BannerAdStatus.RUNNING,
            expiresAt: new Date(Date.now() + BANNER_AD_DURATION_MS),
          },
          include: {
            photo: { select: { id: true, url: true } },
          },
        });
      });

      return {
        message: 'Banner ad renewed successfully',
        data: renewedBannerAd,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Error renewing banner ad: ${error.message}`);
      throw new InternalServerErrorException('Failed to renew banner ad');
    }
  }

  async deleteBannerAd(userId: string, bannerAdId: string) {
    const bannerAd = await this.prisma.bannerAd.findFirst({
      where: { id: bannerAdId, creatorId: userId },
      include: {
        photo: { select: { filename: true } },
      },
    });

    if (!bannerAd) {
      throw new NotFoundException('Banner ad not found or access denied');
    }

    try {
      await this.prisma.bannerAd.delete({
        where: { id: bannerAdId },
      });

      if (bannerAd.photo) {
        deleteBannerAdPhoto(bannerAd.photo.filename);
      }

      await this.redis
        .del(`banner-ad:views:${bannerAdId}`)
        .catch((err) =>
          this.logger.warn('Failed to clear cached view count', err),
        );
      await this.redis
        .del(`banner-ad:clicks:${bannerAdId}`)
        .catch((err) =>
          this.logger.warn('Failed to clear cached click count', err),
        );

      return {
        message: 'Banner ad deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Error deleting banner ad: ${error.message}`);
      throw new InternalServerErrorException('Failed to delete banner ad');
    }
  }

  private async incrementViewCount(bannerAdId: string): Promise<void> {
    await this.redis.incr(`banner-ad:views:${bannerAdId}`);
    await this.redis.sadd('banner-ads:updated_views', bannerAdId);
  }

  private async incrementClickCount(bannerAdId: string): Promise<void> {
    await this.redis.incr(`banner-ad:clicks:${bannerAdId}`);
    await this.redis.sadd('banner-ads:updated_clicks', bannerAdId);
  }

  private async _isFirstInteraction(
    type: 'view' | 'click',
    bannerAdId: string,
    userId?: string,
    ip?: string,
  ): Promise<boolean> {
    const viewerKey = userId ? `user:${userId}` : ip ? `ip:${ip}` : null;

    if (!viewerKey) {
      return false;
    }

    return this.redis.setIfNotExists(
      `banner-ad:seen:${type}:${bannerAdId}:${viewerKey}`,
      '1',
      type === 'view' ? VIEW_DEDUP_TTL_SECONDS : CLICK_DEDUP_TTL_SECONDS,
    );
  }

  private _isRunning(bannerAd: {
    status: BannerAdStatus;
    expiresAt: Date;
  }): boolean {
    return (
      bannerAd.status === BannerAdStatus.RUNNING &&
      bannerAd.expiresAt > new Date()
    );
  }

  private async _assertRunningLimit(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

    const runningCount = await tx.bannerAd.count({
      where: {
        creatorId: userId,
        status: BannerAdStatus.RUNNING,
        expiresAt: { gt: new Date() },
      },
    });

    if (runningCount >= MAX_RUNNING_BANNER_ADS) {
      throw new BadRequestException(
        `You can only have ${MAX_RUNNING_BANNER_ADS} running banner ads at a time`,
      );
    }
  }
}
