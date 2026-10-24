import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { BannerAdPosition } from '@generated/prisma';

export class UpdateBannerAdDto {
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  description: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  ctaButtonText: string;

  @Transform(({ value }) => value?.trim())
  @IsUrl()
  destinationLink: string;

  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(BannerAdPosition)
  position: BannerAdPosition;
}
