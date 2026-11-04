'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Camera,
  Sliders,
  PackageCheck,
  ShieldCheck,
  ArrowRight,
  ArrowUpRight,
  Star,
  MapPin,
  MoveHorizontal,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { formatNaira } from '@icx/ui-core';

const HERO_PRESETS = [
  {
    id: 'editorial',
    label: 'Editorial Skin & Color Grade',
    package: 'High-End Frequency Separation • ₦6,000 / frame',
    turnaround: '48h Turnaround',
    image:
      'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=1200&q=90',
    beforeFilter: 'sepia(0.18) saturate(0.68) contrast(0.86) brightness(0.92)',
    afterFilter: 'contrast(1.08) saturate(1.12) brightness(1.03)',
  },
  {
    id: 'fashion',
    label: 'Ankara Couture & Fashion Mastering',
    package: 'Commercial Campaign Composite • ₦12,000 / frame',
    turnaround: '72h Turnaround',
    image:
      'https://images.unsplash.com/photo-1523824921871-d6f1a15151f1?auto=format&fit=crop&w=1200&q=90',
    beforeFilter: 'saturate(0.55) contrast(0.85) brightness(0.9)',
    afterFilter: 'contrast(1.12) saturate(1.15) brightness(1.04)',
  },
  {
    id: 'bridal',
    label: 'Fine-Art Melanin Beauty & Bridal',
    package: 'Essential Studio Color & Exposure • ₦2,500 / frame',
    turnaround: '24h Turnaround',
    image:
      'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=1200&q=90',
    beforeFilter: 'saturate(0.6) contrast(0.88) brightness(0.91)',
    afterFilter: 'contrast(1.09) saturate(1.1) brightness(1.03)',
  },
];

const FEATURED_PHOTOGRAPHERS = [
  {
    name: 'Adesua Nwosu Studios',
    specialty: 'Editorial Fashion & Ankara Couture Portraiture',
    location: 'Victoria Island, Lagos',
    rating: '4.98',
    reviews: 64,
    startingPrice: 15000000,
    image:
      'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Kolawole Olanrewaju Visuals',
    specialty: 'Traditional Society Weddings & Bridal Editorial',
    location: 'Ikoyi, Lagos',
    rating: '4.95',
    reviews: 51,
    startingPrice: 22000000,
    image:
      'https://images.unsplash.com/photo-1531123414780-f74242c2b052?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Ngozi Ezeani Studio',
    specialty: 'C-Suite Boardroom Portraiture & Beauty Campaigns',
    location: 'Maitama, Abuja',
    rating: '4.92',
    reviews: 39,
    startingPrice: 18000000,
    image:
      'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Obinna Adeleke Commercial',
    specialty: 'Commercial Campaigns, Architecture & Lookbooks',
    location: 'Lekki Phase 1, Lagos',
    rating: '4.96',
    reviews: 47,
    startingPrice: 20000000,
    image:
      'https://images.unsplash.com/photo-1531384441138-2736e62e0919?auto=format&fit=crop&w=900&q=85',
  },
];

const FEATURED_GEAR = [
  {
    name: 'RED V-RAPTOR 8K VV Cinema Production Pack',
    category: 'Digital Cinema Camera',
    specs: '8K VV 120fps • V-Lock Expander • 7" DSMC3 LCD • 2TB CFexpress',
    dailyPrice: 22000000,
    units: 2,
    image:
      'https://images.unsplash.com/photo-1589872307379-0ffdf9829123?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Hasselblad X2D 100C Medium Format Kit',
    category: '100MP Medium Format',
    specs: '16-Bit Color • 15-Stop Dynamic Range • XCD 55V & 90V Lenses',
    dailyPrice: 14500000,
    units: 2,
    image:
      'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Profoto Pro-11 2400 AirTTL Studio Pack',
    category: 'Commercial Strobe Lighting',
    specs: '2400Ws Generator • 2x ProHead Plus • 1/80,000s Freeze • 5ft Octa',
    dailyPrice: 9500000,
    units: 2,
    image:
      'https://images.unsplash.com/photo-1527011046414-4781f1f94f8c?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Sony Alpha A1 50.1MP Mirrorless Body',
    category: 'Flagship Full-Frame Stills & 8K',
    specs: '50.1MP Stacked Sensor • 30fps Blackout-Free • Dual 160GB CFexpress',
    dailyPrice: 6500000,
    units: 3,
    image:
      'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=85',
  },
];

const FAQS = [
  {
    q: 'How does the 70% deposit and watermarked proof review work for Photo Retouching?',
    a: 'When ordering photo editing, you can choose to pay a 70% deposit upfront (or 100% upfront). Once our senior retouchers complete your order, you inspect the high-resolution watermarked proofs using our interactive Before/After loupe, request any free revisions per photo, and settle the remaining 30% balance only when you are ready to download the uncompressed, un-watermarked master ZIP.',
  },
  {
    q: 'What happens when I request a time slot with an ICX Photographer?',
    a: 'Selecting a free slot places an exclusive 48-hour reservation hold on that photographer’s calendar so no other client can take your time. Once the photographer confirms availability in their portal, you receive an instant payment link to finalize the shoot booking.',
  },
  {
    q: 'How do you prevent double-booking on multi-unit camera and lighting rentals?',
    a: 'Every equipment item tracks live daily unit inventory. When you proceed to checkout, our reservation engine locks your requested units for 30 minutes while you complete Paystack checkout—guaranteeing zero overlapping double-bookings.',
  },
  {
    q: 'What file formats and sizes are supported for studio uploads?',
    a: 'Our resumable chunked upload engine supports uncompressed JPG, PNG, HEIC, WebP, and 16-bit TIFF files up to 50 MB per image (up to 100 images per order). If your internet connection drops mid-upload, transfers resume from the exact last byte without restarting.',
  },
];

export default function HomePage() {
  const [sliderPos, setSliderPos] = useState(50);
  const [activePresetIdx, setActivePresetIdx] = useState(0);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  const activePreset = HERO_PRESETS[activePresetIdx]!;

  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-950">
      <AppNavbar />

      <main className="flex-1">
        {/* =====================================================================
            1. ARCHITECTURAL MONOCHROME HERO + LIVE RETOUCHING LOUPE
           ===================================================================== */}
        <section className="relative overflow-hidden border-b border-zinc-200 bg-zinc-950 text-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
              {/* Left 6 Columns: Editorial Copy & Primary CTAs */}
              <div className="lg:col-span-6 space-y-7">
                <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/90 px-4 py-1.5 text-xs font-semibold text-zinc-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Lagos &amp; Abuja Creative Production House</span>
                </div>

                <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.06]">
                  Where Master Imagery Meets Precision Production.
                </h1>

                <p className="max-w-xl text-base sm:text-lg text-zinc-400 leading-relaxed">
                  Commission magazine-grade photo retouching with 70% deposit protection, book vetted editorial photographers with 48-hour exclusive slot holds, and rent insured RED, Hasselblad &amp; Profoto cinema gear.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Link
                    href="/editing"
                    className="inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-4 text-sm font-black text-zinc-950 shadow-xl hover:bg-zinc-200 transition-all"
                  >
                    <span>Order Photo Retouching</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/photographers"
                    className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-6 py-4 text-sm font-bold text-white hover:border-white hover:bg-zinc-800 transition-all"
                  >
                    <span>Book a Photographer</span>
                  </Link>
                  <Link
                    href="/rentals"
                    className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-5 py-4 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition-all"
                  >
                    <span>Rent Cinema Gear</span>
                  </Link>
                </div>

                {/* Mini Guarantee Row */}
                <div className="grid grid-cols-3 gap-4 border-t border-zinc-800/90 pt-7 text-xs">
                  <div>
                    <div className="font-black text-white text-base sm:text-lg">70% / 30%</div>
                    <div className="text-zinc-400 mt-0.5">Split Deposit Escrow</div>
                  </div>
                  <div>
                    <div className="font-black text-white text-base sm:text-lg">24h – 72h</div>
                    <div className="text-zinc-400 mt-0.5">Guaranteed Turnaround</div>
                  </div>
                  <div>
                    <div className="font-black text-white text-base sm:text-lg">50 MB / File</div>
                    <div className="text-zinc-400 mt-0.5">Resumable RAW/TIFF Transfer</div>
                  </div>
                </div>
              </div>

              {/* Right 6 Columns: Live Interactive Before/After Retouching Studio Showcase */}
              <div className="lg:col-span-6 space-y-4">
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-3 shadow-2xl">
                  <div className="relative h-[380px] sm:h-[440px] w-full overflow-hidden rounded-2xl select-none">
                    {/* After Layer (Master Retouched) */}
                    <img
                      src={activePreset.image}
                      alt={activePreset.label}
                      draggable={false}
                      style={{ filter: activePreset.afterFilter }}
                      className="h-full w-full object-cover pointer-events-none"
                    />

                    {/* Before Layer (Unretouched Camera RAW Simulation) */}
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                    >
                      <img
                        src={activePreset.image}
                        alt="Original RAW Capture"
                        draggable={false}
                        style={{ filter: activePreset.beforeFilter }}
                        className="h-full w-full object-cover pointer-events-none"
                      />
                    </div>

                    {/* Top Pills */}
                    <div className="absolute top-4 left-4 rounded-full bg-black/75 backdrop-blur-md px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-200 border border-white/15">
                      Unretouched RAW
                    </div>
                    <div className="absolute top-4 right-4 rounded-full bg-white px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-zinc-950 shadow-lg">
                      ICX Master Grade
                    </div>

                    {/* Interactive Divider Handle */}
                    <div
                      className="absolute inset-y-0 w-0.5 bg-white shadow-2xl pointer-events-none"
                      style={{ left: `${sliderPos}%` }}
                    >
                      <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-950 shadow-2xl ring-4 ring-black/30">
                        <MoveHorizontal className="h-4 w-4" />
                      </div>
                    </div>

                    {/* Bottom Interactive Slider Bar Overlay */}
                    <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/15 bg-black/80 backdrop-blur-md px-4 py-3 flex items-center gap-4">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 shrink-0">
                        Drag Loupe
                      </span>
                      <input
                        type="range"
                        min={5}
                        max={95}
                        value={sliderPos}
                        aria-label="Interactive Retouching Comparison Slider"
                        onChange={(e) => setSliderPos(Number(e.target.value))}
                        className="w-full accent-white cursor-ew-resize"
                      />
                      <span className="text-[11px] font-semibold text-emerald-400 shrink-0">
                        {activePreset.turnaround}
                      </span>
                    </div>
                  </div>

                  {/* Preset Switcher Tabs */}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {HERO_PRESETS.map((preset, idx) => {
                      const active = idx === activePresetIdx;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setActivePresetIdx(idx)}
                          className={`rounded-xl px-3 py-2.5 text-left transition-all ${
                            active
                              ? 'bg-white text-zinc-950 shadow'
                              : 'bg-zinc-950/60 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                          }`}
                        >
                          <div className="text-xs font-extrabold truncate">{preset.label}</div>
                          <div
                            className={`text-[10px] truncate mt-0.5 ${
                              active ? 'text-zinc-600 font-semibold' : 'text-zinc-500'
                            }`}
                          >
                            {preset.package}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            2. EXECUTIVE STUDIO METRICS BAR
           ===================================================================== */}
        <section className="border-b border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <div>
                <div className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950">
                  14,800+
                </div>
                <div className="mt-1 text-xs font-semibold text-zinc-500">
                  Commercial &amp; Editorial Frames Mastered
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950">
                  4.96 ★
                </div>
                <div className="mt-1 text-xs font-semibold text-zinc-500">
                  Average Rating Across Vetted Photographers
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950">
                  ₦250M+
                </div>
                <div className="mt-1 text-xs font-semibold text-zinc-500">
                  Insured RED, Hasselblad &amp; Profoto Fleet
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950">
                  100%
                </div>
                <div className="mt-1 text-xs font-semibold text-zinc-500">
                  Watermarked Proof Inspection Before Final Balance
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            3. THREE CORE CREATIVE SERVICES (ARCHITECTURAL MONOCHROME CARDS)
           ===================================================================== */}
        <section className="py-20 sm:py-24 border-b border-zinc-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
              <div>
                <span className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
                  Three Integrated Production Pillars
                </span>
                <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-zinc-950">
                  Everything Required for World-Class Visuals.
                </h2>
              </div>
              <p className="max-w-md text-xs sm:text-sm text-zinc-600 leading-relaxed">
                One unified client account connects you to our senior retouching suite, verified Lagos &amp; Abuja photographers, and cinema equipment vault.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Pillar 01: Photo Retouching */}
              <div className="group rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm hover:border-zinc-950 hover:shadow-xl transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-widest text-zinc-400">
                      01 / Post-Production
                    </span>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                      <Sliders className="h-5 w-5" />
                    </div>
                  </div>

                  <h3 className="mt-6 text-2xl font-black text-zinc-950">
                    Bespoke Studio Photo Retouching
                  </h3>
                  <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
                    Upload up to 100 uncompressed RAW/TIFF/JPG files per order. Start with a 70% deposit, review high-resolution proofs with our interactive Before/After slider, request revisions per frame, and unlock clean masters upon completion.
                  </p>

                  <div className="mt-6 space-y-2.5 border-t border-zinc-100 pt-5 text-xs text-zinc-700">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Essential Studio Color &amp; Exposure</span>
                      <span className="font-black text-zinc-950">{formatNaira(250000)} / photo</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Editorial Frequency Separation</span>
                      <span className="font-black text-zinc-950">{formatNaira(600000)} / photo</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Commercial Campaign Composite</span>
                      <span className="font-black text-zinc-950">{formatNaira(1200000)} / photo</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-5 border-t border-zinc-200">
                  <Link
                    href="/editing"
                    className="inline-flex w-full items-center justify-between rounded-2xl bg-zinc-950 px-5 py-3.5 text-xs font-extrabold text-white group-hover:bg-zinc-800 transition-colors"
                  >
                    <span>Launch Retouching Wizard</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Pillar 02: Photographer Booking */}
              <div className="group rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm hover:border-zinc-950 hover:shadow-xl transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-widest text-zinc-400">
                      02 / Talent Directory
                    </span>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                      <Camera className="h-5 w-5" />
                    </div>
                  </div>

                  <h3 className="mt-6 text-2xl font-black text-zinc-950">
                    Vetted Master Photographers
                  </h3>
                  <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
                    Explore curated portfolios across editorial fashion, executive portraits, luxury weddings, and commercial campaigns. Reserve any open time slot for 48 hours exclusively while the photographer confirms your brief.
                  </p>

                  <div className="mt-6 space-y-2.5 border-t border-zinc-100 pt-5 text-xs text-zinc-700">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Strict portfolio &amp; lighting verification by ICX Directors</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>48-hour exclusive slot hold before payment is required</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Automated watermarked shoot proof gallery &amp; ZIP delivery</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-5 border-t border-zinc-200">
                  <Link
                    href="/photographers"
                    className="inline-flex w-full items-center justify-between rounded-2xl bg-zinc-950 px-5 py-3.5 text-xs font-extrabold text-white group-hover:bg-zinc-800 transition-colors"
                  >
                    <span>Explore Photographers &amp; Slots</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Pillar 03: Equipment Rental */}
              <div className="group rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm hover:border-zinc-950 hover:shadow-xl transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-widest text-zinc-400">
                      03 / Cinema Vault
                    </span>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                      <PackageCheck className="h-5 w-5" />
                    </div>
                  </div>

                  <h3 className="mt-6 text-2xl font-black text-zinc-950">
                    Cinema &amp; Studio Gear Rental
                  </h3>
                  <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
                    Reserve multi-unit RED cinema rigs, Hasselblad 100MP medium format systems, Sony G-Master lens trinities, and Profoto Pro-11 generators with live daily unit availability and 30-minute checkout protection.
                  </p>

                  <div className="mt-6 space-y-2.5 border-t border-zinc-100 pt-5 text-xs text-zinc-700">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Live 14-day multi-unit availability matrix</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>30-minute exclusive inventory lock during checkout</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Bench-tested &amp; sensor-cleaned before every dispatch</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-5 border-t border-zinc-200">
                  <Link
                    href="/rentals"
                    className="inline-flex w-full items-center justify-between rounded-2xl bg-zinc-950 px-5 py-3.5 text-xs font-extrabold text-white group-hover:bg-zinc-800 transition-colors"
                  >
                    <span>Browse Cinema Gear Catalog</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            4. CURATED MASTER PHOTOGRAPHERS ROSTER PREVIEW
           ===================================================================== */}
        <section className="py-20 sm:py-24 border-b border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
              <div>
                <span className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
                  Verified Creative Roster
                </span>
                <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-zinc-950">
                  Book Vetted Studio &amp; Location Photographers
                </h2>
              </div>
              <Link
                href="/photographers"
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-950 bg-white px-5 py-2.5 text-xs font-extrabold text-zinc-950 hover:bg-zinc-950 hover:text-white transition-all self-start sm:self-auto"
              >
                <span>View Full Directory &amp; Live Calendars</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURED_PHOTOGRAPHERS.map((photog) => (
                <Link
                  key={photog.name}
                  href="/photographers"
                  className="group overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm hover:border-zinc-950 hover:shadow-xl transition-all flex flex-col"
                >
                  <div className="relative h-64 w-full overflow-hidden bg-zinc-900">
                    <img
                      src={photog.image}
                      alt={photog.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 rounded-full bg-black/75 backdrop-blur px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                      Verified Roster
                    </div>
                    <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-black text-zinc-950 shadow">
                      <Star className="h-3 w-3 fill-zinc-950 text-zinc-950" />
                      <span>{photog.rating}</span>
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-base font-black text-zinc-950 group-hover:underline">
                        {photog.name}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-zinc-600">
                        {photog.specialty}
                      </p>
                      <p className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-500">
                        <MapPin className="h-3.5 w-3.5 text-zinc-900" />
                        <span>{photog.location}</span>
                      </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-zinc-100 flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                          Packages From
                        </span>
                        <span className="text-sm font-black text-zinc-950">
                          {formatNaira(photog.startingPrice)}
                        </span>
                      </div>
                      <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-950 group-hover:bg-zinc-950 group-hover:text-white transition-colors">
                        Book Slot →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* =====================================================================
            5. FLAGSHIP CINEMA & LIGHTING GEAR VAULT
           ===================================================================== */}
        <section className="py-20 sm:py-24 border-b border-zinc-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
              <div>
                <span className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
                  Real-Time Multi-Unit Fleet
                </span>
                <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-zinc-950">
                  Rent Cinema Cameras, Medium Format &amp; Profoto Lighting
                </h2>
              </div>
              <Link
                href="/rentals"
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-zinc-800 transition-all self-start sm:self-auto"
              >
                <span>Open Equipment Availability Matrix</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURED_GEAR.map((item) => (
                <Link
                  key={item.name}
                  href="/rentals"
                  className="group overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm hover:border-zinc-950 hover:shadow-xl transition-all flex flex-col"
                >
                  <div className="relative h-52 w-full overflow-hidden bg-zinc-100">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-3 left-3 rounded-full bg-zinc-950/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                      {item.category}
                    </span>
                    <span className="absolute bottom-3 right-3 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">
                      {item.units} Units in Vault
                    </span>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-black text-zinc-950 leading-snug">
                        {item.name}
                      </h3>
                      <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
                        {item.specs}
                      </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-zinc-100 flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                          Daily Rate
                        </span>
                        <span className="text-sm font-black text-zinc-950">
                          {formatNaira(item.dailyPrice)} / day
                        </span>
                      </div>
                      <span className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-bold text-zinc-900 group-hover:border-zinc-950 group-hover:bg-zinc-950 group-hover:text-white transition-colors">
                        Hold Dates
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* =====================================================================
            6. HOW THE ICX STUDIO WORKFLOW PROTECTS EVERY CLIENT
           ===================================================================== */}
        <section className="py-20 sm:py-24 bg-zinc-950 text-white border-b border-zinc-800">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                Engineered for Trust
              </span>
              <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-white">
                Zero Guesswork from Upload to Final Master Delivery.
              </h2>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  step: 'STEP 01',
                  title: 'Configure & Lock Your Brief',
                  desc: 'Select your retouching package, photographer time slot (locked for 48h), or equipment rental dates (locked for 30m at checkout).',
                },
                {
                  step: 'STEP 02',
                  title: 'Resumable Studio Transfer',
                  desc: 'Upload high-resolution RAW, TIFF, HEIC, or JPEG files up to 50 MB each. Interrupted uploads resume from the exact byte.',
                },
                {
                  step: 'STEP 03',
                  title: 'Inspect Watermarked Proofs',
                  desc: 'Compare before and after retouches side-by-side in our browser loupe and submit pinpointed revision notes per photo.',
                },
                {
                  step: 'STEP 04',
                  title: 'Unlock 24h Signed Master ZIP',
                  desc: 'Once your balance is settled via Paystack, generate an encrypted 24-hour direct download link for your clean, full-resolution files.',
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 space-y-3"
                >
                  <span className="inline-block rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-950">
                    {item.step}
                  </span>
                  <h3 className="text-lg font-extrabold text-white pt-1">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =====================================================================
            7. FREQUENTLY ASKED QUESTIONS
           ===================================================================== */}
        <section className="py-20 sm:py-24 bg-white">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                Studio Concierge FAQ
              </span>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-3">
              {FAQS.map((item, idx) => {
                const open = openFaqIdx === idx;
                return (
                  <div
                    key={item.q}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50/60 overflow-hidden transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIdx(open ? null : idx)}
                      className="flex w-full items-center justify-between px-6 py-5 text-left text-sm sm:text-base font-bold text-zinc-950 hover:bg-zinc-100/80 transition-colors"
                    >
                      <span>{item.q}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 transition-transform ${
                          open ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {open && (
                      <div className="px-6 pb-5 text-xs sm:text-sm text-zinc-600 leading-relaxed border-t border-zinc-200/60 pt-4 bg-white">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
