import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { JobApplicationStatus } from '@generated/prisma';

export class UpdateApplicationStatusDto {
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(JobApplicationStatus)
  status: JobApplicationStatus;
}
