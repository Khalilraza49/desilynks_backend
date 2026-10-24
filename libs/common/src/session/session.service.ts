import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { RedisService } from '../redis/redis.service';
import { refreshTokenKey, userRefreshTokensKey } from '../redis/redis-keys';

export const USER_SESSIONS_ENDED_CHANNEL = 'user:sessions-ended';

const REFRESH_TOKEN_TTL = 60 * 24 * 60 * 60;

@Injectable()
export class SessionService {
  constructor(private readonly redis: RedisService) {}

  async issueRefreshToken(userId: string): Promise<string> {
    const refreshToken = randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(refreshToken);

    await this.redis.set(refreshTokenKey(tokenHash), userId, REFRESH_TOKEN_TTL);
    await this.redis.sadd(userRefreshTokensKey(userId), tokenHash);
    await this.redis.expire(userRefreshTokensKey(userId), REFRESH_TOKEN_TTL);

    return refreshToken;
  }

  async consumeRefreshToken(refreshToken: string): Promise<string | null> {
    const tokenHash = this.hashToken(refreshToken);
    const userId = await this.redis.getdel(refreshTokenKey(tokenHash));

    if (userId) {
      await this.redis.srem(userRefreshTokensKey(userId), tokenHash);
    }

    return userId;
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    const tokenHashes = await this.redis.smembers(userRefreshTokensKey(userId));

    for (const tokenHash of tokenHashes) {
      await this.redis.del(refreshTokenKey(tokenHash));
    }

    await this.redis.del(userRefreshTokensKey(userId));
  }

  async endAllSessions(userId: string): Promise<void> {
    await this.revokeAllRefreshTokens(userId);

    await this.redis
      .getClient()
      .publish(USER_SESSIONS_ENDED_CHANNEL, JSON.stringify({ userId }));
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
