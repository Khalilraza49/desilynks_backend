import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Min, Max } from 'class-validator';
import { BudgetType } from '@generated/prisma';

export class GetAllNeedAWorkerPostsQueryDto {
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
  @IsEnum(BudgetType)
  budgetType?: BudgetType;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsUUID('4')
  workerTypeId?: string;
}
