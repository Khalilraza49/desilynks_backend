import type { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from '../redis/redis.service';

type ThrottlerStorageRecord = Awaited<
  ReturnType<ThrottlerStorage['increment']>
>;

export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitsKey = `throttler:${throttlerName}:${key}`;
    const blockKey = `${hitsKey}:blocked`;

    const blockTtlInMs = await this.redis.pttl(blockKey);
    if (blockTtlInMs > 0) {
      const timeToBlockExpire = Math.ceil(blockTtlInMs / 1000);
      return {
        totalHits: limit + 1,
        timeToExpire: timeToBlockExpire,
        isBlocked: true,
        timeToBlockExpire,
      };
    }

    const { count, ttlInMs } = await this.redis.incrementWithTtl(hitsKey, ttl);
    const timeToExpire = Math.ceil(ttlInMs / 1000);

    if (count > limit) {
      const timeToBlockExpire = Math.ceil(blockDuration / 1000);
      await this.redis.set(blockKey, '1', timeToBlockExpire);

      return {
        totalHits: count,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire,
      };
    }

    return {
      totalHits: count,
      timeToExpire,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }
}
