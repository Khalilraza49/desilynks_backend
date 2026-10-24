import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService, RedisService } from '@libs/common';

@Injectable()
export class ProductAdViewSyncTask {
  private readonly logger = new Logger(ProductAdViewSyncTask.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Cron('0 */5 * * * *')
  async handleProductAdViewSync() {
    if (this.isRunning) {
      this.logger.warn(
        'Product ad view sync is already running, skipping this cycle.',
      );
      return;
    }

    this.isRunning = true;
    this.logger.log('Starting product ad view sync from Redis to DB...');

    try {
      const productAdIds = await this.redis.smembers(
        'product-ads:updated_views',
      );

      if (!productAdIds || productAdIds.length === 0) {
        this.logger.log('No product ad views to sync.');
        return;
      }

      await this.redis.srem('product-ads:updated_views', ...productAdIds);

      const viewEntries = await Promise.all(
        productAdIds.map(async (id) => {
          const countStr = await this.redis.getdel(`product-ad:views:${id}`);
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
          this.prisma.productAd.update({
            where: { id: entry.id },
            data: { viewsCount: { increment: entry.count } },
          }),
        ),
      );

      this.logger.log(
        `Successfully synced views for ${validEntries.length} product ads.`,
      );
    } catch (error) {
      this.logger.error('Failed to sync product ad views', error);
    } finally {
      this.isRunning = false;
    }
  }
}
