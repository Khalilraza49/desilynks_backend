import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ES_INDEX, type EsIndexName } from '../indices/index-names';

export class SuggestQueryDto {
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  query: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsIn(Object.values(ES_INDEX))
  index?: EsIndexName;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  field?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  size?: number;
}
