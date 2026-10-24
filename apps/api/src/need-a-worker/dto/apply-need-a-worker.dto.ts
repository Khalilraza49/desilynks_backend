import { Transform } from 'class-transformer';
import {
  IsDecimal,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ApplyNeedAWorkerDto {
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MinLength(100)
  @MaxLength(750)
  coverLetter?: string;

  @IsOptional()
  @IsDecimal({
    decimal_digits: '0,2',
    force_decimal: false,
  })
  proposedPrice?: string;
}
