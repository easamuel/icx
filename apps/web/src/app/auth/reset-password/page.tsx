'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { apiFetch } from '@/lib/api';

export default function PasswordResetPage() {
  const [step, setStep] = useState<'request' | 'confirm' | 'done'>('request');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setResetToken(urlToken);
      setStep('confirm');
    }
  }, []);

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
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      <main className="flex-1 flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h1 className="text-center text-3xl font-black text-zinc-950">
            Reset Studio Password
          </h1>
          <p className="mt-2 text-center text-xs sm:text-sm text-zinc-600">
            We will send a secure password reset link to your registered email address.
          </p>
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
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800">
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
                  className="w-full rounded-full bg-zinc-950 py-3.5 text-sm font-black text-white hover:bg-zinc-800 transition-colors"
                >
                  {loading ? 'Sending Reset Email...' : 'Send Password Reset Email'}
                </button>
              </form>
            )}

            {step === 'confirm' && (
              <form onSubmit={handleConfirmReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-zinc-900">
                    Reset Token (From Email)
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
                  <div className="relative mt-1.5">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="block w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-4 py-3 pr-11 text-sm text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
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
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 py-3.5 text-sm font-black text-white hover:bg-zinc-800 transition-colors"
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
      </main>

      <AppFooter />
    </div>
  );
}
