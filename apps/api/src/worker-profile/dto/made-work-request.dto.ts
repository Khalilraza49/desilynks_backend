import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsDecimal,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { WorkerService, WorkRequestType } from '@generated/prisma';

export class MadeWorkRequestDto {
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsNotEmpty()
  @IsEnum(WorkerService)
  service: WorkerService;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  description: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  location: string;

  @IsNotEmpty()
  @IsDecimal({
    decimal_digits: '0,2',
    force_decimal: false,
  })
  budget: string;

  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsNotEmpty()
  @IsEnum(WorkRequestType)
  type: WorkRequestType;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  schedule: Date;
}
