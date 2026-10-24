import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsDecimal,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CommunityEventType,
  CommunityEventVisibility,
} from '@generated/prisma';

export class UpdateEventDto {
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  startTime: string;

  @Type(() => Date)
  @IsDate()
  endDate: Date;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  endTime: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  location: string;

  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    return value === 'true';
  })
  @IsBoolean()
  isOnline: boolean;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(750)
  description: string;

  @IsDecimal({
    decimal_digits: '0,2',
    force_decimal: false,
  })
  ticketPrice: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxAttendees: number;

  @Transform(({ value }) => {
    if (Array.isArray(value))
      return value.map((val) => val?.trim()?.toUpperCase());
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
  @IsEnum(CommunityEventType, { each: true })
  type: CommunityEventType[];

  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(CommunityEventVisibility)
  visibility: CommunityEventVisibility;
}
