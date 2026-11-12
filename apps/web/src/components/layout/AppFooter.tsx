import React from 'react';
import Link from 'next/link';
import { IcxLogo } from '@/components/brand/IcxLogo';
import { MapPin, Phone, Mail } from 'lucide-react';

export function AppFooter() {
  const envPhone = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '2348000000000').replace(/\D/g, '');
  const displayPhone = envPhone.startsWith('234')
    ? `+234 (0) ${envPhone.slice(3, 6)} ${envPhone.slice(6, 9)} ${envPhone.slice(9)}`
    : `+${envPhone}`;
  const whatsappHref = `https://wa.me/${envPhone}?text=${encodeURIComponent(
    'Hello ICX Studios Support, I would like assistance with a project.'
  )}`;

  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          {/* Column 1-2: Brand & Contact */}
          <div className="md:col-span-2 space-y-4">
            <Link
              href="/"
              aria-label="ICX Studios Home"
              className="inline-flex items-center shrink-0"
            >
              <IcxLogo variant="light" />
            </Link>
            <p className="max-w-sm text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Professional photo editing, trusted photographers, and camera &amp; lighting rentals in Lagos and Abuja.
            </p>
            <div className="pt-1 space-y-2 text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-white shrink-0" />
                <span>Victoria Island &amp; Lekki Phase 1, Lagos • Maitama, Abuja</span>
              </div>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-white transition-colors"
                title="Chat with Studio Support on WhatsApp"
              >
                <Phone className="h-3.5 w-3.5 text-white shrink-0" />
                <span>{displayPhone}</span>
              </a>
              <a
                href="mailto:support@icxora.com"
                className="flex items-center gap-2 hover:text-white transition-colors"
                title="Email Studio Support"
              >
                <Mail className="h-3.5 w-3.5 text-white shrink-0" />
                <span>support@icxora.com</span>
              </a>
            </div>
          </div>

          {/* Column 3: Services */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Navigation
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm font-medium text-zinc-300">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/editing" className="hover:text-white transition-colors">
                  Photo Editing
                </Link>
              </li>
              <li>
                <Link href="/photographers" className="hover:text-white transition-colors">
                  Photographers
                </Link>
              </li>
              <li>
                <Link href="/rentals" className="hover:text-white transition-colors">
                  Rent Equipment
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-white transition-colors">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Account & Support */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Account &amp; Legal
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm font-medium text-zinc-300">
              <li>
                <Link href="/auth/login" className="hover:text-white transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/portal/photographer" className="hover:text-white transition-colors">
                  Photographer Portal
                </Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-white transition-colors">
                  Support &amp; Help Desk
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-zinc-800/80 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} ICX Studios (LearnArk Technology Limited). All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4 text-zinc-400">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
            <span>•</span>
            <Link href="/support" className="hover:text-white transition-colors">
              Support Desk
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
