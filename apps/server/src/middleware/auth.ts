import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@icx/shared-types';
import { query } from '@icx/database';
import { verifyAccessToken, type AccessTokenPayload } from '../lib/jwt.js';
import { redis, RedisKeys } from '../lib/redis.js';

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

/**
 * Extracts and verifies the JWT Access Token from either Authorization Bearer header
 * (Web & Mobile React Native clients) or HttpOnly cookie, and checks Redis revocation.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : undefined;
    const cookieToken = req.cookies?.icx_access_token as string | undefined;
    const token = bearerToken || cookieToken;

    if (!token) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication token is required.',
      });
      return;
    }

    const payload = verifyAccessToken(token);

    // Check Redis blacklist for revoked access tokens
    const isBlacklisted = await redis.get(RedisKeys.blacklistedAccessToken(payload.jti));
    if (isBlacklisted) {
      res.status(401).json({
        error: 'TOKEN_REVOKED',
        message: 'Session has been terminated. Please log in again.',
      });
      return;
    }

    // Verify user is still active in PostgreSQL
    const userRes = await query<{ status: string; role: UserRole; email_verified_at: Date | null }>(
      'SELECT status, role, email_verified_at FROM users WHERE id = $1 LIMIT 1',
      [payload.sub]
    );

    const dbUser = userRes.rows[0];
    if (!dbUser || dbUser.status !== 'active') {
      res.status(403).json({
        error: 'ACCOUNT_SUSPENDED',
        message: 'Your account is suspended or no longer active.',
      });
      return;
    }

    req.user = {
      ...payload,
      role: dbUser.role,
      emailVerified: Boolean(dbUser.email_verified_at),
    };

    next();
  } catch {
    res.status(401).json({
      error: 'INVALID_OR_EXPIRED_TOKEN',
      message: 'Invalid or expired authentication token.',
    });
  }
}

/**
 * Server-side Role-Based Access Control (RBAC) enforcement (Requirement AC-07).
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'FORBIDDEN_ROLE',
        message: `Access restricted. Required role: ${allowedRoles.join(' or ')}.`,
      });
      return;
    }

    next();
  };
}

/**
 * Enforces email verification before a customer's first order, booking, or rental (Requirement AC-02).
 */
export function requireVerifiedEmail(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required.',
    });
    return;
  }

  if (!req.user.emailVerified) {
    res.status(403).json({
      error: 'EMAIL_VERIFICATION_REQUIRED',
      message: 'Please verify your email address before creating an order, booking, or equipment rental.',
    });
    return;
  }

  next();
}

