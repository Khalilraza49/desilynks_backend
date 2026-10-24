import { Transform, Type } from 'class-transformer';
import {
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
  ContactPreference,
  PropertyStatus,
  PropertyType,
} from '@generated/prisma';
import {
  MAX_SEARCH_PAGE_SIZE,
  PROPERTY_SORT_FIELDS,
  PUBLIC_PROPERTY_STATUSES,
} from '../indices/search-rules';

export class SearchPropertiesDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(PropertyType)
  type?: PropertyType;

  @IsOptional()
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsIn(PUBLIC_PROPERTY_STATUSES)
  status?: PropertyStatus;

  @IsOptional()
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(ContactPreference)
  contactPreference?: ContactPreference;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minRent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxRent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minBedrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minBathrooms?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsIn(PROPERTY_SORT_FIELDS)
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
