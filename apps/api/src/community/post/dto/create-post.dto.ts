import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateIf,
  IsDate,
} from 'class-validator';
import {
  CommunityPostType,
  CommunityPostVisibility,
} from '@generated/prisma';

export class CreatePostDto {
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(CommunityPostType)
  type: CommunityPostType;

  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(CommunityPostVisibility)
  visibility: CommunityPostVisibility;

  @ValidateIf((o) => o.type === CommunityPostType.TEXT)
  @IsNotEmpty({ message: 'Content is required for TEXT posts' })
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MaxLength(2000)
  content?: string;

  @ValidateIf((o) => o.visibility === CommunityPostVisibility.GROUP)
  @IsNotEmpty({ message: 'groupId is required for GROUP visibility posts' })
  @IsUUID('4', { message: 'groupId must be a valid UUID' })
  groupId?: string;

  @ValidateIf((o) => o.type === CommunityPostType.POLL)
  @IsNotEmpty({ message: 'pollQuestion is required for POLL posts' })
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MaxLength(500)
  pollQuestion?: string;

  @ValidateIf((o) => o.type === CommunityPostType.POLL)
  @IsNotEmpty({ message: 'pollOptions is required for POLL posts' })
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : value;
      } catch {
        return value;
      }
    }
    return value;
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  pollOptions?: string[];

  @ValidateIf((o) => o.type === CommunityPostType.POLL)
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  pollExpiresAt?: Date;
}
