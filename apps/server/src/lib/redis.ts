import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('[ICX-REDIS] Connection error:', err.message);
});

/**
 * Redis Key Namespace Helpers for Session Blacklists, Refresh Token Rotation,
 * Account Lockouts, and Concurrency Hold Counters
 */
export const RedisKeys = {
  refreshToken: (userId: string, tokenId: string) => `icx:auth:rt:${userId}:${tokenId}`,
  blacklistedAccessToken: (jti: string) => `icx:auth:bl:${jti}`,
  loginAttempts: (email: string) => `icx:auth:attempts:${email.toLowerCase()}`,
  accountLockout: (email: string) => `icx:auth:lockout:${email.toLowerCase()}`,
  emailVerificationToken: (token: string) => `icx:auth:verify_email:${token}`,
  passwordResetToken: (token: string) => `icx:auth:pwd_reset:${token}`,
  staffInviteToken: (token: string) => `icx:auth:staff_invite:${token}`,
  rateLimit: (scope: string, identifier: string) => `icx:rl:${scope}:${identifier}`,
  slotHoldTTL: (slotId: string) => `icx:hold:slot:${slotId}`,
  rentalHoldTTL: (rentalId: string) => `icx:hold:rental:${rentalId}`,
} as const;

