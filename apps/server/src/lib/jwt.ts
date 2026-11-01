import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@icx/shared-types';
import { env } from '../config/env.js';
import { redis, RedisKeys } from './redis.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  jti: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
  familyId: string;
  iat?: number;
  exp?: number;
}

/**
 * Issues a signed Access Token + Refresh Token pair and persists the Refresh Token in Redis.
 */
export async function issueTokenPair(user: {
  id: string;
  email: string;
  role: UserRole;
  email_verified_at: Date | null;
}, existingFamilyId?: string) {
  const jti = crypto.randomUUID();
  const tokenId = crypto.randomUUID();
  const familyId = existingFamilyId ?? crypto.randomUUID();

  const accessPayload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    emailVerified: Boolean(user.email_verified_at),
    jti,
  };

  const refreshPayload: RefreshTokenPayload = {
    sub: user.id,
    tokenId,
    familyId,
  };

  const accessToken = jwt.sign(accessPayload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  const refreshToken = jwt.sign(refreshPayload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_SECONDS,
  });

  await redis.set(
    RedisKeys.refreshToken(user.id, tokenId),
    JSON.stringify({
      userId: user.id,
      familyId,
      createdAt: Date.now(),
    }),
    'EX',
    env.JWT_REFRESH_EXPIRES_SECONDS
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: 900, // 15 minutes in seconds
  };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

/**
 * Generates an expiring 24-hour HMAC-SHA256 signed download token for clean files.
 */
export function createSignedDownloadToken(params: {
  userId: string;
  targetType: 'edit_order' | 'booking';
  targetId: string;
  photoId?: string | 'zip';
}): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // Strictly 24 hours
  const payload = `${params.userId}:${params.targetType}:${params.targetId}:${params.photoId ?? 'zip'}:${expiresAt}`;
  const signature = crypto
    .createHmac('sha256', env.DOWNLOAD_HMAC_SECRET)
    .update(payload)
    .digest('hex');

  const token = Buffer.from(`${payload}:${signature}`, 'utf8').toString('base64url');
  return { token, expiresAt };
}

export function verifySignedDownloadToken(token: string): {
  userId: string;
  targetType: 'edit_order' | 'booking';
  targetId: string;
  photoId: string;
  expiresAt: number;
} | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 6) return null;

    const [userId, targetType, targetId, photoId, expiresAtStr, signature] = parts as [
      string,
      'edit_order' | 'booking',
      string,
      string,
      string,
      string,
    ];

    const expiresAt = Number(expiresAtStr);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
      return null;
    }

    const payload = `${userId}:${targetType}:${targetId}:${photoId}:${expiresAtStr}`;
    const expectedSig = crypto
      .createHmac('sha256', env.DOWNLOAD_HMAC_SECRET)
      .update(payload)
      .digest('hex');

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSig, 'utf8')
      )
    ) {
      return null;
    }

    return { userId, targetType, targetId, photoId, expiresAt };
  } catch {
    return null;
  }
}

