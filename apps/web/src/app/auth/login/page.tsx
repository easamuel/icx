'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, AlertCircle } from 'lucide-react';
import { IcxLogo } from '@/components/brand/IcxLogo';
import { apiFetch, setStoredSession, ApiError } from '@/lib/api';

interface LoginResponse {
  requiresTwoFactor?: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    email: string;
    full_name: string;
    role: 'customer' | 'photographer' | 'editor' | 'admin';
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          totp_code: totpCode.trim() ? totpCode.trim() : undefined,
        }),
      });

      if (res.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        setLoading(false);
        return;
      }

      if (res.accessToken && res.user) {
        setStoredSession(res.accessToken, res.user);
        if (res.user.role === 'admin') {
          router.push('/admin');
        } else if (res.user.role === 'editor') {
          router.push('/workspace/editor');
        } else if (res.user.role === 'photographer') {
          router.push('/portal/photographer');
        } else {
          router.push('/dashboard');
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to reach the ICX authentication server.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center bg-icx-slate px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center">
          <IcxLogo variant="sand-on-slate" className="h-11 w-auto" />
        </Link>
        <h1 className="mt-6 text-center text-2xl font-bold tracking-tight text-icx-sand">
          Sign in to ICX Studios
        </h1>
        <p className="mt-2 text-center text-xs text-icx-sand-muted">
          Unified access for Customers, Photographers, Editors &amp; Admins
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark px-6 py-8 shadow-xl sm:px-10">
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-icx-error/40 bg-icx-error/10 p-3.5 text-xs text-icx-error">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-icx-sand"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2.5 text-sm text-icx-sand placeholder-icx-sand-muted/50 focus:border-icx-sand focus:outline-none"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider text-icx-sand"
                >
                  Password
                </label>
                <Link
                  href="/auth/reset-password"
                  className="text-xs font-medium text-icx-sand-muted hover:text-icx-sand hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2.5 text-sm text-icx-sand placeholder-icx-sand-muted/50 focus:border-icx-sand focus:outline-none"
                placeholder="••••••••••••"
              />
            </div>

            {requiresTwoFactor && (
              <div className="rounded-xl border border-icx-warning/40 bg-icx-slate p-4">
                <label
                  htmlFor="totp"
                  className="flex items-center gap-1.5 text-xs font-semibold text-icx-warning"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>6-Digit Authenticator Code (2FA Required)</span>
                </label>
                <input
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="mt-2 block w-full rounded-lg border border-icx-slate-border bg-icx-slate-dark px-3 py-2 text-center tracking-widest text-base font-mono text-icx-sand focus:border-icx-sand focus:outline-none"
                  placeholder="000000"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-icx-sand py-3 text-sm font-bold text-icx-slate shadow hover:bg-icx-sand-light disabled:opacity-50 transition-colors"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 border-t border-icx-slate-border pt-5 text-center text-xs text-icx-sand-muted">
            Don&apos;t have an account?{' '}
            <Link
              href="/auth/register"
              className="font-semibold text-icx-sand hover:underline"
            >
              Create a Customer or Photographer Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

