import { Type, Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min, Max } from 'class-validator';
import { BannerAdStatus } from '@generated/prisma';

export class GetMyBannerAdsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @IsOptional()
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(BannerAdStatus)
  status?: BannerAdStatus;
}
