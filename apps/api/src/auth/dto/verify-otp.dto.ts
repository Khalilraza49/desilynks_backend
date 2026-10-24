import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class VerifyOtpDto {
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsEmail()
  email: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  otp: string;
}
