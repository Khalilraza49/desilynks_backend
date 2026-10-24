import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDecimal,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ProductAdCategory,
  ProductCondition,
} from '@generated/prisma';

export class UpdateProductAdDto {
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(ProductAdCategory)
  category: ProductAdCategory;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  brand?: string;

  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(ProductCondition)
  condition: ProductCondition;

  @IsDecimal({
    decimal_digits: '0,2',
    force_decimal: false,
  })
  price: string;

  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    return value === 'true';
  })
  @IsBoolean()
  negotiable: boolean;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(750)
  description: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  location: string;
}
