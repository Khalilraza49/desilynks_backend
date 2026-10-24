import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@libs/common';
import { UserSupportStatus } from '@generated/prisma';
import { SupportService } from './support.service';

describe('SupportService', () => {
  let supportService: SupportService;
  let prisma: { userSupportForm: { create: jest.Mock } };

  const dto = {
    name: 'John Doe',
    email: 'john@example.com',
    message: 'I cannot log in to my account',
  };

  beforeEach(async () => {
    prisma = {
      userSupportForm: {
        create: jest.fn().mockResolvedValue({
          id: 'support-form-1',
          status: UserSupportStatus.PENDING,
        }),
      },
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [SupportService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    supportService = app.get<SupportService>(SupportService);
  });

  it('should link the support form to the logged-in user', async () => {
    await expect(
      supportService.createSupportForm('user-1', dto),
    ).resolves.toEqual({
      message: 'Support form submitted successfully',
      data: { id: 'support-form-1', status: UserSupportStatus.PENDING },
    });

    expect(prisma.userSupportForm.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', ...dto },
    });
  });

  it('should accept a support form from a guest', async () => {
    await supportService.createSupportForm(undefined, dto);

    expect(prisma.userSupportForm.create).toHaveBeenCalledWith({
      data: { userId: undefined, ...dto },
    });
  });

  it('should throw when the support form cannot be stored', async () => {
    prisma.userSupportForm.create.mockRejectedValue(new Error('db down'));

    await expect(
      supportService.createSupportForm(undefined, dto),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
