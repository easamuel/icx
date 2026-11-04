'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  Star,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Camera,
  ArrowRight,
} from 'lucide-react';
import { formatNaira } from '@icx/ui-core';
import type {
  PhotographerProfileRecord,
  AvailabilitySlotRecord,
} from '@icx/shared-types';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { apiFetch, ApiError } from '@/lib/api';

type DirectoryPhotographer = PhotographerProfileRecord & { full_name: string };

const LOCATION_PILLS = ['All', 'Victoria Island', 'Ikoyi', 'Lekki', 'Abuja'];

const DEFAULT_PORTFOLIO_IMG =
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=1000&q=85';

const FALLBACK_PORTFOLIO = [
  DEFAULT_PORTFOLIO_IMG,
  'https://images.unsplash.com/photo-1523824921871-d6f1a15151f1?auto=format&fit=crop&w=1000&q=85',
  'https://images.unsplash.com/photo-1589156280159-27698a70f29e?auto=format&fit=crop&w=1000&q=85',
  'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=1000&q=85',
];

const BANNED_NON_AFRICAN_IDS = [
  '1534528741775',
  '1509631179647',
  '1515886657613',
  '1524504388940',
  '1519741497674',
  '1511285560929',
  '1537633552985',
  '1465495976277',
  '1531746020798',
  '1507003211169',
  '1573496359142',
  '1560250097',
  '1542038784456',
  '1492691527719',
];

function getValidPortfolioUrls(urls?: string[]): string[] {
  const valid = (urls || []).filter(
    (u) =>
      typeof u === 'string' &&
      (u.startsWith('http') || u.startsWith('/')) &&
      !BANNED_NON_AFRICAN_IDS.some((badId) => u.includes(badId))
  );
  return valid.length > 0 ? valid : FALLBACK_PORTFOLIO;
}

export default function PhotographerDirectoryPage() {
  const router = useRouter();
  const [photographers, setPhotographers] = useState<DirectoryPhotographer[]>([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [activeLocPill, setActiveLocPill] = useState('All');
  const [selectedPhotographer, setSelectedPhotographer] =
    useState<DirectoryPhotographer | null>(null);
  const [activePortfolioImg, setActivePortfolioImg] = useState<string>('');
  const [slots, setSlots] = useState<AvailabilitySlotRecord[]>([]);
  const [selectedServiceTitle, setSelectedServiceTitle] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPhotographers(loc = '') {
    try {
      const res = await apiFetch<{ photographers: DirectoryPhotographer[] }>(
        `/bookings/photographers${loc ? `?location=${encodeURIComponent(loc)}` : ''}`
      );
      setPhotographers(res.photographers);
      if (res.photographers[0]) {
        void handleSelectPhotographer(res.photographers[0].id);
      } else {
        setSelectedPhotographer(null);
      }
    } catch {
      setError('Unable to load verified photographer roster.');
    }
  }

  useEffect(() => {
    void loadPhotographers();
  }, []);

  async function handleSelectPhotographer(photographerId: string) {
    setError(null);
    setBookingMessage(null);
    try {
      const res = await apiFetch<{
        photographer: DirectoryPhotographer;
        slots: AvailabilitySlotRecord[];
      }>(`/bookings/photographers/${photographerId}`);

      setSelectedPhotographer(res.photographer);
      const gallery = getValidPortfolioUrls(res.photographer.portfolio_urls);
      setActivePortfolioImg(gallery[0]!);
      setSlots(res.slots);
      setSelectedServiceTitle(res.photographer.services_and_prices[0]?.title || '');
      const firstFree = res.slots.find((s) => s.status === 'free');
      setSelectedSlotId(firstFree?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load photographer schedule.');
    }
  }

  function handleLocationPillClick(pill: string) {
    setActiveLocPill(pill);
    const query = pill === 'All' ? '' : pill;
    setLocationFilter(query);
    void loadPhotographers(query);
  }

  async function handleRequestSlotHold(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPhotographer || !selectedSlotId || !selectedServiceTitle) return;
    setError(null);
    setBookingMessage(null);

    try {
      await apiFetch('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          photographer_id: selectedPhotographer.id,
          slot_id: selectedSlotId,
          service_title: selectedServiceTitle,
        }),
      });

      setBookingMessage(
        'Time slot locked exclusively for you for 48 hours! As soon as the photographer confirms your session brief, you will receive an instant notification to finalize payment.'
      );
      await handleSelectPhotographer(selectedPhotographer.id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/auth/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Slot reservation failed.');
    }
  }

  const galleryUrls = selectedPhotographer
    ? getValidPortfolioUrls(selectedPhotographer.portfolio_urls)
    : FALLBACK_PORTFOLIO;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      {/* Studio Header */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950">
                Book Vetted Master Photographers
              </h1>
              <p className="mt-2 max-w-2xl text-xs sm:text-sm text-zinc-600 leading-relaxed">
                Inspect curated studio and location portfolios across Lagos &amp; Abuja. Select a package and place a 48-hour exclusive hold on any open time slot before paying.
              </p>
            </div>

            {/* Location Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {LOCATION_PILLS.map((pill) => (
                <button
                  key={pill}
                  type="button"
                  onClick={() => handleLocationPillClick(pill)}
                  className={`rounded-full px-4 py-2 text-xs font-extrabold transition-all ${
                    activeLocPill === pill
                      ? 'bg-zinc-950 text-white shadow'
                      : 'border border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-950'
                  }`}
                >
                  {pill}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        {error && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {bookingMessage && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{bookingMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left 4 Columns: Photographer Directory Cards */}
          <div className="lg:col-span-4 space-y-4">
            {photographers.map((photog) => {
              const active = selectedPhotographer?.id === photog.id;
              const coverImg = getValidPortfolioUrls(photog.portfolio_urls)[0]!;
              const minPrice = photog.services_and_prices?.[0]?.price || 15000000;

              return (
                <div
                  key={photog.id}
                  onClick={() => void handleSelectPhotographer(photog.id)}
                  className={`cursor-pointer overflow-hidden rounded-3xl border-2 transition-all ${
                    active
                      ? 'border-zinc-950 bg-zinc-950 text-white shadow-xl'
                      : 'border-zinc-200 bg-white text-zinc-950 hover:border-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-4 p-4">
                    <img
                      src={coverImg}
                      alt={photog.full_name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_PORTFOLIO_IMG;
                      }}
                      className="h-20 w-20 rounded-2xl object-cover shrink-0 bg-zinc-200"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="truncate text-base font-black">
                          {photog.full_name}
                        </h2>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black shrink-0 ${
                            active
                              ? 'bg-white text-zinc-950'
                              : 'bg-zinc-100 text-zinc-950'
                          }`}
                        >
                          <Star className="h-3 w-3 fill-current" />
                          <span>{photog.rating}</span>
                        </span>
                      </div>

                      <p
                        className={`mt-1 flex items-center gap-1 text-xs font-medium ${
                          active ? 'text-zinc-300' : 'text-zinc-500'
                        }`}
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{photog.location || 'Lagos, Nigeria'}</span>
                      </p>

                      <div className="mt-2.5 flex items-center justify-between text-xs">
                        <span className={active ? 'text-zinc-400' : 'text-zinc-500'}>
                          From{' '}
                          <strong className={active ? 'text-white' : 'text-zinc-950'}>
                            {formatNaira(minPrice)}
                          </strong>
                        </span>
                        <span className="text-[11px] font-extrabold underline">
                          View Lookbook
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right 8 Columns: Interactive Lookbook + Packages + 48h Slot Scheduler */}
          {selectedPhotographer && (
            <div className="lg:col-span-8 rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-8">
              {/* Top Profile & Lookbook Showcase */}
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 border border-emerald-200">
                        <ShieldCheck className="h-3 w-3" />
                        <span>ICX Vetted Photographer</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-zinc-600">
                        <MapPin className="h-3.5 w-3.5 text-zinc-950" />
                        <span>{selectedPhotographer.location}</span>
                      </span>
                    </div>
                    <h2 className="mt-2 text-2xl sm:text-3xl font-black text-zinc-950">
                      {selectedPhotographer.full_name}
                    </h2>
                    <p className="mt-2 text-xs sm:text-sm text-zinc-600 leading-relaxed max-w-2xl">
                      {selectedPhotographer.bio}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-lg font-black text-zinc-950">
                      <Star className="h-4 w-4 fill-zinc-950 text-zinc-950" />
                      <span>{selectedPhotographer.rating}</span>
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Verified Rating
                    </div>
                  </div>
                </div>

                {/* Interactive Portfolio Lookbook Grid */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-8 h-64 sm:h-80 overflow-hidden rounded-2xl bg-zinc-900">
                    <img
                      src={activePortfolioImg || galleryUrls[0]}
                      alt={`${selectedPhotographer.full_name} Lookbook`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_PORTFOLIO_IMG;
                      }}
                      className="h-full w-full object-cover transition-all duration-300"
                    />
                  </div>
                  <div className="sm:col-span-4 grid grid-cols-4 sm:grid-cols-2 gap-2.5">
                    {galleryUrls.slice(0, 4).map((url, idx) => (
                      <button
                        key={url + idx}
                        type="button"
                        onClick={() => setActivePortfolioImg(url)}
                        className={`relative h-20 sm:h-[154px] overflow-hidden rounded-xl border-2 transition-all ${
                          activePortfolioImg === url
                            ? 'border-zinc-950 ring-2 ring-zinc-950/20'
                            : 'border-transparent opacity-75 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={url}
                          alt={`Portfolio ${idx + 1}`}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              FALLBACK_PORTFOLIO[idx % FALLBACK_PORTFOLIO.length] ??
                              DEFAULT_PORTFOLIO_IMG;
                          }}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <form onSubmit={handleRequestSlotHold} className="space-y-8 border-t border-zinc-200 pt-7">
                {/* 1. Select Shoot Package */}
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">
                    Step 01 — Choose Production Package
                  </h3>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {selectedPhotographer.services_and_prices.map((svc) => {
                      const active = selectedServiceTitle === svc.title;
                      return (
                        <div
                          key={svc.title}
                          onClick={() => setSelectedServiceTitle(svc.title)}
                          className={`cursor-pointer rounded-2xl border-2 p-5 transition-all ${
                            active
                              ? 'border-zinc-950 bg-zinc-950 text-white shadow-lg'
                              : 'border-zinc-200 bg-zinc-50/70 text-zinc-950 hover:border-zinc-400'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-black leading-snug">
                              {svc.title}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black shrink-0 ${
                                active
                                  ? 'bg-white text-zinc-950'
                                  : 'bg-zinc-950 text-white'
                              }`}
                            >
                              {formatNaira(svc.price)}
                            </span>
                          </div>
                          {svc.description && (
                            <p
                              className={`mt-2 text-xs leading-relaxed ${
                                active ? 'text-zinc-300' : 'text-zinc-600'
                              }`}
                            >
                              {svc.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Select Available Time Slot */}
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">
                      Step 02 — Select Available Date &amp; Time Slot
                    </h3>
                    <span className="text-xs font-semibold text-emerald-700">
                      48-Hour Exclusive Calendar Lock
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {slots.map((slot) => {
                      const isFree = slot.status === 'free';
                      const active = selectedSlotId === slot.id;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          disabled={!isFree}
                          onClick={() => setSelectedSlotId(slot.id)}
                          className={`flex flex-col items-start rounded-2xl border-2 p-4 text-left transition-all ${
                            !isFree
                              ? 'border-zinc-200 bg-zinc-100 text-zinc-400 opacity-60 cursor-not-allowed'
                              : active
                                ? 'border-zinc-950 bg-zinc-950 text-white shadow-lg'
                                : 'border-zinc-200 bg-white text-zinc-950 hover:border-zinc-400'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full text-xs font-black">
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>
                                {new Date(slot.start_time).toLocaleDateString('en-NG', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </span>
                            <span
                              className={`uppercase text-[10px] px-2.5 py-0.5 rounded-full font-black ${
                                !isFree
                                  ? 'bg-zinc-200 text-zinc-600'
                                  : active
                                    ? 'bg-emerald-400 text-zinc-950'
                                    : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {slot.status === 'free' ? 'Available' : slot.status}
                            </span>
                          </div>
                          <div
                            className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold ${
                              active ? 'text-zinc-300' : 'text-zinc-600'
                            }`}
                          >
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                              {new Date(slot.start_time).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              –{' '}
                              {new Date(slot.end_time).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!selectedSlotId || !selectedServiceTitle}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 py-4 text-sm font-black text-white shadow-xl hover:bg-zinc-800 disabled:opacity-40 transition-all"
                >
                  <span>Reserve Slot Exclusively for 48 Hours</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
