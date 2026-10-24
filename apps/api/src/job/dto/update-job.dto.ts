import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDecimal,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  Experience,
  JobType,
  Language,
  SalaryPeriod,
  WorkMode,
} from '@generated/prisma';

export class UpdateJobDto {
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  companyName: string;

  @Transform(({ value }) => value?.trim())
  @IsUUID('4')
  categoryId: string;

  @IsDecimal({
    decimal_digits: '0,2',
    force_decimal: false,
  })
  salary: string;

  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(SalaryPeriod)
  salaryPeriod: SalaryPeriod;

  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(JobType)
  type: JobType;

  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(Experience)
  experience: Experience;

  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.map((val) => val?.trim()?.toUpperCase());
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map((val) => val?.trim()?.toUpperCase());
        }
        return value;
      } catch {
        return value;
      }
    }

    return value;
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsEnum(Language, { each: true })
  languages: Language[];

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  location: string;

  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(WorkMode)
  workMode: WorkMode;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(750)
  description: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  requiredSkills: string;
}
