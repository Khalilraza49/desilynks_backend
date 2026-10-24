import { Transform } from 'class-transformer';
import { IsEnum } from 'class-validator';
import { BusinessListingStatus } from '@generated/prisma';

export class UpdateBusinessListingStatusDto {
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(BusinessListingStatus)
  status: BusinessListingStatus;
}
