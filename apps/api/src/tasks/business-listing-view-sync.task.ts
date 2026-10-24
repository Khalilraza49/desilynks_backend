import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService, RedisService } from '@libs/common';

@Injectable()
export class BusinessListingViewSyncTask {
  private readonly logger = new Logger(BusinessListingViewSyncTask.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Cron('0 */5 * * * *')
  async handleBusinessListingViewSync() {
    if (this.isRunning) {
      this.logger.warn(
        'Business listing view sync is already running, skipping this cycle.',
      );
      return;
    }

    this.isRunning = true;
    this.logger.log(
      'Starting business listing view/click sync from Redis to DB...',
    );

    try {
      await this.syncViews();
      await this.syncClicks();
    } catch (error) {
      this.logger.error('Failed to sync business listing views/clicks', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async syncViews() {
    const viewIds = await this.redis.smembers(
      'business-listings:updated_views',
    );

    if (!viewIds || viewIds.length === 0) {
      this.logger.log('No business listing views to sync.');
      return;
    }

    await this.redis.srem('business-listings:updated_views', ...viewIds);

    const viewEntries = await Promise.all(
      viewIds.map(async (id) => {
        const countStr = await this.redis.getdel(
          `business-listing:views:${id}`,
        );
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.$transaction([
      ...validEntries.map((entry) =>
        this.prisma.businessListing.update({
          where: { id: entry.id },
          data: { viewsCount: { increment: entry.count } },
        }),
      ),
      ...validEntries.map((entry) =>
        this.prisma.businessListingDailyAnalytics.upsert({
          where: {
            businessId_date: { businessId: entry.id, date: today },
          },
          create: {
            businessId: entry.id,
            date: today,
            views: entry.count,
          },
          update: {
            views: { increment: entry.count },
          },
        }),
      ),
    ]);

    this.logger.log(
      `Successfully synced views for ${validEntries.length} business listings.`,
    );
  }

  private async syncClicks() {
    const clickIds = await this.redis.smembers(
      'business-listings:updated_clicks',
    );

    if (!clickIds || clickIds.length === 0) {
      this.logger.log('No business listing clicks to sync.');
      return;
    }

    await this.redis.srem('business-listings:updated_clicks', ...clickIds);

    const clickEntries = await Promise.all(
      clickIds.map(async (id) => {
        const countStr = await this.redis.getdel(
          `business-listing:clicks:${id}`,
        );
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.$transaction([
      ...validEntries.map((entry) =>
        this.prisma.businessListing.update({
          where: { id: entry.id },
          data: { clicks: { increment: entry.count } },
        }),
      ),
      ...validEntries.map((entry) =>
        this.prisma.businessListingDailyAnalytics.upsert({
          where: {
            businessId_date: { businessId: entry.id, date: today },
          },
          create: {
            businessId: entry.id,
            date: today,
            clicks: entry.count,
          },
          update: {
            clicks: { increment: entry.count },
          },
        }),
      ),
    ]);

    this.logger.log(
      `Successfully synced clicks for ${validEntries.length} business listings.`,
    );
  }
}
