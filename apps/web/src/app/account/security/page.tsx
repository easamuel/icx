'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { apiFetch } from '@/lib/api';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'customer' | 'photographer' | 'editor' | 'admin';
  email_verified_at: string | null;
}

function getWorkspacePath(role?: string): string {
  if (role === 'admin') return '/admin';
  if (role === 'photographer') return '/portal/photographer';
  if (role === 'editor') return '/workspace/editor';
  return '/dashboard';
}

export default function AccountSecurityPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyingLink, setVerifyingLink] = useState(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncStoredUser = useCallback((profile: UserProfile) => {
    setUser(profile);
    if (profile.email_verified_at) {
      setVerifiedSuccess(true);
    }
    try {
      const existingRaw = window.localStorage.getItem('icx_user');
      if (existingRaw) {
        const parsed = JSON.parse(existingRaw);
        window.localStorage.setItem(
          'icx_user',
          JSON.stringify({ ...parsed, ...profile })
        );
      }
    } catch {
      // Ignore storage error
    }
  }, []);

  const checkProfileStatus = useCallback(async () => {
    try {
      const res = await apiFetch<{ user: UserProfile }>('/auth/me');
      syncStoredUser(res.user);
      return res.user;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [syncStoredUser]);

  // 1. Initial load + automatic ?verify=<token> verification
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get('verify');
    const emailParam = params.get('email');

    if (emailParam && !user) {
      setUser((prev) =>
        prev
          ? prev
          : {
              id: '',
              email: emailParam,
              full_name: 'Studio Account',
              role: 'customer',
              email_verified_at: null,
            }
      );
    }

    if (verifyToken) {
      setVerifyingLink(true);
      void (async () => {
        try {
          const res = await apiFetch<{ status: string; user?: UserProfile }>(
            '/auth/verify-email',
            {
              method: 'POST',
              body: JSON.stringify({ token: verifyToken }),
            }
          );
          setVerifiedSuccess(true);
          if (res.user) {
            syncStoredUser(res.user);
          }
          try {
            const bc = new BroadcastChannel('icx_email_verification');
            bc.postMessage({ type: 'EMAIL_VERIFIED', user: res.user });
            bc.close();
          } catch {
            // BroadcastChannel not supported in older environments
          }
          await checkProfileStatus();
        } catch (err) {
          const current = await checkProfileStatus();
          if (!current?.email_verified_at) {
            setError(
              err instanceof Error
                ? err.message
                : 'This confirmation link has expired or has already been used.'
            );
          }
        } finally {
          setVerifyingLink(false);
        }
      })();
    } else {
      void checkProfileStatus();
    }
  }, [checkProfileStatus, syncStoredUser]);

  // 2. Real-time Cross-Device & Cross-Tab Automatic Verification Detection (No Refresh Needed)
  useEffect(() => {
    if (verifiedSuccess || user?.email_verified_at) {
      return;
    }

    const checkVerification = async () => {
      try {
        const res = await apiFetch<{ user: UserProfile }>('/auth/me');
        if (res.user.email_verified_at) {
          syncStoredUser(res.user);
          return;
        }
      } catch {
        // Fallback to checking public verification status by email or ID
        const targetEmail =
          user?.email ||
          (typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('email')
            : null);
        if (targetEmail) {
          try {
            const statusRes = await apiFetch<{
              verified: boolean;
              email_verified_at: string | null;
              user?: UserProfile;
            }>(`/auth/verification-status?email=${encodeURIComponent(targetEmail)}`);
            if (statusRes.verified && statusRes.user) {
              syncStoredUser(statusRes.user);
            }
          } catch {
            // Ignore polling errors
          }
        }
      }
    };

    // Poll every 2 seconds
    const interval = window.setInterval(checkVerification, 2000);

    // Also listen for same-device BroadcastChannel or window focus
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('icx_email_verification');
      bc.onmessage = (event) => {
        if (event.data?.type === 'EMAIL_VERIFIED') {
          void checkProfileStatus();
        }
      };
    } catch {
      bc = null;
    }

    const handleFocus = () => {
      void checkVerification();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      if (bc) bc.close();
    };
  }, [verifiedSuccess, user?.email_verified_at, user?.email, checkProfileStatus, syncStoredUser]);

  // 3. Auto-redirect to workspace 2.5 seconds after confirmation if user is signed in
  useEffect(() => {
    if (!verifiedSuccess || !user) return;
    const timer = window.setTimeout(() => {
      router.push(getWorkspacePath(user.role));
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [verifiedSuccess, user, router]);

  async function handleResendEmail() {
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      await apiFetch('/auth/resend-verification', { method: 'POST' });
      setNotice(`We sent a new confirmation link to ${user?.email || 'your email'}.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not resend the confirmation email. Please try again.'
      );
    } finally {
      setResending(false);
    }
  }

  const isConfirmed = verifiedSuccess || Boolean(user?.email_verified_at);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-zinc-200 bg-white p-8 sm:p-10 shadow-sm text-center space-y-6">
            {verifyingLink || (loading && !user && !verifiedSuccess && !error) ? (
              <div className="py-8 space-y-4">
                <RefreshCw className="mx-auto h-10 w-10 text-zinc-950 animate-spin" />
                <h1 className="text-xl font-black text-zinc-950">
                  Confirming your email...
                </h1>
                <p className="text-xs sm:text-sm text-zinc-600">
                  Please wait a moment while we verify your account.
                </p>
              </div>
            ) : isConfirmed ? (
              <div className="space-y-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-9 w-9" />
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl font-black tracking-tight text-zinc-950">
                    Email confirmed
                  </h1>
                  <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                    {user?.email ? (
                      <>
                        Your email address <strong>{user.email}</strong> is confirmed and your account is ready.
                      </>
                    ) : (
                      'Your email address has been confirmed and your account is ready.'
                    )}
                  </p>
                </div>

                {user ? (
                  <div className="space-y-3">
                    <Link
                      href={getWorkspacePath(user.role)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 py-3.5 text-sm font-black text-white hover:bg-zinc-800 transition-colors"
                    >
                      <span>Continue to Dashboard</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <p className="text-[11px] text-zinc-400">
                      Taking you to your dashboard automatically...
                    </p>
                  </div>
                ) : (
                  <Link
                    href="/auth/login"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 py-3.5 text-sm font-black text-white hover:bg-zinc-800 transition-colors"
                  >
                    <span>Sign In to Your Account</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            ) : user ? (
              <div className="space-y-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-950">
                  <Mail className="h-8 w-8" />
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl font-black tracking-tight text-zinc-950">
                    Check your email
                  </h1>
                  <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                    We sent a confirmation link to{' '}
                    <strong className="text-zinc-950">{user.email}</strong>. Click the link in that email to confirm your account.
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600 flex items-center justify-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 text-zinc-500 animate-spin shrink-0" />
                  <span>
                    Waiting for confirmation — this page will update automatically as soon as you click the link on any device.
                  </span>
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700 text-left">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {notice && (
                  <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800 text-left">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{notice}</span>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    disabled={resending}
                    onClick={handleResendEmail}
                    className="w-full rounded-full bg-zinc-950 py-3.5 text-xs sm:text-sm font-black text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                  >
                    {resending ? 'Sending email...' : 'Resend confirmation email'}
                  </button>

                  <Link
                    href={getWorkspacePath(user.role)}
                    className="block w-full rounded-full border border-zinc-300 bg-white py-3 text-xs font-bold text-zinc-800 hover:border-zinc-950 transition-colors"
                  >
                    Go to Dashboard
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {error && (
                  <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700 text-left">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <h1 className="text-2xl font-black text-zinc-950">
                  Confirm your email
                </h1>
                <p className="text-xs sm:text-sm text-zinc-600">
                  Sign in to your account to request a new confirmation link.
                </p>
                <Link
                  href="/auth/login"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 py-3.5 text-sm font-black text-white"
                >
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
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
