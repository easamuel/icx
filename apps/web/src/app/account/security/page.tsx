'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  MailCheck,
  CheckCircle2,
  AlertCircle,
  Send,
  ArrowRight,
} from 'lucide-react';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { apiFetch } from '@/lib/api';

interface UserSecurityProfile {
  id: string;
  email: string;
  full_name: string;
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
  const [resending, setResending] = useState(false);
  const [justVerifiedByLink, setJustVerifiedByLink] = useState(false);

  async function loadProfile() {
    try {
      const res = await apiFetch<{ user: UserSecurityProfile }>('/auth/me');
      setUser(res.user);
    } catch {
      // User may be clicking the email verification link from an unauthenticated browser
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyParam = params.get('verify');
    const registeredParam = params.get('registered');

    if (registeredParam === '1') {
      setStatusMessage(
        'Your studio account has been created! We have sent a confirmation link to your email address. Please check your inbox and click the confirmation button.'
      );
    }

    if (verifyParam) {
      setEmailVerifyToken(verifyParam);
      void (async () => {
        try {
          await apiFetch('/auth/verify-email', {
            method: 'POST',
            body: JSON.stringify({ token: verifyParam }),
          });
          setJustVerifiedByLink(true);
          setStatusMessage(
            'Your email address has been officially confirmed! Your ICX Studios account is now verified.'
          );
          setEmailVerifyToken('');
          await loadProfile();
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'This verification link is invalid or has already been used.'
          );
          await loadProfile();
        }
      })();
    } else {
      void loadProfile();
    }
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
      setJustVerifiedByLink(true);
      setStatusMessage('Your email address has been officially confirmed!');
      setEmailVerifyToken('');
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification token.');
    }
  }

  async function handleResendVerification() {
    setError(null);
    setResending(true);
    try {
      const res = await apiFetch<{ message: string }>('/auth/resend-verification', {
        method: 'POST',
      });
      setStatusMessage(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend verification email.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-zinc-950">
              Account Security &amp; Email Confirmation
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-600">
              Manage email verification and authenticator-based 2FA for your studio account.
            </p>
          </div>

          {user && (
            <Link
              href={
                user.role === 'admin'
                  ? '/admin'
                  : user.role === 'photographer'
                    ? '/portal/photographer'
                    : user.role === 'editor'
                      ? '/workspace/editor'
                      : '/dashboard'
              }
              className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-2.5 text-xs font-black text-white hover:bg-zinc-800 transition-colors self-start"
            >
              <span>Continue to Workspace</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {statusMessage && (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-xs sm:text-sm font-bold text-emerald-900">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p>{statusMessage}</p>
              {justVerifiedByLink && !user && (
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-2 text-xs font-black text-white"
                >
                  <span>Sign In to Your Verified Account</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        )}

        {user ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5">
                <MailCheck className="h-5 w-5 text-zinc-950" />
                <h2 className="text-base font-black text-zinc-950">
                  Email Confirmation Status
                </h2>
              </div>
              {user.email_verified_at ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Confirmed Studio Email ({user.email})</span>
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Verified on {new Date(user.email_verified_at).toLocaleString()}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <form onSubmit={handleVerifyEmail} className="space-y-3">
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      We sent a confirmation link to <strong>{user.email}</strong>. Click the button inside that email, or paste your verification token below:
                    </p>
                    <input
                      type="text"
                      required
                      value={emailVerifyToken}
                      onChange={(e) => setEmailVerifyToken(e.target.value)}
                      placeholder="Paste Verification Token"
                      className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs font-mono text-zinc-950"
                    />
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="submit"
                        className="rounded-full bg-zinc-950 px-5 py-2.5 text-xs font-black text-white hover:bg-zinc-800 transition-colors"
                      >
                        Confirm Token
                      </button>
                      <button
                        type="button"
                        disabled={resending}
                        onClick={handleResendVerification}
                        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-xs font-bold text-zinc-900 hover:border-zinc-950 disabled:opacity-50 transition-colors"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>{resending ? 'Sending...' : 'Resend Confirmation Email'}</span>
                      </button>
                    </div>
                  </form>
                </div>
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
                    className="rounded-full bg-zinc-950 px-5 py-2.5 text-xs font-black text-white hover:bg-zinc-800 transition-colors"
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
        ) : (
          !justVerifiedByLink && (
            <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center space-y-4">
              <p className="text-sm font-semibold text-zinc-700">
                Sign in to manage your email verification and two-factor authentication settings.
              </p>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-6 py-3 text-xs font-black text-white"
              >
                <span>Sign In to ICX Studios</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )
        )}
      </main>

      <AppFooter />
    </div>
  );
}
