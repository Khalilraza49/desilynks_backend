import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsDecimal,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { BudgetType } from '@generated/prisma';

export class CreateNeedAWorkerDto {
  @Transform(({ value }) => value?.trim())
  @IsUUID('4')
  workerTypeId: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  location: string;

  @Type(() => Date)
  @IsDate()
  dateNeeded: Date;

  @IsDecimal({
    decimal_digits: '0,2',
    force_decimal: false,
  })
  budget: string;

  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(BudgetType)
  budgetType: BudgetType;

  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    return value === 'true';
  })
  @IsBoolean()
  isUrgentRequest: boolean;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(750)
  description: string;
}
