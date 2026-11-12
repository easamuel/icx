'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { apiFetch, setStoredSession } from '@/lib/api';

export default function GoogleCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      setError('Missing Google authentication code.');
      return;
    }

    apiFetch<{
      user: { role?: string };
      accessToken: string;
      redirect?: string;
    }>('/auth/google/exchange', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
      .then((res) => {
        setStoredSession(res.accessToken, res.user);
        if (res.redirect && res.redirect.startsWith('/')) {
          router.replace(res.redirect);
        } else if (res.user.role === 'photographer') {
          router.replace('/portal/photographer');
        } else if (res.user.role === 'editor') {
          router.replace('/workspace/editor');
        } else {
          router.replace('/dashboard');
        }
      })
      .catch(() => {
        setError('Google sign-in session expired. Please try again.');
      });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="max-w-sm w-full rounded-3xl border border-zinc-200 bg-white p-8 text-center space-y-4 shadow-sm">
        {error ? (
          <>
            <AlertCircle className="h-10 w-10 text-red-600 mx-auto" />
            <p className="text-sm font-bold text-zinc-950">{error}</p>
            <Link
              href="/auth/login"
              className="inline-block rounded-full bg-zinc-950 px-6 py-2.5 text-xs font-black text-white"
            >
              Return to Sign In
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="h-10 w-10 text-zinc-950 animate-spin mx-auto" />
            <p className="text-sm font-bold text-zinc-950">Completing Google Sign-In...</p>
          </>
        )}
      </div>
    </div>
  );
}
