import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  PrismaService,
  moveFileToCommunityPostPhotos,
  moveFileToCommunityPostVideos,
  deleteTempFile,
  deleteCommunityPostPhoto,
  deleteCommunityPostVideo,
} from '@libs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { GetPublicFeedQueryDto } from './dto/get-public-feed-query.dto';
import { GetGroupPostsQueryDto } from './dto/get-group-posts-query.dto';
import { GetMyPostsQueryDto } from './dto/get-my-posts-query.dto';
import {
  Prisma,
  CommunityPostType,
  CommunityPostVisibility,
  CommunityPostStatus,
  CommunityGroupStatus,
  CommunityGroupMemberStatus,
  CommunityGroupMemberRole,
  NotificationType,
} from '@generated/prisma';
import { NotificationQueueService } from '../../notification/notification-queue.service';
import { BlockService } from '../../moderation/block.service';

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationQueue: NotificationQueueService,
    private readonly blockService: BlockService,
  ) {}

  async createPost(
    userId: string,
    dto: CreatePostDto,
    files: {
      photos?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ) {
    const photos = files?.photos || [];
    const video = files?.video?.[0];

    this.validateFilesForType(dto.type, photos, video);

    if (dto.visibility !== CommunityPostVisibility.GROUP && dto.groupId) {
      this.cleanupTempFiles(photos, video);
      throw new BadRequestException(
        'groupId must not be provided for PUBLIC or PRIVATE posts',
      );
    }

    if (dto.visibility === CommunityPostVisibility.GROUP) {
      await this.verifyGroupMembership(userId, dto.groupId!, photos, video);
    }

    const movedPhotos: { url: string; filename: string; mimetype: string }[] =
      [];
    let movedVideo: { url: string; filename: string; mimetype: string } | null =
      null;

    try {
      for (const photo of photos) {
        const url = moveFileToCommunityPostPhotos(photo.filename);
        movedPhotos.push({
          url,
          filename: photo.filename,
          mimetype: photo.mimetype,
        });
      }

      if (video) {
        const url = moveFileToCommunityPostVideos(video.filename);
        movedVideo = {
          url,
          filename: video.filename,
          mimetype: video.mimetype,
        };
      }
    } catch (error) {
      this.logger.error(`Error processing media files: ${error.message}`);
      this.rollbackMovedFiles(movedPhotos, movedVideo);
      this.cleanupTempFiles(photos, video);
      throw new InternalServerErrorException('Failed to process media files');
    }

    try {
      const post = await this.prisma.communityPost.create({
        data: {
          authorId: userId,
          type: dto.type,
          visibility: dto.visibility,
          content: dto.type !== CommunityPostType.POLL ? dto.content : null,
          groupId:
            dto.visibility === CommunityPostVisibility.GROUP
              ? dto.groupId
              : null,
          ...(dto.type === CommunityPostType.PHOTO &&
            movedPhotos.length > 0 && {
              photos: {
                create: movedPhotos.map((p) => ({
                  url: p.url,
                  filename: p.filename,
                  mimetype: p.mimetype,
                })),
              },
            }),
          ...(dto.type === CommunityPostType.VIDEO &&
            movedVideo && {
              video: {
                create: {
                  url: movedVideo.url,
                  filename: movedVideo.filename,
                  mimetype: movedVideo.mimetype,
                },
              },
            }),
          ...(dto.type === CommunityPostType.POLL && {
            poll: {
              create: {
                question: dto.pollQuestion!,
                expiresAt: dto.pollExpiresAt
                  ? new Date(dto.pollExpiresAt)
                  : null,
                options: {
                  create: dto.pollOptions!.map((text) => ({ text })),
                },
              },
            },
          }),
        },
        include: this.getPostInclude(userId),
      });

      return {
        message: 'Post created successfully',
        data: this.formatPost(post),
      };
    } catch (error) {
      this.logger.error(`Error creating post in database: ${error.message}`);
      this.rollbackMovedFiles(movedPhotos, movedVideo);
      throw new InternalServerErrorException('Failed to create post');
    }
  }

  async getPublicFeed(userId: string, query: GetPublicFeedQueryDto) {
    const { page = 1, limit = 10, type } = query;
    const skip = (page - 1) * limit;

    const blockedUserIds = await this.blockService.getBlockedUserIds(userId);

    const where: Prisma.CommunityPostWhereInput = {
      visibility: CommunityPostVisibility.PUBLIC,
      status: CommunityPostStatus.ACTIVE,
      authorId: { notIn: blockedUserIds },
      ...(type && { type }),
    };

    try {
      const [count, posts] = await Promise.all([
        this.prisma.communityPost.count({ where }),
        this.prisma.communityPost.findMany({
          where,
          skip,
          take: limit,
          include: this.getPostInclude(userId),
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return {
        data: posts.map((post) => this.formatPost(post)),
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching public feed: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch public feed');
    }
  }

  async getGroupPosts(
    userId: string,
    groupId: string,
    query: GetGroupPostsQueryDto,
  ) {
    const group = await this.prisma.communityGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Community group not found');
    }

    if (group.status !== CommunityGroupStatus.ACTIVE) {
      throw new BadRequestException(
        'Cannot view posts in an inactive or archived group',
      );
    }

    const member = await this.prisma.communityGroupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId },
      },
    });

    if (!member || member.status !== CommunityGroupMemberStatus.ACTIVE) {
      throw new ForbiddenException(
        'You must be an active member of this group to view posts',
      );
    }

    const { page = 1, limit = 10, type } = query;
    const skip = (page - 1) * limit;

    const blockedUserIds = await this.blockService.getBlockedUserIds(userId);

    const where: Prisma.CommunityPostWhereInput = {
      groupId,
      visibility: CommunityPostVisibility.GROUP,
      status: CommunityPostStatus.ACTIVE,
      authorId: { notIn: blockedUserIds },
      ...(type && { type }),
    };

    try {
      const [count, posts] = await Promise.all([
        this.prisma.communityPost.count({ where }),
        this.prisma.communityPost.findMany({
          where,
          skip,
          take: limit,
          include: this.getPostInclude(userId),
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return {
        data: posts.map((post) => this.formatPost(post)),
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching group posts: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch group posts');
    }
  }

  async getMyPosts(userId: string, query: GetMyPostsQueryDto) {
    const { page = 1, limit = 10, type, visibility } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CommunityPostWhereInput = {
      authorId: userId,
      ...(type && { type }),
      ...(visibility && { visibility }),
    };

    try {
      const [count, posts] = await Promise.all([
        this.prisma.communityPost.count({ where }),
        this.prisma.communityPost.findMany({
          where,
          skip,
          take: limit,
          include: this.getPostInclude(userId),
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return {
        data: posts.map((post) => this.formatPost(post)),
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching user posts: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch your posts');
    }
  }

  async getPostById(userId: string, postId: string) {
    try {
      const post = await this.prisma.communityPost.findUnique({
        where: { id: postId },
        include: this.getPostInclude(userId),
      });

      if (!post || post.status !== CommunityPostStatus.ACTIVE) {
        throw new NotFoundException('Post not found');
      }

      if (post.visibility === CommunityPostVisibility.PRIVATE) {
        if (post.authorId !== userId) {
          throw new NotFoundException('Post not found');
        }
      }

      if (await this.blockService.isBlockedBetween(userId, post.authorId)) {
        throw new NotFoundException('Post not found');
      }

      if (post.visibility === CommunityPostVisibility.GROUP) {
        const member = await this.prisma.communityGroupMember.findUnique({
          where: {
            groupId_userId: { groupId: post.groupId!, userId },
          },
        });

        if (!member || member.status !== CommunityGroupMemberStatus.ACTIVE) {
          throw new ForbiddenException(
            'You must be an active member of this group to view this post',
          );
        }
      }

      return {
        data: this.formatPost(post),
      };
    } catch (error) {
      this.logger.error(`Error fetching post by id: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      )
        throw error;
      throw new InternalServerErrorException('Failed to fetch post');
    }
  }

  async deletePost(userId: string, postId: string) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
      include: {
        photos: true,
        video: true,
        group: { select: { name: true } },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const isAuthor = post.authorId === userId;

    let isGroupAdminOrMod = false;
    if (!isAuthor && post.groupId) {
      const member = await this.prisma.communityGroupMember.findUnique({
        where: {
          groupId_userId: { groupId: post.groupId, userId },
        },
      });

      if (
        member &&
        member.status === CommunityGroupMemberStatus.ACTIVE &&
        (member.role === CommunityGroupMemberRole.ADMIN ||
          member.role === CommunityGroupMemberRole.MODERATOR)
      ) {
        isGroupAdminOrMod = true;
      }
    }

    if (!isAuthor && !isGroupAdminOrMod) {
      throw new ForbiddenException('You are not allowed to delete this post');
    }

    const photoFilenames = post.photos.map((p) => p.filename);
    const videoFilename = post.video?.filename;

    try {
      await this.prisma.communityPost.delete({
        where: { id: postId },
      });
    } catch (error) {
      this.logger.error(`Error deleting post from database: ${error.message}`);
      throw new InternalServerErrorException('Failed to delete post');
    }

    await this.notificationQueue.queueDeleteNotification({
      referenceIds: { postId },
    });

    if (isGroupAdminOrMod) {
      await this.notificationQueue.queueNotification({
        type: NotificationType.POST_REMOVED,
        recipientId: post.authorId,
        actorId: userId,
        title: 'Your Post was Removed',
        body: `Your post in ${post.group?.name} was removed by a group admin.`,
        referenceIds: { groupId: post.groupId! },
      });
    }

    for (const filename of photoFilenames) {
      try {
        deleteCommunityPostPhoto(filename);
      } catch (e) {
        this.logger.error(`Failed to delete photo ${filename}: ${e.message}`);
      }
    }

    if (videoFilename) {
      try {
        deleteCommunityPostVideo(videoFilename);
      } catch (e) {
        this.logger.error(
          `Failed to delete video ${videoFilename}: ${e.message}`,
        );
      }
    }

    return {
      message: 'Post deleted successfully',
    };
  }

  private validateFilesForType(
    type: CommunityPostType,
    photos: Express.Multer.File[],
    video?: Express.Multer.File,
  ): void {
    switch (type) {
      case CommunityPostType.TEXT:
        if (photos.length > 0 || video) {
          this.cleanupTempFiles(photos, video);
          throw new BadRequestException(
            'TEXT posts must not include photos or video',
          );
        }
        break;

      case CommunityPostType.PHOTO:
        if (video) {
          this.cleanupTempFiles(photos, video);
          throw new BadRequestException('PHOTO posts must not include a video');
        }
        if (photos.length === 0) {
          throw new BadRequestException(
            'PHOTO posts require at least 1 photo (max 5)',
          );
        }
        if (photos.length > 5) {
          this.cleanupTempFiles(photos, video);
          throw new BadRequestException(
            'PHOTO posts allow a maximum of 5 photos',
          );
        }
        break;

      case CommunityPostType.VIDEO:
        if (photos.length > 0) {
          this.cleanupTempFiles(photos, video);
          throw new BadRequestException('VIDEO posts must not include photos');
        }
        if (!video) {
          throw new BadRequestException('VIDEO posts require exactly 1 video');
        }
        break;

      case CommunityPostType.POLL:
        if (photos.length > 0 || video) {
          this.cleanupTempFiles(photos, video);
          throw new BadRequestException(
            'POLL posts must not include photos or video',
          );
        }
        break;
    }
  }

  private async verifyGroupMembership(
    userId: string,
    groupId: string,
    photos: Express.Multer.File[],
    video?: Express.Multer.File,
  ): Promise<void> {
    const group = await this.prisma.communityGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      this.cleanupTempFiles(photos, video);
      throw new NotFoundException('Community group not found');
    }

    if (group.status !== CommunityGroupStatus.ACTIVE) {
      this.cleanupTempFiles(photos, video);
      throw new BadRequestException(
        'Cannot post in an inactive or archived group',
      );
    }

    const member = await this.prisma.communityGroupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!member || member.status !== CommunityGroupMemberStatus.ACTIVE) {
      this.cleanupTempFiles(photos, video);
      throw new ForbiddenException(
        'You must be an active member of this group to post',
      );
    }
  }

  private cleanupTempFiles(
    photos: Express.Multer.File[],
    video?: Express.Multer.File,
  ): void {
    for (const photo of photos) {
      deleteTempFile(photo.filename);
    }
    if (video) {
      deleteTempFile(video.filename);
    }
  }

  private rollbackMovedFiles(
    movedPhotos: { filename: string }[],
    movedVideo: { filename: string } | null,
  ): void {
    for (const photo of movedPhotos) {
      deleteCommunityPostPhoto(photo.filename);
    }
    if (movedVideo) {
      deleteCommunityPostVideo(movedVideo.filename);
    }
  }

  private getPostInclude(userId: string) {
    return {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profilePhoto: { select: { url: true } },
        },
      },
      group: {
        select: {
          id: true,
          name: true,
          coverPhoto: { select: { url: true } },
        },
      },
      photos: {
        select: { id: true, url: true },
      },
      video: {
        select: { id: true, url: true },
      },
      poll: {
        select: {
          id: true,
          question: true,
          expiresAt: true,
          options: {
            select: {
              id: true,
              text: true,
              voteCount: true,
              votes: {
                where: { voterId: userId },
                select: { id: true },
              },
            },
          },
        },
      },
      likes: {
        where: { userId },
        select: { id: true },
      },
    } satisfies Prisma.CommunityPostInclude;
  }

  private formatPost(post: any) {
    const { likes, ...rest } = post;

    let formattedPoll = rest.poll;
    if (rest.poll) {
      const poll = rest.poll;
      const isExpired = poll.expiresAt
        ? new Date(poll.expiresAt) < new Date()
        : false;

      const votedOption = poll.options?.find((o: any) => o.votes?.length > 0);
      const hasVoted = !!votedOption;

      if (!hasVoted && !isExpired) {
        formattedPoll = {
          id: poll.id,
          question: poll.question,
          expiresAt: poll.expiresAt,
          isExpired,
          hasVoted: false,
          votedOptionId: null,
          totalVotes: null,
          options: poll.options.map((o: any) => ({
            id: o.id,
            text: o.text,
          })),
        };
      } else {
        const totalVotes = poll.options.reduce(
          (sum: number, o: any) => sum + o.voteCount,
          0,
        );

        formattedPoll = {
          id: poll.id,
          question: poll.question,
          expiresAt: poll.expiresAt,
          isExpired,
          hasVoted,
          votedOptionId: votedOption?.id ?? null,
          totalVotes,
          options: poll.options.map((o: any) => ({
            id: o.id,
            text: o.text,
            voteCount: o.voteCount,
            percentage:
              totalVotes > 0
                ? Math.round((o.voteCount / totalVotes) * 100 * 10) / 10
                : 0,
          })),
        };
      }
    }

    return {
      ...rest,
      poll: formattedPoll,
      isLikedByMe: likes?.length > 0,
    };
  }
}
