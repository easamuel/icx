'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Lock, MailCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { AppNavbar } from '@/components/layout/AppNavbar';
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
      setStatusMessage('Two-Factor Authentication (RFC 6238 TOTP) is now active on your account.');
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
    <div className="min-h-screen bg-icx-slate text-icx-sand">
      <AppNavbar />

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-icx-sand">
            Account Security, Email Verification &amp; 2FA (AC-02, AC-06)
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-icx-sand-muted">
            Manage email verification and mandatory Two-Factor Authentication for Editor
            and Admin accounts.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-icx-error/40 bg-icx-error/10 p-4 text-xs text-icx-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {statusMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-icx-success/40 bg-icx-success/10 p-4 text-xs text-icx-success font-semibold">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {user && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Email Verification Card (AC-02) */}
            <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <MailCheck className="h-5 w-5 text-icx-sand" />
                <h2 className="text-base font-bold text-icx-sand">
                  Email Verification Status
                </h2>
              </div>
              {user.email_verified_at ? (
                <p className="text-xs text-icx-success font-semibold">
                  Verified on {new Date(user.email_verified_at).toLocaleString()}
                </p>
              ) : (
                <form onSubmit={handleVerifyEmail} className="space-y-3">
                  <p className="text-xs text-icx-sand-muted">
                    Enter your verification token to verify <strong>{user.email}</strong> before
                    placing your first order, booking, or rental.
                  </p>
                  <input
                    type="text"
                    required
                    value={emailVerifyToken}
                    onChange={(e) => setEmailVerifyToken(e.target.value)}
                    placeholder="Verification Token"
                    className="w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2 text-xs text-icx-sand"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-icx-sand px-4 py-2 text-xs font-extrabold text-icx-slate"
                  >
                    Verify Email
                  </button>
                </form>
              )}
            </div>

            {/* Two-Factor Authentication Card (AC-06) */}
            <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <Lock className="h-5 w-5 text-icx-sand" />
                <h2 className="text-base font-bold text-icx-sand">
                  Two-Factor Authentication (TOTP)
                </h2>
              </div>

              {user.two_factor_enabled ? (
                <div className="inline-flex items-center gap-2 rounded-xl bg-icx-success/15 px-3.5 py-2 text-xs font-bold text-icx-success">
                  <ShieldCheck className="h-4 w-4" />
                  <span>2FA Active &amp; Enforced on Login</span>
                </div>
              ) : !totpSecret ? (
                <div className="space-y-3">
                  <p className="text-xs text-icx-sand-muted">
                    Protect your account with an RFC 6238 Authenticator app (Google
                    Authenticator, Authy, 1Password). Mandatory for Editor and Admin roles.
                  </p>
                  <button
                    type="button"
                    onClick={handleStart2FASetup}
                    className="rounded-xl bg-icx-sand px-4 py-2.5 text-xs font-extrabold text-icx-slate"
                  >
                    Generate 2FA Secret Key
                  </button>
                </div>
              ) : (
                <form onSubmit={handleEnable2FA} className="space-y-3">
                  <div className="rounded-xl border border-icx-slate-border bg-icx-slate p-3 text-xs">
                    <div className="text-icx-sand-muted">Base32 Authenticator Secret:</div>
                    <div className="mt-1 font-mono font-bold text-icx-sand break-all">
                      {totpSecret}
                    </div>
                    {otpauthUri && (
                      <div className="mt-2 text-[10px] text-icx-sand-muted break-all">
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
                    className="w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2 text-center font-mono tracking-widest text-sm text-icx-sand"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-icx-sand py-2.5 text-xs font-extrabold text-icx-slate"
                  >
                    Verify &amp; Enable 2FA
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

