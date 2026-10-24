import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateEmergencyNumberDto {
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .trim()
          .replace(/\s+/g, ' ')
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase())
      : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  title: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  number: string;
}
