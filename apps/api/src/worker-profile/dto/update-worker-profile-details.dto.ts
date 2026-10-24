import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDecimal,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { WorkerService } from '@generated/prisma';

export class UpdateWorkerProfileDetailsDto {
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(WorkerService)
  service: WorkerService;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  experienceInYears: number;

  @IsDecimal({
    decimal_digits: '0,2',
    force_decimal: false,
  })
  hourlyRate: string;

  @IsDecimal({
    decimal_digits: '0,2',
    force_decimal: false,
  })
  dailyRate: string;

  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.map((val) => val?.trim()?.toUpperCase());
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map((val) => val?.trim()?.toUpperCase());
        }

        return value;
      } catch {
        return value;
      }
    }

    return value;
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  languagesSpoken: string[];

  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    return value === 'true';
  })
  @IsBoolean()
  isAvailableToday: boolean;

  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    return value === 'true';
  })
  @IsBoolean()
  ownVehicle: boolean;

  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    return value === 'true';
  })
  @IsBoolean()
  ownTools: boolean;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  areaCovered: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  about: string;
}
