import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDate,
  IsDecimal,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ContactPreference, PropertyType } from '@generated/prisma';

export class CraetePropertyDto {
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(PropertyType)
  type: PropertyType;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(750)
  description: string;

  @IsDecimal({
    decimal_digits: '0,2',
    force_decimal: false,
  })
  monthlyRent: string;

  @Type(() => Date)
  @IsDate()
  availableFrom: Date;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  location: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  noOfBedRooms: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  noOfBathRooms: number;

  @Transform(({ value }) => {
    if (Array.isArray(value)) return value.map((val) => val?.trim());
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map((val) => val?.trim());
        }
        return value;
      } catch (err: any) {
        return value;
      }
    }

    return value;
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(15)
  @IsUUID('4', { each: true })
  featureIds: string[];

  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(ContactPreference)
  contactPreference: ContactPreference;
}
