import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@libs/common';
import { ROLES_KEY } from '../decorators/group-roles.decorator';
import {
  CommunityGroupMemberRole,
  CommunityGroupMemberStatus,
} from '@generated/prisma';

@Injectable()
export class GroupRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<
      CommunityGroupMemberRole[]
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    if (!user || !user?.id) {
      throw new ForbiddenException('User not authenticated');
    }

    const groupId = request.params?.id || request.params?.groupId;

    if (!groupId) {
      throw new BadRequestException('Group ID is missing in route parameters');
    }

    const member = await this.prisma.communityGroupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: groupId,
          userId: user.id,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this group');
    }

    if (member.status !== CommunityGroupMemberStatus.ACTIVE) {
      throw new ForbiddenException('Your membership is not active');
    }

    if (!requiredRoles.includes(member.role)) {
      throw new ForbiddenException(
        'You are not allowed to perform this action',
      );
    }

    return true;
  }
}
