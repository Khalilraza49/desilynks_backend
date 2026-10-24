import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Gender } from '@generated/prisma';

export class RegisterUserDto {
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  firstName: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  lastName: string;

  @Transform(({ value }) => value?.trim().toUpperCase())
  @IsEnum(Gender)
  gender: Gender;

  @Type(() => Date)
  @IsDate()
  dateOfBirth: Date;

  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsEmail()
  @MaxLength(50)
  email: string;

  @Transform(({ value }) => value?.trim())
  @IsPhoneNumber()
  phoneNumber: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  streetAddress?: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  postalCode?: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  city: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  province: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  country: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(8)
  password: string;

  @Transform(({ value }) => value === true || value === 'true')
  @Equals(true, { message: 'You must accept the terms and conditions' })
  acceptTerms: boolean;
}
