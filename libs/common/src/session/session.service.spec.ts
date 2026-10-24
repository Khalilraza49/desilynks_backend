import { SessionService, USER_SESSIONS_ENDED_CHANNEL } from './session.service';
import { RedisService } from '../redis/redis.service';

function createRedisFake() {
  const values = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const publish = jest.fn().mockResolvedValue(1);

  return {
    values,
    sets,
    publish,
    set: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    getdel: jest.fn(async (key: string) => {
      const value = values.get(key) ?? null;
      values.delete(key);
      return value;
    }),
    del: jest.fn(async (key: string) => {
      const existed = values.delete(key) || sets.delete(key);
      return existed ? 1 : 0;
    }),
    sadd: jest.fn(async (key: string, member: string) => {
      const set = sets.get(key) ?? new Set<string>();
      set.add(member);
      sets.set(key, set);
      return 1;
    }),
    srem: jest.fn(async (key: string, ...members: string[]) => {
      members.forEach((member) => sets.get(key)?.delete(member));
      return members.length;
    }),
    smembers: jest.fn(async (key: string) => [...(sets.get(key) ?? [])]),
    expire: jest.fn().mockResolvedValue(undefined),
    getClient: () => ({ publish }),
  };
}

describe('SessionService', () => {
  let redis: ReturnType<typeof createRedisFake>;
  let sessionService: SessionService;

  beforeEach(() => {
    redis = createRedisFake();
    sessionService = new SessionService(redis as unknown as RedisService);
  });

  it('should issue a refresh token that can be consumed only once', async () => {
    const refreshToken = await sessionService.issueRefreshToken('user-1');

    await expect(
      sessionService.consumeRefreshToken(refreshToken),
    ).resolves.toBe('user-1');
    await expect(
      sessionService.consumeRefreshToken(refreshToken),
    ).resolves.toBeNull();
  });

  it('should never store the raw refresh token', async () => {
    const refreshToken = await sessionService.issueRefreshToken('user-1');

    const storedKeys = [...redis.values.keys()].join(' ');
    expect(storedKeys).not.toContain(refreshToken);
  });

  it('should revoke every refresh token of a user', async () => {
    const first = await sessionService.issueRefreshToken('user-1');
    const second = await sessionService.issueRefreshToken('user-1');
    const otherUser = await sessionService.issueRefreshToken('user-2');

    await sessionService.revokeAllRefreshTokens('user-1');

    await expect(sessionService.consumeRefreshToken(first)).resolves.toBeNull();
    await expect(
      sessionService.consumeRefreshToken(second),
    ).resolves.toBeNull();
    await expect(sessionService.consumeRefreshToken(otherUser)).resolves.toBe(
      'user-2',
    );
  });

  it('should publish a session ended event when ending all sessions', async () => {
    const refreshToken = await sessionService.issueRefreshToken('user-1');

    await sessionService.endAllSessions('user-1');

    await expect(
      sessionService.consumeRefreshToken(refreshToken),
    ).resolves.toBeNull();
    expect(redis.publish).toHaveBeenCalledWith(
      USER_SESSIONS_ENDED_CHANNEL,
      JSON.stringify({ userId: 'user-1' }),
    );
  });
});
