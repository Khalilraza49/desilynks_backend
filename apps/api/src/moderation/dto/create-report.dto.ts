import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ReportReason, ReportTargetType } from '@generated/prisma';

export class CreateReportDto {
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(ReportTargetType)
  targetType: ReportTargetType;

  @Transform(({ value }) => value?.trim())
  @IsUUID()
  targetId: string;

  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(ReportReason)
  reason: ReportReason;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MaxLength(1000)
  details?: string;
}
