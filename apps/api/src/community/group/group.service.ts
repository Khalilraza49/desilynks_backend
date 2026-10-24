import {
  Injectable,
  InternalServerErrorException,
  Logger,
  MethodNotAllowedException,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaService,
  moveFileToCommunityGroupCovers,
  deleteTempFile,
  deleteCommunityGroupCover,
} from '@libs/common';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import {
  Prisma,
  CommunityGroupMemberRole,
  CommunityGroupMemberStatus,
  CommunityGroupStatus,
} from '@generated/prisma';
import { GetAllGroupsQueryDto } from './dto/get-all-groups-query.dto';
import { GetUserGroupsQueryDto } from './dto/get-user-groups-query.dto';

@Injectable()
export class GroupService {
  private readonly logger = new Logger(GroupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createGroup(
    userId: string,
    dto: CreateGroupDto,
    coverPhoto?: Express.Multer.File,
  ) {
    let coverPhotoData: {
      url: string;
      filename: string;
      mimetype: string;
    } | null = null;

    if (coverPhoto) {
      try {
        const finalUrl = moveFileToCommunityGroupCovers(coverPhoto.filename);
        coverPhotoData = {
          url: finalUrl,
          filename: coverPhoto.filename,
          mimetype: coverPhoto.mimetype,
        };
      } catch (error) {
        this.logger.error(`Error saving cover photo: ${error.message}`);
        deleteTempFile(coverPhoto.filename);
        throw new InternalServerErrorException('Failed to process cover photo');
      }
    }

    try {
      const newGroup = await this.prisma.communityGroup.create({
        data: {
          name: dto.name,
          description: dto.description,
          category: dto.category,
          privacy: dto.privacy,
          creatorId: userId,
          memberCount: 1,
          coverPhoto: coverPhotoData
            ? {
                create: coverPhotoData,
              }
            : undefined,
          members: {
            create: [
              {
                userId: userId,
                role: CommunityGroupMemberRole.ADMIN,
              },
            ],
          },
        },
        include: {
          coverPhoto: {
            select: { url: true },
          },
        },
      });

      return {
        message: 'Community group created successfully',
        data: newGroup,
      };
    } catch (error) {
      this.logger.error(`Error creating community group: ${error.message}`);
      if (coverPhotoData) {
        deleteCommunityGroupCover(coverPhotoData.filename);
      }
      throw new InternalServerErrorException(
        'Failed to create community group',
      );
    }
  }

  async updateGroupDetails(groupId: string, dto: UpdateGroupDto) {
    try {
      const group = await this.prisma.communityGroup.findUnique({
        where: { id: groupId },
      });

      if (!group) {
        throw new NotFoundException('Community group not found');
      }

      const updatedGroup = await this.prisma.communityGroup.update({
        where: { id: groupId },
        data: {
          ...dto,
        },
        include: {
          coverPhoto: {
            select: {
              url: true,
            },
          },
        },
      });

      return {
        message: 'Community group updated successfully',
        data: updatedGroup,
      };
    } catch (error) {
      this.logger.error(`Error updating community group: ${error.message}`);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to update community group',
      );
    }
  }

  async updateGroupCover(groupId: string, coverPhoto: Express.Multer.File) {
    const group = await this.prisma.communityGroup.findUnique({
      where: { id: groupId },
      include: { coverPhoto: true },
    });

    if (!group) {
      deleteTempFile(coverPhoto.filename);
      throw new NotFoundException('Community group not found');
    }

    const oldCoverPhoto = group.coverPhoto;
    let newCoverPhotoData: {
      url: string;
      filename: string;
      mimetype: string;
    } | null = null;

    try {
      const finalUrl = moveFileToCommunityGroupCovers(coverPhoto.filename);
      newCoverPhotoData = {
        url: finalUrl,
        filename: coverPhoto.filename,
        mimetype: coverPhoto.mimetype,
      };
    } catch (error) {
      this.logger.error(`Error saving new cover photo: ${error.message}`);
      deleteTempFile(coverPhoto.filename);
      throw new InternalServerErrorException(
        'Failed to process new cover photo',
      );
    }

    try {
      const updatedGroup = await this.prisma.communityGroup.update({
        where: { id: groupId },
        data: {
          coverPhoto: {
            upsert: {
              create: newCoverPhotoData,
              update: newCoverPhotoData,
            },
          },
        },
        include: {
          coverPhoto: {
            select: {
              url: true,
            },
          },
        },
      });

      if (oldCoverPhoto) {
        deleteCommunityGroupCover(oldCoverPhoto.filename);
      }

      return {
        message: 'Community group cover updated successfully',
        data: updatedGroup,
      };
    } catch (error) {
      this.logger.error(
        `Error updating community group cover in DB: ${error.message}`,
      );
      if (newCoverPhotoData) {
        deleteCommunityGroupCover(newCoverPhotoData.filename);
      }
      throw new InternalServerErrorException(
        'Failed to update community group cover',
      );
    }
  }

  async getAllGroups(query: GetAllGroupsQueryDto) {
    const { page = 1, limit = 10, category } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CommunityGroupWhereInput = {
      status: CommunityGroupStatus.ACTIVE,
      ...(category && { category }),
    };

    try {
      const [count, groups] = await Promise.all([
        this.prisma.communityGroup.count({ where }),
        this.prisma.communityGroup.findMany({
          where,
          skip,
          take: limit,
          include: {
            coverPhoto: { select: { url: true } },
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhoto: {
                  select: { url: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return {
        data: groups,
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching community groups: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to fetch community groups',
      );
    }
  }

  async getUserGroups(userId: string, query: GetUserGroupsQueryDto) {
    const { page = 1, limit = 10, category } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CommunityGroupWhereInput = {
      members: {
        some: {
          userId,
          status: CommunityGroupMemberStatus.ACTIVE,
        },
      },
      ...(category && { category }),
    };

    try {
      const [count, groups] = await Promise.all([
        this.prisma.communityGroup.count({ where }),
        this.prisma.communityGroup.findMany({
          where,
          skip,
          take: limit,
          include: {
            coverPhoto: { select: { url: true } },
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhoto: {
                  select: { url: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return {
        data: groups,
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching user groups: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch user groups');
    }
  }

  async getGroupById(userId: string, groupId: string) {
    try {
      const group = await this.prisma.communityGroup.findUnique({
        where: { id: groupId },
        include: {
          coverPhoto: { select: { url: true } },
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

      if (!group) {
        throw new NotFoundException('Community group not found');
      }

      if (
        group.status !== CommunityGroupStatus.ACTIVE &&
        group.creatorId !== userId
      ) {
        throw new NotFoundException('Community group not found');
      }

      return {
        data: group,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching community group by id: ${error.message}`,
      );
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to fetch community group');
    }
  }

  async toggleArchiveGroup(groupId: string) {
    try {
      const group = await this.prisma.communityGroup.findUnique({
        where: { id: groupId },
      });

      if (!group) {
        throw new NotFoundException('Community group not found');
      }

      if (group.status === CommunityGroupStatus.SUSPENDED) {
        throw new MethodNotAllowedException(
          'You cannot update the status of suspended group',
        );
      }

      const newStatus =
        group.status === CommunityGroupStatus.ARCHIVED
          ? CommunityGroupStatus.ACTIVE
          : CommunityGroupStatus.ARCHIVED;

      const updatedGroup = await this.prisma.communityGroup.update({
        where: { id: groupId },
        data: { status: newStatus },
      });

      return {
        message: `Community group ${newStatus === CommunityGroupStatus.ARCHIVED ? 'archived' : 'unarchived'} successfully`,
        data: updatedGroup,
      };
    } catch (error) {
      this.logger.error(
        `Error toggling community group archive status: ${error.message}`,
      );
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to toggle community group archive status',
      );
    }
  }
}
