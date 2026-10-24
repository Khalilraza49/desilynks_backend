import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService, RedisService } from '@libs/common';

@Injectable()
export class BannerAdViewSyncTask {
  private readonly logger = new Logger(BannerAdViewSyncTask.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Cron('0 */5 * * * *')
  async handleBannerAdViewSync() {
    if (this.isRunning) {
      this.logger.warn(
        'Banner ad view sync is already running, skipping this cycle.',
      );
      return;
    }

    this.isRunning = true;
    this.logger.log('Starting banner ad view/click sync from Redis to DB...');

    try {
      await this.syncViews();
      await this.syncClicks();
    } catch (error) {
      this.logger.error('Failed to sync banner ad views/clicks', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async syncViews() {
    const viewIds = await this.redis.smembers('banner-ads:updated_views');

    if (!viewIds || viewIds.length === 0) {
      this.logger.log('No banner ad views to sync.');
      return;
    }

    await this.redis.srem('banner-ads:updated_views', ...viewIds);

    const viewEntries = await Promise.all(
      viewIds.map(async (id) => {
        const countStr = await this.redis.getdel(`banner-ad:views:${id}`);
        return { id, count: countStr ? parseInt(countStr, 10) : 0 };
      }),
    );

    const validEntries = viewEntries.filter(
      (entry) => !isNaN(entry.count) && entry.count > 0,
    );

    if (validEntries.length === 0) {
      this.logger.log('All buffered view counts were zero or invalid.');
      return;
    }

    await this.prisma.$transaction(
      validEntries.map((entry) =>
        this.prisma.bannerAd.updateMany({
          where: { id: entry.id },
          data: { views: { increment: entry.count } },
        }),
      ),
    );

    this.logger.log(
      `Successfully synced views for ${validEntries.length} banner ads.`,
    );
  }

  private async syncClicks() {
    const clickIds = await this.redis.smembers('banner-ads:updated_clicks');

    if (!clickIds || clickIds.length === 0) {
      this.logger.log('No banner ad clicks to sync.');
      return;
    }

    await this.redis.srem('banner-ads:updated_clicks', ...clickIds);

    const clickEntries = await Promise.all(
      clickIds.map(async (id) => {
        const countStr = await this.redis.getdel(`banner-ad:clicks:${id}`);
        return { id, count: countStr ? parseInt(countStr, 10) : 0 };
      }),
    );

    const validEntries = clickEntries.filter(
      (entry) => !isNaN(entry.count) && entry.count > 0,
    );

    if (validEntries.length === 0) {
      this.logger.log('All buffered click counts were zero or invalid.');
      return;
    }

    await this.prisma.$transaction(
      validEntries.map((entry) =>
        this.prisma.bannerAd.updateMany({
          where: { id: entry.id },
          data: { clicks: { increment: entry.count } },
        }),
      ),
    );

    this.logger.log(
      `Successfully synced clicks for ${validEntries.length} banner ads.`,
    );
  }
}
