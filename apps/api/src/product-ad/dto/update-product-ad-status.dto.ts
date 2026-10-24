import { Transform } from 'class-transformer';
import { IsEnum } from 'class-validator';
import { ProductAdStatus } from '@generated/prisma';

export class UpdateProductAdStatusDto {
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(ProductAdStatus)
  status: ProductAdStatus;
}
