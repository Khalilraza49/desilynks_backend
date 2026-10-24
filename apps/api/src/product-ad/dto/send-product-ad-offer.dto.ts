import { Transform } from 'class-transformer';
import {
  IsDecimal,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SendProductAdOfferDto {
  @IsDecimal({
    decimal_digits: '0,2',
    force_decimal: false,
  })
  offerPrice: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  message?: string;
}
