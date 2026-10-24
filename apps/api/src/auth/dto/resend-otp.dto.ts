import { Transform } from 'class-transformer';
import { IsEmail, IsEnum } from 'class-validator';

export enum OtpPurpose {
  REGISTER = 'register',
  RESET_PASSWORD = 'reset-password',
}

export class ResendOtpDto {
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsEmail()
  email: string;

  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;
}
