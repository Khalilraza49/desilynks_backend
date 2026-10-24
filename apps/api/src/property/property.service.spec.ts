import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService, RedisService, SearchService } from '@libs/common';
import { NotificationType } from '@generated/prisma';
import { PropertyService } from './property.service';
import { NotificationQueueService } from '../notification/notification-queue.service';

describe('PropertyService', () => {
  let propertyService: PropertyService;
  let prisma: {
    property: { findUnique: jest.Mock };
    propertyLikes: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
  let notificationQueue: {
    queueNotification: jest.Mock;
    queueDeleteNotification: jest.Mock;
  };

  const user = { id: 'liker', firstName: 'John', lastName: 'Doe' };

  beforeEach(async () => {
    prisma = {
      property: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ownerId: 'owner', title: 'Downtown Apartment' }),
      },
      propertyLikes: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    notificationQueue = {
      queueNotification: jest.fn().mockResolvedValue(undefined),
      queueDeleteNotification: jest.fn().mockResolvedValue(undefined),
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        PropertyService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: {} },
        { provide: SearchService, useValue: {} },
        { provide: NotificationQueueService, useValue: notificationQueue },
      ],
    }).compile();

    propertyService = app.get<PropertyService>(PropertyService);
  });

  describe('likeProperty', () => {
    it('should notify the owner about a new like', async () => {
      await propertyService.likeProperty(user, 'property');

      expect(notificationQueue.queueNotification).toHaveBeenCalledWith({
        type: NotificationType.PROPERTY_LIKED,
        recipientId: 'owner',
        actorId: 'liker',
        title: 'New Like on Your Property',
        body: 'John Doe liked your property Downtown Apartment.',
        referenceIds: { propertyId: 'property' },
      });
    });

    it('should not notify again when the property is already liked', async () => {
      prisma.propertyLikes.findUnique.mockResolvedValue({ id: 'like' });

      await propertyService.likeProperty(user, 'property');

      expect(notificationQueue.queueNotification).not.toHaveBeenCalled();
    });

    it('should throw when the property does not exist', async () => {
      prisma.property.findUnique.mockResolvedValue(null);

      await expect(
        propertyService.likeProperty(user, 'property'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.propertyLikes.upsert).not.toHaveBeenCalled();
    });
  });

  describe('unlikeProperty', () => {
    it('should delete the like notification', async () => {
      await propertyService.unlikeProperty('liker', 'property');

      expect(notificationQueue.queueDeleteNotification).toHaveBeenCalledWith({
        type: NotificationType.PROPERTY_LIKED,
        actorId: 'liker',
        referenceIds: { propertyId: 'property' },
      });
    });

    it('should not delete anything when there was no like', async () => {
      prisma.propertyLikes.deleteMany.mockResolvedValue({ count: 0 });

      await propertyService.unlikeProperty('liker', 'property');

      expect(notificationQueue.queueDeleteNotification).not.toHaveBeenCalled();
    });
  });
});
