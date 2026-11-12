'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { apiFetch, setStoredSession, clearStoredSession, ApiError } from '@/lib/api';

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
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const redir = params.get('redirect') || '';
    if (redir.startsWith('/')) {
      setRedirectTo(redir);
    }
    const errParam = params.get('error');
    if (errParam) {
      const errorMessages: Record<string, string> = {
        google_not_configured: 'Google Sign-In is not configured on this environment yet.',
        google_cancelled: 'Google Sign-In was cancelled.',
        admin_oauth_forbidden: 'Executive accounts cannot sign in via public Google OAuth.',
        account_suspended: 'This account has been suspended by an administrator.',
      };
      setError(errorMessages[errParam] || 'Unable to complete Google Sign-In. Please try again.');
    }
  }, []);

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
        if (res.user.role === 'admin') {
          clearStoredSession();
          setError(
            'Executive accounts are restricted from the public portal. Please sign in via your designated internal gateway.'
          );
          setLoading(false);
          return;
        }

        setStoredSession(res.accessToken, res.user);
        if (redirectTo && redirectTo.startsWith('/')) {
          router.push(redirectTo);
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
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden border border-zinc-200 bg-white shadow-sm">
          {/* Left 5 Columns: Nigerian Studio Showcase */}
          <div className="hidden lg:flex lg:col-span-5 flex-col justify-between bg-zinc-950 p-10 text-white relative overflow-hidden">
            <div className="relative z-10 space-y-5">
              <div className="overflow-hidden rounded-2xl border border-zinc-800 h-60 w-full">
                <img
                  src="https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=900&q=85"
                  alt="ICX Studios Lagos Editorial Portraiture"
                  className="h-full w-full object-cover"
                />
              </div>
              <h2 className="text-2xl font-black tracking-tight leading-snug">
                One Studio Identity for Retouching, Talent &amp; Cinema Gear.
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Access your high-resolution proof room, manage 48-hour photographer slot holds, or oversee cinema vault dispatches across Lagos and Abuja.
              </p>
            </div>

            <div className="relative z-10 border-t border-zinc-800 pt-5 text-xs text-zinc-400">
              Victoria Island &amp; Lekki Phase 1, Lagos • Maitama, Abuja
            </div>
          </div>

          {/* Right 7 Columns: Sign-In Form */}
          <div className="lg:col-span-7 flex flex-col justify-center p-6 sm:p-10 lg:p-12">
            <div className="mx-auto w-full max-w-md space-y-6">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-zinc-950">
                  Sign in to ICX Studios
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-zinc-600">
                  Enter your studio credentials to access your workspace.
                </p>
              </div>

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
                  <div className="relative mt-1.5">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-4 py-3 pr-11 text-sm text-zinc-950 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none"
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700 focus:outline-none"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
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

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-zinc-200" />
                <span className="mx-3 shrink-0 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Or continue with
                </span>
                <div className="flex-grow border-t border-zinc-200" />
              </div>

              <a
                href={`/api/v1/auth/google?intent=login${
                  redirectTo ? `&redirect=${encodeURIComponent(redirectTo)}` : ''
                }`}
                className="w-full inline-flex items-center justify-center gap-2.5 rounded-full border border-zinc-300 bg-white py-3 text-sm font-bold text-zinc-950 hover:bg-zinc-50 transition-all"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>Continue with Google</span>
              </a>

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
      </main>

      <AppFooter />
    </div>
  );
}
