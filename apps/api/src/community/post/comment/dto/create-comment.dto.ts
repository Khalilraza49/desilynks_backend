import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateCommentDto {
  @IsNotEmpty()
  @IsUUID('4')
  postId: string;

  @Transform(({ value }) => value?.trim())
  @IsNotEmpty()
  @IsString()
  @MaxLength(750)
  content: string;

  @IsOptional()
  @IsUUID('4')
  parentId?: string;
}
