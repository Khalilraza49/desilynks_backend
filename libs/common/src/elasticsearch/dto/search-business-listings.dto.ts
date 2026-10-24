import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { BusinessListingStatus } from '@generated/prisma';
import {
  BUSINESS_LISTING_SORT_FIELDS,
  MAX_SEARCH_PAGE_SIZE,
  PUBLIC_BUSINESS_LISTING_STATUSES,
} from '../indices/search-rules';

export class SearchBusinessListingsDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsIn(PUBLIC_BUSINESS_LISTING_STATUSES)
  status?: BusinessListingStatus;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsIn(BUSINESS_LISTING_SORT_FIELDS)
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
