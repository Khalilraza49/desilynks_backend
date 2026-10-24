import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class ActionReportDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') {
      return value;
    } else if (typeof value === 'string') {
      return value === 'true';
    } else {
      return undefined;
    }
  })
  @IsBoolean()
  suspendUser?: boolean;
}
