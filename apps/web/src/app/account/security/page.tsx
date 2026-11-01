'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Lock, MailCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { apiFetch } from '@/lib/api';

interface UserSecurityProfile {
  id: string;
  email: string;
  role: string;
  two_factor_enabled: boolean;
  email_verified_at: string | null;
}

export default function AccountSecurityPage() {
  const [user, setUser] = useState<UserSecurityProfile | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [emailVerifyToken, setEmailVerifyToken] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile() {
    try {
      const res = await apiFetch<{ user: UserSecurityProfile }>('/auth/me');
      setUser(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please sign in.');
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  async function handleStart2FASetup() {
    setError(null);
    try {
      const res = await apiFetch<{ secret: string; otpauthUri: string }>(
        '/auth/2fa/setup',
        { method: 'POST' }
      );
      setTotpSecret(res.secret);
      setOtpauthUri(res.otpauthUri);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize 2FA.');
    }
  }

  async function handleEnable2FA(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/auth/2fa/enable', {
        method: 'POST',
        body: JSON.stringify({ totp_code: totpCode }),
      });
      setStatusMessage('Two-Factor Authentication (TOTP) is now active on your account.');
      setTotpSecret(null);
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid 6-digit TOTP code.');
    }
  }

  async function handleVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: emailVerifyToken }),
      });
      setStatusMessage('Email address verified!');
      setEmailVerifyToken('');
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification token.');
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
            Identity &amp; Access Protection
          </span>
          <h1 className="mt-1 text-3xl font-black text-zinc-950">
            Account Security &amp; Two-Factor Authentication
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-600">
            Manage email verification and authenticator-based 2FA for your studio account.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {statusMessage && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {user && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5">
                <MailCheck className="h-5 w-5 text-zinc-950" />
                <h2 className="text-base font-black text-zinc-950">
                  Email Verification
                </h2>
              </div>
              {user.email_verified_at ? (
                <p className="text-xs text-emerald-700 font-bold">
                  Verified on {new Date(user.email_verified_at).toLocaleString()}
                </p>
              ) : (
                <form onSubmit={handleVerifyEmail} className="space-y-3">
                  <p className="text-xs text-zinc-600">
                    Enter your verification token to confirm <strong>{user.email}</strong>.
                  </p>
                  <input
                    type="text"
                    required
                    value={emailVerifyToken}
                    onChange={(e) => setEmailVerifyToken(e.target.value)}
                    placeholder="Verification Token"
                    className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-950"
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-zinc-950 px-5 py-2.5 text-xs font-black text-white"
                  >
                    Verify Email
                  </button>
                </form>
              )}
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5">
                <Lock className="h-5 w-5 text-zinc-950" />
                <h2 className="text-base font-black text-zinc-950">
                  Two-Factor Authentication (TOTP)
                </h2>
              </div>

              {user.two_factor_enabled ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-800">
                  <ShieldCheck className="h-4 w-4" />
                  <span>2FA Active &amp; Enforced on Sign-In</span>
                </div>
              ) : !totpSecret ? (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Protect your account with an Authenticator app (Google Authenticator, Authy, 1Password).
                  </p>
                  <button
                    type="button"
                    onClick={handleStart2FASetup}
                    className="rounded-full bg-zinc-950 px-5 py-2.5 text-xs font-black text-white"
                  >
                    Generate 2FA Secret Key
                  </button>
                </div>
              ) : (
                <form onSubmit={handleEnable2FA} className="space-y-3">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs">
                    <div className="text-zinc-500 font-semibold">Base32 Authenticator Secret:</div>
                    <div className="mt-1 font-mono font-black text-zinc-950 break-all">
                      {totpSecret}
                    </div>
                    {otpauthUri && (
                      <div className="mt-2 text-[10px] text-zinc-500 break-all">
                        URI: {otpauthUri}
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="Enter 6-Digit Authenticator Code"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-center font-mono tracking-widest text-sm font-bold text-zinc-950"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-full bg-zinc-950 py-3 text-xs font-black text-white"
                  >
                    Verify &amp; Enable 2FA
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </main>

      <AppFooter />
    </div>
  );
}
