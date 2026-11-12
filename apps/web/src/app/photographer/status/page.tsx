'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, AlertCircle, MailCheck, ShieldCheck } from 'lucide-react';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { apiFetch, getStoredAccessToken, ApiError } from '@/lib/api';

interface WorkspaceStatusResponse {
  profile: {
    id: string;
    approval_status: 'pending' | 'approved' | 'suspended' | 'rejected';
    rejection_reason?: string | null;
    specialty?: string | null;
    location?: string | null;
    portfolio_urls?: string[];
  };
}

interface MeResponse {
  user: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    email_verified_at: string | null;
  };
}

export default function PhotographerApplicationStatusPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse['user'] | null>(null);
  const [profile, setProfile] = useState<WorkspaceStatusResponse['profile'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      router.replace('/auth/login?redirect=/photographer/status');
      return;
    }

    Promise.all([
      apiFetch<MeResponse>('/auth/me'),
      apiFetch<WorkspaceStatusResponse>('/bookings/photographer/workspace').catch(() => null),
    ])
      .then(([meRes, wsRes]) => {
        setMe(meRes.user);
        if (wsRes?.profile) {
          setProfile(wsRes.profile);
          if (wsRes.profile.approval_status === 'approved' && meRes.user.email_verified_at) {
            router.replace('/portal/photographer');
          }
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/auth/login?redirect=/photographer/status');
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleResend() {
    setResending(true);
    setResendMsg(null);
    try {
      const res = await apiFetch<{ message: string }>('/auth/resend-verification', {
        method: 'POST',
      });
      setResendMsg(res.message);
    } catch (err) {
      setResendMsg(err instanceof Error ? err.message : 'Unable to resend verification email.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12 space-y-6">
        {loading ? (
          <div className="h-64 rounded-3xl border border-zinc-200 bg-white animate-pulse" />
        ) : (
          <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Photographer Verification Pipeline
                </p>
                <h1 className="text-2xl font-black text-zinc-950 mt-1">
                  Application Status: {me?.full_name || 'Photographer'}
                </h1>
              </div>
              <span className="rounded-full bg-zinc-950 text-white px-4 py-1.5 text-xs font-bold uppercase">
                {profile?.approval_status || 'pending'}
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 p-4">
                {me?.email_verified_at ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <MailCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-bold text-zinc-950">
                    Step 1: Email Verification {me?.email_verified_at ? '(Completed)' : '(Action Required)'}
                  </p>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {me?.email_verified_at
                      ? `Verified for ${me.email}.`
                      : `Check ${me?.email} for your verification link.`}
                  </p>
                  {!me?.email_verified_at && (
                    <button
                      type="button"
                      disabled={resending}
                      onClick={handleResend}
                      className="mt-2 rounded-full bg-zinc-950 px-4 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {resending ? 'Sending...' : 'Resend Verification Email'}
                    </button>
                  )}
                  {resendMsg && (
                    <p className="mt-2 text-xs font-semibold text-emerald-700">{resendMsg}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 p-4">
                {profile?.approval_status === 'approved' ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : profile?.approval_status === 'rejected' ? (
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                ) : (
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-bold text-zinc-950">
                    Step 2: Admin Proof-of-Work Review
                  </p>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {profile?.approval_status === 'rejected'
                      ? `Application rejected: ${profile.rejection_reason || 'Please contact support@icxora.com.'}`
                      : profile?.approval_status === 'approved'
                      ? 'Your profile is approved and live in the ICXORA directory.'
                      : 'Our curation team is reviewing your portfolio submission. You will be notified by email once approved.'}
                  </p>
                </div>
              </div>
            </div>

            {profile?.approval_status === 'approved' && (
              <Link
                href="/portal/photographer"
                className="inline-block rounded-full bg-zinc-950 px-6 py-3 text-xs font-black text-white"
              >
                Open Photographer Portal →
              </Link>
            )}
          </div>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
