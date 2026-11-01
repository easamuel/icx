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
  Camera,
} from 'lucide-react';
import { formatNaira } from '@icx/ui-core';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
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
          : 'Sign in with a Photographer account to access this studio portal.'
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
      setError(err instanceof Error ? err.message : 'Failed to publish availability slot.');
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
      setProfileSavedMsg('Studio profile & service pricing updated.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
              <Camera className="h-3 w-3" />
              <span>Partner Studio Workspace</span>
            </span>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-zinc-950">
              Photographer Studio Portal
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-600">
              Manage your live availability slots, confirm 48-hour held session requests, upload shoot deliverables, and track net earnings.
            </p>
          </div>
          {data && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-800">
              Roster Status: {data.profile.approval_status}
            </span>
          )}
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {data && (
          <>
            {/* Earnings & Commission Ledger */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
                  <span>Gross Completed Sessions ({data.earningsSummary.completedCount})</span>
                  <DollarSign className="h-4 w-4 text-zinc-950" />
                </div>
                <div className="mt-2 text-3xl font-black text-zinc-950">
                  {formatNaira(data.earningsSummary.grossEarningsKobo)}
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="text-xs font-bold text-zinc-500">
                  Platform Commission Deducted
                </div>
                <div className="mt-2 text-3xl font-black text-amber-600">
                  -{formatNaira(data.earningsSummary.totalCommissionKobo)}
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-zinc-950 p-6 text-white shadow-lg">
                <div className="text-xs font-bold text-zinc-400">
                  Net Amount Payable to Studio
                </div>
                <div className="mt-2 text-3xl font-black text-emerald-400">
                  {formatNaira(data.earningsSummary.netPayableKobo)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Left 2 Columns: Booking Requests & Shoot Deliveries */}
              <div className="lg:col-span-2 rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
                <h2 className="text-lg font-black text-zinc-950">
                  Session Requests &amp; Shoot Deliveries ({data.bookings.length})
                </h2>

                {data.bookings.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    No active session bookings yet. Publish availability slots on the right to receive client bookings.
                  </p>
                ) : (
                  data.bookings.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-sm font-black text-zinc-950">
                            {b.service_title} — Client: {b.customer_name}
                          </span>
                          <p className="text-xs font-medium text-zinc-600 mt-1">
                            Slot: {new Date(b.start_time).toLocaleString()} • Gross:{' '}
                            <strong>{formatNaira(b.price)}</strong> (Commission {b.commission_rate}%:{' '}
                            {formatNaira(b.commission_amount)})
                          </p>
                        </div>
                        <span className="rounded-full bg-zinc-950 px-3 py-1 text-[10px] font-black uppercase text-white">
                          {b.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {b.status === 'requested' && (
                        <div className="flex items-center gap-2.5 pt-2">
                          <button
                            type="button"
                            onClick={() => void handleRespondBooking(b.id, 'accept')}
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2 text-xs font-black text-white"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Accept Session</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRespondBooking(b.id, 'decline')}
                            className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-5 py-2 text-xs font-bold text-red-700"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Decline &amp; Release Slot</span>
                          </button>
                        </div>
                      )}

                      {['confirmed', 'delivered'].includes(b.status) && (
                        <div className="pt-3 border-t border-zinc-200">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveUploadBookingId(
                                activeUploadBookingId === b.id ? null : b.id
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-2 text-xs font-black text-white"
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
                  ))
                )}
              </div>

              {/* Right Column: Availability Slot Scheduler */}
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-5 h-fit">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-zinc-950" />
                  <h2 className="text-base font-black text-zinc-950">
                    Publish Availability Slots
                  </h2>
                </div>

                <form onSubmit={handleAddSlot} className="space-y-3">
                  <div>
                    <label className="block text-xs font-extrabold text-zinc-900">
                      Start Date &amp; Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={slotStart}
                      onChange={(e) => setSlotStart(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-xs font-bold text-zinc-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-zinc-900">
                      End Date &amp; Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={slotEnd}
                      onChange={(e) => setSlotEnd(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-xs font-bold text-zinc-950"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-zinc-950 py-3 text-xs font-black text-white shadow"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Publish Open Slot</span>
                  </button>
                </form>

                <div className="space-y-2 border-t border-zinc-200 pt-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
                    Published Slots ({data.slots.length})
                  </h3>
                  {data.slots.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs font-semibold"
                    >
                      <span>{new Date(s.start_time).toLocaleString()}</span>
                      <span className="uppercase font-black text-[10px] px-2.5 py-0.5 rounded-full bg-zinc-950 text-white">
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Profile, Bio & Custom Services Manager */}
            <form
              onSubmit={handleSaveProfile}
              className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-zinc-950">
                  Studio Profile, Bio &amp; Shoot Packages
                </h2>
                {profileSavedMsg && (
                  <span className="text-xs font-bold text-emerald-700">
                    {profileSavedMsg}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-zinc-900">
                    Studio / Base Location
                  </label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Victoria Island, Lagos"
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs font-bold text-zinc-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-zinc-900">
                    Add New Shoot Package (Optional)
                  </label>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={serviceTitle}
                      onChange={(e) => setServiceTitle(e.target.value)}
                      placeholder="Package Title"
                      className="rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-950"
                    />
                    <input
                      type="number"
                      value={servicePriceNgn}
                      onChange={(e) => setServicePriceNgn(e.target.value)}
                      placeholder="Price (NGN)"
                      className="rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-950"
                    />
                    <input
                      type="number"
                      value={serviceDuration}
                      onChange={(e) => setServiceDuration(e.target.value)}
                      placeholder="Hours"
                      className="rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-950"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-zinc-900">
                    Photographer Bio &amp; Specialties
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-zinc-300 bg-zinc-50 p-3.5 text-xs text-zinc-950"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="rounded-full bg-zinc-950 px-6 py-3 text-xs font-black text-white shadow"
              >
                Save Profile &amp; Packages
              </button>
            </form>
          </>
        )}
      </main>

      <AppFooter />
    </div>
  );
}
