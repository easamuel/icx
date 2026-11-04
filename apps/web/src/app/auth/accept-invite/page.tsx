'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, AlertCircle, Eye, EyeOff, CheckCircle2, ArrowRight } from 'lucide-react';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { apiFetch, setStoredSession, ApiError } from '@/lib/api';
import type { UserRecord } from '@icx/shared-types';

interface InviteDetails {
  valid: boolean;
  email: string;
  fullName: string;
  role: string;
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const [token, setToken] = useState<string>('');
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');

    if (!urlToken) {
      setTokenError('No invitation token was provided. Please use the complete activation link from your email.');
      setLoadingDetails(false);
      return;
    }

    setToken(urlToken);

    apiFetch<InviteDetails>(`/auth/invite-details?token=${encodeURIComponent(urlToken)}`)
      .then((data) => {
        setInviteDetails(data);
      })
      .catch((err) => {
        const msg = err instanceof ApiError ? err.message : 'This invitation link is invalid or has expired.';
        setTokenError(msg);
      })
      .finally(() => {
        setLoadingDetails(false);
      });
  }, []);

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (password.length < 8) {
      setSubmitError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match. Please verify and retype.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await apiFetch<{
        status: string;
        user: UserRecord;
        accessToken: string;
      }>('/auth/accept-invite', {
        method: 'POST',
        body: JSON.stringify({
          token,
          password,
        }),
      });

      if (res.accessToken && res.user) {
        setStoredSession(res.accessToken, res.user);
        setCompleted(true);

        setTimeout(() => {
          if (res.user.role === 'admin') {
            router.push('/admin');
          } else if (res.user.role === 'editor') {
            router.push('/workspace/editor');
          } else if (res.user.role === 'photographer') {
            router.push('/portal/photographer');
          } else {
            router.push('/dashboard');
          }
        }, 1500);
      }
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Failed to activate account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const roleLabel =
    inviteDetails?.role === 'admin'
      ? 'Executive Administrator'
      : inviteDetails?.role === 'editor'
      ? 'Senior Retoucher & Editor'
      : inviteDetails?.role === 'photographer'
      ? 'Studio Photographer'
      : 'Team Member';

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      <main className="flex-1 flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-sm">
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
            </div>
          </div>
          <h1 className="mt-4 text-center text-3xl font-black text-zinc-950 tracking-tight">
            Activate Studio Workspace
          </h1>
          <p className="mt-2 text-center text-xs sm:text-sm text-zinc-600">
            Set your confidential password to complete account activation.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="rounded-3xl border border-zinc-200 bg-white px-6 py-8 shadow-sm sm:px-10">
            {loadingDetails ? (
              <div className="py-12 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-zinc-900 border-r-transparent align-[-0.125em]" />
                <p className="mt-4 text-sm font-semibold text-zinc-600">Verifying invitation credentials...</p>
              </div>
            ) : tokenError ? (
              <div className="space-y-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-950">Invitation Invalid or Expired</h3>
                  <p className="mt-2 text-xs text-zinc-600 leading-relaxed">{tokenError}</p>
                </div>
                <div className="pt-2">
                  <Link
                    href="/auth/login"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition"
                  >
                    Go to Sign In
                  </Link>
                </div>
              </div>
            ) : completed ? (
              <div className="space-y-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-950">Account Activated Successfully</h3>
                  <p className="mt-1 text-xs text-zinc-600">
                    Welcome to ICX Studios. Redirecting you to your workspace...
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAccept} className="space-y-5">
                {inviteDetails && (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Invited User</div>
                    <div className="mt-1 text-sm font-bold text-zinc-950">{inviteDetails.fullName}</div>
                    <div className="text-xs text-zinc-600">{inviteDetails.email}</div>
                    <div className="mt-2 inline-flex items-center rounded-md bg-zinc-200 px-2 py-0.5 text-xs font-semibold text-zinc-800">
                      {roleLabel}
                    </div>
                  </div>
                )}

                {submitError && (
                  <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Create Password
                  </label>
                  <div className="relative mt-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Confirm Password
                  </label>
                  <div className="relative mt-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Retype your password"
                      className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 text-sm font-bold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 transition"
                  >
                    <span>{submitting ? 'Activating Account...' : 'Set Password & Enter Workspace'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

                <p className="text-center text-xs text-zinc-500">
                  By activating, you agree to ICX Studios{' '}
                  <Link href="/terms" className="underline hover:text-zinc-800">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="underline hover:text-zinc-800">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </form>
            )}
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}

