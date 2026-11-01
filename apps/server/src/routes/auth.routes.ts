import { Router, type Request, type Response } from 'express';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import {
  RegisterSchema,
  LoginSchema,
  AdminInviteStaffSchema,
  type UserRecord,
} from '@icx/shared-types';
import { query, withTransaction, recordAuditEvent } from '@icx/database';
import {
  issueTokenPair,
  verifyRefreshToken,
  verifyAccessToken,
} from '../lib/jwt.js';
import { redis, RedisKeys } from '../lib/redis.js';
import {
  generateTotpSecret,
  verifyTotpCode,
  buildOtpAuthUri,
} from '../lib/totp.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { env } from '../config/env.js';

export const authRouter = Router();

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_SECONDS = 15 * 60; // 15 minutes

function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie('icx_refresh_token', refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: env.JWT_REFRESH_EXPIRES_SECONDS * 1000,
  });
}

// ============================================================================
// POST /api/v1/auth/register (AC-01, AC-02, AC-04)
// ============================================================================
authRouter.post(
  '/register',
  rateLimiter({ scope: 'auth_register', windowSeconds: 300, maxRequests: 10 }),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
      return;
    }

    const { email, password, full_name, phone, role } = parsed.data;

    try {
      const existing = await query('SELECT 1 FROM users WHERE email = $1', [email]);
      if (existing.rowCount && existing.rowCount > 0) {
        res.status(409).json({
          error: 'EMAIL_ALREADY_REGISTERED',
          message: 'An account with this email address already exists.',
        });
        return;
      }

      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });

      const verificationToken = crypto.randomBytes(32).toString('hex');

      const newUser = await withTransaction(async (client) => {
        const userInsert = await client.query<UserRecord>(
          `INSERT INTO users (email, password_hash, role, phone, full_name, status)
           VALUES ($1, $2, $3, $4, $5, 'active')
           RETURNING *`,
          [email, passwordHash, role, phone, full_name]
        );
        const createdUser = userInsert.rows[0]!;

        // AC-04: Photographers apply through sign-up form; profile starts as 'pending'
        if (role === 'photographer') {
          await client.query(
            `INSERT INTO photographer_profiles (user_id, approval_status)
             VALUES ($1, 'pending')`,
            [createdUser.id]
          );
        }

        await recordAuditEvent(
          {
            actorId: createdUser.id,
            action: 'USER_REGISTERED',
            targetEntity: 'users',
            targetId: createdUser.id,
            details: { role, email },
          },
          client
        );

        return createdUser;
      });

      // Store email verification token in Redis for 24 hours
      await redis.set(
        RedisKeys.emailVerificationToken(verificationToken),
        newUser.id,
        'EX',
        86400
      );

      const tokens = await issueTokenPair(newUser);
      setRefreshCookie(res, tokens.refreshToken);

      res.status(201).json({
        user: {
          id: newUser.id,
          email: newUser.email,
          full_name: newUser.full_name,
          phone: newUser.phone,
          role: newUser.role,
          status: newUser.status,
          email_verified_at: newUser.email_verified_at,
          two_factor_enabled: newUser.two_factor_enabled,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        verificationTokenPreview:
          env.NODE_ENV !== 'production' ? verificationToken : undefined,
      });
    } catch (error) {
      console.error('[ICX-AUTH] Registration error:', error);
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Unable to complete registration.',
      });
    }
  }
);

// ============================================================================
// POST /api/v1/auth/login (AC-01, AC-06, NF-06)
// ============================================================================
authRouter.post(
  '/login',
  rateLimiter({ scope: 'auth_login', windowSeconds: 60, maxRequests: 10 }),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
      return;
    }

    const { email, password, totp_code } = parsed.data;

    try {
      // Check Redis account lockout (NF-06)
      const isLocked = await redis.ttl(RedisKeys.accountLockout(email));
      if (isLocked > 0) {
        res.status(423).json({
          error: 'ACCOUNT_LOCKED',
          message: `Account temporarily locked due to repeated failed login attempts. Try again in ${isLocked} seconds.`,
          retryAfterSeconds: isLocked,
        });
        return;
      }

      const userRes = await query<UserRecord>(
        'SELECT * FROM users WHERE email = $1 LIMIT 1',
        [email]
      );
      const user = userRes.rows[0];

      if (!user) {
        res.status(401).json({
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        });
        return;
      }

      if (user.status !== 'active') {
        res.status(403).json({
          error: 'ACCOUNT_SUSPENDED',
          message: 'This account has been suspended by an administrator.',
        });
        return;
      }

      const validPassword = await argon2.verify(user.password_hash, password);
      if (!validPassword) {
        const attempts = await redis.incr(RedisKeys.loginAttempts(email));
        if (attempts === 1) {
          await redis.expire(RedisKeys.loginAttempts(email), LOCKOUT_SECONDS);
        }

        if (attempts >= MAX_FAILED_LOGINS) {
          await redis.set(
            RedisKeys.accountLockout(email),
            'locked',
            'EX',
            LOCKOUT_SECONDS
          );
          await recordAuditEvent({
            actorId: user.id,
            action: 'ACCOUNT_LOCKOUT_TRIGGERED',
            targetEntity: 'users',
            targetId: user.id,
            details: { ip: req.ip, attempts },
          });
        }

        res.status(401).json({
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        });
        return;
      }

      // Enforce 2FA if enabled on account (AC-06: Admin & Editor accounts)
      if (user.two_factor_enabled && user.two_factor_secret) {
        if (!totp_code) {
          res.status(200).json({
            requiresTwoFactor: true,
            message: 'Two-factor authentication code is required.',
          });
          return;
        }

        const isTotpValid = verifyTotpCode(user.two_factor_secret, totp_code);
        if (!isTotpValid) {
          res.status(401).json({
            error: 'INVALID_2FA_CODE',
            message: 'Invalid two-factor authentication code.',
          });
          return;
        }
      }

      // Reset failed login counter
      await redis.del(RedisKeys.loginAttempts(email));

      const tokens = await issueTokenPair(user);
      setRefreshCookie(res, tokens.refreshToken);

      await recordAuditEvent({
        actorId: user.id,
        action: 'USER_LOGIN_SUCCESS',
        targetEntity: 'users',
        targetId: user.id,
        details: { role: user.role, ip: req.ip },
      });

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          phone: user.phone,
          role: user.role,
          status: user.status,
          email_verified_at: user.email_verified_at,
          two_factor_enabled: user.two_factor_enabled,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (error) {
      console.error('[ICX-AUTH] Login error:', error);
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Unable to process login request.',
      });
    }
  }
);

// ============================================================================
// POST /api/v1/auth/refresh (Redis Refresh Token Rotation)
// ============================================================================
authRouter.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const token =
    (req.cookies?.icx_refresh_token as string | undefined) ||
    (req.body?.refreshToken as string | undefined);

  if (!token) {
    res.status(401).json({
      error: 'MISSING_REFRESH_TOKEN',
      message: 'Refresh token is required.',
    });
    return;
  }

  try {
    const payload = verifyRefreshToken(token);
    const redisKey = RedisKeys.refreshToken(payload.sub, payload.tokenId);
    const stored = await redis.get(redisKey);

    if (!stored) {
      res.status(401).json({
        error: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token has already been rotated or revoked.',
      });
      return;
    }

    // Consume old refresh token immediately (single-use rotation)
    await redis.del(redisKey);

    const userRes = await query<UserRecord>(
      'SELECT * FROM users WHERE id = $1 AND status = $2 LIMIT 1',
      [payload.sub, 'active']
    );
    const user = userRes.rows[0];

    if (!user) {
      res.status(401).json({
        error: 'USER_INACTIVE',
        message: 'User account is no longer active.',
      });
      return;
    }

    const rotated = await issueTokenPair(user, payload.familyId);
    setRefreshCookie(res, rotated.refreshToken);

    res.status(200).json({
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
    });
  } catch {
    res.status(401).json({
      error: 'EXPIRED_REFRESH_TOKEN',
      message: 'Session expired. Please sign in again.',
    });
  }
});

// ============================================================================
// POST /api/v1/auth/logout
// ============================================================================
authRouter.post('/logout', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : undefined;

    if (accessToken) {
      try {
        const decoded = verifyAccessToken(accessToken);
        const ttl = decoded.exp
          ? Math.max(1, decoded.exp - Math.floor(Date.now() / 1000))
          : 900;
        await redis.set(
          RedisKeys.blacklistedAccessToken(decoded.jti),
          'revoked',
          'EX',
          ttl
        );
      } catch {
        // Ignore already expired access token
      }
    }

    const refreshToken =
      (req.cookies?.icx_refresh_token as string | undefined) ||
      (req.body?.refreshToken as string | undefined);

    if (refreshToken) {
      try {
        const rtPayload = verifyRefreshToken(refreshToken);
        await redis.del(RedisKeys.refreshToken(rtPayload.sub, rtPayload.tokenId));
      } catch {
        // Ignore expired refresh token
      }
    }

    res.clearCookie('icx_refresh_token', { path: '/api/v1/auth' });
    res.status(200).json({ status: 'logged_out' });
  } catch {
    res.status(200).json({ status: 'logged_out' });
  }
});

// ============================================================================
// POST /api/v1/auth/verify-email (AC-02)
// ============================================================================
authRouter.post('/verify-email', async (req: Request, res: Response): Promise<void> => {
  const token = String(req.body?.token || '').trim();
  if (!token) {
    res.status(400).json({ error: 'MISSING_TOKEN', message: 'Verification token required.' });
    return;
  }

  const userId = await redis.get(RedisKeys.emailVerificationToken(token));
  if (!userId) {
    res.status(400).json({
      error: 'INVALID_OR_EXPIRED_TOKEN',
      message: 'Verification token is invalid or has expired.',
    });
    return;
  }

  await query(
    'UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1',
    [userId]
  );
  await redis.del(RedisKeys.emailVerificationToken(token));

  await recordAuditEvent({
    actorId: userId,
    action: 'EMAIL_VERIFIED',
    targetEntity: 'users',
    targetId: userId,
  });

  res.status(200).json({ status: 'verified' });
});

// ============================================================================
// POST /api/v1/auth/password-reset/request & /confirm (AC-03: Password Reset by Email)
// ============================================================================
authRouter.post(
  '/password-reset/request',
  rateLimiter({ scope: 'pwd_reset_req', windowSeconds: 300, maxRequests: 5 }),
  async (req: Request, res: Response): Promise<void> => {
    const email = String(req.body?.email || '').toLowerCase().trim();
    if (!email) {
      res.status(400).json({ error: 'EMAIL_REQUIRED', message: 'Email address is required.' });
      return;
    }

    const userRes = await query<{ id: string; email: string }>(
      'SELECT id, email FROM users WHERE email = $1 AND status = $2 LIMIT 1',
      [email, 'active']
    );
    const user = userRes.rows[0];

    let resetTokenPreview: string | undefined;
    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      await redis.set(
        RedisKeys.passwordResetToken(resetToken),
        user.id,
        'EX',
        1800 // 30 minutes expiration
      );

      await recordAuditEvent({
        actorId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        targetEntity: 'users',
        targetId: user.id,
        details: { ip: req.ip },
      });

      if (env.NODE_ENV !== 'production') {
        resetTokenPreview = resetToken;
      }
    }

    // Always return 200 to prevent email enumeration
    res.status(200).json({
      status: 'reset_instructions_dispatched',
      message: 'If an active account matches that email, a password reset token has been dispatched.',
      resetTokenPreview,
    });
  }
);

authRouter.post(
  '/password-reset/confirm',
  rateLimiter({ scope: 'pwd_reset_confirm', windowSeconds: 300, maxRequests: 5 }),
  async (req: Request, res: Response): Promise<void> => {
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.new_password || '');

    if (!token || newPassword.length < 8) {
      res.status(400).json({
        error: 'INVALID_RESET_PAYLOAD',
        message: 'A valid reset token and a password of at least 8 characters are required.',
      });
      return;
    }

    const userId = await redis.get(RedisKeys.passwordResetToken(token));
    if (!userId) {
      res.status(400).json({
        error: 'INVALID_OR_EXPIRED_RESET_TOKEN',
        message: 'Password reset token is invalid or has expired.',
      });
      return;
    }

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      passwordHash,
      userId,
    ]);
    await redis.del(RedisKeys.passwordResetToken(token));

    await recordAuditEvent({
      actorId: userId,
      action: 'PASSWORD_RESET_COMPLETED',
      targetEntity: 'users',
      targetId: userId,
    });

    res.status(200).json({ status: 'password_updated' });
  }
);

// ============================================================================
// POST /api/v1/auth/2fa/setup & /enable (AC-06: Admin & Editor 2FA)
// ============================================================================
authRouter.post(
  '/2fa/setup',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const secret = generateTotpSecret();
    await query('UPDATE users SET two_factor_secret = $1 WHERE id = $2', [
      secret,
      req.user!.sub,
    ]);

    const otpauthUri = buildOtpAuthUri(req.user!.email, secret);
    res.status(200).json({ secret, otpauthUri });
  }
);

authRouter.post(
  '/2fa/enable',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const code = String(req.body?.totp_code || '').trim();
    const userRes = await query<{ two_factor_secret: string | null }>(
      'SELECT two_factor_secret FROM users WHERE id = $1 LIMIT 1',
      [req.user!.sub]
    );

    const secret = userRes.rows[0]?.two_factor_secret;
    if (!secret || !verifyTotpCode(secret, code)) {
      res.status(400).json({
        error: 'INVALID_2FA_CODE',
        message: 'Invalid 6-digit authenticator verification code.',
      });
      return;
    }

    await query('UPDATE users SET two_factor_enabled = true WHERE id = $1', [
      req.user!.sub,
    ]);

    await recordAuditEvent({
      actorId: req.user!.sub,
      action: 'TWO_FACTOR_ENABLED',
      targetEntity: 'users',
      targetId: req.user!.sub,
    });

    res.status(200).json({ status: 'two_factor_enabled' });
  }
);

// ============================================================================
// POST /api/v1/auth/admin/invite (AC-05: Admin invites Editors and Admins)
// ============================================================================
authRouter.post(
  '/admin/invite',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = AdminInviteStaffSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
      return;
    }

    const { email, full_name, phone, role } = parsed.data;
    const temporaryPassword = `Icx#${crypto.randomBytes(6).toString('hex')}!`;
    const passwordHash = await argon2.hash(temporaryPassword, {
      type: argon2.argon2id,
    });

    const created = await withTransaction(async (client) => {
      const insertRes = await client.query<UserRecord>(
        `INSERT INTO users (email, password_hash, role, phone, full_name, status, email_verified_at)
         VALUES ($1, $2, $3, $4, $5, 'active', NOW())
         RETURNING id, email, role, full_name, phone, status, created_at`,
        [email, passwordHash, role, phone, full_name]
      );
      const staff = insertRes.rows[0]!;

      await recordAuditEvent(
        {
          actorId: req.user!.sub,
          action: 'ADMIN_INVITED_STAFF',
          targetEntity: 'users',
          targetId: staff.id,
          details: { invited_email: email, assigned_role: role },
        },
        client
      );
      return staff;
    });

    res.status(201).json({
      staff: created,
      temporaryPassword,
    });
  }
);

// ============================================================================
// GET /api/v1/auth/me
// ============================================================================
authRouter.get(
  '/me',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userRes = await query<UserRecord>(
      `SELECT id, email, role, phone, full_name, two_factor_enabled, status, email_verified_at, created_at, updated_at
       FROM users WHERE id = $1 LIMIT 1`,
      [req.user!.sub]
    );
    const user = userRes.rows[0];
    if (!user) {
      res.status(404).json({ error: 'USER_NOT_FOUND' });
      return;
    }

    res.status(200).json({ user });
  }
);

