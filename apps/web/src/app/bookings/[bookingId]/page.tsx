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
import { apiFetch, getStoredAccessToken } from '@/lib/api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface BookingDetailView {
  booking: {
    id: string;
    service_title: string;
    price: string;
    status: string;
    photographer_name: string;
    start_time: string;
    end_time: string;
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

      // Load authenticated burned-watermark previews for delivered shoot photos (PB-06)
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
      setBanner('Booking marked as Completed!');
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
    <div className="min-h-screen bg-icx-slate text-icx-sand">
      <AppNavbar />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-icx-error/40 bg-icx-error/10 p-4 text-xs text-icx-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {banner && (
          <div className="flex items-center gap-2 rounded-xl border border-icx-success/40 bg-icx-success/10 p-4 text-xs text-icx-success font-semibold">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{banner}</span>
          </div>
        )}

        {data && (
          <>
            <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="rounded bg-icx-sand px-2.5 py-0.5 text-xs font-extrabold uppercase text-icx-slate">
                  {data.booking.status.replace(/_/g, ' ')}
                </span>
                <h1 className="mt-2 text-2xl font-bold text-icx-sand">
                  {data.booking.service_title} — {data.booking.photographer_name}
                </h1>
                <p className="mt-1 text-xs text-icx-sand-muted">
                  Slot: {new Date(data.booking.start_time).toLocaleString()} • Shoot Fee:{' '}
                  {formatNaira(data.booking.price)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {data.booking.status === 'awaiting_payment' && (
                  <button
                    type="button"
                    onClick={handlePayBooking}
                    className="inline-flex items-center gap-2 rounded-xl bg-icx-sand px-5 py-3 text-xs font-extrabold text-icx-slate"
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
                    className="inline-flex items-center gap-1.5 rounded-xl border border-icx-error/50 px-4 py-2.5 text-xs font-bold text-icx-error"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Cancel Booking</span>
                  </button>
                )}

                {data.canDownloadClean && data.deliverables.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadCleanZip}
                    className="inline-flex items-center gap-2 rounded-xl bg-icx-success px-5 py-3 text-xs font-extrabold text-white"
                  >
                    <FileArchive className="h-4 w-4" />
                    <span>Download All Clean Shoot Files (24h ZIP)</span>
                  </button>
                )}

                {data.booking.status === 'delivered' && (
                  <button
                    type="button"
                    onClick={handleCompleteBooking}
                    className="rounded-xl border border-icx-sand px-4 py-2.5 text-xs font-bold text-icx-sand"
                  >
                    Mark Shoot Completed
                  </button>
                )}
              </div>
            </div>

            {/* Watermarked Shoot Deliverables Gallery (PB-06) */}
            <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-icx-sand">
                  Shoot Deliverables ({data.deliverables.length})
                </h2>
                {!data.canDownloadClean && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-icx-warning">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Watermarked Previews Until Paid in Full</span>
                  </span>
                )}
              </div>

              {data.deliverables.length === 0 ? (
                <p className="text-xs text-icx-sand-muted">
                  Photographer has not uploaded shoot deliverables yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.deliverables.map((item) => (
                    <div
                      key={item.id}
                      onContextMenu={(e) => e.preventDefault()}
                      className="overflow-hidden rounded-xl border border-icx-slate-border bg-icx-slate"
                    >
                      {previewBlobs[item.id] ? (
                        <img
                          src={previewBlobs[item.id]}
                          alt="Watermarked Shoot Proof"
                          draggable={false}
                          className="h-56 w-full object-cover pointer-events-none"
                        />
                      ) : (
                        <div className="flex h-56 items-center justify-center text-xs text-icx-sand-muted">
                          Loading burned watermark proof...
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rate Photographer After Delivery/Completion (PB-09) */}
            {['delivered', 'completed'].includes(data.booking.status) && (
              <form
                onSubmit={handleRatePhotographer}
                className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <Star className="h-6 w-6 text-icx-sand fill-icx-sand" />
                  <div>
                    <h3 className="text-sm font-bold text-icx-sand">
                      Rate {data.booking.photographer_name}
                    </h3>
                    <p className="text-xs text-icx-sand-muted">
                      Share your experience from this completed shoot (PB-09).
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    aria-label="Star Rating"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2 text-xs font-bold text-icx-sand"
                  >
                    <option value={5}>5 Stars — Exceptional</option>
                    <option value={4}>4 Stars — Very Good</option>
                    <option value={3}>3 Stars — Satisfactory</option>
                    <option value={2}>2 Stars — Subpar</option>
                    <option value={1}>1 Star — Poor</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded-xl bg-icx-sand px-4 py-2 text-xs font-extrabold text-icx-slate"
                  >
                    Submit Rating
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </main>
    </div>
  );
}

