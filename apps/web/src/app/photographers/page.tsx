'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Star, Calendar, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatNaira } from '@icx/ui-core';
import type {
  PhotographerProfileRecord,
  AvailabilitySlotRecord,
} from '@icx/shared-types';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { apiFetch, ApiError } from '@/lib/api';

type DirectoryPhotographer = PhotographerProfileRecord & { full_name: string };

export default function PhotographerDirectoryPage() {
  const router = useRouter();
  const [photographers, setPhotographers] = useState<DirectoryPhotographer[]>([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [selectedPhotographer, setSelectedPhotographer] =
    useState<DirectoryPhotographer | null>(null);
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
      if (res.photographers[0] && !selectedPhotographer) {
        void handleSelectPhotographer(res.photographers[0].id);
      }
    } catch {
      setError('Unable to load approved photographers.');
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
      setSlots(res.slots);
      setSelectedServiceTitle(res.photographer.services_and_prices[0]?.title || '');
      const firstFree = res.slots.find((s) => s.status === 'free');
      setSelectedSlotId(firstFree?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load photographer slots.');
    }
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
        'Slot locked exclusively for 48 hours! Once the photographer accepts your request, you will be notified to complete payment.'
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

  return (
    <div className="min-h-screen bg-icx-slate text-icx-sand">
      <AppNavbar />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-icx-sand">
              Book Approved ICX Photographers
            </h1>
            <p className="mt-1 text-sm text-icx-sand-muted">
              Browse verified portfolios, select a service, and lock a free time slot for 48
              hours while awaiting photographer confirmation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              placeholder="Filter by location (e.g. Lagos)..."
              className="rounded-xl border border-icx-slate-border bg-icx-slate-dark px-3.5 py-2 text-xs text-icx-sand focus:border-icx-sand focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void loadPhotographers(locationFilter)}
              className="rounded-xl bg-icx-sand px-4 py-2 text-xs font-bold text-icx-slate"
            >
              Filter
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-icx-error/40 bg-icx-error/10 p-4 text-xs text-icx-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {bookingMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-icx-success/40 bg-icx-success/10 p-4 text-xs text-icx-success font-semibold">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{bookingMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left Column: Approved Photographers List */}
          <div className="space-y-4">
            {photographers.map((photog) => {
              const active = selectedPhotographer?.id === photog.id;
              return (
                <div
                  key={photog.id}
                  onClick={() => void handleSelectPhotographer(photog.id)}
                  className={`cursor-pointer rounded-2xl border p-5 transition-all ${
                    active
                      ? 'border-icx-sand bg-icx-slate-elevated shadow-lg'
                      : 'border-icx-slate-border bg-icx-slate-dark hover:border-icx-sand/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold text-icx-sand">
                        {photog.full_name}
                      </h2>
                      <p className="mt-1 flex items-center gap-1 text-xs text-icx-sand-muted">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{photog.location || 'Lagos, Nigeria'}</span>
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-icx-sand/15 px-2.5 py-1 text-xs font-bold text-icx-sand">
                      <Star className="h-3.5 w-3.5 fill-icx-sand text-icx-sand" />
                      <span>{photog.rating}</span>
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-icx-sand-muted line-clamp-3">
                    {photog.bio}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Right 2 Columns: Portfolio, Services & Live 48h Slot Scheduler */}
          {selectedPhotographer && (
            <div className="lg:col-span-2 rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 sm:p-8 space-y-6">
              <div className="border-b border-icx-slate-border pb-5">
                <span className="rounded bg-icx-success/20 px-2.5 py-1 text-[11px] font-bold uppercase text-icx-success">
                  Admin Verified Photographer
                </span>
                <h2 className="mt-2 text-2xl font-bold text-icx-sand">
                  {selectedPhotographer.full_name}
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-icx-sand-muted leading-relaxed">
                  {selectedPhotographer.bio}
                </p>
              </div>

              <form onSubmit={handleRequestSlotHold} className="space-y-6">
                {/* 1. Select Service & Price */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-icx-sand">
                    1. Choose Shoot Package
                  </h3>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedPhotographer.services_and_prices.map((svc) => {
                      const active = selectedServiceTitle === svc.title;
                      return (
                        <div
                          key={svc.title}
                          onClick={() => setSelectedServiceTitle(svc.title)}
                          className={`cursor-pointer rounded-xl border p-4 transition-all ${
                            active
                              ? 'border-icx-sand bg-icx-slate-elevated'
                              : 'border-icx-slate-border bg-icx-slate'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-icx-sand">
                              {svc.title}
                            </span>
                            <span className="text-xs font-extrabold text-icx-success">
                              {formatNaira(svc.price)}
                            </span>
                          </div>
                          {svc.description && (
                            <p className="mt-1.5 text-[11px] text-icx-sand-muted">
                              {svc.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Select Available Slot (PB-02, PB-03) */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-icx-sand">
                    2. Select Available Date &amp; Time Slot (48-Hour Exclusive Lock)
                  </h3>
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
                          className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
                            !isFree
                              ? 'border-icx-slate-border bg-icx-slate/40 opacity-50 cursor-not-allowed'
                              : active
                                ? 'border-icx-sand bg-icx-sand text-icx-slate'
                                : 'border-icx-slate-border bg-icx-slate text-icx-sand hover:border-icx-sand/40'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full text-xs font-bold">
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
                            <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-black/20">
                              {slot.status}
                            </span>
                          </div>
                          <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] opacity-85">
                            <Clock className="h-3 w-3" />
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
                  className="w-full rounded-xl bg-icx-sand py-3.5 text-sm font-extrabold text-icx-slate shadow-lg hover:bg-icx-sand-light disabled:opacity-40 transition-colors"
                >
                  Request Booking &amp; Lock Slot for 48 Hours
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

