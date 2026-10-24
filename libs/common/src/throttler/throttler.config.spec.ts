import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { RedisService } from '../redis/redis.service';
import { createThrottlerOptions } from './throttler.config';

function createRedisFake() {
  const counters = new Map<string, { count: number; expiresAt: number }>();
  const blocks = new Map<string, number>();

  return {
    pttl: jest.fn(async (key: string) => {
      const expiresAt = blocks.get(key);
      return expiresAt && expiresAt > Date.now() ? expiresAt - Date.now() : -2;
    }),
    set: jest.fn(async (key: string, _value: string, ttlInSeconds: number) => {
      blocks.set(key, Date.now() + ttlInSeconds * 1000);
    }),
    incrementWithTtl: jest.fn(async (key: string, ttlInMs: number) => {
      const current = counters.get(key);
      const entry =
        current && current.expiresAt > Date.now()
          ? { ...current, count: current.count + 1 }
          : { count: 1, expiresAt: Date.now() + ttlInMs };
      counters.set(key, entry);
      return { count: entry.count, ttlInMs: entry.expiresAt - Date.now() };
    }),
  };
}

@Controller('test')
class TestController {
  @Post('login')
  @Throttle({
    default: { limit: 5, ttl: 60000 },
    account: { limit: 2, ttl: 60000 },
  })
  login(@Body() body: { email?: string }) {
    return { email: body.email };
  }
}

describe('createThrottlerOptions', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const redis = createRedisFake();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot(
          createThrottlerOptions(redis as unknown as RedisService),
        ),
      ],
      controllers: [TestController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const login = (email?: string) =>
    request(app.getHttpServer())
      .post('/test/login')
      .send(email ? { email } : {});

  it('should limit attempts per account regardless of letter case', async () => {
    await login('user@example.com').expect(201);
    await login('USER@example.com').expect(201);
    await login('user@example.com').expect(429);
  });

  it('should keep other accounts usable when one account is limited', async () => {
    await login('first@example.com').expect(201);
    await login('first@example.com').expect(201);
    await login('first@example.com').expect(429);

    await login('second@example.com').expect(201);
  });

  it('should limit requests per ip when no account is provided', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      await login().expect(201);
    }

    await login().expect(429);
  });
});
