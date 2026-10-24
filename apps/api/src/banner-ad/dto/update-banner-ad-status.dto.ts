import { Transform } from 'class-transformer';
import { IsIn } from 'class-validator';
import { BannerAdStatus } from '@generated/prisma';

export class UpdateBannerAdStatusDto {
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  @IsIn([BannerAdStatus.RUNNING, BannerAdStatus.PAUSED])
  status: BannerAdStatus;
}
