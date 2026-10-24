import {
  BadRequestException,
  ForbiddenException,
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
  moveFileToProductPhotos,
  moveFileToProductVideo,
  deleteProductPhoto,
  deleteProductVideo,
  deleteTempFile,
  MAX_PRODUCT_PHOTO_SIZE,
  MAX_PRODUCT_VIDEO_SIZE,
} from '@libs/common';
import { CreateProductAdDto } from './dto/create-product-ad.dto';
import { UpdateProductAdDto } from './dto/update-product-ad.dto';
import { UpdateProductAdVideoDto } from './dto/update-product-ad-video.dto';
import { GetUserProductAdsQueryDto } from './dto/get-user-product-ads-query.dto';
import { GetAllProductAdsQueryDto } from './dto/get-all-product-ads-query.dto';
import {
  NotificationType,
  Prisma,
  ProductAdOfferStatus,
  ProductAdStatus,
} from '@generated/prisma';
import { SendProductAdOfferDto } from './dto/send-product-ad-offer.dto';
import { GetMySendedOffersQueryDto } from './dto/get-my-sended-offers-query.dto';
import { GetOffersOnMyAdQueryDto } from './dto/get-offers-on-my-ad-query.dto';
import { NotificationQueueService } from '../notification/notification-queue.service';
import { BlockService } from '../moderation/block.service';

const MAX_PRODUCT_AD_PHOTOS = 8;

@Injectable()
export class ProductAdService {
  private readonly logger = new Logger(ProductAdService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly searchService: SearchService,
    private readonly notificationQueue: NotificationQueueService,
    private readonly blockService: BlockService,
  ) {}

  async createProductAd(
    userId: string,
    dto: CreateProductAdDto,
    files: {
      photos?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ) {
    const photoFiles = files.photos ?? [];
    const videoFile = files.video?.[0];

    for (const photo of photoFiles) {
      if (photo.size > MAX_PRODUCT_PHOTO_SIZE) {
        this._cleanupTempFiles([
          ...photoFiles,
          ...(videoFile ? [videoFile] : []),
        ]);
        throw new BadRequestException(
          `Photo "${photo.originalname}" exceeds the 3 MB size limit`,
        );
      }
    }

    const movedPhotoFilenames: string[] = [];
    let movedVideoFilename: string | null = null;

    try {
      const photoRecords = photoFiles.map((photo) => {
        const url = moveFileToProductPhotos(photo.filename);
        movedPhotoFilenames.push(photo.filename);
        return {
          url,
          filename: photo.filename,
          mimetype: photo.mimetype,
        };
      });

      let videoRecord: {
        url: string;
        filename: string;
        mimetype: string;
      } | null = null;
      if (videoFile) {
        const url = moveFileToProductVideo(videoFile.filename);
        movedVideoFilename = videoFile.filename;
        videoRecord = {
          url,
          filename: videoFile.filename,
          mimetype: videoFile.mimetype,
        };
      }

      const productAd = await this.prisma.productAd.create({
        data: {
          sellerId: userId,
          category: dto.category,
          title: dto.title,
          brand: dto.brand,
          condition: dto.condition,
          price: dto.price,
          negotiable: dto.negotiable,
          description: dto.description,
          location: dto.location,
          photos: {
            createMany: { data: photoRecords },
          },
          ...(videoRecord && {
            video: { create: videoRecord },
          }),
        },
        include: {
          photos: { select: { id: true, url: true } },
          video: { select: { id: true, url: true } },
        },
      });

      await this.searchService.indexDocument(
        ES_INDEX.PRODUCT_ADS,
        productAd.id,
        productAd,
      );

      return {
        message: 'Product ad created successfully',
        data: productAd,
      };
    } catch (err) {
      for (const filename of movedPhotoFilenames) {
        deleteProductPhoto(filename);
      }
      if (movedVideoFilename) {
        deleteProductVideo(movedVideoFilename);
      }

      for (const photo of photoFiles) {
        if (!movedPhotoFilenames.includes(photo.filename)) {
          deleteTempFile(photo.filename);
        }
      }
      if (videoFile && !movedVideoFilename) {
        deleteTempFile(videoFile.filename);
      }

      if (err instanceof BadRequestException) throw err;
      this.logger.error('Failed to create product ad', err);
      throw new InternalServerErrorException(
        'Failed to create product ad. Please try again',
      );
    }
  }

  async getUserProductAds(userId: string, query: GetUserProductAdsQueryDto) {
    const { page = 1, limit = 10, status, category, condition } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductAdWhereInput = {
      sellerId: userId,
      ...(status && { status }),
      ...(category && { category }),
      ...(condition && { condition }),
    };

    try {
      const [productAds, count] = await Promise.all([
        this.prisma.productAd.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            photos: { select: { id: true, url: true } },
            video: { select: { id: true, url: true } },
            _count: { select: { saves: true } },
            saves: {
              where: { userId },
              select: { id: true },
            },
          },
        }),
        this.prisma.productAd.count({ where }),
      ]);

      return {
        data: productAds.map(({ _count, saves, ...rest }: any) => ({
          ...rest,
          savesCount: _count.saves,
          isSaved: saves.length > 0,
        })),
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (err) {
      this.logger.error('Failed to retrieve user product ads', err);
      throw new InternalServerErrorException(
        'Failed to retrieve product ads. Please try again',
      );
    }
  }

  async getAllProductAds(query: GetAllProductAdsQueryDto, userId?: string) {
    const {
      page = 1,
      limit = 10,
      category,
      condition,
      minPrice,
      maxPrice,
      negotiable,
      brand,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductAdWhereInput = {
      status: ProductAdStatus.ACTIVE,
      ...(category && { category }),
      ...(condition && { condition }),
      ...(negotiable !== undefined && { negotiable }),
      ...(brand && { brand: { contains: brand, mode: 'insensitive' } }),
    };

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {
        ...(minPrice !== undefined && { gte: minPrice }),
        ...(maxPrice !== undefined && { lte: maxPrice }),
      };
    }

    try {
      const [productAds, count] = await Promise.all([
        this.prisma.productAd.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            photos: { select: { id: true, url: true } },
            video: { select: { id: true, url: true } },
            _count: { select: { saves: true } },
            ...(userId && {
              saves: {
                where: { userId },
                select: { id: true },
              },
            }),
            seller: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhoto: { select: { url: true } },
              },
            },
          },
        }),
        this.prisma.productAd.count({ where }),
      ]);

      let adsWithOfferStatus = productAds as any[];

      if (userId) {
        const adIds = productAds.map((ad) => ad.id);

        const offers = await this.prisma.productAdOffer.findMany({
          where: {
            buyerId: userId,
            productAdId: { in: adIds },
          },
          select: { productAdId: true },
        });

        const offeredAdIds = new Set(offers.map((offer) => offer.productAdId));

        adsWithOfferStatus = productAds.map(
          ({ _count, saves, ...ad }: any) => ({
            ...ad,
            savesCount: _count.saves,
            isSaved: (saves?.length ?? 0) > 0,
            isOfferSent: offeredAdIds.has(ad.id),
          }),
        );
      }

      if (!userId) {
        adsWithOfferStatus = productAds.map(({ _count, ...ad }: any) => ({
          ...ad,
          savesCount: _count.saves,
          isSaved: false,
          isOfferSent: false,
        }));
      }

      return {
        data: adsWithOfferStatus,
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (err) {
      this.logger.error('Failed to retrieve all product ads', err);
      throw new InternalServerErrorException(
        'Failed to retrieve product ads. Please try again',
      );
    }
  }

  // --- Ad Offer Methods ---

  async getMySentOffers(userId: string, query: GetMySendedOffersQueryDto) {
    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductAdOfferWhereInput = {
      buyerId: userId,
      ...(status && { status }),
    };

    const [myOffers, count] = await Promise.all([
      this.prisma.productAdOffer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          productAd: {
            select: {
              id: true,
              title: true,
              category: true,
              brand: true,
              condition: true,
              price: true,
              negotiable: true,
              description: true,
              location: true,
              status: true,
              photos: {
                select: { id: true, url: true },
              },
              video: {
                select: { id: true, url: true },
              },
            },
          },
        },
      }),
      this.prisma.productAdOffer.count({ where }),
    ]);

    return {
      data: myOffers,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async sendProductAdOffer(
    user: any,
    productAdId: string,
    dto: SendProductAdOfferDto,
  ) {
    const userId = user.id;
    const productAd = await this.prisma.productAd.findUnique({
      where: {
        id: productAdId,
      },
      include: {
        seller: { select: { id: true } },
      },
    });

    if (!productAd) {
      throw new NotFoundException('Product ad not found');
    }

    if (productAd.seller.id === userId) {
      throw new BadRequestException('You cannot send offer on your own ad');
    }

    await this.blockService.assertNotBlocked(userId, productAd.seller.id);

    if (productAd.status !== ProductAdStatus.ACTIVE) {
      throw new BadRequestException(
        `You cannot send an offer on an ad that is ${productAd.status.toLowerCase()}`,
      );
    }

    const alreadyOffered = await this.prisma.productAdOffer.findUnique({
      where: {
        productAdId_buyerId: {
          productAdId,
          buyerId: userId,
        },
      },
    });

    if (alreadyOffered) {
      throw new BadRequestException(
        'You have already sent an offer for this ad',
      );
    }

    const productAdOffer = await this.prisma.productAdOffer.create({
      data: {
        productAdId,
        buyerId: userId,
        ...dto,
      },
    });

    await this.notificationQueue.queueNotification({
      type: NotificationType.PRODUCT_OFFER_RECEIVED,
      recipientId: productAd.sellerId,
      actorId: userId,
      title: 'New Offer',
      body: `${user.firstName} ${user.lastName} sent an offer on your ad ${productAd.title}.`,
      referenceIds: {
        productAdId,
        productAdOfferId: productAdOffer.id,
      },
    });

    return {
      message: 'Your offer sent successfully',
      data: productAdOffer,
    };
  }

  async cancelProductAdOffer(user: any, productAdId: string) {
    const userId = user.id;
    const offer = await this.prisma.productAdOffer.findUnique({
      where: {
        productAdId_buyerId: {
          productAdId,
          buyerId: userId,
        },
      },
      include: {
        productAd: {
          select: { sellerId: true, title: true },
        },
      },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.status !== ProductAdOfferStatus.PENDING) {
      throw new BadRequestException(
        `Cannot cancel an offer that is already ${offer.status.toLowerCase()}`,
      );
    }

    const rejectedOffer = await this.prisma.productAdOffer.update({
      where: {
        id: offer.id,
      },
      data: {
        status: ProductAdOfferStatus.CANCELLED,
      },
    });

    await this.notificationQueue.queueNotification({
      type: NotificationType.PRODUCT_OFFER_CANCELLED,
      recipientId: offer.productAd.sellerId,
      actorId: userId,
      title: 'Offer Cancelled',
      body: `${user.firstName} ${user.lastName} cancelled their offer on your ad ${offer.productAd.title}.`,
      referenceIds: {
        productAdId,
        productAdOfferId: offer.id,
      },
    });

    return {
      message: 'Offer cancelled successfully',
      data: rejectedOffer,
    };
  }

  async getOffersOnMyProductAd(
    userId: string,
    productAdId: string,
    query: GetOffersOnMyAdQueryDto,
  ) {
    const productAd = await this.prisma.productAd.findUnique({
      where: {
        id: productAdId,
      },
    });

    if (!productAd) {
      throw new NotFoundException('Product ad not found');
    }

    if (productAd.sellerId !== userId) {
      throw new ForbiddenException(
        'You can only access the offers on your own ad',
      );
    }

    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductAdOfferWhereInput = {
      productAdId,
      ...(status && { status }),
    };

    const [productAdOffers, count] = await Promise.all([
      this.prisma.productAdOffer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          buyer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              profilePhoto: {
                select: { url: true },
              },
            },
          },
        },
      }),
      this.prisma.productAdOffer.count({ where }),
    ]);

    return {
      data: productAdOffers,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async acceptProductAdOffer(userId: string, offerId: string) {
    const offer = await this.prisma.productAdOffer.findUnique({
      where: { id: offerId },
      include: {
        productAd: {
          select: { sellerId: true, title: true },
        },
      },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.productAd.sellerId !== userId) {
      throw new ForbiddenException('Only the ad owner can accept offers');
    }

    if (offer.status !== ProductAdOfferStatus.PENDING) {
      throw new BadRequestException(
        `Cannot accept an offer that is already ${offer.status.toLowerCase()}`,
      );
    }

    const [acceptedOffer, pendingOffers] = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.productAdOffer.update({
          where: { id: offerId },
          data: { status: ProductAdOfferStatus.ACCEPTED },
        });

        const pendingWhere: Prisma.ProductAdOfferWhereInput = {
          productAdId: offer.productAdId,
          id: { not: offerId },
          status: ProductAdOfferStatus.PENDING,
        };

        const pending = await tx.productAdOffer.findMany({
          where: pendingWhere,
          select: { id: true, buyerId: true },
        });

        await tx.productAdOffer.updateMany({
          where: pendingWhere,
          data: { status: ProductAdOfferStatus.REJECTED },
        });

        return [updated, pending] as const;
      },
    );

    const productAdTitle = offer.productAd.title;

    await this.notificationQueue.queueNotification({
      type: NotificationType.PRODUCT_OFFER_ACCEPTED,
      recipientId: offer.buyerId,
      actorId: userId,
      title: 'Offer Accepted',
      body: `Your offer on ${productAdTitle} was accepted.`,
      referenceIds: {
        productAdId: offer.productAdId,
        productAdOfferId: offerId,
      },
    });

    for (const pendingOffer of pendingOffers) {
      await this.notificationQueue.queueNotification({
        type: NotificationType.PRODUCT_OFFER_REJECTED,
        recipientId: pendingOffer.buyerId,
        actorId: userId,
        title: 'Offer Rejected',
        body: `The seller accepted another offer on ${productAdTitle}.`,
        referenceIds: {
          productAdId: offer.productAdId,
          productAdOfferId: pendingOffer.id,
        },
      });
    }

    return {
      message: 'Offer accepted successfully',
      data: acceptedOffer,
    };
  }

  async rejectProductAdOffer(userId: string, offerId: string) {
    const offer = await this.prisma.productAdOffer.findUnique({
      where: { id: offerId },
      include: {
        productAd: {
          select: { sellerId: true, title: true },
        },
      },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.productAd.sellerId !== userId) {
      throw new ForbiddenException('Only the ad owner can reject offers');
    }

    if (offer.status !== ProductAdOfferStatus.PENDING) {
      throw new BadRequestException(
        `Cannot reject an offer that is already ${offer.status.toLowerCase()}`,
      );
    }

    const rejectedOffer = await this.prisma.productAdOffer.update({
      where: { id: offerId },
      data: { status: ProductAdOfferStatus.REJECTED },
    });

    await this.notificationQueue.queueNotification({
      type: NotificationType.PRODUCT_OFFER_REJECTED,
      recipientId: offer.buyerId,
      actorId: userId,
      title: 'Offer Rejected',
      body: `Your offer on ${offer.productAd.title} was rejected.`,
      referenceIds: {
        productAdId: offer.productAdId,
        productAdOfferId: offerId,
      },
    });

    return {
      message: 'Offer rejected successfully',
      data: rejectedOffer,
    };
  }

  // --- Product Ad Save Methods ---

  async saveProductAd(user: any, productAdId: string) {
    const userId = user.id;
    const productAd = await this.prisma.productAd.findUnique({
      where: { id: productAdId },
      select: { sellerId: true, title: true },
    });

    if (!productAd) {
      throw new NotFoundException('Product ad not found');
    }

    const existingSave = await this.prisma.productAdSave.findUnique({
      where: {
        userId_productAdId: { userId, productAdId },
      },
    });

    await this.prisma.productAdSave.upsert({
      where: {
        userId_productAdId: { userId, productAdId },
      },
      update: {},
      create: {
        userId,
        productAdId,
      },
    });

    if (!existingSave) {
      await this.notificationQueue.queueNotification({
        type: NotificationType.PRODUCT_AD_SAVED,
        recipientId: productAd.sellerId,
        actorId: userId,
        title: 'Your Ad Was Saved',
        body: `${user.firstName} ${user.lastName} saved your ad ${productAd.title}.`,
        referenceIds: { productAdId },
      });
    }

    return {
      saved: true,
    };
  }

  async unsaveProductAd(userId: string, productAdId: string) {
    const result = await this.prisma.productAdSave.deleteMany({
      where: {
        userId,
        productAdId,
      },
    });

    if (result.count > 0) {
      await this.notificationQueue.queueDeleteNotification({
        type: NotificationType.PRODUCT_AD_SAVED,
        actorId: userId,
        referenceIds: { productAdId },
      });
    }

    return {
      saved: false,
    };
  }

  // --- Product Ad Dynamic Methods ---

  async getProductAdById(productAdId: string, userId?: string) {
    const productAd = await this.prisma.productAd.findUnique({
      where: { id: productAdId },
      include: {
        photos: { select: { id: true, url: true } },
        video: { select: { id: true, url: true } },
        _count: { select: { saves: true } },
        ...(userId && {
          saves: {
            where: { userId },
            select: { id: true },
          },
        }),
        seller: {
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

    if (!productAd) {
      throw new NotFoundException('Product ad not found');
    }

    if (
      productAd.status !== ProductAdStatus.ACTIVE &&
      productAd.seller.id !== userId
    ) {
      throw new NotFoundException('Product ad is no longer active');
    }

    if (productAd.status === ProductAdStatus.ACTIVE) {
      this.increamentViewCount(productAdId).catch((err) => {
        this.logger.error('Failed to increment view count', err);
      });
    }

    let isOfferSent = false;

    if (userId) {
      const offer = await this.prisma.productAdOffer.findUnique({
        where: {
          productAdId_buyerId: {
            productAdId,
            buyerId: userId,
          },
        },
        select: { id: true },
      });

      isOfferSent = !!offer;
    }

    const viewsCountStr = await this.redis.get(
      `product-ad:views:${productAdId}`,
    );
    const redisViews = viewsCountStr ? parseInt(viewsCountStr, 10) : 0;
    const totalViews = productAd.viewsCount + redisViews;

    let isSaved = false;
    if (userId && (productAd as any).saves) {
      isSaved = (productAd as any).saves.length > 0;
    }

    const { saves, ...restProductAd } = productAd as any;

    return {
      data: {
        ...restProductAd,
        savesCount: productAd._count.saves,
        isSaved,
        isOfferSent,
        viewsCount: totalViews,
      },
    };
  }

  async updateProductAdDetails(
    userId: string,
    productAdId: string,
    dto: UpdateProductAdDto,
  ) {
    const productAd = await this.prisma.productAd.findFirst({
      where: {
        id: productAdId,
        sellerId: userId,
      },
    });

    if (!productAd) {
      throw new NotFoundException('Product ad not found or access denied');
    }

    try {
      const updatedAd = await this.prisma.productAd.update({
        where: {
          id: productAdId,
        },
        data: {
          ...dto,
        },
        include: {
          photos: { select: { id: true, url: true } },
          video: { select: { id: true, url: true } },
        },
      });

      await this.searchService.updateDocument(
        ES_INDEX.PRODUCT_ADS,
        productAdId,
        updatedAd,
      );

      return {
        message: 'Product ad details updated successfully',
        data: updatedAd,
      };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error('Failed to update product ad details', err);
      throw new InternalServerErrorException(
        'Failed to update product ad details. Please try again',
      );
    }
  }

  async updateProductAdPhotos(
    userId: string,
    productAdId: string,
    newPhotoFiles: Express.Multer.File[],
    photoIdsToRemove: string[],
  ) {
    const productAd = await this.prisma.productAd.findFirst({
      where: {
        id: productAdId,
        sellerId: userId,
      },
      include: { photos: true },
    });

    if (!productAd) {
      this._cleanupTempFiles(newPhotoFiles);
      throw new NotFoundException('Product ad not found or access denied');
    }

    const existingPhotos = productAd.photos;

    const invalidIds = photoIdsToRemove.filter(
      (id) => !existingPhotos.some((p) => p.id === id),
    );
    if (invalidIds.length > 0) {
      this._cleanupTempFiles(newPhotoFiles);
      throw new BadRequestException(
        `The following photo IDs do not belong to this product ad: ${invalidIds.join(', ')}`,
      );
    }

    const photosToDelete = existingPhotos.filter((p) =>
      photoIdsToRemove.includes(p.id),
    );

    const remainingCount = existingPhotos.length - photosToDelete.length;
    const totalAfterUpdate = remainingCount + newPhotoFiles.length;

    if (totalAfterUpdate > MAX_PRODUCT_AD_PHOTOS) {
      this._cleanupTempFiles(newPhotoFiles);
      throw new BadRequestException(
        `A product ad can have at most ${MAX_PRODUCT_AD_PHOTOS} photos. ` +
          `After removal you would have ${remainingCount} photo(s); ` +
          `adding ${newPhotoFiles.length} more would exceed the limit`,
      );
    }

    if (totalAfterUpdate < 1) {
      this._cleanupTempFiles(newPhotoFiles);
      throw new BadRequestException(
        'A product ad must retain at least 1 photo',
      );
    }

    for (const photo of newPhotoFiles) {
      if (photo.size > MAX_PRODUCT_PHOTO_SIZE) {
        this._cleanupTempFiles(newPhotoFiles);
        throw new BadRequestException(
          `Photo "${photo.originalname}" exceeds the 3 MB size limit`,
        );
      }
    }

    const movedFilenames: string[] = [];
    try {
      const newPhotoRecords = newPhotoFiles.map((photo) => {
        const url = moveFileToProductPhotos(photo.filename);
        movedFilenames.push(photo.filename);
        return {
          url,
          filename: photo.filename,
          mimetype: photo.mimetype,
          productAdId,
        };
      });

      await this.prisma.$transaction(async (tx) => {
        if (photosToDelete.length > 0) {
          await tx.productPhoto.deleteMany({
            where: { id: { in: photosToDelete.map((p) => p.id) } },
          });
        }

        if (newPhotoRecords.length > 0) {
          await tx.productPhoto.createMany({ data: newPhotoRecords });
        }
      });

      for (const photo of photosToDelete) {
        deleteProductPhoto(photo.filename);
      }

      const updatedProductAd = await this.prisma.productAd.findUnique({
        where: { id: productAdId },
        include: {
          photos: { select: { id: true, url: true } },
          video: { select: { id: true, url: true } },
        },
      });

      if (updatedProductAd) {
        await this.searchService.updateDocument(
          ES_INDEX.PRODUCT_ADS,
          productAdId,
          updatedProductAd,
        );
      }

      return {
        message: 'Product ad photos updated successfully',
        data: updatedProductAd,
      };
    } catch (err) {
      for (const filename of movedFilenames) {
        deleteProductPhoto(filename);
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

      this.logger.error('Failed to update product ad photos', err);
      throw new InternalServerErrorException(
        'Failed to update product ad photos. Please try again',
      );
    }
  }

  async updateProductAdVideo(
    userId: string,
    productAdId: string,
    newVideo: Express.Multer.File | undefined,
    dto: UpdateProductAdVideoDto,
  ) {
    const removeVideo = dto?.removeVideo ?? false;
    const productAd = await this.prisma.productAd.findFirst({
      where: {
        id: productAdId,
        sellerId: userId,
      },
      include: { video: true },
    });

    if (!productAd) {
      if (newVideo) deleteTempFile(newVideo.filename);
      throw new NotFoundException('Product ad not found or access denied');
    }

    const existingVideo = productAd.video;

    if (newVideo && newVideo.size > MAX_PRODUCT_VIDEO_SIZE) {
      deleteTempFile(newVideo.filename);
      throw new BadRequestException(
        `Video "${newVideo.originalname}" exceeds the 50MB size limit`,
      );
    }

    let movedVideoFilename: string | null = null;

    try {
      let newVideoRecord: {
        url: string;
        filename: string;
        mimetype: string;
      } | null = null;

      if (newVideo) {
        const url = moveFileToProductVideo(newVideo.filename);
        movedVideoFilename = newVideo.filename;
        newVideoRecord = {
          url,
          filename: newVideo.filename,
          mimetype: newVideo.mimetype,
        };
      }

      await this.prisma.$transaction(async (tx) => {
        if (newVideoRecord) {
          if (existingVideo) {
            await tx.productVideo.delete({
              where: {
                id: existingVideo.id,
              },
            });
          }
          await tx.productVideo.create({
            data: {
              ...newVideoRecord,
              productAdId,
            },
          });
        } else if (removeVideo && existingVideo) {
          await tx.productVideo.delete({
            where: { id: existingVideo.id },
          });
        }
      });

      if (existingVideo && (newVideoRecord || removeVideo)) {
        deleteProductVideo(existingVideo.filename);
      }

      const updatedProductAd = await this.prisma.productAd.findUnique({
        where: {
          id: productAdId,
        },
        include: {
          photos: { select: { id: true, url: true } },
          video: { select: { id: true, url: true } },
        },
      });

      if (updatedProductAd) {
        await this.searchService.updateDocument(
          ES_INDEX.PRODUCT_ADS,
          productAdId,
          updatedProductAd,
        );
      }

      return {
        message: newVideoRecord
          ? 'Product ad video updated successfully'
          : 'Product ad video removed successfully',
        data: updatedProductAd,
      };
    } catch (err) {
      if (movedVideoFilename) {
        deleteProductVideo(movedVideoFilename);
      } else if (newVideo) {
        deleteTempFile(newVideo.filename);
      }

      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }

      this.logger.error('Failed to update product ad video', err);
      throw new InternalServerErrorException(
        'Failed to update product ad video. Please try again',
      );
    }
  }

  async updateProductAdStatus(
    userId: string,
    productAdId: string,
    status: ProductAdStatus,
  ) {
    const productAd = await this.prisma.productAd.findFirst({
      where: {
        id: productAdId,
        sellerId: userId,
      },
    });

    if (!productAd) {
      throw new NotFoundException('Product ad not found or access denied');
    }

    if (productAd.status === status) {
      throw new BadRequestException(`Product ad is already ${status}`);
    }

    try {
      const updatedAd = await this.prisma.productAd.update({
        where: { id: productAdId },
        data: { status },
      });

      await this.searchService.updateDocument(
        ES_INDEX.PRODUCT_ADS,
        productAdId,
        updatedAd,
      );

      return {
        message: `Product ad status updated to ${status}`,
        data: updatedAd,
      };
    } catch (err) {
      this.logger.error('Failed to update product ad status', err);
      throw new InternalServerErrorException(
        'Failed to update product ad status. Please try again',
      );
    }
  }

  async deleteProductAd(userId: string, productAdId: string) {
    const productAd = await this.prisma.productAd.findFirst({
      where: {
        id: productAdId,
        sellerId: userId,
      },
      include: {
        photos: { select: { filename: true } },
        video: { select: { filename: true } },
      },
    });

    if (!productAd) {
      throw new NotFoundException('Product ad not found or access denied');
    }

    try {
      await this.prisma.productAd.delete({
        where: { id: productAdId },
      });

      for (const photo of productAd.photos) {
        deleteProductPhoto(photo.filename);
      }

      if (productAd.video) {
        deleteProductVideo(productAd.video.filename);
      }

      await this.searchService.removeDocument(
        ES_INDEX.PRODUCT_ADS,
        productAdId,
      );

      await this.notificationQueue.queueDeleteNotification({
        referenceIds: { productAdId },
      });

      await this.redis
        .del(`product-ad:views:${productAdId}`)
        .catch((err) =>
          this.logger.warn('Failed to clear cached view count', err),
        );

      return {
        message: 'Product ad deleted successfully',
      };
    } catch (err) {
      this.logger.error('Failed to delete product ad', err);
      throw new InternalServerErrorException(
        'Failed to delete product ad. Please try again',
      );
    }
  }

  private async increamentViewCount(productAdId: string): Promise<void> {
    await this.redis.incr(`product-ad:views:${productAdId}`);
    await this.redis.sadd('product-ads:updated_views', productAdId);
  }

  private _cleanupTempFiles(files: Express.Multer.File[]): void {
    for (const file of files) {
      deleteTempFile(file.filename);
    }
  }
}
