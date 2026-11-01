'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { IcxLogo } from '@/components/brand/IcxLogo';
import { apiFetch } from '@/lib/api';

export default function PasswordResetPage() {
  const [step, setStep] = useState<'request' | 'confirm' | 'done'>('request');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch<{
        message: string;
        resetTokenPreview?: string;
      }>('/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      setMessage(res.message);
      if (res.resetTokenPreview) {
        setResetToken(res.resetTokenPreview);
      }
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request password reset.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiFetch('/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({
          token: resetToken,
          new_password: newPassword,
        }),
      });
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed.');
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
        <h1 className="mt-6 text-center text-2xl font-bold text-icx-sand">
          Reset Your ICX Studios Password
        </h1>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark px-6 py-8 shadow-xl sm:px-10 space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-icx-error/40 bg-icx-error/10 p-3.5 text-xs text-icx-error">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {message && step === 'confirm' && (
            <div className="rounded-xl border border-icx-sand/30 bg-icx-slate p-3.5 text-xs text-icx-sand-muted">
              {message}
            </div>
          )}

          {step === 'request' && (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-icx-sand">
                  Account Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2.5 text-sm text-icx-sand"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-icx-sand py-3 text-sm font-bold text-icx-slate"
              >
                {loading ? 'Sending Reset Token...' : 'Send Password Reset Token'}
              </button>
            </form>
          )}

          {step === 'confirm' && (
            <form onSubmit={handleConfirmReset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-icx-sand">
                  Reset Token (From Email)
                </label>
                <input
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2.5 text-xs font-mono text-icx-sand"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-icx-sand">
                  New Password (Min 8 Characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2.5 text-sm text-icx-sand"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-icx-sand py-3 text-sm font-bold text-icx-slate"
              >
                <KeyRound className="h-4 w-4" />
                <span>{loading ? 'Updating Password...' : 'Confirm New Password'}</span>
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="text-center space-y-4">
              <CheckCircle2 className="mx-auto h-10 w-10 text-icx-success" />
              <p className="text-sm font-semibold text-icx-sand">
                Your password has been updated with Argon2id encryption.
              </p>
              <Link
                href="/auth/login"
                className="inline-block rounded-xl bg-icx-sand px-6 py-2.5 text-xs font-extrabold text-icx-slate"
              >
                Return to Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

