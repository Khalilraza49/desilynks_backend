import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateBusinessListingDto {
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Transform(({ value }) => value?.trim())
  @IsUUID('4')
  categoryId: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  address: string;

  @Transform(({ value }) => value?.trim())
  @IsPhoneNumber()
  phone: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsPhoneNumber()
  whatsApp?: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(750)
  description: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  monToFriStartTime: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  monToFriEndTime: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  saturdayStartTime: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  saturdayEndTime: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  sundayStartTime?: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  sundayEndTime?: string;

  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    return value === 'true';
  })
  @IsBoolean()
  isClosedOnSunday: boolean;
}
