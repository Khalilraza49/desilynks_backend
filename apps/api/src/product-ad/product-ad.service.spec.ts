import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService, RedisService, SearchService } from '@libs/common';
import {
  NotificationType,
  ProductAdOfferStatus,
  ProductAdStatus,
} from '@generated/prisma';
import { ProductAdService } from './product-ad.service';
import { NotificationQueueService } from '../notification/notification-queue.service';
import { BlockService } from '../moderation/block.service';

describe('ProductAdService', () => {
  let productAdService: ProductAdService;
  let prisma: {
    productAd: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      delete: jest.Mock;
    };
    productAdOffer: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    productAdSave: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let notificationQueue: {
    queueNotification: jest.Mock;
    queueDeleteNotification: jest.Mock;
  };

  const buyer = { id: 'buyer', firstName: 'John', lastName: 'Doe' };
  const productAd = {
    id: 'ad',
    sellerId: 'seller',
    seller: { id: 'seller' },
    title: 'iPhone 14',
    status: ProductAdStatus.ACTIVE,
  };
  const pendingOffer = {
    id: 'offer',
    productAdId: 'ad',
    buyerId: 'buyer',
    status: ProductAdOfferStatus.PENDING,
    productAd: { sellerId: 'seller', title: 'iPhone 14' },
  };

  beforeEach(async () => {
    prisma = {
      productAd: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      },
      productAdOffer: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      productAdSave: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    notificationQueue = {
      queueNotification: jest.fn().mockResolvedValue(undefined),
      queueDeleteNotification: jest.fn().mockResolvedValue(undefined),
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        ProductAdService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: RedisService,
          useValue: { del: jest.fn().mockResolvedValue(1) },
        },
        {
          provide: SearchService,
          useValue: { removeDocument: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: NotificationQueueService, useValue: notificationQueue },
        {
          provide: BlockService,
          useValue: {
            assertNotBlocked: jest.fn().mockResolvedValue(undefined),
            getBlockedUserIds: jest.fn().mockResolvedValue([]),
            isBlockedBetween: jest.fn().mockResolvedValue(false),
          },
        },
      ],
    }).compile();

    productAdService = app.get<ProductAdService>(ProductAdService);
  });

  describe('sendProductAdOffer', () => {
    const dto = { offerPrice: '900' };

    it('should notify the seller about the offer', async () => {
      prisma.productAd.findUnique.mockResolvedValue(productAd);
      prisma.productAdOffer.findUnique.mockResolvedValue(null);
      prisma.productAdOffer.create.mockResolvedValue({ id: 'offer' });

      await productAdService.sendProductAdOffer(buyer, 'ad', dto);

      expect(notificationQueue.queueNotification).toHaveBeenCalledWith({
        type: NotificationType.PRODUCT_OFFER_RECEIVED,
        recipientId: 'seller',
        actorId: 'buyer',
        title: 'New Offer',
        body: 'John Doe sent an offer on your ad iPhone 14.',
        referenceIds: { productAdId: 'ad', productAdOfferId: 'offer' },
      });
    });

    it('should not notify when the offer is sent on own ad', async () => {
      prisma.productAd.findUnique.mockResolvedValue(productAd);

      await expect(
        productAdService.sendProductAdOffer(
          { ...buyer, id: 'seller' },
          'ad',
          dto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(notificationQueue.queueNotification).not.toHaveBeenCalled();
    });

    it('should not notify when an offer was already sent', async () => {
      prisma.productAd.findUnique.mockResolvedValue(productAd);
      prisma.productAdOffer.findUnique.mockResolvedValue({ id: 'offer' });

      await expect(
        productAdService.sendProductAdOffer(buyer, 'ad', dto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(notificationQueue.queueNotification).not.toHaveBeenCalled();
    });
  });

  describe('cancelProductAdOffer', () => {
    it('should notify the seller about the cancellation', async () => {
      prisma.productAdOffer.findUnique.mockResolvedValue(pendingOffer);

      await productAdService.cancelProductAdOffer(buyer, 'ad');

      expect(notificationQueue.queueNotification).toHaveBeenCalledWith({
        type: NotificationType.PRODUCT_OFFER_CANCELLED,
        recipientId: 'seller',
        actorId: 'buyer',
        title: 'Offer Cancelled',
        body: 'John Doe cancelled their offer on your ad iPhone 14.',
        referenceIds: { productAdId: 'ad', productAdOfferId: 'offer' },
      });
    });

    it('should not notify when the offer is not pending', async () => {
      prisma.productAdOffer.findUnique.mockResolvedValue({
        ...pendingOffer,
        status: ProductAdOfferStatus.ACCEPTED,
      });

      await expect(
        productAdService.cancelProductAdOffer(buyer, 'ad'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(notificationQueue.queueNotification).not.toHaveBeenCalled();
    });
  });

  describe('acceptProductAdOffer', () => {
    it('should notify the accepted buyer and every auto-rejected buyer', async () => {
      prisma.productAdOffer.findUnique.mockResolvedValue(pendingOffer);
      prisma.productAdOffer.findMany.mockResolvedValue([
        { id: 'other-offer', buyerId: 'other-buyer' },
      ]);

      await productAdService.acceptProductAdOffer('seller', 'offer');

      const notifications = notificationQueue.queueNotification.mock.calls.map(
        ([params]) => [
          params.type,
          params.recipientId,
          params.body,
          params.referenceIds,
        ],
      );
      expect(notifications).toEqual([
        [
          NotificationType.PRODUCT_OFFER_ACCEPTED,
          'buyer',
          'Your offer on iPhone 14 was accepted.',
          { productAdId: 'ad', productAdOfferId: 'offer' },
        ],
        [
          NotificationType.PRODUCT_OFFER_REJECTED,
          'other-buyer',
          'The seller accepted another offer on iPhone 14.',
          { productAdId: 'ad', productAdOfferId: 'other-offer' },
        ],
      ]);
    });
  });

  describe('rejectProductAdOffer', () => {
    it('should notify the rejected buyer', async () => {
      prisma.productAdOffer.findUnique.mockResolvedValue(pendingOffer);

      await productAdService.rejectProductAdOffer('seller', 'offer');

      expect(notificationQueue.queueNotification).toHaveBeenCalledWith({
        type: NotificationType.PRODUCT_OFFER_REJECTED,
        recipientId: 'buyer',
        actorId: 'seller',
        title: 'Offer Rejected',
        body: 'Your offer on iPhone 14 was rejected.',
        referenceIds: { productAdId: 'ad', productAdOfferId: 'offer' },
      });
    });
  });

  describe('saveProductAd', () => {
    it('should notify the seller about a new save', async () => {
      prisma.productAd.findUnique.mockResolvedValue(productAd);

      await productAdService.saveProductAd(buyer, 'ad');

      expect(notificationQueue.queueNotification).toHaveBeenCalledWith({
        type: NotificationType.PRODUCT_AD_SAVED,
        recipientId: 'seller',
        actorId: 'buyer',
        title: 'Your Ad Was Saved',
        body: 'John Doe saved your ad iPhone 14.',
        referenceIds: { productAdId: 'ad' },
      });
    });

    it('should not notify again when the ad is already saved', async () => {
      prisma.productAd.findUnique.mockResolvedValue(productAd);
      prisma.productAdSave.findUnique.mockResolvedValue({ id: 'save' });

      await productAdService.saveProductAd(buyer, 'ad');

      expect(notificationQueue.queueNotification).not.toHaveBeenCalled();
    });

    it('should throw when the product ad does not exist', async () => {
      prisma.productAd.findUnique.mockResolvedValue(null);

      await expect(
        productAdService.saveProductAd(buyer, 'ad'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.productAdSave.upsert).not.toHaveBeenCalled();
    });
  });

  describe('unsaveProductAd', () => {
    it('should delete the save notification', async () => {
      await productAdService.unsaveProductAd('buyer', 'ad');

      expect(notificationQueue.queueDeleteNotification).toHaveBeenCalledWith({
        type: NotificationType.PRODUCT_AD_SAVED,
        actorId: 'buyer',
        referenceIds: { productAdId: 'ad' },
      });
    });

    it('should not delete anything when there was no save', async () => {
      prisma.productAdSave.deleteMany.mockResolvedValue({ count: 0 });

      await productAdService.unsaveProductAd('buyer', 'ad');

      expect(notificationQueue.queueDeleteNotification).not.toHaveBeenCalled();
    });
  });

  describe('deleteProductAd', () => {
    it('should delete every notification of the product ad', async () => {
      prisma.productAd.findFirst.mockResolvedValue({
        ...productAd,
        photos: [],
        video: null,
      });

      await productAdService.deleteProductAd('seller', 'ad');

      expect(notificationQueue.queueDeleteNotification).toHaveBeenCalledWith({
        referenceIds: { productAdId: 'ad' },
      });
    });
  });
});
