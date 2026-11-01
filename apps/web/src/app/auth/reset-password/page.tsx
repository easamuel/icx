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
    <div className="min-h-screen flex flex-col justify-center bg-zinc-50 px-4 py-12 sm:px-6 lg:px-8 text-zinc-950">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center">
          <IcxLogo variant="dark" />
        </Link>
        <h1 className="mt-6 text-center text-3xl font-black text-zinc-950">
          Reset Studio Password
        </h1>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-3xl border border-zinc-200 bg-white px-6 py-8 shadow-sm sm:px-10 space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {message && step === 'confirm' && (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs text-zinc-600">
              {message}
            </div>
          )}

          {step === 'request' && (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-zinc-900">
                  Account Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-4 py-3 text-sm text-zinc-950"
                  placeholder="you@company.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-zinc-950 py-3.5 text-sm font-black text-white"
              >
                {loading ? 'Sending Reset Token...' : 'Send Password Reset Token'}
              </button>
            </form>
          )}

          {step === 'confirm' && (
            <form onSubmit={handleConfirmReset} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-zinc-900">
                  Reset Token
                </label>
                <input
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-4 py-3 text-xs font-mono text-zinc-950"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-zinc-900">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-4 py-3 text-sm text-zinc-950"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 py-3.5 text-sm font-black text-white"
              >
                <KeyRound className="h-4 w-4" />
                <span>{loading ? 'Updating Password...' : 'Confirm New Password'}</span>
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="text-center space-y-4">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
              <p className="text-sm font-bold text-zinc-950">
                Your password has been updated.
              </p>
              <Link
                href="/auth/login"
                className="inline-block rounded-full bg-zinc-950 px-6 py-3 text-xs font-black text-white"
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
