import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@libs/common';
import { BannerAdStatus } from '@generated/prisma';

@Injectable()
export class BannerAdExpiryTask {
  private readonly logger = new Logger(BannerAdExpiryTask.name);
  private isRunning = false;

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 */5 * * * *')
  async handleBannerAdExpiry() {
    if (this.isRunning) {
      this.logger.warn(
        'Banner ad expiry is already running, skipping this cycle.',
      );
      return;
    }

    this.isRunning = true;
    this.logger.log('Starting banner ad expiry check...');

    try {
      const { count } = await this.prisma.bannerAd.updateMany({
        where: {
          status: { in: [BannerAdStatus.RUNNING, BannerAdStatus.PAUSED] },
          expiresAt: { lte: new Date() },
        },
        data: { status: BannerAdStatus.EXPIRED },
      });

      this.logger.log(
        `Banner ad expiry check complete. Expired ${count} banner ad(s).`,
      );
    } catch (error) {
      this.logger.error('Failed to expire banner ads', error);
    } finally {
      this.isRunning = false;
    }
  }
}
