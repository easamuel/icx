'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sliders, Camera, PackageCheck, CreditCard, Download, ArrowRight } from 'lucide-react';
import { formatNaira } from '@icx/ui-core';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { apiFetch } from '@/lib/api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export default function CustomerUnifiedDashboardPage() {
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);
  const [bookings, setBookings] = useState<Array<Record<string, unknown>>>([]);
  const [rentals, setRentals] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<{ orders: Array<Record<string, unknown>> }>('/editing/orders').catch(() => ({
        orders: [],
      })),
      apiFetch<{ bookings: Array<Record<string, unknown>> }>('/bookings/my').catch(() => ({
        bookings: [],
      })),
      apiFetch<{ rentals: Array<Record<string, unknown>> }>('/rentals/my').catch(() => ({
        rentals: [],
      })),
    ]).then(([o, b, r]) => {
      setOrders(o.orders);
      setBookings(b.bookings);
      setRentals(r.rentals);
      setLoading(false);
    });
  }, []);

  async function handlePayBooking(bookingId: string) {
    const res = await apiFetch<{ authorizationUrl: string }>('/payments/initialize', {
      method: 'POST',
      body: JSON.stringify({
        target_type: 'booking',
        target_id: bookingId,
        payment_type: 'full',
        callback_url: window.location.href,
      }),
    });
    window.location.href = res.authorizationUrl;
  }

  async function handleDownloadBookingZip(bookingId: string) {
    const res = await apiFetch<{ downloadUrl: string }>('/uploads/clean-link', {
      method: 'POST',
      body: JSON.stringify({
        targetType: 'booking',
        targetId: bookingId,
        photoId: 'zip',
      }),
    });
    window.open(`${API_BASE_URL.replace('/api/v1', '')}${res.downloadUrl}`, '_blank');
  }

  return (
    <div className="min-h-screen bg-icx-slate text-icx-sand">
      <AppNavbar />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-icx-sand">
              Unified Account History
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-icx-sand-muted">
              Track your photo editing orders, photographer bookings, and studio equipment
              rentals from one place (Requirement AC-08).
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/editing"
              className="rounded-xl bg-icx-sand px-4 py-2.5 text-xs font-extrabold text-icx-slate"
            >
              + New Edit Order
            </Link>
            <Link
              href="/photographers"
              className="rounded-xl border border-icx-sand/30 px-4 py-2.5 text-xs font-semibold text-icx-sand"
            >
              + Book Photographer
            </Link>
            <Link
              href="/rentals"
              className="rounded-xl border border-icx-sand/30 px-4 py-2.5 text-xs font-semibold text-icx-sand"
            >
              + Rent Gear
            </Link>
            <Link
              href="/account/security"
              className="rounded-xl border border-icx-sand/30 px-4 py-2.5 text-xs font-semibold text-icx-sand"
            >
              Security &amp; 2FA
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="text-xs text-icx-sand-muted">Loading account activity...</p>
        ) : (
          <div className="space-y-8">
            {/* 1. Photo Editing Orders */}
            <section className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <Sliders className="h-5 w-5 text-icx-sand" />
                <h2 className="text-lg font-bold text-icx-sand">
                  Photo Editing Orders ({orders.length})
                </h2>
              </div>
              {orders.length === 0 ? (
                <p className="text-xs text-icx-sand-muted">No photo editing orders yet.</p>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div
                      key={String(order.id)}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-icx-slate-border bg-icx-slate p-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-icx-sand">
                            {String(order.package_name)}
                          </span>
                          <span className="rounded bg-icx-sand/20 px-2 py-0.5 text-[10px] font-bold uppercase text-icx-sand">
                            {String(order.status).replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-icx-sand-muted">
                          {String(order.picture_count)} photos • Paid:{' '}
                          {formatNaira(String(order.amount_paid))} /{' '}
                          {formatNaira(String(order.total_amount))} ({String(order.payment_state)})
                        </p>
                      </div>
                      <Link
                        href={`/editing/${String(order.id)}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-icx-sand px-3.5 py-2 text-xs font-bold text-icx-slate self-start sm:self-center"
                      >
                        <span>Review Proofs / Download</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 2. Photographer Bookings */}
            <section className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <Camera className="h-5 w-5 text-icx-sand" />
                <h2 className="text-lg font-bold text-icx-sand">
                  Photographer Bookings ({bookings.length})
                </h2>
              </div>
              {bookings.length === 0 ? (
                <p className="text-xs text-icx-sand-muted">No photographer bookings yet.</p>
              ) : (
                <div className="space-y-3">
                  {bookings.map((b) => (
                    <div
                      key={String(b.id)}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-icx-slate-border bg-icx-slate p-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-icx-sand">
                            {String(b.service_title)} — {String(b.photographer_name)}
                          </span>
                          <span className="rounded bg-icx-sand/20 px-2 py-0.5 text-[10px] font-bold uppercase text-icx-sand">
                            {String(b.status).replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-icx-sand-muted">
                          Slot: {new Date(String(b.start_time)).toLocaleString()} • Fee:{' '}
                          {formatNaira(String(b.price))}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/bookings/${String(b.id)}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-icx-sand/40 px-3 py-2 text-xs font-semibold text-icx-sand hover:bg-icx-slate-elevated"
                        >
                          <span>View Shoot</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                        {b.status === 'awaiting_payment' && (
                          <button
                            type="button"
                            onClick={() => void handlePayBooking(String(b.id))}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-icx-sand px-3.5 py-2 text-xs font-extrabold text-icx-slate"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            <span>Pay {formatNaira(String(b.price))}</span>
                          </button>
                        )}
                        {['delivered', 'completed'].includes(String(b.status)) && (
                          <button
                            type="button"
                            onClick={() => void handleDownloadBookingZip(String(b.id))}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-icx-success px-3.5 py-2 text-xs font-extrabold text-white"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Download Clean Shoot ZIP</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 3. Equipment Rentals */}
            <section className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <PackageCheck className="h-5 w-5 text-icx-sand" />
                <h2 className="text-lg font-bold text-icx-sand">
                  Equipment Rentals ({rentals.length})
                </h2>
              </div>
              {rentals.length === 0 ? (
                <p className="text-xs text-icx-sand-muted">No equipment rentals yet.</p>
              ) : (
                <div className="space-y-3">
                  {rentals.map((r) => (
                    <div
                      key={String(r.id)}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-icx-slate-border bg-icx-slate p-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-icx-sand">
                            {String(r.item_name)} ({String(r.units)} unit[s])
                          </span>
                          <span className="rounded bg-icx-sand/20 px-2 py-0.5 text-[10px] font-bold uppercase text-icx-sand">
                            {String(r.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-icx-sand-muted">
                          Dates: {String(r.start_date).slice(0, 10)} to{' '}
                          {String(r.end_date).slice(0, 10)} • Total:{' '}
                          {formatNaira(String(r.total_amount))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

