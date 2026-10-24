import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.getOrThrow<string>('REDIS_HOST'),
      port: this.configService.getOrThrow<number>('REDIS_PORT'),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy(times) {
        return Math.min(times * 100, 3000);
      },
    });

    this.registerEvents();
  }

  async onModuleInit() {
    await this.client.ping();
    this.logger.log('Redis connected successfully');
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.warn('Redis connection closed');
  }

  getClient(): Redis {
    return this.client;
  }

  async set(key: string, value: string, ttlInSeconds?: number): Promise<void> {
    if (ttlInSeconds) {
      await this.client.set(key, value, 'EX', ttlInSeconds);
      return;
    }

    await this.client.set(key, value);
  }

  async setIfNotExists(
    key: string,
    value: string,
    ttlInSeconds: number,
  ): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', ttlInSeconds, 'NX');
    return result === 'OK';
  }

  async setIfExists(
    key: string,
    value: string,
    ttlInSeconds: number,
  ): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', ttlInSeconds, 'XX');
    return result === 'OK';
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  async sadd(key: string, member: string): Promise<number> {
    return this.client.sadd(key, member);
  }

  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return this.client.srem(key, ...members);
  }

  async getdel(key: string): Promise<string | null> {
    return this.client.getdel(key);
  }

  async pttl(key: string): Promise<number> {
    return this.client.pttl(key);
  }

  async incrementWithTtl(
    key: string,
    ttlInMs: number,
  ): Promise<{ count: number; ttlInMs: number }> {
    const results = await this.client
      .multi()
      .incr(key)
      .pexpire(key, ttlInMs, 'NX')
      .pttl(key)
      .exec();

    return {
      count: Number(results?.[0]?.[1] ?? 0),
      ttlInMs: Number(results?.[2]?.[1] ?? ttlInMs),
    };
  }

  private registerEvents() {
    this.client.on('connect', () => {
      this.logger.log('Connecting to Redis...');
    });

    this.client.on('ready', () => {
      this.logger.log('Redis is ready');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis error', error);
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      this.logger.warn('Reconnecting to Redis...');
    });

    this.client.on('end', () => {
      this.logger.warn('Redis connection ended');
    });
  }
}
