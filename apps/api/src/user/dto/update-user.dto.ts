import { Transform, Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsDate,
  IsPhoneNumber,
} from 'class-validator';
import { Gender } from '@generated/prisma';

export class UpdateUserDto {
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @Transform(({ value }) => value?.trim().toUpperCase())
  @IsEnum(Gender)
  gender: Gender;

  @Type(() => Date)
  @IsDate()
  dateOfBirth: Date;

  @Transform(({ value }) => value?.trim())
  @IsPhoneNumber()
  phoneNumber: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  streetAddress?: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  postalCode?: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  city: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  province: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  country: string;
}
