'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  X,
  Plus,
  DollarSign,
  Calendar,
  UploadCloud,
  AlertCircle,
  Camera,
  Trash2,
  Clock,
  ImagePlus,
  Star,
  Eye,
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

function formatSlotDate(startIso: string, endIso?: string) {
  try {
    const s = new Date(startIso);
    const dateStr = s.toLocaleDateString('en-NG', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const startTime = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (!endIso) return `${dateStr} at ${startTime}`;
    const e = new Date(endIso);
    const endTime = e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} • ${startTime} – ${endTime}`;
  } catch {
    return startIso;
  }
}

export default function PhotographerPortalPage() {
  const router = useRouter();
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
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>([]);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const [slotMode, setSlotMode] = useState<'bulk' | 'single'>('bulk');
  const [bulkStartDate, setBulkStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [bulkEndDate, setBulkEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [bulkWeekdays, setBulkWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6]); // Mon–Sat
  const [bulkBlocks, setBulkBlocks] = useState<string[]>(['09:00-13:00', '13:30-17:30']);
  const [customBlockStart, setCustomBlockStart] = useState('09:00');
  const [customBlockEnd, setCustomBlockEnd] = useState('17:00');
  const [useCustomBlock, setUseCustomBlock] = useState(false);
  const [publishingSlots, setPublishingSlots] = useState(false);
  const [slotBanner, setSlotBanner] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    try {
      const res = await apiFetch<PhotographerWorkspaceData>(
        '/bookings/photographer/workspace'
      );
      if (res.profile.approval_status !== 'approved') {
        router.replace('/photographer/status');
        return;
      }
      setData(res);
      setBio(res.profile.bio || '');
      setLocation(res.profile.location || '');
      setPortfolioUrls(Array.isArray(res.profile.portfolio_urls) ? res.profile.portfolio_urls : []);
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

  function setSlotDuration(hours: number) {
    if (!slotStart) {
      const now = new Date();
      now.setMinutes(0, 0, 0);
      now.setHours(now.getHours() + 2);
      const startIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      const endObj = new Date(now.getTime() + hours * 3600000);
      const endIso = new Date(endObj.getTime() - endObj.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setSlotStart(startIso);
      setSlotEnd(endIso);
    } else {
      const start = new Date(slotStart);
      const endObj = new Date(start.getTime() + hours * 3600000);
      const endIso = new Date(endObj.getTime() - endObj.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setSlotEnd(endIso);
    }
  }

  async function handleAddSlot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!slotStart || !slotEnd) {
      setError('Please select both start and end times for the slot.');
      return;
    }
    const start = new Date(slotStart);
    const end = new Date(slotEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setError('Invalid date format.');
      return;
    }
    if (end <= start) {
      setError('Slot end time must be after start time.');
      return;
    }
    try {
      await apiFetch('/bookings/photographer/slots', {
        method: 'POST',
        body: JSON.stringify({
          start_time: start.toISOString(),
          end_time: end.toISOString(),
        }),
      });
      setSlotStart('');
      setSlotEnd('');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish availability slot.');
    }
  }

  async function handleDeleteSlot(slotId: string) {
    setError(null);
    setSlotBanner(null);
    try {
      await apiFetch(`/bookings/photographer/slots/${slotId}`, {
        method: 'DELETE',
      });
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove availability slot.');
    }
  }

  function buildBulkSlotPayloads(): Array<{ start_time: string; end_time: string }> {
    if (!bulkStartDate || !bulkEndDate || bulkWeekdays.length === 0) return [];
    const blocks = useCustomBlock
      ? customBlockStart && customBlockEnd && customBlockEnd > customBlockStart
        ? [`${customBlockStart}-${customBlockEnd}`]
        : []
      : bulkBlocks;
    if (blocks.length === 0) return [];

    const startD = new Date(`${bulkStartDate}T00:00:00`);
    const endD = new Date(`${bulkEndDate}T00:00:00`);
    if (isNaN(startD.getTime()) || isNaN(endD.getTime()) || endD < startD) return [];

    const out: Array<{ start_time: string; end_time: string }> = [];
    const cursor = new Date(startD);
    let safety = 0;
    while (cursor <= endD && safety < 60 && out.length < 120) {
      safety += 1;
      if (bulkWeekdays.includes(cursor.getDay())) {
        const ymd = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
          cursor.getDate()
        ).padStart(2, '0')}`;
        for (const block of blocks) {
          const [sTime, eTime] = block.split('-');
          if (!sTime || !eTime) continue;
          const sDt = new Date(`${ymd}T${sTime}:00`);
          const eDt = new Date(`${ymd}T${eTime}:00`);
          if (!isNaN(sDt.getTime()) && !isNaN(eDt.getTime()) && eDt > sDt) {
            out.push({
              start_time: sDt.toISOString(),
              end_time: eDt.toISOString(),
            });
          }
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  async function handleBulkPublishSlots(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSlotBanner(null);
    const payloads = buildBulkSlotPayloads();
    if (payloads.length === 0) {
      setError('Select a valid date range, at least one weekday, and at least one time block.');
      return;
    }

    setPublishingSlots(true);
    try {
      const res = await apiFetch<{ createdCount: number; skippedCount: number }>(
        '/bookings/photographer/slots/bulk',
        {
          method: 'POST',
          body: JSON.stringify({ slots: payloads }),
        }
      );
      setSlotBanner(
        `Published ${res.createdCount} availability slot${res.createdCount === 1 ? '' : 's'}${
          res.skippedCount > 0 ? ` (${res.skippedCount} overlapping skipped)` : ''
        }.`
      );
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish bulk slots.');
    } finally {
      setPublishingSlots(false);
    }
  }

  async function handleRemoveService(indexToRemove: number) {
    if (!data) return;
    setError(null);
    setProfileSavedMsg(null);
    const remaining = (data.profile.services_and_prices || []).filter(
      (_, idx) => idx !== indexToRemove
    );
    try {
      await apiFetch('/bookings/photographer/profile', {
        method: 'PUT',
        body: JSON.stringify({
          bio: bio || data.profile.bio || 'Studio and event photography specialist.',
          location: location || data.profile.location || 'Lagos, Nigeria',
          portfolio_urls: portfolioUrls,
          services_and_prices: remaining,
        }),
      });
      setProfileSavedMsg('Shoot package removed.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove package.');
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
          portfolio_urls: portfolioUrls,
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

  async function handlePortfolioFilesSelect(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploadingPortfolio(true);

    const newUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file || !file.type.startsWith('image/')) continue;
      if (file.size > 20 * 1024 * 1024) continue;

      try {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const res = await apiFetch<{ url: string }>('/uploads/media', {
          method: 'POST',
          body: JSON.stringify({
            base64Data,
            filename: file.name,
          }),
        });

        if (res.url) {
          newUrls.push(res.url);
        } else {
          newUrls.push(base64Data);
        }
      } catch {
        // Continue
      }
    }

    if (newUrls.length > 0) {
      const combined = [...portfolioUrls, ...newUrls];
      setPortfolioUrls(combined);

      try {
        await apiFetch('/bookings/photographer/profile', {
          method: 'PUT',
          body: JSON.stringify({
            bio: bio.trim() || data?.profile.bio || 'Professional photographer at ICX Studios.',
            location: location.trim() || data?.profile.location || 'Lagos, Nigeria',
            portfolio_urls: combined,
            services_and_prices: data?.profile.services_and_prices?.length
              ? data.profile.services_and_prices
              : [{ title: 'Standard Studio Session', price: 15000000, duration_hours: 2 }],
          }),
        });
        setProfileSavedMsg(`Added ${newUrls.length} recent work${newUrls.length > 1 ? 's' : ''} to your portfolio.`);
        await loadWorkspace();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update portfolio showcase.');
      }
    }

    setUploadingPortfolio(false);
  }

  async function handleRemovePortfolioPhoto(indexToRemove: number) {
    const updated = portfolioUrls.filter((_, idx) => idx !== indexToRemove);
    setPortfolioUrls(updated);
    try {
      await apiFetch('/bookings/photographer/profile', {
        method: 'PUT',
        body: JSON.stringify({
          bio: bio.trim() || data?.profile.bio || 'Professional photographer at ICX Studios.',
          location: location.trim() || data?.profile.location || 'Lagos, Nigeria',
          portfolio_urls: updated,
          services_and_prices: data?.profile.services_and_prices?.length
            ? data.profile.services_and_prices
            : [{ title: 'Standard Studio Session', price: 15000000, duration_hours: 2 }],
        }),
      });
      setProfileSavedMsg('Photo removed from your portfolio.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update portfolio showcase.');
    }
  }

  async function handleSetCoverPhoto(index: number) {
    if (index === 0) return;
    const target = portfolioUrls[index];
    if (!target) return;
    const rest = portfolioUrls.filter((_, idx) => idx !== index);
    const updated = [target, ...rest];
    setPortfolioUrls(updated);
    try {
      await apiFetch('/bookings/photographer/profile', {
        method: 'PUT',
        body: JSON.stringify({
          bio: bio.trim() || data?.profile.bio || 'Professional photographer at ICX Studios.',
          location: location.trim() || data?.profile.location || 'Lagos, Nigeria',
          portfolio_urls: updated,
          services_and_prices: data?.profile.services_and_prices?.length
            ? data.profile.services_and_prices
            : [{ title: 'Standard Studio Session', price: 15000000, duration_hours: 2 }],
        }),
      });
      setProfileSavedMsg('Directory cover photo updated.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update portfolio showcase.');
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950">
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
                            Slot: {formatSlotDate(b.start_time, b.end_time)} • Gross:{' '}
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
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-zinc-950" />
                    <h2 className="text-base font-black text-zinc-950">
                      Publish Availability
                    </h2>
                  </div>
                  <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 p-0.5 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setSlotMode('bulk')}
                      className={`rounded-full px-3 py-1 transition-colors ${
                        slotMode === 'bulk'
                          ? 'bg-zinc-950 text-white'
                          : 'text-zinc-600 hover:text-zinc-950'
                      }`}
                    >
                      Days &amp; Hours
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlotMode('single')}
                      className={`rounded-full px-3 py-1 transition-colors ${
                        slotMode === 'single'
                          ? 'bg-zinc-950 text-white'
                          : 'text-zinc-600 hover:text-zinc-950'
                      }`}
                    >
                      Single Slot
                    </button>
                  </div>
                </div>

                {slotBanner && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800">
                    {slotBanner}
                  </div>
                )}

                {slotMode === 'bulk' ? (
                  <form onSubmit={handleBulkPublishSlots} className="space-y-4">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-extrabold text-zinc-900">
                          From Date
                        </label>
                        <input
                          type="date"
                          required
                          value={bulkStartDate}
                          onChange={(e) => setBulkStartDate(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-extrabold text-zinc-900">
                          To Date
                        </label>
                        <input
                          type="date"
                          required
                          value={bulkEndDate}
                          onChange={(e) => setBulkEndDate(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-extrabold text-zinc-900 mb-1.5">
                        Available Days of Week
                      </label>
                      <div className="grid grid-cols-7 gap-1">
                        {[
                          { d: 0, l: 'Sun' },
                          { d: 1, l: 'Mon' },
                          { d: 2, l: 'Tue' },
                          { d: 3, l: 'Wed' },
                          { d: 4, l: 'Thu' },
                          { d: 5, l: 'Fri' },
                          { d: 6, l: 'Sat' },
                        ].map((item) => {
                          const active = bulkWeekdays.includes(item.d);
                          return (
                            <button
                              key={item.d}
                              type="button"
                              onClick={() =>
                                setBulkWeekdays((prev) =>
                                  prev.includes(item.d)
                                    ? prev.filter((x) => x !== item.d)
                                    : [...prev, item.d]
                                )
                              }
                              className={`rounded-lg py-1.5 text-[11px] font-bold transition-colors ${
                                active
                                  ? 'bg-zinc-950 text-white'
                                  : 'border border-zinc-200 bg-zinc-50 text-zinc-500 hover:bg-zinc-100'
                              }`}
                            >
                              {item.l}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-extrabold text-zinc-900">
                          Session Hours
                        </label>
                        <button
                          type="button"
                          onClick={() => setUseCustomBlock(!useCustomBlock)}
                          className="text-[11px] font-bold text-zinc-600 underline hover:text-zinc-950"
                        >
                          {useCustomBlock ? 'Use Preset Blocks' : 'Custom Hours'}
                        </button>
                      </div>

                      {useCustomBlock ? (
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <span className="text-[10px] font-bold text-zinc-500">Start Hour</span>
                            <input
                              type="time"
                              value={customBlockStart}
                              onChange={(e) => setCustomBlockStart(e.target.value)}
                              className="mt-0.5 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-950"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-zinc-500">End Hour</span>
                            <input
                              type="time"
                              value={customBlockEnd}
                              onChange={(e) => setCustomBlockEnd(e.target.value)}
                              className="mt-0.5 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-950"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {[
                            { id: '09:00-13:00', label: 'Morning (09:00 AM – 01:00 PM)' },
                            { id: '13:30-17:30', label: 'Afternoon (01:30 PM – 05:30 PM)' },
                            { id: '09:00-17:00', label: 'Full Day (09:00 AM – 05:00 PM)' },
                          ].map((block) => {
                            const selected = bulkBlocks.includes(block.id);
                            return (
                              <button
                                key={block.id}
                                type="button"
                                onClick={() =>
                                  setBulkBlocks((prev) =>
                                    prev.includes(block.id)
                                      ? prev.filter((x) => x !== block.id)
                                      : [...prev, block.id]
                                  )
                                }
                                className={`w-full rounded-xl border px-3 py-2 text-left text-xs font-bold flex items-center justify-between transition-colors ${
                                  selected
                                    ? 'border-zinc-950 bg-zinc-950 text-white'
                                    : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                                }`}
                              >
                                <span>{block.label}</span>
                                <span className="text-[10px] uppercase">
                                  {selected ? 'Selected' : 'Add'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={publishingSlots || buildBulkSlotPayloads().length === 0}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-zinc-950 py-3 text-xs font-black text-white shadow hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      <span>
                        {publishingSlots
                          ? 'Publishing Schedule...'
                          : `Publish ${buildBulkSlotPayloads().length} Open Slots`}
                      </span>
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleAddSlot} className="space-y-4">
                    <div>
                      <label className="block text-xs font-extrabold text-zinc-900">
                        Start Date &amp; Time
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={slotStart}
                        onChange={(e) => setSlotStart(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-xs font-bold text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-extrabold text-zinc-900">
                          End Date &amp; Time
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSlotDuration(2)}
                            className="rounded-lg bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700 hover:bg-zinc-200"
                          >
                            +2h
                          </button>
                          <button
                            type="button"
                            onClick={() => setSlotDuration(4)}
                            className="rounded-lg bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700 hover:bg-zinc-200"
                          >
                            +4h
                          </button>
                          <button
                            type="button"
                            onClick={() => setSlotDuration(8)}
                            className="rounded-lg bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700 hover:bg-zinc-200"
                          >
                            Full Day
                          </button>
                        </div>
                      </div>
                      <input
                        type="datetime-local"
                        required
                        value={slotEnd}
                        onChange={(e) => setSlotEnd(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-xs font-bold text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-zinc-950 py-3 text-xs font-black text-white shadow hover:bg-zinc-800 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Publish Open Slot</span>
                    </button>
                  </form>
                )}

                <div className="space-y-2 border-t border-zinc-200 pt-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
                    Published Slots ({data.slots.length})
                  </h3>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {data.slots.length === 0 ? (
                      <p className="text-xs text-zinc-500">
                        No open slots published yet. Clients will see &ldquo;Not Available&rdquo; until you publish your schedule.
                      </p>
                    ) : (
                      data.slots.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs font-semibold gap-2"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Clock className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                          <span className="truncate">{formatSlotDate(s.start_time, s.end_time)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`uppercase font-black text-[10px] px-2.5 py-0.5 rounded-full ${
                              s.status === 'free'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-zinc-950 text-white'
                            }`}
                          >
                            {s.status}
                          </span>
                          {s.status === 'free' && (
                            <button
                              type="button"
                              onClick={() => void handleDeleteSlot(s.id)}
                              className="p-1 text-zinc-400 hover:text-red-600 transition-colors"
                              title="Delete Slot"
                              aria-label="Delete Slot"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Verified Portfolio Showcase (Read-Only — Managed via Onboarding & Admin Review) */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Camera className="h-5 w-5 text-purple-600" />
                    <h2 className="text-lg font-black text-zinc-950">
                      Verified Portfolio Showcase ({portfolioUrls.length})
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">
                    Your proof-of-work portfolio is verified during onboarding and locked to maintain directory standards. Contact support@icxora.com to request portfolio updates.
                  </p>
                </div>
              </div>

              {portfolioUrls.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-xs text-zinc-500">
                  No verified portfolio images on record yet.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {portfolioUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-100 aspect-4/5 shadow-xs"
                    >
                      <img
                        src={url}
                        alt={`Verified Portfolio #${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
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
                {(data.profile.services_and_prices || []).length > 0 && (
                  <div className="sm:col-span-2 space-y-2 pt-2 border-t border-zinc-100">
                    <label className="block text-xs font-extrabold text-zinc-900">
                      Your Published Shoot Packages &amp; Pricing ({data.profile.services_and_prices.length})
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {data.profile.services_and_prices.map((svc, idx) => (
                        <div
                          key={`${svc.title}-${idx}`}
                          className="flex items-center justify-between gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-black text-zinc-950 truncate">{svc.title}</p>
                            <p className="text-[11px] font-semibold text-zinc-600">
                              {formatNaira(svc.price)} • {svc.duration_hours || 2} hrs
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleRemoveService(idx)}
                            className="p-1.5 text-zinc-400 hover:text-red-600 transition-colors shrink-0"
                            title="Remove package"
                            aria-label="Remove package"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                className="rounded-full bg-zinc-950 px-6 py-3 text-xs font-black text-white shadow hover:bg-zinc-800 transition-colors"
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
