import React from 'react';
import Link from 'next/link';
import { IcxLogo } from '@/components/brand/IcxLogo';
import { ShieldCheck, MapPin, Phone, Mail, ArrowUpRight } from 'lucide-react';

export function AppFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5">
          {/* Column 1-2: Brand & Studio Locations */}
          <div className="lg:col-span-2 space-y-4">
            <IcxLogo variant="light" />
            <p className="max-w-sm text-xs sm:text-sm text-zinc-400 leading-relaxed">
              West Africa’s premier creative production ecosystem. Bespoke frequency-separation photo retouching, vetted master photographers, and insured cinema equipment rentals.
            </p>
            <div className="pt-2 space-y-2 text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-white shrink-0" />
                <span>Victoria Island &amp; Lekki Phase 1, Lagos • Maitama, Abuja</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-white shrink-0" />
                <span>+234 (0) 801 000 0001 • Concierge Desk (Mon–Sat, 8am–8pm)</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-white shrink-0" />
                <span>concierge@icxora.com</span>
              </div>
            </div>
          </div>

          {/* Column 3: Core Studio Services */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Studio Services
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm font-medium text-zinc-300">
              <li>
                <Link href="/editing" className="hover:text-white transition-colors">
                  Editorial Photo Retouching
                </Link>
              </li>
              <li>
                <Link href="/photographers" className="hover:text-white transition-colors">
                  Book Vetted Photographers
                </Link>
              </li>
              <li>
                <Link href="/rentals" className="hover:text-white transition-colors">
                  Cinema &amp; Lighting Gear Rental
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-white transition-colors">
                  Client Project Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Partner & Staff Portals */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Partner Workspaces
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm font-medium text-zinc-300">
              <li>
                <Link href="/portal/photographer" className="hover:text-white transition-colors">
                  Photographer Studio Portal
                </Link>
              </li>
              <li>
                <Link href="/auth/register" className="hover:text-white transition-colors inline-flex items-center gap-1">
                  <span>Apply as a Photographer</span>
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </li>
              <li>
                <Link href="/workspace/editor" className="hover:text-white transition-colors">
                  Senior Retoucher Queue
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-white transition-colors">
                  Executive Control Center
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 5: Security & Protection */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Studio Guarantees
            </h3>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-2.5 text-xs text-zinc-300">
              <div className="flex items-center gap-2 font-bold text-white">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Escrow &amp; Proof Protection</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Pay a 70% deposit to start retouching, inspect high-res proofs with our interactive comparison loupe, and settle the 30% balance only when ready to unlock uncompressed masters.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-zinc-800/80 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} ICX Studios (LearnArk Technology Limited). All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/account/security" className="hover:text-zinc-300">
              Account Security &amp; 2FA
            </Link>
            <Link href="/auth/login" className="hover:text-zinc-300">
              Staff Sign In
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
