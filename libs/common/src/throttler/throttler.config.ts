import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { RedisService } from '../redis/redis.service';
import { RedisThrottlerStorage } from './redis-throttler.storage';

const ONE_MINUTE = 60 * 1000;
const TEN_MINUTES = 10 * 60 * 1000;

export const ACCOUNT_THROTTLER = 'account';

export const LOGIN_THROTTLE = {
  default: { limit: 30, ttl: ONE_MINUTE },
  [ACCOUNT_THROTTLER]: { limit: 10, ttl: ONE_MINUTE },
};

export const OTP_REQUEST_THROTTLE = {
  default: { limit: 10, ttl: TEN_MINUTES },
  [ACCOUNT_THROTTLER]: { limit: 3, ttl: TEN_MINUTES },
};

export const OTP_VERIFY_THROTTLE = {
  default: { limit: 30, ttl: TEN_MINUTES },
  [ACCOUNT_THROTTLER]: { limit: 10, ttl: TEN_MINUTES },
};

// Cooldown and resend count are enforced per email in AuthService.resendOtp
export const OTP_RESEND_THROTTLE = {
  default: { limit: 20, ttl: TEN_MINUTES },
  [ACCOUNT_THROTTLER]: { limit: 10, ttl: TEN_MINUTES },
};

export const TOKEN_REFRESH_THROTTLE = {
  default: { limit: 30, ttl: ONE_MINUTE },
};

export const SEARCH_THROTTLE = {
  default: { limit: 60, ttl: ONE_MINUTE },
};

export const UPLOAD_THROTTLE = {
  default: { limit: 30, ttl: ONE_MINUTE },
};

export const REPORT_THROTTLE = {
  default: { limit: 20, ttl: ONE_MINUTE },
};

export const SENSITIVE_ACTION_THROTTLE = {
  default: { limit: 5, ttl: TEN_MINUTES },
};

export const SUPPORT_THROTTLE = {
  default: { limit: 10, ttl: TEN_MINUTES },
  [ACCOUNT_THROTTLER]: { limit: 3, ttl: TEN_MINUTES },
};

function getAccountIdentifier(context: ExecutionContext): string | undefined {
  const body = context
    .switchToHttp()
    .getRequest<{ body?: Record<string, unknown> }>()?.body;
  const identifier = body?.email ?? body?.emailOrPhoneNumber;

  return typeof identifier === 'string' && identifier.trim()
    ? identifier.trim().toLowerCase()
    : undefined;
}

export function createThrottlerOptions(
  redis: RedisService,
): ThrottlerModuleOptions {
  return {
    throttlers: [
      { name: 'default', ttl: ONE_MINUTE, limit: 300 },
      {
        name: ACCOUNT_THROTTLER,
        ttl: ONE_MINUTE,
        limit: 10,
        skipIf: (context) =>
          context.getType() !== 'http' || !getAccountIdentifier(context),
        getTracker: (_req, context) => getAccountIdentifier(context) ?? '',
      },
    ],
    skipIf: (context) => context.getType() !== 'http',
    storage: new RedisThrottlerStorage(redis),
  };
}
