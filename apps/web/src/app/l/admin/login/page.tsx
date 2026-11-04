'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, AlertCircle, ArrowRight, Eye, EyeOff, Lock } from 'lucide-react';
import { IcxLogo } from '@/components/brand/IcxLogo';
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

export default function SecretAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
          email: email.trim().toLowerCase(),
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
        if (res.user.role !== 'admin') {
          clearStoredSession();
          setError('Access Denied. This gateway is strictly restricted to Executive Administrators.');
          setLoading(false);
          return;
        }

        setStoredSession(res.accessToken, res.user);
        router.push('/admin');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Authentication failed. Verify credentials and network connection.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#09090b] text-white px-4 py-12 selection:bg-[#E6D8C3] selection:text-black">
      {/* Background glow accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[350px] bg-[#E6D8C3]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md space-y-8">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center">
            <IcxLogo variant="dark" mark="slash" showText={true} />
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#E6D8C3]">
              <Shield className="h-3 w-3 text-[#E6D8C3]" />
              <span>Executive Control Gateway</span>
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            Internal administrative portal • Authorized executive personnel only
          </p>
        </div>

        {/* Form Container */}
        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/50 backdrop-blur-xl p-7 sm:p-9 shadow-2xl space-y-6">
          {error && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-red-900/60 bg-red-950/40 p-3.5 text-xs font-semibold text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs font-extrabold uppercase tracking-wider text-zinc-400"
              >
                Executive Email Address
              </label>
              <input
                id="admin-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@icxstudios.com"
                className="mt-1.5 block w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-[#E6D8C3] focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-extrabold uppercase tracking-wider text-zinc-400"
              >
                Security Key / Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 pr-11 text-sm text-white placeholder-zinc-600 focus:border-[#E6D8C3] focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {requiresTwoFactor && (
              <div className="rounded-2xl border border-amber-900/60 bg-amber-950/30 p-4 space-y-2">
                <label
                  htmlFor="totp-code"
                  className="flex items-center gap-1.5 text-xs font-bold text-amber-300"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>6-Digit Authenticator Code (2FA Required)</span>
                </label>
                <input
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="000000"
                  className="w-full rounded-xl border border-amber-700/60 bg-zinc-950 px-4 py-2.5 text-center text-lg font-mono tracking-widest text-amber-200 focus:border-amber-400 focus:outline-none"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#E6D8C3] py-3.5 text-xs font-black uppercase tracking-wider text-black shadow-xl hover:bg-[#d8c7ad] disabled:opacity-50 transition-all cursor-pointer"
            >
              <span>{loading ? 'Authenticating Executive...' : 'Authenticate & Access Control Center'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>

        <div className="text-center text-[11px] text-zinc-600">
          ICX Studios • Encrypted Executive Gateway • Lagos &amp; Abuja
        </div>
      </div>
    </div>
  );
}
