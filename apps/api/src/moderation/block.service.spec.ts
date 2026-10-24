import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@libs/common';
import { BlockService } from './block.service';

describe('BlockService', () => {
  let blockService: BlockService;
  let prisma: {
    user: { findUnique: jest.Mock };
    userBlock: { upsert: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      userBlock: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [BlockService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    blockService = app.get<BlockService>(BlockService);
  });

  describe('blockUser', () => {
    it('should not allow blocking yourself', async () => {
      await expect(blockService.blockUser('user-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should not allow blocking a deleted account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        deletedAt: new Date(),
      });

      await expect(blockService.blockUser('user-1', 'user-2')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should block another user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        deletedAt: null,
      });

      await expect(blockService.blockUser('user-1', 'user-2')).resolves.toEqual(
        { blocked: true },
      );
      expect(prisma.userBlock.upsert).toHaveBeenCalled();
    });
  });

  describe('getBlockedUserIds', () => {
    it('should return users blocked in either direction', async () => {
      prisma.userBlock.findMany.mockResolvedValue([
        { blockerId: 'user-1', blockedId: 'user-2' },
        { blockerId: 'user-3', blockedId: 'user-1' },
      ]);

      await expect(blockService.getBlockedUserIds('user-1')).resolves.toEqual([
        'user-2',
        'user-3',
      ]);
    });
  });

  describe('assertNotBlocked', () => {
    it('should throw when the users have blocked each other', async () => {
      prisma.userBlock.findFirst.mockResolvedValue({ id: 'block-1' });

      await expect(
        blockService.assertNotBlocked('user-1', 'user-2'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should pass when there is no block', async () => {
      prisma.userBlock.findFirst.mockResolvedValue(null);

      await expect(
        blockService.assertNotBlocked('user-1', 'user-2'),
      ).resolves.toBeUndefined();
    });
  });
});
