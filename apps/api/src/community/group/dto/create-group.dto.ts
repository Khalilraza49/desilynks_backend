import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  CommunityGroupCategory,
  CommunityGroupPrivacy,
} from '@generated/prisma';

export class CreateGroupDto {
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(750)
  description: string;

  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(CommunityGroupCategory)
  category: CommunityGroupCategory;

  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(CommunityGroupPrivacy)
  privacy: CommunityGroupPrivacy;
}
