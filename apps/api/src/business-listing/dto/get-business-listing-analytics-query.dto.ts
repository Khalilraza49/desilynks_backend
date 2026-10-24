import { Transform } from 'class-transformer';
import { IsEnum } from 'class-validator';

export enum AnalyticsPeriod {
  THIS_MONTH = 'THIS_MONTH',
  LAST_MONTH = 'LAST_MONTH',
  LAST_THREE_MONTHS = 'LAST_THREE_MONTHS',
}

export class GetBusinessListingAnalyticsQueryDto {
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsEnum(AnalyticsPeriod, {
    message: 'period must be one of: THIS_MONTH, LAST_MONTH, LAST_THREE_MONTHS',
  })
  period: AnalyticsPeriod;
}
