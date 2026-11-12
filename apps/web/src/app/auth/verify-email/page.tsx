'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertCircle, Loader2, Clock } from 'lucide-react';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { apiFetch } from '@/lib/api';

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<'verifying' | 'verified' | 'error'>('verifying');
  const [role, setRole] = useState<string>('customer');
  const [message, setMessage] = useState('Verifying your email address...');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const verifiedParam = params.get('verified');
    const roleParam = params.get('role');
    const errorParam = params.get('error');

    if (errorParam) {
      setStatus('error');
      setMessage(
        errorParam === 'missing_token'
          ? 'Verification token is missing.'
          : 'This verification link is invalid or has expired.'
      );
      return;
    }

    if (verifiedParam === '1') {
      setStatus('verified');
      setRole(roleParam || 'customer');
      setMessage('Your email address has been verified.');
      return;
    }

    if (!token) {
      setStatus('error');
      setMessage('Verification token is missing from the link.');
      return;
    }

    apiFetch<{ status: string; user?: { role?: string } }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        setStatus('verified');
        setRole(res.user?.role || 'customer');
        setMessage('Your email address has been verified.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(
          err instanceof Error
            ? err.message
            : 'Verification link is invalid or has already been used.'
        );
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />
      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-16 flex items-center">
        <div className="w-full rounded-3xl border border-zinc-200 bg-white p-8 sm:p-10 shadow-sm text-center space-y-5">
          {status === 'verifying' && (
            <>
              <Loader2 className="h-12 w-12 text-zinc-950 animate-spin mx-auto" />
              <h1 className="text-2xl font-black">Verifying Email...</h1>
              <p className="text-sm text-zinc-600">{message}</p>
            </>
          )}

          {status === 'verified' && (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-black text-zinc-950">Email Verified</h1>
              <p className="text-sm text-zinc-600">{message}</p>

              {role === 'photographer' ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left text-xs text-amber-950 space-y-1.5">
                  <p className="font-bold flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    Pending Admin Review
                  </p>
                  <p>
                    Your photographer application and proof-of-work portfolio are now in our Admin
                    Review Queue. You will receive an email once approved.
                  </p>
                </div>
              ) : null}

              <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href={role === 'photographer' ? '/photographer/status' : '/dashboard'}
                  className="rounded-full bg-zinc-950 px-6 py-3 text-xs font-black text-white hover:bg-zinc-800"
                >
                  {role === 'photographer' ? 'View Application Status' : 'Open Dashboard'}
                </Link>
                <Link
                  href="/auth/login"
                  className="rounded-full border border-zinc-300 px-6 py-3 text-xs font-bold text-zinc-950 hover:bg-zinc-50"
                >
                  Sign In
                </Link>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 border border-red-200">
                <AlertCircle className="h-7 w-7 text-red-600" />
              </div>
              <h1 className="text-2xl font-black text-zinc-950">Verification Failed</h1>
              <p className="text-sm text-zinc-600">{message}</p>
              <div className="pt-2">
                <Link
                  href="/auth/login"
                  className="inline-block rounded-full bg-zinc-950 px-6 py-3 text-xs font-black text-white hover:bg-zinc-800"
                >
                  Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
