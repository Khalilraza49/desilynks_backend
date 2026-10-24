import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  ProductAdCategory,
  ProductCondition,
  ProductAdStatus,
} from '@generated/prisma';
import {
  MAX_SEARCH_PAGE_SIZE,
  PRODUCT_AD_SORT_FIELDS,
  PUBLIC_PRODUCT_AD_STATUSES,
} from '../indices/search-rules';

export class SearchProductAdsDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(ProductAdCategory)
  category?: ProductAdCategory;

  @IsOptional()
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(ProductCondition)
  condition?: ProductCondition;

  @IsOptional()
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsIn(PUBLIC_PRODUCT_AD_STATUSES)
  status?: ProductAdStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  negotiable?: boolean;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsIn(PRODUCT_AD_SORT_FIELDS)
  sortBy?: string;

  @IsOptional()
  @Transform(({ value }) => value?.toLowerCase())
  @IsEnum(['asc', 'desc'] as const)
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SEARCH_PAGE_SIZE)
  limit?: number;
}
