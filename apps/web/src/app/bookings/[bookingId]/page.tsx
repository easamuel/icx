'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  CreditCard,
  FileArchive,
  Star,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { formatNaira } from '@icx/ui-core';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { apiFetch, getStoredAccessToken } from '@/lib/api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || '/api/v1';

interface BookingDetailView {
  booking: {
    id: string;
    service_title: string;
    price: string;
    status: string;
    photographer_name: string;
    photographer_location?: string | null;
    start_time: string | null;
    end_time: string | null;
    booking_date?: string | null;
    package_type?: string | null;
    time_period?: string | null;
    notes?: string | null;
  };
  deliverables: Array<{
    id: string;
    version: number;
    previewUrl: string;
  }>;
  canDownloadClean: boolean;
}

export default function CustomerBookingReviewPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = params.bookingId;

  const [data, setData] = useState<BookingDetailView | null>(null);
  const [previewBlobs, setPreviewBlobs] = useState<Record<string, string>>({});
  const [rating, setRating] = useState(5);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBooking = useCallback(async () => {
    try {
      const res = await apiFetch<BookingDetailView>(`/bookings/${bookingId}`);
      setData(res);

      const token = getStoredAccessToken();
      const map: Record<string, string> = {};
      for (const item of res.deliverables) {
        const previewRes = await fetch(`${API_BASE_URL}/uploads/preview/${item.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (previewRes.ok) {
          const blob = await previewRes.blob();
          map[item.id] = URL.createObjectURL(blob);
        }
      }
      setPreviewBlobs(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load booking.');
    }
  }, [bookingId]);

  useEffect(() => {
    void loadBooking();
  }, [loadBooking]);

  async function handlePayBooking() {
    if (!data) return;
    try {
      const res = await apiFetch<{ authorizationUrl: string }>('/payments/initialize', {
        method: 'POST',
        body: JSON.stringify({
          target_type: 'booking',
          target_id: data.booking.id,
          payment_type: 'full',
          callback_url: window.location.href,
        }),
      });
      window.location.href = res.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment initialization failed.');
    }
  }

  async function handleDownloadCleanZip() {
    if (!data) return;
    try {
      const res = await apiFetch<{ downloadUrl: string }>('/uploads/clean-link', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'booking',
          targetId: data.booking.id,
          photoId: 'zip',
        }),
      });
      window.open(`${API_BASE_URL.replace('/api/v1', '')}${res.downloadUrl}`, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clean download requires full payment.');
    }
  }

  async function handleCompleteBooking() {
    if (!data) return;
    try {
      await apiFetch(`/bookings/${data.booking.id}/complete`, { method: 'POST' });
      setBanner('Shoot marked as Completed!');
      await loadBooking();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete booking.');
    }
  }

  async function handleCancelBooking() {
    if (!data) return;
    try {
      await apiFetch(`/bookings/${data.booking.id}/cancel`, { method: 'POST' });
      setBanner('Booking cancelled and slot released.');
      await loadBooking();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancellation failed.');
    }
  }

  async function handleRatePhotographer(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    try {
      const res = await apiFetch<{ newRating: string }>(
        `/bookings/${data.booking.id}/rate`,
        {
          method: 'POST',
          body: JSON.stringify({ rating }),
        }
      );
      setBanner(
        `Thank you! Photographer rating updated to ${res.newRating} stars.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit rating.');
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {banner && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{banner}</span>
          </div>
        )}

        {data && (
          <>
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="rounded-full bg-zinc-950 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white">
                  {data.booking.status.replace(/_/g, ' ')}
                </span>
                <h1 className="mt-3 text-2xl sm:text-3xl font-black text-zinc-950">
                  {data.booking.service_title} — {data.booking.photographer_name}
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-zinc-600">
                  Session:{' '}
                  {data.booking.start_time
                    ? `${new Date(data.booking.start_time).toLocaleDateString('en-NG', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })} • ${new Date(data.booking.start_time).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}${
                        data.booking.end_time
                          ? ` – ${new Date(data.booking.end_time).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`
                          : ''
                      }`
                    : data.booking.booking_date
                    ? `${new Date(data.booking.booking_date).toLocaleDateString('en-NG', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        timeZone: 'UTC',
                      })}${data.booking.time_period ? ` • ${data.booking.time_period}` : ''}`
                    : 'Schedule pending confirmation'}{' '}
                  {data.booking.photographer_location ? `• ${data.booking.photographer_location} ` : ''}
                  • Session Fee:{' '}
                  <strong className="text-zinc-950">{formatNaira(data.booking.price)}</strong>
                </p>
                {data.booking.notes && (
                  <p className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
                    <strong className="text-zinc-950">Notes:</strong> {data.booking.notes}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {data.booking.status === 'awaiting_payment' && (
                  <button
                    type="button"
                    onClick={handlePayBooking}
                    className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-6 py-3.5 text-xs font-black text-white shadow-xl"
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>Pay {formatNaira(data.booking.price)} via Paystack</span>
                  </button>
                )}

                {['requested', 'accepted', 'awaiting_payment'].includes(
                  data.booking.status
                ) && (
                  <button
                    type="button"
                    onClick={handleCancelBooking}
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Cancel Booking</span>
                  </button>
                )}

                {data.canDownloadClean && data.deliverables.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadCleanZip}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3.5 text-xs font-black text-white shadow-xl"
                  >
                    <FileArchive className="h-4 w-4" />
                    <span>Download All Clean Shoot Files (24h ZIP)</span>
                  </button>
                )}

                {data.booking.status === 'delivered' && (
                  <button
                    type="button"
                    onClick={handleCompleteBooking}
                    className="rounded-full border border-zinc-950 px-5 py-2.5 text-xs font-black text-zinc-950 hover:bg-zinc-950 hover:text-white transition-colors"
                  >
                    Mark Shoot Completed
                  </button>
                )}
              </div>
            </div>

            {/* Shoot Deliverables Gallery */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-zinc-950">
                  Shoot Deliverables Gallery ({data.deliverables.length})
                </h2>
                {!data.canDownloadClean && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Watermarked Proofs Until Session Fee Is Settled</span>
                  </span>
                )}
              </div>

              {data.deliverables.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Your photographer has not uploaded shoot deliverables yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.deliverables.map((item) => (
                    <div
                      key={item.id}
                      onContextMenu={(e) => e.preventDefault()}
                      className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950"
                    >
                      {previewBlobs[item.id] ? (
                        <img
                          src={previewBlobs[item.id]}
                          alt="Studio Proof"
                          draggable={false}
                          className="h-60 w-full object-cover pointer-events-none"
                        />
                      ) : (
                        <div className="flex h-60 items-center justify-center text-xs text-zinc-400">
                          Loading studio proof...
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {['delivered', 'completed'].includes(data.booking.status) && (
              <form
                onSubmit={handleRatePhotographer}
                className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <Star className="h-6 w-6 text-zinc-950 fill-zinc-950" />
                  <div>
                    <h3 className="text-sm font-black text-zinc-950">
                      Rate Your Experience with {data.booking.photographer_name}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Your verified review helps maintain ICX Studios’ roster excellence.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    aria-label="Star Rating"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-xs font-bold text-zinc-950"
                  >
                    <option value={5}>5 Stars — Exceptional</option>
                    <option value={4}>4 Stars — Very Good</option>
                    <option value={3}>3 Stars — Satisfactory</option>
                    <option value={2}>2 Stars — Subpar</option>
                    <option value={1}>1 Star — Poor</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded-full bg-zinc-950 px-5 py-2.5 text-xs font-black text-white"
                  >
                    Submit Rating
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </main>

      <AppFooter />
    </div>
  );
}
