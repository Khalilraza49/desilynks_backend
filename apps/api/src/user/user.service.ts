import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CommunityGroupMemberRole,
  CommunityGroupMemberStatus,
  Gender,
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
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfilePhotoDto } from './dto/update-profile-photo.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';

const SALT_ROUNDS = 12;

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly contentRemoval: ContentRemovalService,
  ) {}

  async getUser(user: User) {
    return {
      user,
    };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        gender: true,
        profilePhoto: { select: { url: true } },
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      user,
    };
  }

  async updateUser(userId: string, dto: UpdateUserDto) {
    const {
      firstName,
      lastName,
      gender,
      dateOfBirth,
      phoneNumber,
      streetAddress,
      postalCode,
      city,
      province,
      country,
    } = dto;

    const exisitingUser = await this.prisma.user.findFirst({
      where: {
        phoneNumber,
        NOT: {
          id: userId,
        },
      },
    });

    if (exisitingUser) {
      throw new ConflictException('Phone number is already in use');
    }

    const results = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          firstName,
          lastName,
          gender,
          dateOfBirth,
          phoneNumber,
        },
      });

      const updatedAddress = await tx.userAddress.update({
        where: {
          userId: userId,
        },
        data: {
          streetAddress: streetAddress ?? null,
          postalCode: postalCode ?? null,
          city,
          province,
          country,
        },
        select: {
          streetAddress: true,
          postalCode: true,
          city: true,
          province: true,
          country: true,
        },
      });

      const profilePhoto = await tx.profilePhoto.findUnique({
        where: { userId: userId },
        select: { url: true },
      });

      return { updatedUser, updatedAddress, profilePhoto };
    });

    const { password: _password, ...safeUser } = results.updatedUser;

    return {
      message: 'User updated successfully',
      user: {
        ...safeUser,
        profilePhoto: {
          url: results.profilePhoto?.url ?? null,
        },
        userAddress: results.updatedAddress,
      },
    };
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        password: true,
        profilePhoto: { select: { filename: true } },
      },
    });

    if (!account) {
      throw new NotFoundException('User not found');
    }

    const isPasswordCorrect = await bcrypt.compare(
      dto.password,
      account.password,
    );
    if (!isPasswordCorrect) {
      throw new UnauthorizedException('Incorrect password');
    }

    try {
      await this.removeOwnedContent(userId);
      await this.removeUserActivity(userId);
      await this.anonymizeUser(userId);
    } catch (err) {
      this.logger.error('Failed to delete account', err);
      throw new InternalServerErrorException(
        'Failed to delete account. Please try again',
      );
    }

    if (account.profilePhoto) {
      this.safeDeleteFile(account.profilePhoto.filename, 'permanent');
    }

    await this.sessionService.endAllSessions(userId);

    return {
      message: 'Account deleted successfully',
    };
  }

  async updateProfilePhoto(
    user: User,
    dto: UpdateProfilePhotoDto,
    file?: Express.Multer.File,
  ) {
    const removeProfilePhoto = dto.removeProfilePhoto ?? false;

    if (file) {
      return this.setProfilePhoto(user, file);
    }

    if (removeProfilePhoto) {
      return this.removeProfilePhotoForUser(user);
    }

    return { message: 'No changes requested' };
  }

  private async setProfilePhoto(user: User, file: Express.Multer.File) {
    let moved = false;

    try {
      const existingPhoto = await this.prisma.profilePhoto.findUnique({
        where: { userId: user.id },
        select: { filename: true },
      });

      const profilePhotoUrl = moveFileToProfilePhotos(file.filename);
      moved = true;

      const profilePhoto = await this.prisma.profilePhoto.upsert({
        where: { userId: user.id },
        create: {
          url: profilePhotoUrl,
          filename: file.filename,
          mimetype: file.mimetype,
          userId: user.id,
        },
        update: {
          url: profilePhotoUrl,
          filename: file.filename,
          mimetype: file.mimetype,
        },
      });

      if (existingPhoto) {
        this.safeDeleteFile(existingPhoto.filename, 'permanent');
      }

      return {
        message: 'Profile photo updated successfully',
        profilePhoto: { url: profilePhoto.url },
      };
    } catch (err) {
      this.safeDeleteFile(file.filename, moved ? 'permanent' : 'temp');
      throw err;
    }
  }

  private async removeProfilePhotoForUser(user: User) {
    const existingPhoto = await this.prisma.profilePhoto.findUnique({
      where: { userId: user.id },
      select: { filename: true },
    });

    if (!existingPhoto) {
      throw new NotFoundException('Profile photo not found');
    }

    await this.prisma.profilePhoto.delete({ where: { userId: user.id } });

    this.safeDeleteFile(existingPhoto.filename, 'permanent');

    return {
      message: 'Profile photo removed successfully',
      profilePhoto: { url: null },
    };
  }

  private async removeOwnedContent(userId: string) {
    const ownerOf = { select: { id: true } };
    const [
      properties,
      jobs,
      workerProfiles,
      needAWorkerPosts,
      productAds,
      businessListings,
      bannerAds,
      posts,
      events,
      createdGroups,
    ] = await Promise.all([
      this.prisma.property.findMany({ where: { ownerId: userId }, ...ownerOf }),
      this.prisma.job.findMany({ where: { employerId: userId }, ...ownerOf }),
      this.prisma.workerProfile.findMany({
        where: { workerId: userId },
        ...ownerOf,
      }),
      this.prisma.needAWorker.findMany({
        where: { requesterId: userId },
        ...ownerOf,
      }),
      this.prisma.productAd.findMany({
        where: { sellerId: userId },
        ...ownerOf,
      }),
      this.prisma.businessListing.findMany({
        where: { ownerId: userId },
        ...ownerOf,
      }),
      this.prisma.bannerAd.findMany({
        where: { creatorId: userId },
        ...ownerOf,
      }),
      this.prisma.communityPost.findMany({
        where: { authorId: userId },
        ...ownerOf,
      }),
      this.prisma.communityEvent.findMany({
        where: { organizerUserId: userId },
        ...ownerOf,
      }),
      this.prisma.communityGroup.findMany({
        where: { creatorId: userId },
        ...ownerOf,
      }),
    ]);

    const ids = (records: { id: string }[]) => records.map((r) => r.id);

    await this.contentRemoval.removeProperties(ids(properties));
    await this.contentRemoval.removeJobs(ids(jobs));
    await this.contentRemoval.removeWorkerProfiles(ids(workerProfiles));
    await this.contentRemoval.removeNeedAWorkerPosts(ids(needAWorkerPosts));
    await this.contentRemoval.removeProductAds(ids(productAds));
    await this.contentRemoval.removeBusinessListings(ids(businessListings));
    await this.contentRemoval.removeBannerAds(ids(bannerAds));
    await this.contentRemoval.removeCommunityPosts(ids(posts));
    await this.contentRemoval.removeCommunityEvents(ids(events));

    const groupsToRemove: string[] = [];
    for (const group of createdGroups) {
      const nextAdmin = await this.prisma.communityGroupMember.findFirst({
        where: {
          groupId: group.id,
          userId: { not: userId },
          role: CommunityGroupMemberRole.ADMIN,
          status: CommunityGroupMemberStatus.ACTIVE,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (nextAdmin) {
        await this.prisma.communityGroup.update({
          where: { id: group.id },
          data: { creatorId: nextAdmin.userId },
        });
      } else {
        groupsToRemove.push(group.id);
      }
    }

    await this.contentRemoval.removeCommunityGroups(groupsToRemove);
  }

  private async removeUserActivity(userId: string) {
    const [likes, comments, shares, votes, interests, memberships] =
      await Promise.all([
        this.prisma.communityPostLike.findMany({
          where: { userId },
          select: { postId: true },
        }),
        this.prisma.communityPostComment.findMany({
          where: { userId },
          select: { postId: true },
        }),
        this.prisma.communityPostShare.findMany({
          where: { userId },
          select: { postId: true },
        }),
        this.prisma.communityPostPollVote.findMany({
          where: { voterId: userId },
          select: { optionId: true },
        }),
        this.prisma.communityEventInterest.findMany({
          where: { interestedUserId: userId },
          select: { eventId: true },
        }),
        this.prisma.communityGroupMember.findMany({
          where: { userId },
          select: { groupId: true },
        }),
      ]);

    await this.prisma.$transaction([
      this.prisma.communityPostLike.deleteMany({ where: { userId } }),
      this.prisma.communityPostComment.deleteMany({ where: { userId } }),
      this.prisma.communityPostShare.deleteMany({ where: { userId } }),
      this.prisma.communityPostPollVote.deleteMany({
        where: { voterId: userId },
      }),
      this.prisma.communityEventInterest.deleteMany({
        where: { interestedUserId: userId },
      }),
      this.prisma.communityGroupMember.deleteMany({ where: { userId } }),
      this.prisma.propertyLikes.deleteMany({ where: { userId } }),
      this.prisma.productAdSave.deleteMany({ where: { userId } }),
      this.prisma.productAdOffer.deleteMany({ where: { buyerId: userId } }),
      this.prisma.jobApplications.deleteMany({
        where: { applicantId: userId },
      }),
      this.prisma.needAWorkerApplication.deleteMany({
        where: { workerId: userId },
      }),
      this.prisma.workRequest.deleteMany({ where: { requesterId: userId } }),
      this.prisma.resourceHubArticleSave.deleteMany({ where: { userId } }),
      this.prisma.notification.deleteMany({
        where: { OR: [{ recipientId: userId }, { actorId: userId }] },
      }),
      this.prisma.userBlock.deleteMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      }),
      this.prisma.fcmToken.deleteMany({ where: { userId } }),
      this.prisma.userSupportForm.deleteMany({ where: { userId } }),
      this.prisma.userAddress.deleteMany({ where: { userId } }),
      this.prisma.profilePhoto.deleteMany({ where: { userId } }),
    ]);

    const postIds = new Set(
      [...likes, ...comments, ...shares].map((item) => item.postId),
    );
    for (const postId of postIds) {
      const [likesCount, commentsCount, sharesCount] = await Promise.all([
        this.prisma.communityPostLike.count({ where: { postId } }),
        this.prisma.communityPostComment.count({ where: { postId } }),
        this.prisma.communityPostShare.count({ where: { postId } }),
      ]);

      await this.prisma.communityPost.updateMany({
        where: { id: postId },
        data: { likesCount, commentsCount, sharesCount },
      });
    }

    for (const optionId of new Set(votes.map((vote) => vote.optionId))) {
      const voteCount = await this.prisma.communityPostPollVote.count({
        where: { optionId },
      });

      await this.prisma.communityPostPollOption.updateMany({
        where: { id: optionId },
        data: { voteCount },
      });
    }

    for (const eventId of new Set(interests.map((i) => i.eventId))) {
      const interestsCount = await this.prisma.communityEventInterest.count({
        where: { eventId },
      });

      await this.prisma.communityEvent.updateMany({
        where: { id: eventId },
        data: { interestsCount },
      });
    }

    for (const groupId of new Set(memberships.map((m) => m.groupId))) {
      const memberCount = await this.prisma.communityGroupMember.count({
        where: { groupId, status: CommunityGroupMemberStatus.ACTIVE },
      });

      await this.prisma.communityGroup.updateMany({
        where: { id: groupId },
        data: { memberCount },
      });
    }
  }

  private async anonymizeUser(userId: string) {
    const unusablePassword = await bcrypt.hash(
      randomBytes(32).toString('hex'),
      SALT_ROUNDS,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: 'Deleted',
        lastName: 'User',
        email: `deleted-${userId}@deleted.invalid`,
        phoneNumber: `deleted-${userId}`,
        password: unusablePassword,
        gender: Gender.PREFER_NOT_TO_SAY,
        dateOfBirth: new Date(0),
        termsAcceptedAt: null,
        deletedAt: new Date(),
      },
    });
  }

  private safeDeleteFile(filename: string, location: 'permanent' | 'temp') {
    try {
      if (location === 'permanent') {
        deleteProfilePhoto(filename);
      } else {
        deleteTempFile(filename);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to delete ${location} file "${filename}": ${err}`,
      );
    }
  }
}
