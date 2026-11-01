'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Check,
  X,
  Plus,
  DollarSign,
  Calendar,
  UploadCloud,
  AlertCircle,
} from 'lucide-react';
import { formatNaira } from '@icx/ui-core';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { TusFileUploader } from '@/components/upload/TusFileUploader';
import { apiFetch } from '@/lib/api';

interface PhotographerWorkspaceData {
  profile: {
    id: string;
    bio: string | null;
    location: string | null;
    rating: string;
    approval_status: string;
    portfolio_urls: string[];
    services_and_prices: Array<{
      title: string;
      description?: string;
      price: number;
      duration_hours: number;
    }>;
  };
  slots: Array<{
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    held_until: string | null;
  }>;
  bookings: Array<{
    id: string;
    service_title: string;
    price: string;
    commission_rate: string;
    commission_amount: string;
    status: string;
    customer_name: string;
    start_time: string;
    end_time: string;
    held_until: string | null;
    deliverables_count: number;
  }>;
  earningsSummary: {
    completedCount: number;
    grossEarningsKobo: string;
    totalCommissionKobo: string;
    netPayableKobo: string;
  };
}

export default function PhotographerPortalPage() {
  const [data, setData] = useState<PhotographerWorkspaceData | null>(null);
  const [slotStart, setSlotStart] = useState('');
  const [slotEnd, setSlotEnd] = useState('');
  const [activeUploadBookingId, setActiveUploadBookingId] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [serviceTitle, setServiceTitle] = useState('');
  const [servicePriceNgn, setServicePriceNgn] = useState('150000');
  const [serviceDuration, setServiceDuration] = useState('2');
  const [profileSavedMsg, setProfileSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    try {
      const res = await apiFetch<PhotographerWorkspaceData>(
        '/bookings/photographer/workspace'
      );
      setData(res);
      setBio(res.profile.bio || '');
      setLocation(res.profile.location || '');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Sign in with a Photographer account to access this portal.'
      );
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  async function handleRespondBooking(bookingId: string, decision: 'accept' | 'decline') {
    setError(null);
    try {
      await apiFetch(`/bookings/${bookingId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update booking.');
    }
  }

  async function handleAddSlot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/bookings/photographer/slots', {
        method: 'POST',
        body: JSON.stringify({
          start_time: new Date(slotStart).toISOString(),
          end_time: new Date(slotEnd).toISOString(),
        }),
      });
      setSlotStart('');
      setSlotEnd('');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add availability slot.');
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setError(null);
    setProfileSavedMsg(null);

    const existingServices = data.profile.services_and_prices || [];
    const updatedServices = serviceTitle.trim()
      ? [
          ...existingServices,
          {
            title: serviceTitle.trim(),
            price: Math.round(Number(servicePriceNgn) * 100),
            duration_hours: Number(serviceDuration) || 2,
          },
        ]
      : existingServices;

    try {
      await apiFetch('/bookings/photographer/profile', {
        method: 'PUT',
        body: JSON.stringify({
          bio,
          location,
          portfolio_urls: data.profile.portfolio_urls || [],
          services_and_prices:
            updatedServices.length > 0
              ? updatedServices
              : [
                  {
                    title: 'Standard Studio Session',
                    price: 15000000,
                    duration_hours: 2,
                  },
                ],
        }),
      });
      setServiceTitle('');
      setProfileSavedMsg('Photographer profile & service pricing updated.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    }
  }

  return (
    <div className="min-h-screen bg-icx-slate text-icx-sand">
      <AppNavbar />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-icx-sand">
              Photographer Studio Portal
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-icx-sand-muted">
              Manage your availability slots, accept/decline 48h held booking requests,
              upload shoot deliverables with automatic server watermarking, and track net
              earnings.
            </p>
          </div>
          {data && (
            <span className="rounded-xl border border-icx-sand/40 bg-icx-slate-dark px-4 py-2 text-xs font-bold uppercase text-icx-sand">
              Profile Status: {data.profile.approval_status}
            </span>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-icx-error/40 bg-icx-error/10 p-4 text-xs text-icx-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {data && (
          <>
            {/* PP-06: Earnings & Commission Ledger */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-5">
                <div className="flex items-center justify-between text-xs text-icx-sand-muted">
                  <span>Gross Completed Shoots ({data.earningsSummary.completedCount})</span>
                  <DollarSign className="h-4 w-4 text-icx-sand" />
                </div>
                <div className="mt-2 text-2xl font-extrabold text-icx-sand">
                  {formatNaira(data.earningsSummary.grossEarningsKobo)}
                </div>
              </div>

              <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-5">
                <div className="text-xs text-icx-sand-muted">
                  Platform Commission Deducted
                </div>
                <div className="mt-2 text-2xl font-extrabold text-icx-warning">
                  -{formatNaira(data.earningsSummary.totalCommissionKobo)}
                </div>
              </div>

              <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-5">
                <div className="text-xs text-icx-sand-muted">
                  Net Amount Payable to Photographer
                </div>
                <div className="mt-2 text-2xl font-extrabold text-icx-success">
                  {formatNaira(data.earningsSummary.netPayableKobo)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Left 2 Columns: Booking Inbox & Shoot Delivery Uploader (PP-03, PP-04) */}
              <div className="lg:col-span-2 rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 space-y-5">
                <h2 className="text-lg font-bold text-icx-sand">
                  Booking Requests &amp; Shoot Deliveries ({data.bookings.length})
                </h2>

                {data.bookings.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl border border-icx-slate-border bg-icx-slate p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-sm font-bold text-icx-sand">
                          {b.service_title} — Client: {b.customer_name}
                        </span>
                        <p className="text-xs text-icx-sand-muted mt-0.5">
                          Slot: {new Date(b.start_time).toLocaleString()} • Gross:{' '}
                          {formatNaira(b.price)} (Commission {b.commission_rate}%:{' '}
                          {formatNaira(b.commission_amount)})
                        </p>
                      </div>
                      <span className="rounded bg-icx-sand px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-icx-slate">
                        {b.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {b.status === 'requested' && (
                      <div className="flex items-center gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => void handleRespondBooking(b.id, 'accept')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-icx-success px-4 py-2 text-xs font-bold text-white"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Accept Booking</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRespondBooking(b.id, 'decline')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-icx-error/50 px-4 py-2 text-xs font-bold text-icx-error"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Decline &amp; Release Slot</span>
                        </button>
                      </div>
                    )}

                    {['confirmed', 'delivered'].includes(b.status) && (
                      <div className="pt-2 border-t border-icx-slate-border">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveUploadBookingId(
                              activeUploadBookingId === b.id ? null : b.id
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-icx-sand px-3.5 py-2 text-xs font-bold text-icx-slate"
                        >
                          <UploadCloud className="h-3.5 w-3.5" />
                          <span>
                            Upload Shoot Deliverables ({b.deliverables_count} uploaded)
                          </span>
                        </button>

                        {activeUploadBookingId === b.id && (
                          <div className="mt-4">
                            <TusFileUploader
                              uploadType="booking_delivery"
                              targetId={b.id}
                              maxFiles={100}
                              onUploadComplete={() => void loadWorkspace()}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Right Column: Availability Slot Scheduler (PP-02) */}
              <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 space-y-5 h-fit">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-icx-sand" />
                  <h2 className="text-base font-bold text-icx-sand">
                    Availability Scheduler
                  </h2>
                </div>

                <form onSubmit={handleAddSlot} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-icx-sand">
                      Start Date &amp; Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={slotStart}
                      onChange={(e) => setSlotStart(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3 py-2 text-xs text-icx-sand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-icx-sand">
                      End Date &amp; Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={slotEnd}
                      onChange={(e) => setSlotEnd(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3 py-2 text-xs text-icx-sand"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-icx-sand py-2.5 text-xs font-extrabold text-icx-slate"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Free Availability Slot</span>
                  </button>
                </form>

                <div className="space-y-2 border-t border-icx-slate-border pt-4">
                  <h3 className="text-xs font-bold uppercase text-icx-sand-muted">
                    Published Slots ({data.slots.length})
                  </h3>
                  {data.slots.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-lg border border-icx-slate-border bg-icx-slate px-3 py-2 text-xs"
                    >
                      <span>{new Date(s.start_time).toLocaleString()}</span>
                      <span className="uppercase font-bold text-[10px] px-2 py-0.5 rounded bg-icx-sand/20 text-icx-sand">
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* PP-01: Photographer Profile, Bio, Location & Services Manager */}
            <form
              onSubmit={handleSaveProfile}
              className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-icx-sand">
                  Profile, Bio &amp; Custom Services Manager (Requirement PP-01)
                </h2>
                {profileSavedMsg && (
                  <span className="text-xs font-bold text-icx-success">
                    {profileSavedMsg}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-icx-sand">
                    Studio / Base Location
                  </label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Victoria Island, Lagos"
                    className="mt-1 w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2 text-xs text-icx-sand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-icx-sand">
                    Add New Shoot Package (Optional)
                  </label>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={serviceTitle}
                      onChange={(e) => setServiceTitle(e.target.value)}
                      placeholder="Package Title"
                      className="rounded-xl border border-icx-slate-border bg-icx-slate px-3 py-2 text-xs text-icx-sand"
                    />
                    <input
                      type="number"
                      value={servicePriceNgn}
                      onChange={(e) => setServicePriceNgn(e.target.value)}
                      placeholder="Price (NGN)"
                      className="rounded-xl border border-icx-slate-border bg-icx-slate px-3 py-2 text-xs text-icx-sand"
                    />
                    <input
                      type="number"
                      value={serviceDuration}
                      onChange={(e) => setServiceDuration(e.target.value)}
                      placeholder="Hours"
                      className="rounded-xl border border-icx-slate-border bg-icx-slate px-3 py-2 text-xs text-icx-sand"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-icx-sand">
                    Photographer Bio &amp; Specialties
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-icx-slate-border bg-icx-slate p-3 text-xs text-icx-sand"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="rounded-xl bg-icx-sand px-5 py-2.5 text-xs font-extrabold text-icx-slate"
              >
                Save Profile &amp; Services
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

