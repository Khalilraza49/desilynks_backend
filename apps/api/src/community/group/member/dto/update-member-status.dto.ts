import { Transform } from 'class-transformer';
import { IsEnum } from 'class-validator';
import { CommunityGroupMemberStatus } from '@generated/prisma';

export class UpdateMemberStatusDto {
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(CommunityGroupMemberStatus)
  status: CommunityGroupMemberStatus;
}
