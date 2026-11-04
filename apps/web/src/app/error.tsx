'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { AlertCircle, RefreshCw, Home, MessageSquare } from 'lucide-react';

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ICX-APP] Unhandled React Render Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white">
      <AppNavbar />

      <main className="flex-1 flex items-center justify-center py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl w-full text-center space-y-8">
          <div className="h-16 w-16 rounded-3xl bg-red-950/60 border border-red-800/80 text-red-400 flex items-center justify-center mx-auto shadow-lg">
            <AlertCircle className="h-8 w-8" />
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              An Unexpected Session Error Occurred
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-md mx-auto">
              Our studio telemetry has isolated this event. Your creative files, bookings, and financial state remain completely safe.
            </p>
            {error.digest && (
              <p className="text-[11px] font-mono text-zinc-500">
                Reference Incident: {error.digest}
              </p>
            )}
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-xs font-black text-zinc-950 hover:bg-zinc-200 transition-colors shadow-sm cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Retry Action</span>
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-6 py-3 text-xs font-black text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <Home className="h-4 w-4" />
              <span>Return Home</span>
            </Link>
            <a
              href="https://wa.me/2348010000001?text=Hello%20ICX%20Support%2C%20I%20encountered%20an%20error%20on%20the%20platform."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-6 py-3 text-xs font-black text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <MessageSquare className="h-4 w-4 text-emerald-500" />
              <span>Contact Support</span>
            </a>
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}

