import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, IsUUID, Max } from 'class-validator';

export class GetCommentsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsUUID('4')
  parentId?: string;
}
