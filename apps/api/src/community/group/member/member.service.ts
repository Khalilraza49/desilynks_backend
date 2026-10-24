import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  MethodNotAllowedException,
} from '@nestjs/common';
import { PrismaService } from '@libs/common';
import {
  Prisma,
  CommunityGroupPrivacy,
  CommunityGroupStatus,
  CommunityGroupMemberRole,
  CommunityGroupMemberStatus,
  NotificationType,
} from '@generated/prisma';
import { GetGroupMembersQueryDto } from './dto/get-group-members-query.dto';
import { GetAdminGroupMembersQueryDto } from './dto/get-admin-group-members-query.dto';
import { UpdateMemberStatusDto } from './dto/update-member-status.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { NotificationQueueService } from '../../../notification/notification-queue.service';
import { findGroupModeratorIds } from '../../common/utils/group-moderators';

@Injectable()
export class MemberService {
  private readonly logger = new Logger(MemberService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationQueue: NotificationQueueService,
  ) {}

  async joinGroup(user: any, groupId: string) {
    const userId = user.id;
    try {
      const group = await this.prisma.communityGroup.findUnique({
        where: { id: groupId },
        select: { name: true, privacy: true, status: true },
      });

      if (!group) {
        throw new NotFoundException('Community group not found');
      }

      if (group.status !== CommunityGroupStatus.ACTIVE) {
        throw new BadRequestException('Community group is no longer active');
      }

      const existingMember = await this.prisma.communityGroupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
      });

      if (existingMember) {
        if (existingMember.status === CommunityGroupMemberStatus.BANNED) {
          throw new BadRequestException('You are banned from this group');
        }
        if (existingMember.status === CommunityGroupMemberStatus.PENDING) {
          throw new BadRequestException('Your join request is already pending');
        }
        if (existingMember.status === CommunityGroupMemberStatus.ACTIVE) {
          throw new BadRequestException(
            'You are already a member of this group',
          );
        }
      }

      const newStatus =
        group.privacy === CommunityGroupPrivacy.PUBLIC
          ? CommunityGroupMemberStatus.ACTIVE
          : CommunityGroupMemberStatus.PENDING;

      const member = await this.prisma.$transaction(async (tx) => {
        let updatedMember: any;
        if (existingMember) {
          updatedMember = await tx.communityGroupMember.update({
            where: { groupId_userId: { groupId, userId } },
            data: { status: newStatus },
          });
        } else {
          updatedMember = await tx.communityGroupMember.create({
            data: {
              groupId,
              userId,
              role: CommunityGroupMemberRole.MEMBER,
              status: newStatus,
            },
          });
        }

        if (newStatus === CommunityGroupMemberStatus.ACTIVE) {
          await tx.communityGroup.update({
            where: { id: groupId },
            data: { memberCount: { increment: 1 } },
          });
        }
        return updatedMember;
      });

      if (newStatus === CommunityGroupMemberStatus.PENDING) {
        const moderatorIds = await findGroupModeratorIds(this.prisma, groupId);

        await this.notificationQueue.queueBulkNotifications(
          {
            type: NotificationType.GROUP_JOIN_REQUEST,
            actorId: userId,
            title: 'New Join Request',
            body: `${user.firstName} ${user.lastName} requested to join ${group.name}.`,
            referenceIds: { groupId },
          },
          moderatorIds,
        );
      }

      return {
        message:
          newStatus === CommunityGroupMemberStatus.ACTIVE
            ? 'Successfully joined the group'
            : 'Join request sent successfully',
        data: member,
      };
    } catch (error) {
      this.logger.error(`Error joining group: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to join the group');
    }
  }

  async leaveGroup(userId: string, groupId: string) {
    try {
      const [group, existingMember] = await Promise.all([
        this.prisma.communityGroup.findUnique({
          where: { id: groupId },
          select: { creatorId: true },
        }),
        this.prisma.communityGroupMember.findUnique({
          where: {
            groupId_userId: {
              groupId,
              userId,
            },
          },
        }),
      ]);

      if (!group) {
        throw new NotFoundException('Community group not found');
      }

      if (!existingMember) {
        throw new BadRequestException('You are not a member of this group');
      }

      if (group.creatorId === userId) {
        throw new MethodNotAllowedException(
          'Creator of group cannot leave the group',
        );
      }

      if (existingMember.role === CommunityGroupMemberRole.ADMIN) {
        const adminCount = await this.prisma.communityGroupMember.count({
          where: {
            groupId,
            role: CommunityGroupMemberRole.ADMIN,
            status: CommunityGroupMemberStatus.ACTIVE,
          },
        });

        if (adminCount === 1) {
          throw new BadRequestException(
            'You are the only admin. Please assign another admin before leaving',
          );
        }
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.communityGroupMember.delete({
          where: {
            groupId_userId: {
              groupId,
              userId,
            },
          },
        });

        if (existingMember.status === CommunityGroupMemberStatus.ACTIVE) {
          await tx.communityGroup.update({
            where: { id: groupId },
            data: { memberCount: { decrement: 1 } },
          });
        }
      });

      if (existingMember.status === CommunityGroupMemberStatus.PENDING) {
        await this.notificationQueue.queueDeleteNotification({
          type: NotificationType.GROUP_JOIN_REQUEST,
          actorId: userId,
          referenceIds: { groupId },
        });
      }

      return {
        message: 'Successfully left the group',
      };
    } catch (error) {
      this.logger.error(`Error leaving group: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof MethodNotAllowedException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to leave the group');
    }
  }

  async removeMember(
    requesterId: string,
    groupId: string,
    userIdToRemove: string,
  ) {
    if (requesterId === userIdToRemove) {
      throw new BadRequestException(
        "You cannot remove yourself. Use 'leave' instead",
      );
    }

    try {
      const [group, targetMember, requester] = await Promise.all([
        this.prisma.communityGroup.findUnique({
          where: { id: groupId },
          select: { name: true, creatorId: true },
        }),
        this.prisma.communityGroupMember.findUnique({
          where: {
            groupId_userId: { groupId, userId: userIdToRemove },
          },
        }),
        this.prisma.communityGroupMember.findUnique({
          where: {
            groupId_userId: { groupId, userId: requesterId },
          },
        }),
      ]);

      if (!group) {
        throw new NotFoundException('Community group not found');
      }

      if (!targetMember) {
        throw new NotFoundException('Member not found in this group');
      }

      if (userIdToRemove === group.creatorId) {
        throw new ForbiddenException('The group creator cannot be removed');
      }

      if (requester?.role === CommunityGroupMemberRole.MODERATOR) {
        if (
          targetMember.role === CommunityGroupMemberRole.ADMIN ||
          targetMember.role === CommunityGroupMemberRole.MODERATOR
        ) {
          throw new ForbiddenException(
            'Moderators cannot remove admins or other moderators',
          );
        }
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.communityGroupMember.delete({
          where: {
            groupId_userId: { groupId, userId: userIdToRemove },
          },
        });

        if (targetMember.status === CommunityGroupMemberStatus.ACTIVE) {
          await tx.communityGroup.update({
            where: { id: groupId },
            data: { memberCount: { decrement: 1 } },
          });
        }
      });

      if (targetMember.status === CommunityGroupMemberStatus.ACTIVE) {
        await this.notificationQueue.queueNotification({
          type: NotificationType.GROUP_MEMBER_REMOVED,
          recipientId: userIdToRemove,
          actorId: requesterId,
          title: 'Removed from Group',
          body: `You have been removed from ${group.name}.`,
          referenceIds: { groupId },
        });
      } else if (targetMember.status === CommunityGroupMemberStatus.PENDING) {
        await this.notificationQueue.queueNotification({
          type: NotificationType.GROUP_JOIN_REJECTED,
          recipientId: userIdToRemove,
          actorId: requesterId,
          title: 'Join Request Rejected',
          body: `Your request to join ${group.name} was rejected.`,
          referenceIds: { groupId },
        });

        await this.notificationQueue.queueDeleteNotification({
          type: NotificationType.GROUP_JOIN_REQUEST,
          actorId: userIdToRemove,
          referenceIds: { groupId },
        });
      }

      return {
        message: 'Member removed successfully',
      };
    } catch (error) {
      this.logger.error(`Error removing member: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof MethodNotAllowedException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to remove the member');
    }
  }

  async getGroupMembers(
    userId: string,
    groupId: string,
    query: GetGroupMembersQueryDto,
  ) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    try {
      const group = await this.prisma.communityGroup.findUnique({
        where: { id: groupId },
        select: { privacy: true },
      });

      if (!group) {
        throw new NotFoundException('Community group not found');
      }

      if (group.privacy === CommunityGroupPrivacy.PRIVATE) {
        const member = await this.prisma.communityGroupMember.findUnique({
          where: { groupId_userId: { groupId, userId } },
        });
        if (!member || member.status !== CommunityGroupMemberStatus.ACTIVE) {
          throw new ForbiddenException(
            'You must be an active member to view the members of a private group',
          );
        }
      }

      const where: Prisma.CommunityGroupMemberWhereInput = {
        groupId,
        status: CommunityGroupMemberStatus.ACTIVE,
      };

      const [count, members] = await Promise.all([
        this.prisma.communityGroupMember.count({ where }),
        this.prisma.communityGroupMember.findMany({
          where,
          skip,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhoto: { select: { url: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return {
        data: members,
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching group members: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch group members');
    }
  }

  async getAdminGroupMembers(
    groupId: string,
    query: GetAdminGroupMembersQueryDto,
  ) {
    const { page = 1, limit = 10, status, role } = query;
    const skip = (page - 1) * limit;

    try {
      const group = await this.prisma.communityGroup.findUnique({
        where: { id: groupId },
        select: { id: true },
      });

      if (!group) {
        throw new NotFoundException('Community group not found');
      }

      const where: Prisma.CommunityGroupMemberWhereInput = {
        groupId,
        ...(status && { status }),
        ...(role && { role }),
      };

      const [count, members] = await Promise.all([
        this.prisma.communityGroupMember.count({ where }),
        this.prisma.communityGroupMember.findMany({
          where,
          skip,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhoto: { select: { url: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return {
        data: members,
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching admin group members: ${error.message}`);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch admin group members',
      );
    }
  }

  async getMyMembership(userId: string, groupId: string) {
    try {
      const member = await this.prisma.communityGroupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
        include: {
          user: {
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
      });

      return {
        message: 'Membership fetched successfully',
        data: member,
      };
    } catch (error) {
      this.logger.error(`Error fetching my membership: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch membership');
    }
  }

  async updateMemberStatus(
    requesterId: string,
    groupId: string,
    userIdToUpdate: string,
    dto: UpdateMemberStatusDto,
  ) {
    try {
      const [group, targetMember, requester] = await Promise.all([
        this.prisma.communityGroup.findUnique({
          where: { id: groupId },
          select: { name: true, creatorId: true },
        }),
        this.prisma.communityGroupMember.findUnique({
          where: { groupId_userId: { groupId, userId: userIdToUpdate } },
        }),
        this.prisma.communityGroupMember.findUnique({
          where: { groupId_userId: { groupId, userId: requesterId } },
        }),
      ]);

      if (!group) {
        throw new NotFoundException('Community group not found');
      }

      if (!targetMember) {
        throw new NotFoundException('Member not found in this group.');
      }

      if (targetMember.status === dto.status) {
        return { message: 'Status is already up to date', data: targetMember };
      }

      if (userIdToUpdate === group.creatorId) {
        if (
          dto.status === CommunityGroupMemberStatus.BANNED ||
          dto.status === CommunityGroupMemberStatus.REJECTED
        ) {
          throw new ForbiddenException(
            'The group creator cannot be banned or rejected.',
          );
        }
      }

      if (requester?.role === CommunityGroupMemberRole.MODERATOR) {
        if (
          targetMember.role === CommunityGroupMemberRole.ADMIN ||
          targetMember.role === CommunityGroupMemberRole.MODERATOR
        ) {
          throw new ForbiddenException(
            'Moderators cannot change the status of admins or other moderators.',
          );
        }
      }

      const { status: currentStatus } = targetMember;
      const newStatus = dto.status;

      const validTransitions: Record<string, CommunityGroupMemberStatus[]> = {
        [CommunityGroupMemberStatus.PENDING]: [
          CommunityGroupMemberStatus.ACTIVE,
          CommunityGroupMemberStatus.REJECTED,
        ],
        [CommunityGroupMemberStatus.ACTIVE]: [
          CommunityGroupMemberStatus.BANNED,
        ],
        [CommunityGroupMemberStatus.REJECTED]: [
          CommunityGroupMemberStatus.ACTIVE,
        ],
        [CommunityGroupMemberStatus.BANNED]: [
          CommunityGroupMemberStatus.ACTIVE,
        ],
      };

      const allowed = validTransitions[currentStatus] ?? [];
      if (!allowed.includes(newStatus)) {
        throw new BadRequestException(
          `Cannot transition from ${currentStatus} to ${newStatus}.`,
        );
      }

      const updatedMember = await this.prisma.$transaction(async (tx) => {
        const member = await tx.communityGroupMember.update({
          where: { groupId_userId: { groupId, userId: userIdToUpdate } },
          data: { status: newStatus },
        });

        if (
          currentStatus !== CommunityGroupMemberStatus.ACTIVE &&
          newStatus === CommunityGroupMemberStatus.ACTIVE
        ) {
          await tx.communityGroup.update({
            where: { id: groupId },
            data: { memberCount: { increment: 1 } },
          });
        } else if (
          currentStatus === CommunityGroupMemberStatus.ACTIVE &&
          newStatus !== CommunityGroupMemberStatus.ACTIVE
        ) {
          await tx.communityGroup.update({
            where: { id: groupId },
            data: { memberCount: { decrement: 1 } },
          });
        }

        return member;
      });

      const messages: Record<string, string> = {
        [`${CommunityGroupMemberStatus.PENDING}_${CommunityGroupMemberStatus.ACTIVE}`]:
          'Member request accepted successfully',
        [`${CommunityGroupMemberStatus.PENDING}_${CommunityGroupMemberStatus.REJECTED}`]:
          'Member request rejected successfully',
        [`${CommunityGroupMemberStatus.ACTIVE}_${CommunityGroupMemberStatus.BANNED}`]:
          'Member banned successfully',
        [`${CommunityGroupMemberStatus.BANNED}_${CommunityGroupMemberStatus.ACTIVE}`]:
          'Member unbanned successfully',
        [`${CommunityGroupMemberStatus.REJECTED}_${CommunityGroupMemberStatus.ACTIVE}`]:
          'Member approved successfully',
      };

      const joinApprovedNotification = {
        type: NotificationType.GROUP_JOIN_APPROVED,
        title: 'Join Request Approved',
        body: `Your request to join ${group.name} was approved.`,
      };

      const notifications: Record<
        string,
        { type: NotificationType; title: string; body: string }
      > = {
        [`${CommunityGroupMemberStatus.PENDING}_${CommunityGroupMemberStatus.ACTIVE}`]:
          joinApprovedNotification,
        [`${CommunityGroupMemberStatus.PENDING}_${CommunityGroupMemberStatus.REJECTED}`]:
          {
            type: NotificationType.GROUP_JOIN_REJECTED,
            title: 'Join Request Rejected',
            body: `Your request to join ${group.name} was rejected.`,
          },
        [`${CommunityGroupMemberStatus.ACTIVE}_${CommunityGroupMemberStatus.BANNED}`]:
          {
            type: NotificationType.GROUP_MEMBER_BANNED,
            title: 'Banned from Group',
            body: `You have been banned from ${group.name}.`,
          },
        [`${CommunityGroupMemberStatus.BANNED}_${CommunityGroupMemberStatus.ACTIVE}`]:
          {
            type: NotificationType.GROUP_MEMBER_UNBANNED,
            title: 'Unbanned from Group',
            body: `You have been unbanned from ${group.name}.`,
          },
        [`${CommunityGroupMemberStatus.REJECTED}_${CommunityGroupMemberStatus.ACTIVE}`]:
          joinApprovedNotification,
      };

      const notification = notifications[`${currentStatus}_${newStatus}`];

      if (notification) {
        await this.notificationQueue.queueNotification({
          ...notification,
          recipientId: userIdToUpdate,
          actorId: requesterId,
          referenceIds: { groupId },
        });
      }

      if (currentStatus === CommunityGroupMemberStatus.PENDING) {
        await this.notificationQueue.queueDeleteNotification({
          type: NotificationType.GROUP_JOIN_REQUEST,
          actorId: userIdToUpdate,
          referenceIds: { groupId },
        });
      }

      return {
        message:
          messages[`${currentStatus}_${newStatus}`] ??
          'Member status updated successfully',
        data: updatedMember,
      };
    } catch (error) {
      this.logger.error(`Error updating member status: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update member status');
    }
  }

  async updateMemberRole(
    requesterId: string,
    groupId: string,
    userIdToUpdate: string,
    dto: UpdateMemberRoleDto,
  ) {
    try {
      const [group, targetMember] = await Promise.all([
        this.prisma.communityGroup.findUnique({
          where: { id: groupId },
          select: { name: true, creatorId: true },
        }),
        this.prisma.communityGroupMember.findUnique({
          where: { groupId_userId: { groupId, userId: userIdToUpdate } },
        }),
      ]);

      if (!group) {
        throw new NotFoundException('Community group not found');
      }

      if (!targetMember) {
        throw new NotFoundException('Member not found in this group');
      }

      if (targetMember.role === dto.role) {
        return { message: 'Role is already up to date', data: targetMember };
      }

      if (targetMember.status !== CommunityGroupMemberStatus.ACTIVE) {
        throw new BadRequestException(
          'Cannot change role of a non-active member',
        );
      }

      if (userIdToUpdate === group.creatorId) {
        throw new ForbiddenException(
          "The group creator's role cannot be changed",
        );
      }

      if (requesterId === userIdToUpdate) {
        throw new BadRequestException(
          'You cannot change your own role. Please assign another admin first if needed',
        );
      }

      if (
        targetMember.role === CommunityGroupMemberRole.ADMIN &&
        dto.role !== CommunityGroupMemberRole.ADMIN
      ) {
        const adminCount = await this.prisma.communityGroupMember.count({
          where: {
            groupId,
            role: CommunityGroupMemberRole.ADMIN,
            status: CommunityGroupMemberStatus.ACTIVE,
          },
        });

        if (adminCount <= 1) {
          throw new BadRequestException(
            'Cannot demote the only admin of the group.',
          );
        }
      }

      const updatedMember = await this.prisma.communityGroupMember.update({
        where: { groupId_userId: { groupId, userId: userIdToUpdate } },
        data: { role: dto.role },
      });

      await this.notificationQueue.queueNotification({
        type: NotificationType.GROUP_ROLE_UPDATED,
        recipientId: userIdToUpdate,
        actorId: requesterId,
        title: 'Group Role Updated',
        body: `Your role in ${group.name} was changed to ${dto.role.toLowerCase()}.`,
        referenceIds: { groupId },
        data: { role: dto.role },
      });

      return {
        message: 'Member role updated successfully',
        data: updatedMember,
      };
    } catch (error) {
      this.logger.error(`Error updating member role: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update member role');
    }
  }
}
