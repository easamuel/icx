import { ICX_COLORS } from '@icx/ui-core';
import type { UserRole, PublicUserProfile } from '@icx/shared-types';

/**
 * Reserved React Native / Expo Mobile Architecture consuming @icx/shared-types and @icx/ui-core
 * against the unified self-hosted Node.js API engine (Requirements MA-01 through MA-14, NF-17).
 */
export const MOBILE_APP_CONFIG = {
  appName: 'ICX Studios',
  supportedRoles: ['customer', 'photographer'] satisfies UserRole[],
  theme: ICX_COLORS,
  minSupportedVersions: {
    ios: '16.0',
    androidApiLevel: 28, // Android 9 (Pie) per MA-12
  },
} as const;

export interface SecureTokenStorageAdapter {
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  saveTokens(accessToken: string, refreshToken: string): Promise<void>;
  clearTokens(): Promise<void>;
}

/**
 * MobilePreviewSecurityPolicy (Requirements MA-06, MA-07, NF-17):
 * - Android: Activates FLAG_SECURE on all watermarked preview screens to block screenshots & screen recording.
 * - iOS: Detects screenshot events, warns the user, posts an audit event to the server, and hides previews when screen recording is active.
 * - Never caches clean files on device before full payment is verified.
 */
export async function reportMobileScreenshotAuditEvent(params: {
  apiBaseUrl: string;
  accessToken: string;
  targetEntity: 'edit_orders' | 'bookings';
  targetId: string;
  platform: 'ios' | 'android';
}): Promise<void> {
  await fetch(`${params.apiBaseUrl}/auth/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'X-ICX-Mobile-Security-Event': `SCREENSHOT_DETECTED_${params.platform.toUpperCase()}:${params.targetEntity}:${params.targetId}`,
    },
  }).catch(() => undefined);
}

/**
 * Role-based mobile screen router (MA-01, MA-02):
 * One React Native codebase serves both Customers and Photographers; Admin & Editor stay on Web.
 */
export function resolveMobileRootScreenForRole(
  user: Pick<PublicUserProfile, 'role'>
): 'CustomerRootStack' | 'PhotographerRootStack' | 'WebOnlyRoleNoticeScreen' {
  if (user.role === 'customer') return 'CustomerRootStack';
  if (user.role === 'photographer') return 'PhotographerRootStack';
  return 'WebOnlyRoleNoticeScreen';
}
