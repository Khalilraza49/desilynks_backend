import { SetMetadata } from '@nestjs/common';
import { CommunityGroupMemberRole } from '@generated/prisma';

export const ROLES_KEY = 'group_roles';
export const GroupRoles = (...roles: CommunityGroupMemberRole[]) =>
  SetMetadata(ROLES_KEY, roles);
