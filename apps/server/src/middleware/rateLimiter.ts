import type { Request, Response, NextFunction } from 'express';
import { redis, RedisKeys } from '../lib/redis.js';

interface RateLimitOptions {
  scope: string;
  windowSeconds: number;
  maxRequests: number;
}

/**
 * Redis-backed sliding counter rate limiter (Requirement NF-06:
 * Rate limits on login, upload, download, and payment endpoints).
 */
export function rateLimiter(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const identifier = req.user?.sub || req.ip || 'anonymous';
      const key = RedisKeys.rateLimit(options.scope, identifier);

      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, options.windowSeconds);
      }

      const ttl = await redis.ttl(key);
      res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
      res.setHeader(
        'X-RateLimit-Remaining',
        String(Math.max(0, options.maxRequests - current))
      );

      if (current > options.maxRequests) {
        res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests for ${options.scope}. Please retry in ${ttl > 0 ? ttl : options.windowSeconds} seconds.`,
          retryAfterSeconds: ttl > 0 ? ttl : options.windowSeconds,
        });
        return;
      }

      next();
    } catch {
      // Fail open only if Redis is momentarily unreachable during non-critical rate check
      next();
    }
  };
}

