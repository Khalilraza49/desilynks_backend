import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';
import { JobApplicationStatus } from '@generated/prisma';

export class BulkUpdateApplicationStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  applicationIds: string[];

  @IsNotEmpty()
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(JobApplicationStatus)
  status: JobApplicationStatus;
}
