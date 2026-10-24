import { Transform } from 'class-transformer';
import { IsEnum } from 'class-validator';
import { CommunityGroupMemberRole } from '@generated/prisma';

export class UpdateMemberRoleDto {
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(CommunityGroupMemberRole)
  role: CommunityGroupMemberRole;
}
