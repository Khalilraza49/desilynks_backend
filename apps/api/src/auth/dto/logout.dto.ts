import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LogoutDto {
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MaxLength(256)
  refreshToken?: string;
}
