import {
  isValidNigerianPhone,
  normalizeNigerianPhone,
} from '@icx/shared-types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('icx_access_token');
}

export function setStoredSession(accessToken: string, user: unknown): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('icx_access_token', accessToken);
  window.localStorage.setItem('icx_user', JSON.stringify(user));
  document.cookie = 'icx_logged_in=1; path=/; max-age=604800; SameSite=Lax';
}

export function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('icx_access_token');
  window.localStorage.removeItem('icx_user');
  document.cookie = 'icx_logged_in=; path=/; max-age=0; SameSite=Lax';
}

export function sanitizeNigerianPhoneInput(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+234') || (cleaned.startsWith('234') && cleaned.length >= 13)) {
    return normalizeNigerianPhone(cleaned).slice(0, 11);
  }
  return cleaned.replace(/\D/g, '').slice(0, 11);
}

export function validateNigerianPhone(raw: string): string | null {
  const normalized = sanitizeNigerianPhoneInput(raw);
  if (normalized.length !== 11) {
    return 'Phone number must be exactly 11 digits (e.g. 0803XXXXXXX).';
  }
  if (!isValidNigerianPhone(normalized)) {
    return 'Enter a valid active Nigerian mobile number (e.g. 0803XXXXXXX, 0812XXXXXXX, 0703XXXXXXX, 0902XXXXXXX).';
  }
  return null;
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredAccessToken();
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error || 'API_ERROR',
      data.message || 'Request failed',
      data.details
    );
  }

  return data as T;
}
