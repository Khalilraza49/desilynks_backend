import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService, RedisService } from '@libs/common';

@Injectable()
export class PropertyViewSyncTask {
  private readonly logger = new Logger(PropertyViewSyncTask.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Cron('0 */5 * * * *')
  async handlePropertyViewSync() {
    if (this.isRunning) {
      this.logger.warn(
        'Property view sync is already running, skipping this cycle.',
      );
      return;
    }

    this.isRunning = true;
    this.logger.log('Starting property view sync from Redis to DB...');

    try {
      const propertyIds = await this.redis.smembers('properties:updated_views');

      if (!propertyIds || propertyIds.length === 0) {
        this.logger.log('No property views to sync.');
        return;
      }

      await this.redis.srem('properties:updated_views', ...propertyIds);

      const viewEntries = await Promise.all(
        propertyIds.map(async (id) => {
          const countStr = await this.redis.getdel(`property:views:${id}`);
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
          this.prisma.property.update({
            where: { id: entry.id },
            data: { viewsCount: { increment: entry.count } },
          }),
        ),
      );

      this.logger.log(
        `Successfully synced views for ${validEntries.length} properties.`,
      );
    } catch (error) {
      this.logger.error('Failed to sync property views', error);
    } finally {
      this.isRunning = false;
    }
  }
}
