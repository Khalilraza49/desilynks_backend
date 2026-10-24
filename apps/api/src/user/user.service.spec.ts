import {
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CommunityGroupMemberRole,
  CommunityGroupMemberStatus,
  Gender,
  UserStatus,
  type User,
} from '@generated/prisma';
import {
  ContentRemovalService,
  PrismaService,
  SessionService,
  deleteProfilePhoto,
  deleteTempFile,
  moveFileToProfilePhotos,
} from '@libs/common';
import * as bcrypt from 'bcrypt';
import { Readable } from 'stream';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';

jest.mock('@libs/common', () => ({
  ...jest.requireActual<typeof import('@libs/common')>('@libs/common'),
  deleteProfilePhoto: jest.fn(),
  deleteTempFile: jest.fn(),
  moveFileToProfilePhotos: jest.fn(),
}));

jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));

const comparePassword = bcrypt.compare as jest.MockedFunction<
  (password: string, hash: string) => Promise<boolean>
>;
const hashPassword = bcrypt.hash as jest.MockedFunction<
  (password: string, rounds: number) => Promise<string>
>;

function createModelMock() {
  return {
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    upsert: jest.fn().mockResolvedValue({}),
  };
}

function createPrismaMock() {
  const modelNames = [
    'user',
    'userAddress',
    'profilePhoto',
    'property',
    'job',
    'workerProfile',
    'needAWorker',
    'productAd',
    'businessListing',
    'bannerAd',
    'communityPost',
    'communityEvent',
    'communityGroup',
    'communityGroupMember',
    'communityPostLike',
    'communityPostComment',
    'communityPostShare',
    'communityPostPollVote',
    'communityPostPollOption',
    'communityEventInterest',
    'propertyLikes',
    'productAdSave',
    'productAdOffer',
    'jobApplications',
    'needAWorkerApplication',
    'workRequest',
    'resourceHubArticleSave',
    'notification',
    'userBlock',
    'fcmToken',
    'userSupportForm',
  ] as const;
  const models = Object.fromEntries(
    modelNames.map((name) => [name, createModelMock()]),
  ) as Record<(typeof modelNames)[number], ReturnType<typeof createModelMock>>;

  return {
    ...models,
    $transaction: jest.fn(
      (
        operation:
          ((tx: typeof models) => Promise<unknown>) | Promise<unknown>[],
      ) =>
        typeof operation === 'function'
          ? operation(models)
          : Promise.all(operation),
    ),
  };
}

function createContentRemovalMock() {
  return {
    removeProperties: jest.fn().mockResolvedValue(undefined),
    removeJobs: jest.fn().mockResolvedValue(undefined),
    removeWorkerProfiles: jest.fn().mockResolvedValue(undefined),
    removeNeedAWorkerPosts: jest.fn().mockResolvedValue(undefined),
    removeProductAds: jest.fn().mockResolvedValue(undefined),
    removeBusinessListings: jest.fn().mockResolvedValue(undefined),
    removeBannerAds: jest.fn().mockResolvedValue(undefined),
    removeCommunityPosts: jest.fn().mockResolvedValue(undefined),
    removeCommunityEvents: jest.fn().mockResolvedValue(undefined),
    removeCommunityGroups: jest.fn().mockResolvedValue(undefined),
  };
}

describe('UserService', () => {
  let service: UserService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let contentRemoval: ReturnType<typeof createContentRemovalMock>;
  let sessionService: { endAllSessions: jest.Mock };
  let logError: jest.SpyInstance;
  let logWarning: jest.SpyInstance;

  const user: User = {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    gender: Gender.MALE,
    dateOfBirth: new Date('1990-01-01'),
    email: 'john@example.com',
    phoneNumber: '+14155550100',
    password: 'stored-password-hash',
    status: UserStatus.ACTIVE,
    termsAcceptedAt: new Date('2026-01-01'),
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
  const requiredAddress = {
    city: 'Berlin',
    province: 'Berlin',
    country: 'Germany',
  };
  const profile: UpdateUserDto = {
    firstName: 'Jane',
    lastName: 'Smith',
    gender: Gender.FEMALE,
    dateOfBirth: new Date('1992-02-02'),
    phoneNumber: '+14155550101',
    ...requiredAddress,
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    logWarning = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    comparePassword.mockResolvedValue(true);
    hashPassword.mockResolvedValue('replacement-hash');
    jest
      .mocked(moveFileToProfilePhotos)
      .mockReturnValue('/uploads/profile-photos/new.jpg');
    prisma = createPrismaMock();
    contentRemoval = createContentRemovalMock();
    sessionService = { endAllSessions: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
        { provide: ContentRemovalService, useValue: contentRemoval },
        { provide: SessionService, useValue: sessionService },
      ],
    }).compile();
    service = module.get(UserService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getUser', () => {
    it('returns the supplied user', async () => {
      const result = await service.getUser(user);
      expect(result.user).toBe(user);
    });
  });

  describe('getUserById', () => {
    it('looks up an undeleted user and returns the public profile', async () => {
      const publicUser = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        gender: user.gender,
        createdAt: user.createdAt,
        profilePhoto: { url: '/photo.jpg' },
      };
      prisma.user.findFirst.mockResolvedValue(publicUser);

      await expect(service.getUserById(user.id)).resolves.toEqual({
        user: publicUser,
      });

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: user.id, deletedAt: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          gender: true,
          profilePhoto: { select: { url: true } },
          createdAt: true,
        },
      });
    });

    it('rejects an unavailable user', async () => {
      await expect(service.getUserById('missing')).rejects.toThrow(
        new NotFoundException('User not found'),
      );
    });
  });

  describe('updateUser', () => {
    beforeEach(() => {
      prisma.user.update.mockResolvedValue({ ...user, ...profile });
    });

    it('updates editable profile fields and returns the address and photo without the password', async () => {
      const address = {
        ...requiredAddress,
        streetAddress: 'Main Street 1',
        postalCode: '10115',
      };
      prisma.userAddress.update.mockResolvedValue(address);
      prisma.profilePhoto.findUnique.mockResolvedValue({ url: '/photo.jpg' });
      const dto = {
        ...profile,
        ...address,
        email: 'ignored@example.com',
        password: 'ignored',
        status: UserStatus.SUSPENDED,
      };

      const result = await service.updateUser(user.id, dto);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { phoneNumber: profile.phoneNumber, NOT: { id: user.id } },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: {
          firstName: profile.firstName,
          lastName: profile.lastName,
          gender: profile.gender,
          dateOfBirth: profile.dateOfBirth,
          phoneNumber: profile.phoneNumber,
        },
      });
      expect(prisma.userAddress.update).toHaveBeenCalledWith({
        where: { userId: user.id },
        data: address,
        select: {
          streetAddress: true,
          postalCode: true,
          city: true,
          province: true,
          country: true,
        },
      });
      expect(result).toMatchObject({
        message: 'User updated successfully',
        user: {
          id: user.id,
          firstName: profile.firstName,
          userAddress: address,
          profilePhoto: { url: '/photo.jpg' },
        },
      });
      expect(result.user).not.toHaveProperty('password');
    });

    it.each([
      {
        name: 'both omitted',
        fields: {},
        expected: { streetAddress: null, postalCode: null },
      },
      {
        name: 'both undefined',
        fields: { streetAddress: undefined, postalCode: undefined },
        expected: { streetAddress: null, postalCode: null },
      },
      {
        name: 'both null',
        fields: { streetAddress: null, postalCode: null },
        expected: { streetAddress: null, postalCode: null },
      },
      {
        name: 'only street address supplied',
        fields: { streetAddress: 'Main Street 1' },
        expected: { streetAddress: 'Main Street 1', postalCode: null },
      },
      {
        name: 'only postal code supplied',
        fields: { postalCode: '10115' },
        expected: { streetAddress: null, postalCode: '10115' },
      },
    ])(
      'writes the current nullable address values when $name',
      async ({ fields, expected }) => {
        const address = { ...requiredAddress, ...expected };
        prisma.userAddress.update.mockResolvedValue(address);
        // Null can reach the service through the DTO's optional validation.
        const dto = { ...profile, ...fields } as UpdateUserDto;

        const result = await service.updateUser(user.id, dto);

        expect(prisma.userAddress.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: address }),
        );
        expect(result.user.userAddress).toEqual(address);
        expect(result.user.profilePhoto).toEqual({ url: null });
      },
    );

    it('rejects a phone number belonging to another user before updating anything', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'other-user' });

      await expect(service.updateUser(user.id, profile)).rejects.toThrow(
        new ConflictException('Phone number is already in use'),
      );

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('propagates a failed address update', async () => {
      const error = new Error('address update failed');
      prisma.userAddress.update.mockRejectedValue(error);

      await expect(service.updateUser(user.id, profile)).rejects.toBe(error);
      expect(prisma.profilePhoto.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('updateProfilePhoto', () => {
    const photoUrl = '/uploads/profile-photos/new.jpg';
    const file: Express.Multer.File = {
      fieldname: 'profilePhoto',
      originalname: 'avatar.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 100,
      destination: 'uploads/temp',
      filename: 'new.jpg',
      path: 'uploads/temp/new.jpg',
      buffer: Buffer.alloc(0),
      stream: Readable.from([]),
    };

    beforeEach(() => {
      prisma.profilePhoto.upsert.mockResolvedValue({ url: photoUrl });
    });

    it.each([undefined, false])(
      'makes no changes when removal is %s and no file is supplied',
      async (removeProfilePhoto) => {
        await expect(
          service.updateProfilePhoto(user, { removeProfilePhoto }),
        ).resolves.toEqual({ message: 'No changes requested' });
        expect(prisma.profilePhoto.findUnique).not.toHaveBeenCalled();
        expect(moveFileToProfilePhotos).not.toHaveBeenCalled();
      },
    );

    it.each([null, { filename: 'old.jpg' }])(
      'uploads a photo with existing photo %j, giving the file precedence over removal',
      async (existingPhoto) => {
        prisma.profilePhoto.findUnique.mockResolvedValue(existingPhoto);

        await expect(
          service.updateProfilePhoto(user, { removeProfilePhoto: true }, file),
        ).resolves.toEqual({
          message: 'Profile photo updated successfully',
          profilePhoto: { url: photoUrl },
        });

        expect(moveFileToProfilePhotos).toHaveBeenCalledWith(file.filename);
        const photoData = {
          url: photoUrl,
          filename: file.filename,
          mimetype: file.mimetype,
        };
        expect(prisma.profilePhoto.upsert).toHaveBeenCalledWith({
          where: { userId: user.id },
          create: { ...photoData, userId: user.id },
          update: photoData,
        });
        if (existingPhoto) {
          expect(deleteProfilePhoto).toHaveBeenCalledWith(
            existingPhoto.filename,
          );
        } else {
          expect(deleteProfilePhoto).not.toHaveBeenCalled();
        }
        expect(deleteTempFile).not.toHaveBeenCalled();
        expect(prisma.profilePhoto.delete).not.toHaveBeenCalled();
      },
    );

    it.each(['lookup', 'move'] as const)(
      'cleans up the temporary upload when the %s fails',
      async (stage) => {
        const error = new Error('upload failed');
        if (stage === 'lookup')
          prisma.profilePhoto.findUnique.mockRejectedValue(error);
        else
          jest.mocked(moveFileToProfilePhotos).mockImplementation(() => {
            throw error;
          });

        await expect(service.updateProfilePhoto(user, {}, file)).rejects.toBe(
          error,
        );

        expect(deleteTempFile).toHaveBeenCalledWith(file.filename);
        expect(deleteProfilePhoto).not.toHaveBeenCalled();
        expect(prisma.profilePhoto.upsert).not.toHaveBeenCalled();
      },
    );

    it('deletes the newly moved file if persistence fails, preserving the old photo', async () => {
      const error = new Error('upsert failed');
      prisma.profilePhoto.findUnique.mockResolvedValue({ filename: 'old.jpg' });
      prisma.profilePhoto.upsert.mockRejectedValue(error);

      await expect(service.updateProfilePhoto(user, {}, file)).rejects.toBe(
        error,
      );

      expect(deleteProfilePhoto).toHaveBeenCalledTimes(1);
      expect(deleteProfilePhoto).toHaveBeenCalledWith(file.filename);
      expect(deleteTempFile).not.toHaveBeenCalled();
    });

    it('keeps the original upload error if temporary cleanup also fails', async () => {
      const error = new Error('lookup failed');
      prisma.profilePhoto.findUnique.mockRejectedValue(error);
      jest.mocked(deleteTempFile).mockImplementation(() => {
        throw new Error('cleanup failed');
      });

      await expect(service.updateProfilePhoto(user, {}, file)).rejects.toBe(
        error,
      );
      expect(logWarning).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete temp file'),
      );
    });

    it('returns a successful replacement even if deleting the old file fails', async () => {
      prisma.profilePhoto.findUnique.mockResolvedValue({ filename: 'old.jpg' });
      jest.mocked(deleteProfilePhoto).mockImplementation(() => {
        throw new Error('cleanup failed');
      });

      await expect(
        service.updateProfilePhoto(user, {}, file),
      ).resolves.toMatchObject({ profilePhoto: { url: photoUrl } });
      expect(logWarning).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete permanent file'),
      );
    });

    it('removes the saved photo and returns a null URL', async () => {
      prisma.profilePhoto.findUnique.mockResolvedValue({ filename: 'old.jpg' });

      await expect(
        service.updateProfilePhoto(user, { removeProfilePhoto: true }),
      ).resolves.toEqual({
        message: 'Profile photo removed successfully',
        profilePhoto: { url: null },
      });

      expect(prisma.profilePhoto.delete).toHaveBeenCalledWith({
        where: { userId: user.id },
      });
      expect(deleteProfilePhoto).toHaveBeenCalledWith('old.jpg');
      expect(moveFileToProfilePhotos).not.toHaveBeenCalled();
    });

    it('rejects removal when no photo exists', async () => {
      await expect(
        service.updateProfilePhoto(user, { removeProfilePhoto: true }),
      ).rejects.toThrow(new NotFoundException('Profile photo not found'));
      expect(prisma.profilePhoto.delete).not.toHaveBeenCalled();
      expect(deleteProfilePhoto).not.toHaveBeenCalled();
    });

    it('preserves the file if deleting its database record fails', async () => {
      const error = new Error('delete failed');
      prisma.profilePhoto.findUnique.mockResolvedValue({ filename: 'old.jpg' });
      prisma.profilePhoto.delete.mockRejectedValue(error);

      await expect(
        service.updateProfilePhoto(user, { removeProfilePhoto: true }),
      ).rejects.toBe(error);
      expect(deleteProfilePhoto).not.toHaveBeenCalled();
    });
  });

  describe('deleteAccount', () => {
    const dto = { password: 'correct-password' };

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        password: user.password,
        profilePhoto: null,
      });
    });

    it('rejects a missing account before checking its password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteAccount(user.id, dto)).rejects.toThrow(
        new NotFoundException('User not found'),
      );
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(contentRemoval.removeProperties).not.toHaveBeenCalled();
      expect(sessionService.endAllSessions).not.toHaveBeenCalled();
    });

    it('rejects an incorrect password before removing data', async () => {
      comparePassword.mockResolvedValue(false);

      await expect(service.deleteAccount(user.id, dto)).rejects.toThrow(
        new UnauthorizedException('Incorrect password'),
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(dto.password, user.password);
      expect(contentRemoval.removeProperties).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(sessionService.endAllSessions).not.toHaveBeenCalled();
    });

    it('anonymizes the account, replaces its password and ends all sessions', async () => {
      await expect(service.deleteAccount(user.id, dto)).resolves.toEqual({
        message: 'Account deleted successfully',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: user.id },
        select: {
          password: true,
          profilePhoto: { select: { filename: true } },
        },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(dto.password, user.password);
      expect(bcrypt.hash).toHaveBeenCalledWith(
        expect.stringMatching(/^[a-f0-9]{64}$/),
        12,
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: {
          firstName: 'Deleted',
          lastName: 'User',
          email: `deleted-${user.id}@deleted.invalid`,
          phoneNumber: `deleted-${user.id}`,
          password: 'replacement-hash',
          gender: Gender.PREFER_NOT_TO_SAY,
          dateOfBirth: new Date(0),
          termsAcceptedAt: null,
          deletedAt: expect.any(Date) as Date,
        },
      });
      expect(sessionService.endAllSessions).toHaveBeenCalledWith(user.id);
      expect(deleteProfilePhoto).not.toHaveBeenCalled();
    });

    it('removes every kind of owned content through the content removal service', async () => {
      const ownedContent = [
        ['property', 'removeProperties', 'ownerId'],
        ['job', 'removeJobs', 'employerId'],
        ['workerProfile', 'removeWorkerProfiles', 'workerId'],
        ['needAWorker', 'removeNeedAWorkerPosts', 'requesterId'],
        ['productAd', 'removeProductAds', 'sellerId'],
        ['businessListing', 'removeBusinessListings', 'ownerId'],
        ['bannerAd', 'removeBannerAds', 'creatorId'],
        ['communityPost', 'removeCommunityPosts', 'authorId'],
        ['communityEvent', 'removeCommunityEvents', 'organizerUserId'],
      ] as const;
      for (const [model] of ownedContent)
        prisma[model].findMany.mockResolvedValue([
          { id: `${model}-1` },
          { id: `${model}-2` },
        ]);

      await service.deleteAccount(user.id, dto);

      for (const [model, removal, ownerField] of ownedContent) {
        expect(prisma[model].findMany).toHaveBeenCalledWith({
          where: { [ownerField]: user.id },
          select: { id: true },
        });
        expect(contentRemoval[removal]).toHaveBeenCalledWith([
          `${model}-1`,
          `${model}-2`,
        ]);
      }
    });

    it('transfers groups to the earliest active remaining admin and removes groups without one', async () => {
      prisma.communityGroup.findMany.mockResolvedValue([
        { id: 'transfer-group' },
        { id: 'remove-group' },
      ]);
      prisma.communityGroupMember.findFirst
        .mockResolvedValueOnce({ userId: 'next-admin' })
        .mockResolvedValueOnce(null);

      await service.deleteAccount(user.id, dto);

      for (const groupId of ['transfer-group', 'remove-group']) {
        expect(prisma.communityGroupMember.findFirst).toHaveBeenCalledWith({
          where: {
            groupId,
            userId: { not: user.id },
            role: CommunityGroupMemberRole.ADMIN,
            status: CommunityGroupMemberStatus.ACTIVE,
          },
          orderBy: { createdAt: 'asc' },
        });
      }
      expect(prisma.communityGroup.update).toHaveBeenCalledTimes(1);
      expect(prisma.communityGroup.update).toHaveBeenCalledWith({
        where: { id: 'transfer-group' },
        data: { creatorId: 'next-admin' },
      });
      expect(contentRemoval.removeCommunityGroups).toHaveBeenCalledWith([
        'remove-group',
      ]);
    });

    it('cleans up user activity, support, address and photo records', async () => {
      await service.deleteAccount(user.id, dto);

      const userIdModels = [
        'communityPostLike',
        'communityPostComment',
        'communityPostShare',
        'communityGroupMember',
        'propertyLikes',
        'productAdSave',
        'resourceHubArticleSave',
        'fcmToken',
        'userSupportForm',
        'userAddress',
        'profilePhoto',
      ] as const;
      for (const model of userIdModels)
        expect(prisma[model].deleteMany).toHaveBeenCalledWith({
          where: { userId: user.id },
        });
      const otherOwners = [
        ['communityEventInterest', 'interestedUserId'],
        ['communityPostPollVote', 'voterId'],
        ['productAdOffer', 'buyerId'],
        ['jobApplications', 'applicantId'],
        ['needAWorkerApplication', 'workerId'],
        ['workRequest', 'requesterId'],
      ] as const;
      for (const [model, field] of otherOwners)
        expect(prisma[model].deleteMany).toHaveBeenCalledWith({
          where: { [field]: user.id },
        });
      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { OR: [{ recipientId: user.id }, { actorId: user.id }] },
      });
      expect(prisma.userBlock.deleteMany).toHaveBeenCalledWith({
        where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] },
      });
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Array));
    });

    it('recalculates affected counters once per post, poll option, event and group', async () => {
      prisma.communityPostLike.findMany.mockResolvedValue([
        { postId: 'post-1' },
      ]);
      prisma.communityPostComment.findMany.mockResolvedValue([
        { postId: 'post-1' },
        { postId: 'post-2' },
      ]);
      prisma.communityPostShare.findMany.mockResolvedValue([
        { postId: 'post-2' },
      ]);
      prisma.communityPostPollVote.findMany.mockResolvedValue([
        { optionId: 'option-1' },
        { optionId: 'option-1' },
      ]);
      prisma.communityEventInterest.findMany.mockResolvedValue([
        { eventId: 'event-1' },
        { eventId: 'event-1' },
      ]);
      prisma.communityGroupMember.findMany.mockResolvedValue([
        { groupId: 'group-1' },
        { groupId: 'group-1' },
      ]);
      prisma.communityPostLike.count.mockResolvedValue(2);
      prisma.communityPostComment.count.mockResolvedValue(3);
      prisma.communityPostShare.count.mockResolvedValue(4);
      prisma.communityPostPollVote.count.mockResolvedValue(5);
      prisma.communityEventInterest.count.mockResolvedValue(6);
      prisma.communityGroupMember.count.mockResolvedValue(7);

      await service.deleteAccount(user.id, dto);

      expect(prisma.communityPost.updateMany).toHaveBeenCalledTimes(2);
      for (const id of ['post-1', 'post-2']) {
        expect(prisma.communityPostLike.count).toHaveBeenCalledWith({
          where: { postId: id },
        });
        expect(prisma.communityPostComment.count).toHaveBeenCalledWith({
          where: { postId: id },
        });
        expect(prisma.communityPostShare.count).toHaveBeenCalledWith({
          where: { postId: id },
        });
        expect(prisma.communityPost.updateMany).toHaveBeenCalledWith({
          where: { id },
          data: { likesCount: 2, commentsCount: 3, sharesCount: 4 },
        });
      }
      expect(prisma.communityPostPollVote.count).toHaveBeenCalledWith({
        where: { optionId: 'option-1' },
      });
      expect(prisma.communityPostPollOption.updateMany).toHaveBeenCalledTimes(
        1,
      );
      expect(prisma.communityPostPollOption.updateMany).toHaveBeenCalledWith({
        where: { id: 'option-1' },
        data: { voteCount: 5 },
      });
      expect(prisma.communityEventInterest.count).toHaveBeenCalledWith({
        where: { eventId: 'event-1' },
      });
      expect(prisma.communityEvent.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.communityEvent.updateMany).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: { interestsCount: 6 },
      });
      expect(prisma.communityGroupMember.count).toHaveBeenCalledWith({
        where: {
          groupId: 'group-1',
          status: CommunityGroupMemberStatus.ACTIVE,
        },
      });
      expect(prisma.communityGroup.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.communityGroup.updateMany).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: { memberCount: 7 },
      });
    });

    it.each([false, true])(
      'ends sessions after photo cleanup (file deletion fails: %s)',
      async (cleanupFails) => {
        prisma.user.findUnique.mockResolvedValue({
          password: user.password,
          profilePhoto: { filename: 'old.jpg' },
        });
        if (cleanupFails)
          jest.mocked(deleteProfilePhoto).mockImplementation(() => {
            throw new Error('cleanup failed');
          });

        await expect(service.deleteAccount(user.id, dto)).resolves.toEqual({
          message: 'Account deleted successfully',
        });

        expect(deleteProfilePhoto).toHaveBeenCalledWith('old.jpg');
        expect(sessionService.endAllSessions).toHaveBeenCalledWith(user.id);
        if (cleanupFails) expect(logWarning).toHaveBeenCalled();
      },
    );

    it.each(['owned content', 'activity', 'anonymization'] as const)(
      'wraps a failure during %s and stops final cleanup',
      async (stage) => {
        const error = new Error('database failure');
        prisma.user.findUnique.mockResolvedValue({
          password: user.password,
          profilePhoto: { filename: 'old.jpg' },
        });
        if (stage === 'owned content')
          contentRemoval.removeProperties.mockRejectedValue(error);
        else if (stage === 'activity')
          prisma.$transaction.mockRejectedValue(error);
        else prisma.user.update.mockRejectedValue(error);

        await expect(service.deleteAccount(user.id, dto)).rejects.toThrow(
          new InternalServerErrorException(
            'Failed to delete account. Please try again',
          ),
        );

        expect(logError).toHaveBeenCalledWith(
          'Failed to delete account',
          error,
        );
        expect(deleteProfilePhoto).not.toHaveBeenCalled();
        expect(sessionService.endAllSessions).not.toHaveBeenCalled();
        if (stage !== 'anonymization')
          expect(prisma.user.update).not.toHaveBeenCalled();
      },
    );

    it('propagates a session termination failure after anonymization', async () => {
      const error = new Error('session termination failed');
      sessionService.endAllSessions.mockRejectedValue(error);

      await expect(service.deleteAccount(user.id, dto)).rejects.toBe(error);
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });
});
