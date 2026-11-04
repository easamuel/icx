import React from 'react';
import Link from 'next/link';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { ArrowLeft, Home, Sliders, Camera, PackageCheck, MessageSquare } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white">
      <AppNavbar />

      <main className="flex-1 flex items-center justify-center py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl w-full text-center space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-4 py-1.5 text-xs font-bold text-zinc-400">
            <span>404 • Page Not Found</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white">
              Lost in Production?
            </h1>
            <p className="max-w-md mx-auto text-sm sm:text-base text-zinc-400 leading-relaxed">
              The page or studio resource you requested cannot be located. It may have been archived, moved, or the link may be mistyped.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-xs font-black text-zinc-950 hover:bg-zinc-200 transition-colors shadow-sm"
            >
              <Home className="h-4 w-4" />
              <span>Return to Studio Home</span>
            </Link>
            <a
              href="https://wa.me/2348010000001?text=Hello%20ICX%20Studios%2C%20I%20hit%20a%20missing%20page%20and%20need%20assistance."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-6 py-3 text-xs font-black text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <MessageSquare className="h-4 w-4 text-emerald-500" />
              <span>Ask Support</span>
            </a>
          </div>

          <div className="pt-8 border-t border-zinc-900">
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">
              Explore Available Studio Services
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <Link
                href="/editing"
                className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 hover:border-zinc-700 hover:bg-zinc-900 transition-all group"
              >
                <Sliders className="h-5 w-5 text-[#E6D8C3] mb-2" />
                <div className="text-xs font-bold text-white group-hover:text-[#E6D8C3] transition-colors">
                  Photo Retouching
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  RAW editing, color grading &amp; escrow delivery
                </div>
              </Link>

              <Link
                href="/photographers"
                className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 hover:border-zinc-700 hover:bg-zinc-900 transition-all group"
              >
                <Camera className="h-5 w-5 text-[#E6D8C3] mb-2" />
                <div className="text-xs font-bold text-white group-hover:text-[#E6D8C3] transition-colors">
                  Photographers
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  Book certified photographers in Lagos &amp; Abuja
                </div>
              </Link>

              <Link
                href="/rentals"
                className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 hover:border-zinc-700 hover:bg-zinc-900 transition-all group"
              >
                <PackageCheck className="h-5 w-5 text-[#E6D8C3] mb-2" />
                <div className="text-xs font-bold text-white group-hover:text-[#E6D8C3] transition-colors">
                  Cinema Fleet Rentals
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  ARRI, RED, Sony cameras &amp; cine lighting
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}

