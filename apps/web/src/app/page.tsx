import Link from 'next/link';
import { Camera, Sliders, PackageCheck, ShieldCheck, ArrowRight, Lock } from 'lucide-react';
import { IcxLogo } from '@/components/brand/IcxLogo';
import { formatNaira } from '@icx/ui-core';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-icx-slate text-icx-sand">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-icx-slate-border bg-icx-slate/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <IcxLogo variant="sand-on-slate" className="h-9 w-auto" />
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-icx-sand/90">
            <Link href="/editing" className="hover:text-white transition-colors">
              Photo Editing
            </Link>
            <Link href="/photographers" className="hover:text-white transition-colors">
              Book Photographers
            </Link>
            <Link href="/rentals" className="hover:text-white transition-colors">
              Equipment Rental
            </Link>
            <Link href="/portal/photographer" className="hover:text-white transition-colors">
              Photographer Portal
            </Link>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              href="/auth/login"
              className="rounded-lg border border-icx-sand/30 px-3.5 py-2 text-xs sm:text-sm font-medium text-icx-sand hover:bg-icx-slate-elevated transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/register"
              className="rounded-lg bg-icx-sand px-3.5 py-2 text-xs sm:text-sm font-semibold text-icx-slate hover:bg-icx-sand-light transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-icx-slate-border py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-icx-sand/25 bg-icx-slate-dark px-3.5 py-1.5 text-xs font-medium text-icx-sand">
                <ShieldCheck className="h-3.5 w-3.5 text-icx-success" />
                <span>Self-Hosted Payment-Gated Production Platform</span>
              </div>

              <h1 className="mt-6 text-3xl font-bold tracking-tight text-icx-sand sm:text-5xl lg:text-6xl">
                Studio Retouching, Verified Photographers &amp; Pro Cinema Gear.
              </h1>

              <p className="mt-5 text-base sm:text-lg text-icx-sand-muted leading-relaxed">
                One unified ICX Studios account for commercial photo editing, vetted
                photographer bookings with 48-hour slot holds, and multi-unit equipment
                rentals with real-time transactional inventory locking.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                <Link
                  href="/editing"
                  className="inline-flex items-center gap-2 rounded-xl bg-icx-sand px-5 py-3.5 text-sm font-semibold text-icx-slate shadow-lg hover:bg-icx-sand-light transition-all"
                >
                  <span>Order Photo Edits</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/photographers"
                  className="inline-flex items-center gap-2 rounded-xl border border-icx-sand/30 bg-icx-slate-dark px-5 py-3.5 text-sm font-semibold text-icx-sand hover:bg-icx-slate-elevated transition-all"
                >
                  <span>Browse Photographers</span>
                </Link>
                <Link
                  href="/rentals"
                  className="inline-flex items-center gap-2 rounded-xl border border-icx-sand/30 bg-icx-slate-dark px-5 py-3.5 text-sm font-semibold text-icx-sand hover:bg-icx-slate-elevated transition-all"
                >
                  <span>Rent Studio Gear</span>
                </Link>
              </div>
            </div>

            {/* Three Core Services Grid */}
            <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Service 1: Photo Editing */}
              <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 flex flex-col justify-between">
                <div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-icx-sand text-icx-slate">
                    <Sliders className="h-5 w-5" />
                  </div>
                  <h2 className="mt-5 text-xl font-bold text-icx-sand">
                    1. Pro Photo Editing
                  </h2>
                  <p className="mt-2 text-sm text-icx-sand-muted leading-relaxed">
                    Resumable TUS uploads up to 50MB per RAW/TIFF/HEIC/JPG file. Pay a 70%
                    deposit or 100% upfront, inspect burned-in watermarked previews with our
                    before/after slider, and unlock clean 24h ZIP downloads upon balance
                    settlement.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-icx-slate-border flex items-center justify-between text-xs text-icx-sand-muted">
                  <span>From {formatNaira(250000)} / photo</span>
                  <span className="text-icx-success font-medium">70% Deposit Available</span>
                </div>
              </div>

              {/* Service 2: Photographer Booking */}
              <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 flex flex-col justify-between">
                <div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-icx-sand text-icx-slate">
                    <Camera className="h-5 w-5" />
                  </div>
                  <h2 className="mt-5 text-xl font-bold text-icx-sand">
                    2. Photographer Booking
                  </h2>
                  <p className="mt-2 text-sm text-icx-sand-muted leading-relaxed">
                    Discover admin-approved photographers by location and specialty. Request
                    a live slot (locked for 48 hours while awaiting acceptance), pay securely
                    via Paystack after confirmation, and receive watermarked shoot previews.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-icx-slate-border flex items-center justify-between text-xs text-icx-sand-muted">
                  <span>48h Exclusive Slot Hold</span>
                  <span className="text-icx-sand font-medium">Verified Portfolios</span>
                </div>
              </div>

              {/* Service 3: Equipment Rental */}
              <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 flex flex-col justify-between">
                <div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-icx-sand text-icx-slate">
                    <PackageCheck className="h-5 w-5" />
                  </div>
                  <h2 className="mt-5 text-xl font-bold text-icx-sand">
                    3. Equipment Rental
                  </h2>
                  <p className="mt-2 text-sm text-icx-sand-muted leading-relaxed">
                    Multi-unit cinema cameras, lenses, and Profoto lighting kits. Real-time
                    PostgreSQL row-locked checkout holds your units for 30 minutes so two
                    customers never double-book overlapping dates.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-icx-slate-border flex items-center justify-between text-xs text-icx-sand-muted">
                  <span>30-Min Checkout Lock</span>
                  <span className="text-icx-warning font-medium">Zero Double-Booking</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Role Portals Quick Access Bar */}
        <section className="py-10 bg-icx-slate-dark/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6">
              <div className="flex items-center gap-3.5">
                <Lock className="h-6 w-6 text-icx-sand shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-icx-sand">
                    Role-Based Workspaces (Customer • Photographer • Editor • Executive Admin)
                  </h3>
                  <p className="text-xs text-icx-sand-muted mt-0.5">
                    Strict server-side RBAC, Argon2id credentials, Redis token rotation, and
                    mandatory 2FA for Editor &amp; Admin portals.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5 text-xs font-semibold">
                <Link
                  href="/dashboard"
                  className="rounded-lg border border-icx-slate-border bg-icx-slate px-3.5 py-2 text-icx-sand hover:border-icx-sand"
                >
                  Customer Dashboard
                </Link>
                <Link
                  href="/portal/photographer"
                  className="rounded-lg border border-icx-slate-border bg-icx-slate px-3.5 py-2 text-icx-sand hover:border-icx-sand"
                >
                  Photographer Portal
                </Link>
                <Link
                  href="/workspace/editor"
                  className="rounded-lg border border-icx-slate-border bg-icx-slate px-3.5 py-2 text-icx-sand hover:border-icx-sand"
                >
                  Editor Workspace
                </Link>
                <Link
                  href="/admin"
                  className="rounded-lg bg-icx-sand px-3.5 py-2 text-icx-slate hover:bg-icx-sand-light"
                >
                  Admin Control Center
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

