import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  Experience,
  JobStatus,
  JobType,
  SalaryPeriod,
  WorkMode,
} from '@generated/prisma';
import {
  JOB_SORT_FIELDS,
  MAX_SEARCH_PAGE_SIZE,
  PUBLIC_JOB_STATUSES,
} from '../indices/search-rules';

export class SearchJobsDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(JobType)
  type?: JobType;

  @IsOptional()
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(WorkMode)
  workMode?: WorkMode;

  @IsOptional()
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(Experience)
  experience?: Experience;

  @IsOptional()
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(SalaryPeriod)
  salaryPeriod?: SalaryPeriod;

  @IsOptional()
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsIn(PUBLIC_JOB_STATUSES)
  status?: JobStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salary?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsIn(JOB_SORT_FIELDS)
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
