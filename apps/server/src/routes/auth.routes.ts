import { Router, type Request, type Response } from 'express';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import {
  RegisterSchema,
  LoginSchema,
  AdminInviteStaffSchema,
  NigerianPhoneSchema,
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
import {
  dispatchNotification,
  buildStudioEmailTemplate,
  escapeHtml,
} from '../engines/notification.engine.js';

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
  res.cookie('icx_logged_in', '1', {
    httpOnly: false,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
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

    const {
      email,
      password,
      full_name,
      phone,
      role,
      bio,
      location,
      specialty,
      years_experience,
      portfolio_urls,
    } = parsed.data;

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
            `INSERT INTO photographer_profiles (
               user_id, bio, location, specialty, years_experience, portfolio_urls, approval_status, submitted_at
             )
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'pending', NOW())`,
            [
              createdUser.id,
              bio || null,
              location || null,
              specialty || null,
              years_experience ?? 0,
              JSON.stringify(portfolio_urls || []),
            ]
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

      // Dispatch real branded Email Confirmation via mail.icxora.com SMTP
      const webUrl = (process.env.NEXT_PUBLIC_WEB_URL || 'https://icxora.com').replace(/\/$/, '');
      const verifyUrl = `${webUrl}/auth/verify-email?token=${verificationToken}`;

      void dispatchNotification({
        triggerId: 'NT-AUTH-VERIFY',
        recipientEmail: newUser.email,
        recipientUserId: newUser.id,
        subject: 'Confirm Your ICX Studios Account',
        htmlBody: buildStudioEmailTemplate({
          heading: `Welcome to ICX Studios, ${escapeHtml(newUser.full_name)}.`,
          subheading: 'Confirm your email address to activate full studio privileges.',
          bodyHtml: `
            <p style="margin:0 0 16px;">Thank you for creating your <strong>${newUser.role === 'photographer' ? 'Partner Photographer' : 'Client Studio'}</strong> account on <strong>ICX Studios</strong>.</p>
            <p style="margin:0 0 16px;">Please confirm your email address within the next 24 hours by clicking the button below. If you prefer to enter a verification token manually in your Account Security settings, your token is:</p>
            <div style="background:#F4F4F5;border:1px solid #E4E4E7;border-radius:10px;padding:12px 16px;font-family:monospace;font-size:13px;color:#09090B;word-break:break-all;">${verificationToken}</div>
          `,
          ctaLabel: 'Confirm Email Address',
          ctaUrl: verifyUrl,
          footerNote: 'This verification link expires in 24 hours.',
        }),
        targetEntity: 'users',
        targetId: newUser.id,
      });

      if (role === 'photographer') {
        void dispatchNotification({
          triggerId: 'NT-06',
          recipientEmail: 'admin@icxora.com',
          recipientUserId: newUser.id,
          subject: `New Photographer Application: ${newUser.full_name}`,
          htmlBody: buildStudioEmailTemplate({
            heading: 'New Photographer Roster Application',
            subheading: `${escapeHtml(newUser.full_name)} (${escapeHtml(newUser.email)}) has applied to join the ICX Studios Photographer Directory.`,
            bodyHtml: `
              <p style="margin:0 0 12px;"><strong>Applicant:</strong> ${escapeHtml(newUser.full_name)}</p>
              <p style="margin:0 0 12px;"><strong>Email:</strong> ${escapeHtml(newUser.email)}</p>
              <p style="margin:0 0 12px;"><strong>Phone:</strong> ${escapeHtml(newUser.phone || '')}</p>
              <p style="margin:0;">Review and approve or reject this photographer profile from the Executive Control Center.</p>
            `,
            ctaLabel: 'Open Executive Admin Console',
            ctaUrl: `${webUrl}/admin`,
          }),
          targetEntity: 'users',
          targetId: newUser.id,
        });
      }

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
    res.clearCookie('icx_logged_in', { path: '/' });
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

  const updatedRes = await query<UserRecord>(
    `UPDATE users
     SET email_verified_at = COALESCE(email_verified_at, NOW())
     WHERE id = $1
     RETURNING id, email, full_name, role, email_verified_at`,
    [userId]
  );
  await redis.del(RedisKeys.emailVerificationToken(token));

  const verifiedUser = updatedRes.rows[0] || null;
  let approvalStatus: string | null = null;
  if (verifiedUser?.role === 'photographer') {
    const ppRes = await query<{ approval_status: string }>(
      'SELECT approval_status FROM photographer_profiles WHERE user_id = $1 LIMIT 1',
      [verifiedUser.id]
    );
    approvalStatus = ppRes.rows[0]?.approval_status || 'pending';
  }

  await recordAuditEvent({
    actorId: userId,
    action: 'EMAIL_VERIFIED',
    targetEntity: 'users',
    targetId: userId,
  });

  res.status(200).json({
    status: 'verified',
    user: verifiedUser,
    approval_status: approvalStatus,
  });
});

// GET /api/v1/auth/verify-email (Direct email link browser handler)
authRouter.get('/verify-email', async (req: Request, res: Response): Promise<void> => {
  const token = String(req.query.token || '').trim();
  const webUrl = (process.env.NEXT_PUBLIC_WEB_URL || 'https://icxora.com').replace(/\/$/, '');

  if (!token) {
    res.redirect(`${webUrl}/auth/verify-email?error=missing_token`);
    return;
  }

  const userId = await redis.get(RedisKeys.emailVerificationToken(token));
  if (!userId) {
    res.redirect(`${webUrl}/auth/verify-email?error=expired_token`);
    return;
  }

  const userRes = await query<{ role: string }>(
    `UPDATE users
     SET email_verified_at = COALESCE(email_verified_at, NOW())
     WHERE id = $1
     RETURNING role`,
    [userId]
  );
  await redis.del(RedisKeys.emailVerificationToken(token));

  await recordAuditEvent({
    actorId: userId,
    action: 'EMAIL_VERIFIED',
    targetEntity: 'users',
    targetId: userId,
  });

  const role = userRes.rows[0]?.role || 'customer';
  res.redirect(`${webUrl}/auth/verify-email?verified=1&role=${encodeURIComponent(role)}`);
});

// ============================================================================
// GET /api/v1/auth/verification-status (Real-time Cross-Device Status Polling)
// ============================================================================
authRouter.get('/verification-status', async (req: Request, res: Response): Promise<void> => {
  const email = String(req.query.email || '').trim().toLowerCase();
  const userId = String(req.query.userId || '').trim();

  if (!email && !userId) {
    res.status(400).json({ error: 'EMAIL_OR_USERID_REQUIRED' });
    return;
  }

  const userRes = await query<{
    id: string;
    email: string;
    full_name: string;
    role: string;
    email_verified_at: string | null;
  }>(
    `SELECT id, email, full_name, role, email_verified_at
     FROM users
     WHERE (email = $1 AND $1 IS NOT NULL)
        OR (id = $2 AND $2 IS NOT NULL)
     LIMIT 1`,
    [email || null, userId || null]
  );

  const found = userRes.rows[0];
  if (!found) {
    res.status(404).json({ error: 'USER_NOT_FOUND' });
    return;
  }

  res.status(200).json({
    verified: Boolean(found.email_verified_at),
    email_verified_at: found.email_verified_at,
    user: found,
  });
});

// ============================================================================
// POST /api/v1/auth/resend-verification (Resend Email Confirmation Link)
// ============================================================================
authRouter.post(
  '/resend-verification',
  requireAuth,
  rateLimiter({ scope: 'auth_resend_verify', windowSeconds: 300, maxRequests: 5 }),
  async (req: Request, res: Response): Promise<void> => {
    const userRes = await query<UserRecord>(
      'SELECT id, email, full_name, role, email_verified_at FROM users WHERE id = $1 LIMIT 1',
      [req.user!.sub]
    );
    const user = userRes.rows[0];
    if (!user) {
      res.status(404).json({ error: 'USER_NOT_FOUND' });
      return;
    }

    if (user.email_verified_at) {
      res.status(200).json({
        status: 'already_verified',
        message: 'Your email address is already verified.',
      });
      return;
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    await redis.set(
      RedisKeys.emailVerificationToken(verificationToken),
      user.id,
      'EX',
      86400
    );

    const webUrl = (process.env.NEXT_PUBLIC_WEB_URL || 'https://icxora.com').replace(/\/$/, '');
    const verifyUrl = `${webUrl}/auth/verify-email?token=${verificationToken}`;

    await dispatchNotification({
      triggerId: 'NT-AUTH-VERIFY',
      recipientEmail: user.email,
      recipientUserId: user.id,
      subject: 'Confirm Your ICX Studios Email Address',
      htmlBody: buildStudioEmailTemplate({
        heading: `Verify Your Email Address, ${user.full_name}.`,
        subheading: 'Click the button below to confirm your ICX Studios account.',
        bodyHtml: `
          <p style="margin:0 0 16px;">You requested a new email verification link for your ICX Studios account (<strong>${user.email}</strong>).</p>
          <p style="margin:0 0 16px;">Click the confirmation button below, or paste this token into your Account Security page:</p>
          <div style="background:#F4F4F5;border:1px solid #E4E4E7;border-radius:10px;padding:12px 16px;font-family:monospace;font-size:13px;color:#09090B;word-break:break-all;">${verificationToken}</div>
        `,
        ctaLabel: 'Confirm Email Address',
        ctaUrl: verifyUrl,
        footerNote: 'This verification link expires in 24 hours.',
      }),
      targetEntity: 'users',
      targetId: user.id,
    });

    res.status(200).json({
      status: 'verification_email_sent',
      message: `A new confirmation email has been sent to ${user.email}.`,
    });
  }
);

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

    const userRes = await query<{ id: string; email: string; full_name: string }>(
      'SELECT id, email, full_name FROM users WHERE email = $1 AND status = $2 LIMIT 1',
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

      const webUrl = (process.env.NEXT_PUBLIC_WEB_URL || 'https://icxora.com').replace(/\/$/, '');
      const resetUrl = `${webUrl}/auth/reset-password?token=${resetToken}`;

      void dispatchNotification({
        triggerId: 'NT-AUTH-RESET',
        recipientEmail: user.email,
        recipientUserId: user.id,
        subject: 'Reset Your ICX Studios Password',
        htmlBody: buildStudioEmailTemplate({
          heading: 'Password Reset Request',
          subheading: `We received a request to reset the password for ${user.email}.`,
          bodyHtml: `
            <p style="margin:0 0 16px;">Hello ${user.full_name},</p>
            <p style="margin:0 0 16px;">Click the button below to choose a new password for your ICX Studios account, or copy and paste this reset token:</p>
            <div style="background:#F4F4F5;border:1px solid #E4E4E7;border-radius:10px;padding:12px 16px;font-family:monospace;font-size:13px;color:#09090B;word-break:break-all;">${resetToken}</div>
          `,
          ctaLabel: 'Reset Studio Password',
          ctaUrl: resetUrl,
          footerNote: 'This password reset link expires in 30 minutes. If you did not request a reset, you can safely ignore this email.',
        }),
        targetEntity: 'users',
        targetId: user.id,
      });

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
      message: 'If an active account matches that email, a password reset link has been sent to your inbox.',
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

    const existing = await query<UserRecord>(
      'SELECT id FROM users WHERE email = $1 LIMIT 1',
      [email]
    );
    if (existing.rows[0]) {
      res.status(409).json({
        error: 'USER_ALREADY_EXISTS',
        message: 'A user with this email address already exists in the system.',
      });
      return;
    }

    const placeholderHash = await argon2.hash(crypto.randomBytes(32).toString('hex'), {
      type: argon2.argon2id,
    });

    const created = await withTransaction(async (client) => {
      const insertRes = await client.query<UserRecord>(
        `INSERT INTO users (email, password_hash, role, phone, full_name, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         RETURNING id, email, role, full_name, phone, status, created_at`,
        [email, placeholderHash, role, phone, full_name]
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

    const inviteToken = crypto.randomBytes(32).toString('hex');
    await redis.set(
      RedisKeys.staffInviteToken(inviteToken),
      created.id,
      'EX',
      259200 // 72 hours
    );

    const webUrl = (process.env.NEXT_PUBLIC_WEB_URL || 'https://icxora.com').replace(/\/$/, '');
    const acceptInviteUrl = `${webUrl}/auth/accept-invite?token=${inviteToken}`;

    const roleName =
      created.role === 'admin'
        ? 'Executive Administrator'
        : created.role === 'editor'
        ? 'Senior Retoucher & Editor'
        : created.role === 'photographer'
        ? 'Studio Photographer'
        : 'Team Member';

    void dispatchNotification({
      triggerId: 'NT-AUTH-INVITE',
      recipientEmail: created.email,
      recipientUserId: created.id,
      subject: `Invitation to Join ICX Studios (${roleName})`,
      htmlBody: buildStudioEmailTemplate({
        heading: `Welcome to the ICX Studios Team, ${created.full_name}.`,
        subheading: `You have been officially invited to join ICX Studios as a ${roleName}.`,
        bodyHtml: `
          <p style="margin:0 0 14px;">An administrator has provisioned your studio access. To activate your workspace and set your private confidential password, click the button below:</p>
          <div style="background:#F4F4F5;border:1px solid #E4E4E7;border-radius:10px;padding:14px 16px;font-size:13px;color:#09090B;margin-bottom:16px;">
            <div style="margin-bottom:6px;"><strong>Work Email:</strong> ${created.email}</div>
            <div><strong>Assigned Position:</strong> ${roleName}</div>
          </div>
          <p style="margin:0;font-size:13px;color:#71717A;">For security, ICX Studios never transmits account passwords over email. This activation link expires in 72 hours.</p>
        `,
        ctaLabel: 'Set Your Password & Activate Account',
        ctaUrl: acceptInviteUrl,
        footerNote: 'If you were not expecting this invitation, please disregard this email or contact support@icxora.com.',
      }),
      targetEntity: 'users',
      targetId: created.id,
    });

    res.status(201).json({
      staff: created,
      inviteToken: env.NODE_ENV !== 'production' ? inviteToken : undefined,
    });
  }
);

// ============================================================================
// GET /api/v1/auth/invite-details (Inspect invitation token before setting password)
// ============================================================================
authRouter.get(
  '/invite-details',
  async (req: Request, res: Response): Promise<void> => {
    const token = String(req.query.token || '').trim();
    if (!token) {
      res.status(400).json({ error: 'MISSING_TOKEN', message: 'Invitation token is required.' });
      return;
    }

    const userId = await redis.get(RedisKeys.staffInviteToken(token));
    if (!userId) {
      res.status(404).json({
        valid: false,
        error: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'This invitation link is invalid or has expired. Please contact your studio administrator for a new invitation.',
      });
      return;
    }

    const userRes = await query<UserRecord>(
      'SELECT id, email, full_name, role FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );
    const user = userRes.rows[0];
    if (!user) {
      res.status(404).json({
        valid: false,
        error: 'USER_NOT_FOUND',
        message: 'Associated user account could not be found.',
      });
      return;
    }

    res.status(200).json({
      valid: true,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    });
  }
);

// ============================================================================
// POST /api/v1/auth/accept-invite (Invited staff sets their private password)
// ============================================================================
authRouter.post(
  '/accept-invite',
  rateLimiter({ scope: 'accept_invite', windowSeconds: 300, maxRequests: 5 }),
  async (req: Request, res: Response): Promise<void> => {
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '');

    if (!token) {
      res.status(400).json({ error: 'MISSING_TOKEN', message: 'Invitation token is required.' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'Password must be at least 8 characters long.',
      });
      return;
    }

    const userId = await redis.get(RedisKeys.staffInviteToken(token));
    if (!userId) {
      res.status(400).json({
        error: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'This invitation token is invalid or has expired. Please contact your administrator for a new link.',
      });
      return;
    }

    const userRes = await query<UserRecord>(
      'SELECT id, email, full_name, role, status FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );
    const user = userRes.rows[0];
    if (!user) {
      res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User account not found.' });
      return;
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const updatedRes = await query<UserRecord>(
      `UPDATE users
       SET password_hash = $1,
           email_verified_at = COALESCE(email_verified_at, NOW()),
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, role, phone, full_name, two_factor_enabled, status, email_verified_at, created_at, updated_at`,
      [passwordHash, userId]
    );
    const updatedUser = updatedRes.rows[0]!;

    await redis.del(RedisKeys.staffInviteToken(token));

    await recordAuditEvent({
      actorId: user.id,
      action: 'STAFF_INVITATION_ACCEPTED',
      targetEntity: 'users',
      targetId: user.id,
      details: { role: user.role },
    });

    const { accessToken, refreshToken } = await issueTokenPair(updatedUser);
    setRefreshCookie(res, refreshToken);

    res.status(200).json({
      status: 'invitation_accepted',
      user: updatedUser,
      accessToken,
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

// ============================================================================
// PATCH /api/v1/auth/profile (Update Name & Phone)
// ============================================================================
authRouter.patch(
  '/profile',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { full_name, phone } = req.body as { full_name?: string; phone?: string };
    let normalizedPhone: string | null = null;
    if (phone !== undefined && phone.trim() !== '') {
      const phoneParsed = NigerianPhoneSchema.safeParse(phone);
      if (!phoneParsed.success) {
        res.status(400).json({
          error: 'INVALID_PHONE',
          message:
            phoneParsed.error.issues[0]?.message ||
            'Enter a valid 11-digit Nigerian phone number.',
        });
        return;
      }
      normalizedPhone = phoneParsed.data;
    }

    const updated = await query<UserRecord>(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, email, role, phone, full_name, two_factor_enabled, status, email_verified_at, created_at, updated_at`,
      [full_name?.trim() || null, normalizedPhone, req.user!.sub]
    );

    const user = updated.rows[0];
    if (!user) {
      res.status(404).json({ error: 'USER_NOT_FOUND' });
      return;
    }

    res.status(200).json({ user });
  }
);

// ============================================================================
// POST /api/v1/auth/change-password (Change Account Password)
// ============================================================================
authRouter.post(
  '/change-password',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { current_password, new_password } = req.body as {
      current_password?: string;
      new_password?: string;
    };

    if (!current_password || !new_password || new_password.length < 8) {
      res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Current password and a new password of at least 8 characters are required.',
      });
      return;
    }

    const userRes = await query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1 LIMIT 1',
      [req.user!.sub]
    );
    const user = userRes.rows[0];
    if (!user) {
      res.status(404).json({ error: 'USER_NOT_FOUND' });
      return;
    }

    const valid = await argon2.verify(user.password_hash, current_password);
    if (!valid) {
      res.status(400).json({
        error: 'INCORRECT_PASSWORD',
        message: 'The current password you entered is incorrect.',
      });
      return;
    }

    const newHash = await argon2.hash(new_password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      newHash,
      req.user!.sub,
    ]);

    await recordAuditEvent({
      actorId: req.user!.sub,
      action: 'PASSWORD_CHANGED',
      targetEntity: 'users',
      targetId: req.user!.sub,
    });

    res.status(200).json({ status: 'password_changed', message: 'Password updated successfully.' });
  }
);

// ============================================================================
// GOOGLE OAUTH 2.0 (Sign In / Sign Up with Google)
// ============================================================================
authRouter.get('/google', async (req: Request, res: Response): Promise<void> => {
  const webUrl = (process.env.NEXT_PUBLIC_WEB_URL || 'https://icxora.com').replace(/\/$/, '');
  const clientId = env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const callbackUrl =
    env.GOOGLE_CALLBACK_URL ||
    process.env.GOOGLE_CALLBACK_URL ||
    `${webUrl}/api/v1/auth/google/callback`;

  if (!clientId) {
    res.redirect(`${webUrl}/auth/login?error=google_not_configured`);
    return;
  }

  const intent = String(req.query.intent || 'login');
  const redirectTarget = String(req.query.redirect || '').startsWith('/')
    ? String(req.query.redirect)
    : '';
  const state = crypto.randomBytes(24).toString('hex');

  await redis.set(
    `oauth:google:state:${state}`,
    JSON.stringify({ intent, redirect: redirectTarget }),
    'EX',
    600
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

authRouter.get('/google/callback', async (req: Request, res: Response): Promise<void> => {
  const webUrl = (process.env.NEXT_PUBLIC_WEB_URL || 'https://icxora.com').replace(/\/$/, '');
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');

  if (!code || !state) {
    res.redirect(`${webUrl}/auth/login?error=google_cancelled`);
    return;
  }

  const statePayloadRaw = await redis.get(`oauth:google:state:${state}`);
  if (!statePayloadRaw) {
    res.redirect(`${webUrl}/auth/login?error=google_state_expired`);
    return;
  }
  await redis.del(`oauth:google:state:${state}`);

  const statePayload = JSON.parse(statePayloadRaw) as { intent?: string; redirect?: string };
  const clientId = env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  const callbackUrl =
    env.GOOGLE_CALLBACK_URL ||
    process.env.GOOGLE_CALLBACK_URL ||
    `${webUrl}/api/v1/auth/google/callback`;

  if (!clientId || !clientSecret) {
    res.redirect(`${webUrl}/auth/login?error=google_not_configured`);
    return;
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      res.redirect(`${webUrl}/auth/login?error=google_token_exchange_failed`);
      return;
    }

    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      res.redirect(`${webUrl}/auth/login?error=google_token_missing`);
      return;
    }

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });

    if (!userInfoRes.ok) {
      res.redirect(`${webUrl}/auth/login?error=google_userinfo_failed`);
      return;
    }

    const profile = (await userInfoRes.json()) as {
      email?: string;
      email_verified?: boolean;
      name?: string;
    };

    if (!profile.email) {
      res.redirect(`${webUrl}/auth/login?error=google_email_missing`);
      return;
    }

    const normalizedEmail = profile.email.toLowerCase().trim();
    const existingRes = await query<UserRecord>(
      'SELECT * FROM users WHERE email = $1 LIMIT 1',
      [normalizedEmail]
    );
    let user = existingRes.rows[0];

    if (user && user.role === 'admin') {
      res.redirect(`${webUrl}/auth/login?error=admin_oauth_forbidden`);
      return;
    }

    if (user && user.status !== 'active') {
      res.redirect(`${webUrl}/auth/login?error=account_suspended`);
      return;
    }

    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await argon2.hash(randomPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });

      const createdRes = await query<UserRecord>(
        `INSERT INTO users (email, password_hash, role, full_name, status, email_verified_at)
         VALUES ($1, $2, 'customer', $3, 'active', $4)
         RETURNING *`,
        [
          normalizedEmail,
          passwordHash,
          (profile.name || normalizedEmail.split('@')[0] || 'ICX User').trim().slice(0, 150),
          profile.email_verified ? new Date() : null,
        ]
      );
      user = createdRes.rows[0]!;

      await recordAuditEvent({
        actorId: user.id,
        action: 'USER_REGISTERED_GOOGLE',
        targetEntity: 'users',
        targetId: user.id,
        details: { email: normalizedEmail },
      });
    } else if (profile.email_verified && !user.email_verified_at) {
      const updatedRes = await query<UserRecord>(
        `UPDATE users SET email_verified_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
        [user.id]
      );
      user = updatedRes.rows[0] || user;
    }

    const tokens = await issueTokenPair(user);
    setRefreshCookie(res, tokens.refreshToken);

    const exchangeCode = crypto.randomBytes(24).toString('hex');
    await redis.set(
      `oauth:google:exchange:${exchangeCode}`,
      JSON.stringify({
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
        redirect: statePayload.redirect || '',
      }),
      'EX',
      120
    );

    res.redirect(`${webUrl}/auth/google-callback?code=${encodeURIComponent(exchangeCode)}`);
  } catch (error) {
    console.error('[ICX-AUTH] Google OAuth callback error:', error);
    res.redirect(`${webUrl}/auth/login?error=google_oauth_error`);
  }
});

authRouter.post('/google/exchange', async (req: Request, res: Response): Promise<void> => {
  const code = String(req.body?.code || '').trim();
  if (!code) {
    res.status(400).json({ error: 'MISSING_CODE' });
    return;
  }

  const raw = await redis.get(`oauth:google:exchange:${code}`);
  if (!raw) {
    res.status(400).json({ error: 'INVALID_OR_EXPIRED_CODE' });
    return;
  }
  await redis.del(`oauth:google:exchange:${code}`);

  const payload = JSON.parse(raw) as {
    user: Record<string, unknown>;
    accessToken: string;
    redirect: string;
  };
  res.status(200).json(payload);
});

