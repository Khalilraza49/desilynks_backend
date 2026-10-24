import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min, Max } from 'class-validator';
import {
  CommunityGroupMemberStatus,
  CommunityGroupMemberRole,
} from '@generated/prisma';

export class GetAdminGroupMembersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(CommunityGroupMemberStatus)
  status?: CommunityGroupMemberStatus;

  @IsOptional()
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(CommunityGroupMemberRole)
  role?: CommunityGroupMemberRole;
}
