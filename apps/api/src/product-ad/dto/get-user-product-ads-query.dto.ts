import { Type, Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min, Max } from 'class-validator';
import {
  ProductAdCategory,
  ProductCondition,
  ProductAdStatus,
} from '@generated/prisma';

export class GetUserProductAdsQueryDto {
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
  @IsEnum(ProductAdStatus)
  status?: ProductAdStatus;

  @IsOptional()
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(ProductAdCategory)
  category?: ProductAdCategory;

  @IsOptional()
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(ProductCondition)
  condition?: ProductCondition;
}
