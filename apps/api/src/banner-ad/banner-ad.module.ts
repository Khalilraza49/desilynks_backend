import { Module } from '@nestjs/common';
import { BannerAdController } from './banner-ad.controller';
import { BannerAdService } from './banner-ad.service';

@Module({
  controllers: [BannerAdController],
  providers: [BannerAdService],
})
export class BannerAdModule {}
