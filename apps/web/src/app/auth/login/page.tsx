'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, AlertCircle, ArrowRight } from 'lucide-react';
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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-white text-zinc-950">
      {/* Left 5 Columns: Editorial Monochrome Brand Showcase */}
      <div className="hidden lg:flex lg:col-span-5 flex-col justify-between bg-zinc-950 p-12 text-white">
        <Link href="/">
          <IcxLogo variant="light" />
        </Link>

        <div className="space-y-6">
          <span className="inline-block rounded-full border border-zinc-800 bg-zinc-900 px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest text-zinc-300">
            ICX Studios Ecosystem
          </span>
          <h2 className="text-3xl font-black tracking-tight leading-tight">
            One Studio Identity for Retouching, Talent &amp; Cinema Gear.
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Access your high-resolution proof room, manage 48-hour photographer slot holds, or oversee cinema vault dispatches.
          </p>
        </div>

        <div className="border-t border-zinc-800 pt-6 text-xs text-zinc-500">
          © {new Date().getFullYear()} ICX Studios (LearnArk Technology Limited)
        </div>
      </div>

      {/* Right 7 Columns: Sign-In Form */}
      <div className="lg:col-span-7 flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-16">
        <div className="mx-auto w-full max-w-md space-y-8">
          <div>
            <Link href="/" className="lg:hidden inline-block mb-6">
              <IcxLogo variant="dark" />
            </Link>
            <h1 className="text-3xl font-black tracking-tight text-zinc-950">
              Sign in to ICX Studios
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-zinc-600">
              Enter your studio credentials to access your workspace.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
            {error && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-extrabold uppercase tracking-wider text-zinc-900"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-4 py-3 text-sm text-zinc-950 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none"
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-xs font-extrabold uppercase tracking-wider text-zinc-900"
                  >
                    Password
                  </label>
                  <Link
                    href="/auth/reset-password"
                    className="text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:underline"
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
                  className="mt-1.5 block w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-4 py-3 text-sm text-zinc-950 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none"
                  placeholder="••••••••••••"
                />
              </div>

              {requiresTwoFactor && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <label
                    htmlFor="totp"
                    className="flex items-center gap-1.5 text-xs font-bold text-amber-900"
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
                    className="mt-2 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-center tracking-widest text-base font-mono font-bold text-zinc-950 focus:border-zinc-950 focus:outline-none"
                    placeholder="000000"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 py-3.5 text-sm font-black text-white shadow-xl hover:bg-zinc-800 disabled:opacity-50 transition-all"
              >
                <span>{loading ? 'Signing In...' : 'Sign In to Studio'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {/* Quick Portal Switcher for Instant Studio Access */}
            <div className="border-t border-zinc-200 pt-5 space-y-2.5">
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Quick-Fill Studio Role Credentials
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Client Account', email: 'customer@icxstudios.com' },
                  { label: 'Photographer Portal', email: 'photographer@icxstudios.com' },
                  { label: 'Senior Retoucher', email: 'editor@icxstudios.com' },
                  { label: 'Executive Admin', email: 'admin@icxstudios.com' },
                ].map((preset) => (
                  <button
                    key={preset.email}
                    type="button"
                    onClick={() => {
                      setEmail(preset.email);
                      setPassword('IcxStudios#2026!');
                    }}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-bold text-zinc-800 hover:border-zinc-950 hover:bg-zinc-950 hover:text-white transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-200 pt-5 text-center text-xs text-zinc-600">
              New to ICX Studios?{' '}
              <Link
                href="/auth/register"
                className="font-black text-zinc-950 hover:underline"
              >
                Create a Client or Photographer Account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
