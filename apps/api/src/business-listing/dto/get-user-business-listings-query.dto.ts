import { Type, Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Min, Max } from 'class-validator';
import { BusinessListingStatus } from '@generated/prisma';

export class GetUserBusinessListingsQueryDto {
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
  @IsEnum(BusinessListingStatus)
  status?: BusinessListingStatus;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsUUID('4')
  categoryId?: string;
}
