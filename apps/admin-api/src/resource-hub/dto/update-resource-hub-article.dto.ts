import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ResourceHubCategory } from '@generated/prisma';

export class UpdateResourceHubArticleDto {
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(ResourceHubCategory)
  category: ResourceHubCategory;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  content: string;
}
