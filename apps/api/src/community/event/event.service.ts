import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  PrismaService,
  moveFileToCommunityEventBanners,
  deleteTempFile,
  deleteCommunityEventBanner,
} from '@libs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { GetEventsQueryDto } from './dto/get-events-query.dto';
import {
  Prisma,
  CommunityEventVisibility,
  CommunityGroupMemberRole,
  CommunityGroupMemberStatus,
  CommunityGroupPrivacy,
  CommunityGroupStatus,
  NotificationType,
} from '@generated/prisma';
import { NotificationQueueService } from '../../notification/notification-queue.service';
import { findGroupModeratorIds } from '../common/utils/group-moderators';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationQueue: NotificationQueueService,
  ) {}

  private async assertCanManageEvent(
    userId: string,
    event: { organizerUserId: string | null; organizerGroupId: string | null },
  ): Promise<void> {
    if (event.organizerUserId) {
      if (event.organizerUserId !== userId) {
        throw new ForbiddenException(
          'You are not authorized to manage this event',
        );
      }
    } else if (event.organizerGroupId) {
      const groupMember = await this.prisma.communityGroupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: event.organizerGroupId,
            userId: userId,
          },
        },
      });

      if (
        !groupMember ||
        groupMember.status !== CommunityGroupMemberStatus.ACTIVE ||
        (groupMember.role !== CommunityGroupMemberRole.ADMIN &&
          groupMember.role !== CommunityGroupMemberRole.MODERATOR)
      ) {
        throw new ForbiddenException(
          'You are not authorized to manage this group event',
        );
      }
    }
  }

  async createEvent(
    userId: string,
    dto: CreateEventDto,
    banner: Express.Multer.File,
  ) {
    let bannerData: {
      url: string;
      filename: string;
      mimetype: string;
    } | null = null;

    if (dto.organizerGroupId) {
      try {
        const group = await this.prisma.communityGroup.findUnique({
          where: { id: dto.organizerGroupId },
          select: { status: true },
        });

        if (!group) {
          throw new NotFoundException('Community group not found');
        }

        if (group.status !== CommunityGroupStatus.ACTIVE) {
          throw new BadRequestException(
            'Cannot create events in an inactive or archived group',
          );
        }

        await this.assertCanManageEvent(userId, {
          organizerUserId: null,
          organizerGroupId: dto.organizerGroupId,
        });
      } catch (error) {
        if (banner) {
          deleteTempFile(banner.filename);
        }
        throw error;
      }
    }

    if (banner) {
      try {
        const finalUrl = moveFileToCommunityEventBanners(banner.filename);
        bannerData = {
          url: finalUrl,
          filename: banner.filename,
          mimetype: banner.mimetype,
        };
      } catch (error) {
        this.logger.error(`Error saving event banner: ${error.message}`);
        deleteTempFile(banner.filename);
        throw new InternalServerErrorException(
          'Failed to process event banner',
        );
      }
    }

    try {
      const newEvent = await this.prisma.communityEvent.create({
        data: {
          name: dto.name,
          startDate: dto.startDate,
          startTime: dto.startTime,
          endDate: dto.endDate,
          endTime: dto.endTime,
          location: dto.location,
          isOnline: dto.isOnline,
          description: dto.description,
          ticketPrice: dto.ticketPrice,
          maxAttendees: dto.maxAttendees,
          type: dto.type,
          visibility: dto.visibility,
          organizerUserId: dto.organizerGroupId ? null : userId,
          organizerGroupId: dto.organizerGroupId || null,
          banner: bannerData
            ? {
                create: bannerData,
              }
            : undefined,
        },
        include: {
          banner: {
            select: { url: true },
          },
          organizerGroup: {
            select: { id: true, name: true },
          },
        },
      });

      if (
        newEvent.organizerGroup &&
        newEvent.visibility !== CommunityEventVisibility.INVITE_ONLY
      ) {
        await this.notificationQueue.queueFanoutNotification({
          audience: {
            kind: 'GROUP_MEMBERS',
            groupId: newEvent.organizerGroup.id,
          },
          excludeUserIds: [userId],
          notification: {
            type: NotificationType.GROUP_EVENT_CREATED,
            actorId: userId,
            title: 'New Group Event',
            body: `${newEvent.organizerGroup.name} has a new event: ${newEvent.name}.`,
            referenceIds: {
              eventId: newEvent.id,
              groupId: newEvent.organizerGroup.id,
            },
          },
        });
      }

      return {
        message: 'Community event created successfully',
        data: newEvent,
      };
    } catch (error) {
      this.logger.error(`Error creating community event: ${error.message}`);
      if (bannerData) {
        deleteCommunityEventBanner(bannerData.filename);
      }
      throw new InternalServerErrorException(
        'Failed to create community event',
      );
    }
  }

  async updateEventBanner(
    userId: string,
    eventId: string,
    banner: Express.Multer.File,
  ) {
    let bannerData: {
      url: string;
      filename: string;
      mimetype: string;
    } | null = null;

    try {
      const event = await this.prisma.communityEvent.findUnique({
        where: { id: eventId },
        include: { banner: true },
      });

      if (!event) {
        throw new NotFoundException('Community event not found');
      }

      await this.assertCanManageEvent(userId, event);

      const finalUrl = moveFileToCommunityEventBanners(banner.filename);
      bannerData = {
        url: finalUrl,
        filename: banner.filename,
        mimetype: banner.mimetype,
      };

      const updatedEvent = await this.prisma.communityEvent.update({
        where: { id: eventId },
        data: {
          banner: {
            upsert: {
              create: bannerData,
              update: bannerData,
            },
          },
        },
        include: {
          banner: {
            select: { url: true },
          },
        },
      });

      if (event.banner) {
        deleteCommunityEventBanner(event.banner.filename);
      }

      return {
        message: 'Community event banner updated successfully',
        data: updatedEvent,
      };
    } catch (error) {
      this.logger.error(
        `Error updating community event banner: ${error.message}`,
      );

      if (bannerData) {
        deleteCommunityEventBanner(bannerData.filename);
      } else {
        deleteTempFile(banner.filename);
      }

      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to update community event banner',
      );
    }
  }

  async updateEventDetails(
    userId: string,
    eventId: string,
    dto: UpdateEventDto,
  ) {
    try {
      const event = await this.prisma.communityEvent.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw new NotFoundException('Community event not found');
      }

      await this.assertCanManageEvent(userId, event);

      const updatedEvent = await this.prisma.communityEvent.update({
        where: { id: eventId },
        data: {
          name: dto.name,
          startDate: dto.startDate,
          startTime: dto.startTime,
          endDate: dto.endDate,
          endTime: dto.endTime,
          location: dto.location,
          isOnline: dto.isOnline,
          description: dto.description,
          ticketPrice: dto.ticketPrice,
          maxAttendees: dto.maxAttendees,
          type: dto.type,
          visibility: dto.visibility,
        },
        include: {
          banner: {
            select: { url: true },
          },
        },
      });

      const isScheduleChanged =
        event.startDate.getTime() !== updatedEvent.startDate.getTime() ||
        event.startTime !== updatedEvent.startTime ||
        event.endDate.getTime() !== updatedEvent.endDate.getTime() ||
        event.endTime !== updatedEvent.endTime ||
        event.location !== updatedEvent.location ||
        event.isOnline !== updatedEvent.isOnline;

      if (isScheduleChanged) {
        const interests = await this.prisma.communityEventInterest.findMany({
          where: { eventId },
          select: { interestedUserId: true },
        });

        await this.notificationQueue.queueBulkNotifications(
          {
            type: NotificationType.EVENT_UPDATED,
            actorId: userId,
            title: 'Event Updated',
            body: `${updatedEvent.name} has been updated. Check the latest date, time and location.`,
            referenceIds: { eventId },
          },
          interests.map((interest) => interest.interestedUserId),
        );
      }

      return {
        message: 'Community event details updated successfully',
        data: updatedEvent,
      };
    } catch (error) {
      this.logger.error(
        `Error updating community event details: ${error.message}`,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to update community event details',
      );
    }
  }

  async getPublicEventFeed(userId: string, query: GetEventsQueryDto) {
    const { page = 1, limit = 10, type, isOnline } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CommunityEventWhereInput = {
      visibility: CommunityEventVisibility.PUBLIC,
      ...(type && {
        type: {
          has: type,
        },
      }),
      ...(isOnline !== undefined && { isOnline }),
      AND: [
        {
          OR: [
            { organizerUserId: { not: null } },
            {
              organizerGroup: {
                status: CommunityGroupStatus.ACTIVE,
              },
            },
          ],
        },
      ],
    };

    try {
      const [count, events] = await Promise.all([
        this.prisma.communityEvent.count({ where }),
        this.prisma.communityEvent.findMany({
          where,
          skip,
          take: limit,
          orderBy: { startDate: 'asc' },
          include: {
            banner: { select: { url: true } },
            organizerUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhoto: { select: { url: true } },
              },
            },
            organizerGroup: {
              select: {
                id: true,
                name: true,
                coverPhoto: { select: { url: true } },
              },
            },
            interests: {
              where: { interestedUserId: userId },
              select: { id: true },
            },
          },
        }),
      ]);

      const formattedEvents = events.map((event) => {
        const { interests, ...rest } = event;
        return {
          ...rest,
          isInterested: Boolean(interests && interests.length > 0),
        };
      });

      return {
        data: formattedEvents,
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching public event feed: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to fetch public event feed',
      );
    }
  }

  async getUserInterestedEvents(
    requesterId: string,
    userId: string,
    query: GetEventsQueryDto,
  ) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const isSelf = requesterId === userId;

    const eventWhereClause: Prisma.CommunityEventWhereInput = {};
    if (!isSelf) {
      eventWhereClause.visibility = CommunityEventVisibility.PUBLIC;
    }

    try {
      const [interests, count] = await Promise.all([
        this.prisma.communityEventInterest.findMany({
          where: {
            interestedUserId: userId,
            event: eventWhereClause,
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            event: {
              include: {
                banner: { select: { url: true } },
                organizerUser: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    profilePhoto: { select: { url: true } },
                  },
                },
                organizerGroup: {
                  select: {
                    id: true,
                    name: true,
                    coverPhoto: { select: { url: true } },
                  },
                },
              },
            },
          },
        }),
        this.prisma.communityEventInterest.count({
          where: {
            interestedUserId: userId,
            event: eventWhereClause,
          },
        }),
      ]);

      const events = interests.map((interest) => interest.event);

      return {
        data: events,
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      this.logger.error(
        `Error fetching user interested events: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to fetch interested events',
      );
    }
  }

  async getUserEvents(
    requesterId: string,
    userId: string,
    query: GetEventsQueryDto,
  ) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const isSelf = requesterId === userId;

    const where: Prisma.CommunityEventWhereInput = {
      organizerUserId: userId,
    };

    if (!isSelf) {
      where.visibility = CommunityEventVisibility.PUBLIC;
    }

    try {
      const [events, count] = await Promise.all([
        this.prisma.communityEvent.findMany({
          where,
          skip,
          take: limit,
          orderBy: { startDate: 'asc' },
          include: {
            banner: { select: { url: true } },
            organizerUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhoto: { select: { url: true } },
              },
            },
          },
        }),
        this.prisma.communityEvent.count({ where }),
      ]);

      return {
        data: events,
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching user events: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch user events');
    }
  }

  async getGroupEvents(
    requesterId: string,
    groupId: string,
    query: GetEventsQueryDto,
  ) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    try {
      const group = await this.prisma.communityGroup.findUnique({
        where: { id: groupId },
        select: { privacy: true, status: true },
      });

      if (!group || group.status !== CommunityGroupStatus.ACTIVE) {
        throw new NotFoundException('Community group not found or inactive');
      }

      const member = await this.prisma.communityGroupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId: requesterId,
          },
        },
      });

      const isMember =
        member && member.status === CommunityGroupMemberStatus.ACTIVE;

      if (group.privacy === CommunityGroupPrivacy.PRIVATE && !isMember) {
        throw new ForbiddenException(
          'You do not have permission to view these events',
        );
      }

      const where: Prisma.CommunityEventWhereInput = {
        organizerGroupId: groupId,
      };

      if (!isMember) {
        where.visibility = CommunityEventVisibility.PUBLIC;
      }

      const [events, count] = await Promise.all([
        this.prisma.communityEvent.findMany({
          where,
          skip,
          take: limit,
          orderBy: { startDate: 'asc' },
          include: {
            banner: { select: { url: true } },
            organizerGroup: {
              select: {
                id: true,
                name: true,
                coverPhoto: { select: { url: true } },
              },
            },
          },
        }),
        this.prisma.communityEvent.count({ where }),
      ]);

      return {
        data: events,
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching group events: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch group events');
    }
  }

  async getOrganizerGroups(userId: string) {
    try {
      const groups = await this.prisma.communityGroup.findMany({
        where: {
          status: CommunityGroupStatus.ACTIVE,
          members: {
            some: {
              userId,
              status: CommunityGroupMemberStatus.ACTIVE,
              role: {
                in: [
                  CommunityGroupMemberRole.ADMIN,
                  CommunityGroupMemberRole.MODERATOR,
                ],
              },
            },
          },
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: 'asc' },
      });

      return {
        data: groups,
      };
    } catch (error) {
      this.logger.error(`Error fetching organizer groups: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to fetch organizer groups',
      );
    }
  }

  async getEventInterestedUsers(
    requesterId: string,
    eventId: string,
    query: GetEventsQueryDto,
  ) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    try {
      const event = await this.prisma.communityEvent.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw new NotFoundException('Community event not found');
      }

      await this.assertCanManageEvent(requesterId, event);

      const [interests, count] = await Promise.all([
        this.prisma.communityEventInterest.findMany({
          where: { eventId },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            interestedUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhoto: { select: { url: true } },
              },
            },
          },
        }),
        this.prisma.communityEventInterest.count({ where: { eventId } }),
      ]);

      const users = interests.map((interest) => interest.interestedUser);

      return {
        data: users,
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      this.logger.error(
        `Error fetching event interested users: ${error.message}`,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to fetch interested users',
      );
    }
  }

  async getEventById(requesterId: string, eventId: string) {
    try {
      const event = await this.prisma.communityEvent.findUnique({
        where: { id: eventId },
        include: {
          banner: { select: { url: true } },
          organizerUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePhoto: { select: { url: true } },
            },
          },
          organizerGroup: {
            select: {
              id: true,
              name: true,
              coverPhoto: { select: { url: true } },
              status: true,
              privacy: true,
            },
          },
          interests: {
            where: { interestedUserId: requesterId },
            select: { id: true },
          },
        },
      });

      if (!event) {
        throw new NotFoundException('Community event not found');
      }

      if (event.visibility === CommunityEventVisibility.GROUP) {
        if (event.organizerGroupId) {
          const member = await this.prisma.communityGroupMember.findUnique({
            where: {
              groupId_userId: {
                groupId: event.organizerGroupId,
                userId: requesterId,
              },
            },
          });

          if (!member || member.status !== CommunityGroupMemberStatus.ACTIVE) {
            throw new ForbiddenException(
              'You must be an active member of this group to view this event',
            );
          }
        } else if (
          event.organizerUserId &&
          event.organizerUserId !== requesterId
        ) {
          throw new ForbiddenException(
            'You do not have permission to view this event',
          );
        }
      } else if (event.visibility === CommunityEventVisibility.INVITE_ONLY) {
        let isAuthorized = false;

        if (event.organizerUserId === requesterId) {
          isAuthorized = true;
        } else if (event.organizerGroupId) {
          const member = await this.prisma.communityGroupMember.findUnique({
            where: {
              groupId_userId: {
                groupId: event.organizerGroupId,
                userId: requesterId,
              },
            },
          });

          if (
            member &&
            member.status === CommunityGroupMemberStatus.ACTIVE &&
            (member.role === CommunityGroupMemberRole.ADMIN ||
              member.role === CommunityGroupMemberRole.MODERATOR)
          ) {
            isAuthorized = true;
          }
        }

        if (event.interests && event.interests.length > 0) {
          isAuthorized = true;
        }

        if (!isAuthorized) {
          throw new ForbiddenException(
            'You do not have permission to view this invite-only event',
          );
        }
      }

      const { interests, ...rest } = event;

      return {
        data: {
          ...rest,
          isInterested: Boolean(interests && interests.length > 0),
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching event by id: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch community event');
    }
  }

  async showInterest(user: any, eventId: string) {
    const userId = user.id;
    try {
      const event = await this.prisma.communityEvent.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          name: true,
          organizerUserId: true,
          organizerGroupId: true,
          visibility: true,
        },
      });

      if (!event) {
        throw new NotFoundException('Community event not found');
      }

      if (
        event.organizerGroupId &&
        event.visibility !== CommunityEventVisibility.PUBLIC
      ) {
        const member = await this.prisma.communityGroupMember.findUnique({
          where: {
            groupId_userId: {
              groupId: event.organizerGroupId,
              userId: userId,
            },
          },
        });
        if (!member || member.status !== CommunityGroupMemberStatus.ACTIVE) {
          throw new ForbiddenException('You do not have access to this event');
        }
      }

      const existingInterest =
        await this.prisma.communityEventInterest.findUnique({
          where: {
            interestedUserId_eventId: {
              interestedUserId: userId,
              eventId: eventId,
            },
          },
        });

      if (existingInterest) {
        return { message: 'You have already shown interest in this event' };
      }

      await this.prisma.$transaction([
        this.prisma.communityEventInterest.create({
          data: {
            interestedUserId: userId,
            eventId: eventId,
          },
        }),
        this.prisma.communityEvent.update({
          where: { id: eventId },
          data: { interestsCount: { increment: 1 } },
        }),
      ]);

      const organizerIds = event.organizerUserId
        ? [event.organizerUserId]
        : await findGroupModeratorIds(this.prisma, event.organizerGroupId!);

      await this.notificationQueue.queueBulkNotifications(
        {
          type: NotificationType.EVENT_INTEREST_RECEIVED,
          actorId: userId,
          title: 'New Interest in Your Event',
          body: `${user.firstName} ${user.lastName} is interested in ${event.name}.`,
          referenceIds: {
            eventId,
            ...(event.organizerGroupId && { groupId: event.organizerGroupId }),
          },
        },
        organizerIds,
      );

      return { message: 'Interest registered successfully' };
    } catch (error) {
      this.logger.error(`Error showing interest: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to register interest');
    }
  }

  async withdrawInterest(userId: string, eventId: string) {
    try {
      const existingInterest =
        await this.prisma.communityEventInterest.findUnique({
          where: {
            interestedUserId_eventId: {
              interestedUserId: userId,
              eventId: eventId,
            },
          },
        });

      if (!existingInterest) {
        throw new NotFoundException('Interest record not found');
      }

      await this.prisma.$transaction([
        this.prisma.communityEventInterest.delete({
          where: {
            interestedUserId_eventId: {
              interestedUserId: userId,
              eventId: eventId,
            },
          },
        }),
        this.prisma.communityEvent.update({
          where: { id: eventId },
          data: { interestsCount: { decrement: 1 } },
        }),
      ]);

      await this.notificationQueue.queueDeleteNotification({
        type: NotificationType.EVENT_INTEREST_RECEIVED,
        actorId: userId,
        referenceIds: { eventId },
      });

      return { message: 'Interest withdrawn successfully' };
    } catch (error) {
      this.logger.error(`Error withdrawing interest: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to withdraw interest');
    }
  }

  async deleteEvent(userId: string, eventId: string) {
    try {
      const event = await this.prisma.communityEvent.findUnique({
        where: { id: eventId },
        include: {
          banner: true,
          interests: { select: { interestedUserId: true } },
        },
      });

      if (!event) {
        throw new NotFoundException('Community event not found');
      }

      await this.assertCanManageEvent(userId, event);

      await this.prisma.communityEvent.delete({
        where: { id: eventId },
      });

      if (event.banner) {
        deleteCommunityEventBanner(event.banner.filename);
      }

      await this.notificationQueue.queueDeleteNotification({
        referenceIds: { eventId },
      });

      await this.notificationQueue.queueBulkNotifications(
        {
          type: NotificationType.EVENT_CANCELLED,
          actorId: userId,
          title: 'Event Cancelled',
          body: `${event.name} has been cancelled.`,
          referenceIds: {
            ...(event.organizerGroupId && { groupId: event.organizerGroupId }),
          },
          data: { eventName: event.name },
        },
        event.interests.map((interest) => interest.interestedUserId),
      );

      return {
        message: 'Community event deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Error deleting community event: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to delete community event',
      );
    }
  }
}
