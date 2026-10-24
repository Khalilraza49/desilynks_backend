import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@libs/common';
import { UserSupportStatus } from '@generated/prisma';
import { SupportService } from './support.service';

describe('SupportService (admin)', () => {
  let supportService: SupportService;
  let prisma: {
    userSupportForm: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  const pendingSupportForm = {
    id: 'support-form-1',
    status: UserSupportStatus.PENDING,
  };

  beforeEach(async () => {
    prisma = {
      userSupportForm: {
        findMany: jest.fn().mockResolvedValue([pendingSupportForm]),
        count: jest.fn().mockResolvedValue(21),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [SupportService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    supportService = app.get<SupportService>(SupportService);
  });

  describe('getSupportForms', () => {
    it('should filter by status and return pagination meta', async () => {
      const result = await supportService.getSupportForms({
        page: 2,
        limit: 10,
        status: UserSupportStatus.PENDING,
      });

      expect(prisma.userSupportForm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: UserSupportStatus.PENDING },
          skip: 10,
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result.meta).toEqual({
        total: 21,
        page: 2,
        limit: 10,
        totalPages: 3,
      });
    });
  });

  describe('getSupportFormById', () => {
    it('should throw when the support form does not exist', async () => {
      prisma.userSupportForm.findUnique.mockResolvedValue(null);

      await expect(
        supportService.getSupportFormById('support-form-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('resolveSupportForm', () => {
    it('should resolve a pending support form', async () => {
      prisma.userSupportForm.findUnique.mockResolvedValue(pendingSupportForm);

      await supportService.resolveSupportForm('admin-1', 'support-form-1');

      expect(prisma.userSupportForm.update).toHaveBeenCalledWith({
        where: { id: 'support-form-1' },
        data: {
          status: UserSupportStatus.RESOLVED,
          resolvedByAdminId: 'admin-1',
          resolvedAt: expect.any(Date),
        },
      });
    });

    it('should not resolve a support form that was already resolved', async () => {
      prisma.userSupportForm.findUnique.mockResolvedValue({
        ...pendingSupportForm,
        status: UserSupportStatus.RESOLVED,
      });

      await expect(
        supportService.resolveSupportForm('admin-1', 'support-form-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.userSupportForm.update).not.toHaveBeenCalled();
    });

    it('should throw when the support form does not exist', async () => {
      prisma.userSupportForm.findUnique.mockResolvedValue(null);

      await expect(
        supportService.resolveSupportForm('admin-1', 'support-form-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
