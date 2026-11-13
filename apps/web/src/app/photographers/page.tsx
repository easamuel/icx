'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  Star,
  Calendar,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Camera,
  Clock,
  ShieldCheck,
  AlertCircle,
  Lock,
  Sparkles,
} from 'lucide-react';
import { formatNaira } from '@icx/ui-core';
import {
  BOOKING_PACKAGES,
  type BookingPackageType,
} from '@icx/shared-types';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { apiFetch, ApiError } from '@/lib/api';

interface PhotographerListing {
  id: string;
  user_id: string;
  full_name: string;
  bio: string | null;
  location: string | null;
  specialty?: string | null;
  years_experience?: number;
  rating: string;
  available_slots_count?: number;
  next_available_at?: string | null;
  portfolio_urls: string[];
  services_and_prices: Array<{
    title: string;
    description?: string;
    price: number;
    duration_hours: number;
  }>;
}

interface AvailableSlotItem {
  id: string;
  start_time: string;
  end_time: string;
}

interface AvailableDateInfo {
  date: string;
  is_available: boolean;
  slots: AvailableSlotItem[];
}

const DEFAULT_PACKAGE_RATES: Record<BookingPackageType, number> = {
  'Studio walk in': 7500000,
  'Half day event booking': 15000000,
  'Full day event booking': 28000000,
};

function getValidPortfolioUrls(urls?: string[] | null): string[] {
  return (urls || []).filter(
    (u) =>
      typeof u === 'string' &&
      !u.includes('localhost') &&
      !u.includes('127.0.0.1') &&
      (u.startsWith('https://') || u.startsWith('/api/'))
  );
}

function formatReadableDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1));
  return dt.toLocaleDateString('en-NG', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatSlotWindow(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const startStr = s.toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endStr = e.toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${startStr} – ${endStr}`;
}

export default function PhotographersBookingPage() {
  const router = useRouter();
  const [photographers, setPhotographers] = useState<PhotographerListing[]>([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [loadingDirectory, setLoadingDirectory] = useState(true);

  // Step 01: Photographer
  const [selectedPhotographer, setSelectedPhotographer] = useState<PhotographerListing | null>(null);
  const [availableDates, setAvailableDates] = useState<AvailableDateInfo[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Step 02: Calendar Month, Date & Published Slot
  const now = new Date();
  const [calendarMonth, setCalendarMonth] = useState<{ year: number; month: number }>({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');

  // Step 03: Package & Notes
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [notes, setNotes] = useState('');

  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);

  const fetchDirectory = useCallback(async (locationQuery = '') => {
    setLoadingDirectory(true);
    try {
      const qs = locationQuery ? `?location=${encodeURIComponent(locationQuery)}` : '';
      const res = await apiFetch<{ photographers: PhotographerListing[] }>(
        `/bookings/photographers${qs}`
      );
      setPhotographers(res.photographers || []);
    } catch {
      setPhotographers([]);
    } finally {
      setLoadingDirectory(false);
    }
  }, []);

  useEffect(() => {
    void fetchDirectory('');
  }, [fetchDirectory]);

  async function handleSelectPhotographer(photog: PhotographerListing) {
    setSelectedPhotographer(photog);
    setSelectedDate('');
    setSelectedSlotId('');
    setSelectedPackage('');
    setBookingError(null);
    setBookingSuccess(null);
    setLoadingAvailability(true);

    try {
      const res = await apiFetch<{ dates: AvailableDateInfo[] }>(
        `/bookings/photographers/${photog.id}/availability`
      );
      const dates = res.dates || [];
      setAvailableDates(dates);

      if (dates.length > 0 && dates[0]) {
        const [y, m] = dates[0].date.split('-').map(Number);
        if (y && m) {
          setCalendarMonth({ year: y, month: m - 1 });
        }
        setSelectedDate(dates[0].date);
        if (dates[0].slots.length === 1 && dates[0].slots[0]) {
          setSelectedSlotId(dates[0].slots[0].id);
        }
      }
    } catch {
      setAvailableDates([]);
      setBookingError('Unable to load available dates for this photographer.');
    } finally {
      setLoadingAvailability(false);
    }
  }

  const availableDateMap = useMemo(() => {
    const map = new Map<string, AvailableDateInfo>();
    for (const d of availableDates) {
      map.set(d.date, d);
    }
    return map;
  }, [availableDates]);

  const selectedDateInfo = useMemo(
    () => (selectedDate ? availableDateMap.get(selectedDate) || null : null),
    [availableDateMap, selectedDate]
  );

  const packageOptions = useMemo(() => {
    const custom = (selectedPhotographer?.services_and_prices || []).filter(
      (s) => s.title && Number(s.price) > 0
    );
    if (custom.length > 0) {
      return custom;
    }
    return BOOKING_PACKAGES.map((pkg) => ({
      title: pkg,
      price: DEFAULT_PACKAGE_RATES[pkg as BookingPackageType],
      description:
        pkg === 'Full day event booking'
          ? 'Full-day coverage & editorial curation'
          : pkg === 'Half day event booking'
          ? 'Up to 4 hours session coverage'
          : '1–2 hour studio walk-in session',
      duration_hours: pkg === 'Full day event booking' ? 8 : pkg === 'Half day event booking' ? 4 : 2,
    }));
  }, [selectedPhotographer]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(calendarMonth.year, calendarMonth.month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(calendarMonth.year, calendarMonth.month + 1, 0).getDate();
    const cells: Array<{ dateStr: string; day: number } | null> = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const m = String(calendarMonth.month + 1).padStart(2, '0');
      const d = String(day).padStart(2, '0');
      cells.push({
        dateStr: `${calendarMonth.year}-${m}-${d}`,
        day,
      });
    }
    return cells;
  }, [calendarMonth]);

  async function handleConfirmBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPhotographer || !selectedDate || !selectedSlotId || !selectedPackage) return;

    setBookingLoading(true);
    setBookingError(null);
    setBookingSuccess(null);

    try {
      await apiFetch('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          photographer_id: selectedPhotographer.id,
          slot_id: selectedSlotId,
          service_title: selectedPackage,
          notes: notes.trim() || undefined,
        }),
      });

      setBookingSuccess(
        `Session slot locked with ${selectedPhotographer.full_name} on ${formatReadableDate(
          selectedDate
        )} (${selectedPackage}).`
      );

      // Refresh availability and reset selection
      const refreshed = await apiFetch<{ dates: AvailableDateInfo[] }>(
        `/bookings/photographers/${selectedPhotographer.id}/availability`
      );
      setAvailableDates(refreshed.dates || []);
      setSelectedDate('');
      setSelectedSlotId('');
      setSelectedPackage('');
      setNotes('');
      void fetchDirectory(locationFilter);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/auth/login?redirect=/photographers');
        return;
      }
      setBookingError(
        err instanceof Error ? err.message : 'Unable to complete booking request.'
      );
    } finally {
      setBookingLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-zinc-950">
      <AppNavbar />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-zinc-200 pb-8">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-zinc-950 text-white px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest">
              <Camera className="w-3.5 h-3.5 text-amber-400" />
              Verified Photographer Roster
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-zinc-950">
              Book a Verified Photographer.
            </h1>
            <p className="text-zinc-600 text-base leading-relaxed">
              Follow the 3-step booking flow: select an approved photographer, pick an open date,
              and lock your package and session period.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void fetchDirectory(locationFilter);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              placeholder="Filter by city (Lagos, Abuja)..."
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 focus:border-zinc-950 focus:outline-none w-60"
            />
            <button
              type="submit"
              className="rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 transition-colors"
            >
              Filter
            </button>
          </form>
        </div>

        {/* 3-Step Sequential Flow Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* STEP 01: Choose Photographer */}
          <div className="lg:col-span-7 space-y-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-white text-xs font-black">
                01
              </span>
              <div>
                <h2 className="text-xl font-black text-zinc-950">Choose Photographer</h2>
                <p className="text-xs text-zinc-500">
                  Only email-verified and admin-approved photographers appear below.
                </p>
              </div>
            </div>

            {loadingDirectory ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-72 rounded-3xl border border-zinc-200 bg-white animate-pulse"
                  />
                ))}
              </div>
            ) : photographers.length === 0 ? (
              <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center space-y-3">
                <Camera className="w-10 h-10 text-zinc-300 mx-auto" />
                <p className="font-bold text-zinc-900">No verified photographers found</p>
                <p className="text-sm text-zinc-500">
                  Try clearing your city filter or check back shortly as new photographers pass
                  verification.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {photographers.map((photog) => {
                  const isSelected = selectedPhotographer?.id === photog.id;
                  const gallery = getValidPortfolioUrls(photog.portfolio_urls);
                  return (
                    <button
                      key={photog.id}
                      type="button"
                      onClick={() => void handleSelectPhotographer(photog)}
                      className={`text-left rounded-3xl border bg-white overflow-hidden transition-all flex flex-col ${
                        isSelected
                          ? 'border-zinc-950 ring-2 ring-zinc-950 shadow-xl'
                          : 'border-zinc-200 hover:border-zinc-400 hover:shadow-md'
                      }`}
                    >
                      <div className="relative h-44 w-full bg-zinc-100 overflow-hidden">
                        {gallery[0] ? (
                          <img
                            src={gallery[0]}
                            alt={photog.full_name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-zinc-900 text-zinc-500">
                            <Camera className="w-8 h-8" />
                          </div>
                        )}
                        <div className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-zinc-950/85 backdrop-blur px-2.5 py-1 text-[11px] font-bold text-white">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          Verified
                        </div>
                        <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-zinc-950">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                          {Number(photog.rating || 5).toFixed(1)}
                        </div>
                      </div>

                      <div className="p-5 space-y-2.5 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-lg font-black text-zinc-950 truncate">
                              {photog.full_name}
                            </h3>
                            {isSelected && (
                              <span className="rounded-full bg-zinc-950 text-white px-2.5 py-0.5 text-[10px] font-bold uppercase">
                                Selected
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-zinc-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3.5 h-3.5" />
                            {photog.location || 'Lagos, Nigeria'}
                            {photog.specialty ? ` • ${photog.specialty}` : ''}
                          </p>
                          <p className="text-xs text-zinc-600 mt-2 line-clamp-2">
                            {photog.bio || 'Editorial, commercial, and studio photography specialist.'}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs font-bold text-zinc-900">
                          <span>
                            {photog.years_experience
                              ? `${photog.years_experience}+ yrs experience`
                              : 'Pro Roster'}
                          </span>
                          {(photog.available_slots_count ?? 0) > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-black text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {photog.available_slots_count} open slot
                              {(photog.available_slots_count ?? 0) > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 border border-zinc-200 px-2.5 py-0.5 text-[11px] font-bold text-zinc-500">
                              Not Available
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* STEP 02 & STEP 03: Sequential Booking Panel */}
          <div className="lg:col-span-5 lg:sticky lg:top-24">
            <form
              onSubmit={handleConfirmBooking}
              className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-7 shadow-xl space-y-6"
            >
              {bookingSuccess && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Booking Request Submitted</span>
                  </div>
                  <p className="text-xs text-emerald-800">{bookingSuccess}</p>
                  <Link
                    href="/dashboard"
                    className="inline-block text-xs font-bold underline text-emerald-950"
                  >
                    Track in your Dashboard →
                  </Link>
                </div>
              )}

              {bookingError && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{bookingError}</span>
                </div>
              )}

              {/* Selected Photographer Summary */}
              {!selectedPhotographer ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center space-y-2">
                  <Lock className="w-6 h-6 text-zinc-400 mx-auto" />
                  <p className="text-sm font-bold text-zinc-800">
                    Step 01: Select a Photographer
                  </p>
                  <p className="text-xs text-zinc-500">
                    Choose any verified photographer on the left to unlock their available dates
                    and session packages.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3 pb-4 border-b border-zinc-100">
                  {getValidPortfolioUrls(selectedPhotographer.portfolio_urls)[0] ? (
                    <img
                      src={getValidPortfolioUrls(selectedPhotographer.portfolio_urls)[0]}
                      alt={selectedPhotographer.full_name}
                      className="w-12 h-12 rounded-2xl object-cover border border-zinc-200"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-zinc-400 flex items-center justify-center border border-zinc-200">
                      <Camera className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      Booking With
                    </p>
                    <p className="font-black text-zinc-950 truncate">
                      {selectedPhotographer.full_name}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      {selectedPhotographer.location || 'Lagos, Nigeria'}
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 02: Interactive Calendar & Published Time Slots */}
              {selectedPhotographer && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-950 text-white text-[10px] font-black">
                      02
                    </span>
                    <span className="text-sm font-black text-zinc-950">
                      Available Dates &amp; Time Slots
                    </span>
                  </div>

                  {loadingAvailability ? (
                    <div className="h-56 rounded-2xl bg-zinc-100 animate-pulse" />
                  ) : availableDates.length === 0 ? (
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center space-y-2">
                      <CalendarX2 className="w-8 h-8 text-zinc-400 mx-auto" />
                      <p className="text-sm font-black text-zinc-900">Not Available</p>
                      <p className="text-xs text-zinc-500">
                        {selectedPhotographer.full_name} has not published any open availability slots yet.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Compact Monthly Calendar */}
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() =>
                              setCalendarMonth((prev) =>
                                prev.month === 0
                                  ? { year: prev.year - 1, month: 11 }
                                  : { year: prev.year, month: prev.month - 1 }
                              )
                            }
                            className="p-1.5 rounded-full border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700"
                            aria-label="Previous month"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="text-xs font-black uppercase tracking-wider text-zinc-900">
                            {new Date(calendarMonth.year, calendarMonth.month, 1).toLocaleDateString(
                              'en-NG',
                              { month: 'long', year: 'numeric' }
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setCalendarMonth((prev) =>
                                prev.month === 11
                                  ? { year: prev.year + 1, month: 0 }
                                  : { year: prev.year, month: prev.month + 1 }
                              )
                            }
                            className="p-1.5 rounded-full border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700"
                            aria-label="Next month"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-zinc-400">
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((wd) => (
                            <div key={wd} className="py-1">
                              {wd}
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                          {calendarCells.map((cell, idx) => {
                            if (!cell) {
                              return <div key={`empty-${idx}`} className="h-9" />;
                            }
                            const dateInfo = availableDateMap.get(cell.dateStr);
                            const isOpen = Boolean(dateInfo && dateInfo.slots.length > 0);
                            const isPicked = selectedDate === cell.dateStr;

                            return (
                              <button
                                key={cell.dateStr}
                                type="button"
                                disabled={!isOpen}
                                onClick={() => {
                                  setSelectedDate(cell.dateStr);
                                  setSelectedSlotId(
                                    dateInfo?.slots.length === 1 && dateInfo.slots[0]
                                      ? dateInfo.slots[0].id
                                      : ''
                                  );
                                  setBookingError(null);
                                }}
                                className={`relative h-9 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center ${
                                  isPicked
                                    ? 'bg-zinc-950 text-white shadow-sm'
                                    : isOpen
                                    ? 'bg-emerald-50 border border-emerald-300 text-emerald-950 hover:bg-emerald-100'
                                    : 'text-zinc-300 cursor-not-allowed'
                                }`}
                              >
                                <span>{cell.day}</span>
                                {isOpen && !isPicked && (
                                  <span className="h-1 w-1 rounded-full bg-emerald-600 mt-0.5" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Time Slots for Selected Date */}
                      {selectedDateInfo && (
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            Open Time Slots for {formatReadableDate(selectedDateInfo.date)}
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {selectedDateInfo.slots.map((slot) => {
                              const isSlotPicked = selectedSlotId === slot.id;
                              return (
                                <button
                                  key={slot.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSlotId(slot.id);
                                    setBookingError(null);
                                  }}
                                  className={`rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-all text-center ${
                                    isSlotPicked
                                      ? 'border-zinc-950 bg-zinc-950 text-white shadow-sm'
                                      : 'border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400'
                                  }`}
                                >
                                  {formatSlotWindow(slot.start_time, slot.end_time)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* STEP 03: Package & Pricing Selection */}
                      {selectedSlotId && (
                        <div className="space-y-4 pt-2 border-t border-zinc-100">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-950 text-white text-[10px] font-black">
                              03
                            </span>
                            <span className="text-sm font-black text-zinc-950">
                              Select Package &amp; Pricing
                            </span>
                          </div>

                          <div className="space-y-2">
                            {packageOptions.map((pkg) => {
                              const isChecked = selectedPackage === pkg.title;
                              return (
                                <button
                                  key={pkg.title}
                                  type="button"
                                  onClick={() => {
                                    setSelectedPackage(pkg.title);
                                    setBookingError(null);
                                  }}
                                  className={`w-full text-left rounded-2xl border p-4 transition-all flex items-center justify-between gap-3 ${
                                    isChecked
                                      ? 'border-zinc-950 bg-zinc-950 text-white shadow-md'
                                      : 'border-zinc-200 bg-white hover:border-zinc-400 text-zinc-950'
                                  }`}
                                >
                                  <div>
                                    <p className="text-sm font-bold">{pkg.title}</p>
                                    {pkg.description && (
                                      <p
                                        className={`text-[11px] mt-0.5 ${
                                          isChecked ? 'text-zinc-300' : 'text-zinc-500'
                                        }`}
                                      >
                                        {pkg.description}
                                      </p>
                                    )}
                                  </div>
                                  <span className="text-sm font-black shrink-0">
                                    {formatNaira(pkg.price)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {selectedPackage && (
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-zinc-600">
                                Session Notes (Optional)
                              </label>
                              <textarea
                                rows={2}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Location details, moodboard notes, or special requests..."
                                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  bookingLoading ||
                  !selectedPhotographer ||
                  !selectedDate ||
                  !selectedSlotId ||
                  !selectedPackage
                }
                className="w-full rounded-2xl bg-zinc-950 py-4 text-sm font-black text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                {bookingLoading ? 'Locking Booking...' : 'Request Photographer Booking'}
              </button>
            </form>
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
