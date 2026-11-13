'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sliders,
  Camera,
  PackageCheck,
  CreditCard,
  Download,
  ArrowRight,
  Shield,
  Plus,
} from 'lucide-react';
import { formatNaira } from '@icx/ui-core';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { apiFetch, getStoredAccessToken, clearStoredSession } from '@/lib/api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export default function CustomerUnifiedDashboardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);
  const [bookings, setBookings] = useState<Array<Record<string, unknown>>>([]);
  const [rentals, setRentals] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      clearStoredSession();
      router.replace('/auth/login?redirect=/Dashboard');
      return;
    }

    try {
      const raw = window.localStorage.getItem('icx_user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u.role === 'photographer') {
          router.replace('/portal/photographer');
          return;
        }
        if (u.role === 'editor') {
          router.replace('/workspace/editor');
          return;
        }
        if (u.role === 'admin') {
          router.replace('/admin');
          return;
        }
      }
    } catch {
      // Ignore
    }

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
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Client Command Center
              </span>
              <h1 className="mt-1 text-3xl sm:text-4xl font-black tracking-tight text-zinc-950">
                Unified Project Studio
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-zinc-600">
                Manage your active photo retouching orders, photographer sessions, and cinema equipment rentals.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link
                href="/editing"
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-zinc-800"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Retouch Order</span>
              </Link>
              <Link
                href="/photographers"
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-xs font-bold text-zinc-900 hover:border-zinc-950"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Book Photographer</span>
              </Link>
              <Link
                href="/rentals"
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-xs font-bold text-zinc-900 hover:border-zinc-950"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Rent Gear</span>
              </Link>
              <Link
                href="/account/security"
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-xs font-bold text-zinc-900 hover:border-zinc-950"
              >
                <Shield className="h-3.5 w-3.5" />
                <span>Security &amp; 2FA</span>
              </Link>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5">
              <div className="text-xs font-bold text-zinc-500">Photo Retouching Orders</div>
              <div className="mt-2 text-3xl font-black text-zinc-950">{orders.length}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5">
              <div className="text-xs font-bold text-zinc-500">Photographer Shoot Bookings</div>
              <div className="mt-2 text-3xl font-black text-zinc-950">{bookings.length}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5">
              <div className="text-xs font-bold text-zinc-500">Cinema Gear Reservations</div>
              <div className="mt-2 text-3xl font-black text-zinc-950">{rentals.length}</div>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        {loading ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-12 text-center text-xs font-semibold text-zinc-500">
            Loading your studio activity...
          </div>
        ) : (
          <div className="space-y-8">
            {/* 1. Photo Editing Orders */}
            <section className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 text-white">
                    <Sliders className="h-4 w-4" />
                  </div>
                  <h2 className="text-lg font-black text-zinc-950">
                    Photo Retouching Orders ({orders.length})
                  </h2>
                </div>
                <Link
                  href="/editing"
                  className="text-xs font-extrabold text-zinc-950 underline"
                >
                  Start New Order →
                </Link>
              </div>
              {orders.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  No photo retouching orders yet. Launch the retouching wizard to upload your first batch.
                </p>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div
                      key={String(order.id)}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-5"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-zinc-950">
                            {String(order.package_name)}
                          </span>
                          <span className="rounded-full bg-zinc-950 px-2.5 py-0.5 text-[10px] font-black uppercase text-white">
                            {String(order.status).replace(/_/g, ' ')}
                          </span>
                          <span className="rounded-full border border-zinc-300 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase text-zinc-700">
                            {String(order.payment_state).replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs font-medium text-zinc-600">
                          {String(order.picture_count)} frames • Paid:{' '}
                          <strong>{formatNaira(String(order.amount_paid))}</strong> of{' '}
                          {formatNaira(String(order.total_amount))}
                        </p>
                      </div>
                      <Link
                        href={`/editing/${String(order.id)}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-2.5 text-xs font-black text-white self-start sm:self-center hover:bg-zinc-800"
                      >
                        <span>Inspect Proofs &amp; Download</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 2. Photographer Bookings */}
            <section className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 text-white">
                    <Camera className="h-4 w-4" />
                  </div>
                  <h2 className="text-lg font-black text-zinc-950">
                    Photographer Bookings ({bookings.length})
                  </h2>
                </div>
                <Link
                  href="/photographers"
                  className="text-xs font-extrabold text-zinc-950 underline"
                >
                  Browse Roster →
                </Link>
              </div>
              {bookings.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  No photographer bookings yet. Explore our verified Lagos &amp; Abuja photographers to lock a slot.
                </p>
              ) : (
                <div className="space-y-3">
                  {bookings.map((b) => (
                    <div
                      key={String(b.id)}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-5"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-zinc-950">
                            {String(b.service_title)} — {String(b.photographer_name)}
                          </span>
                          <span className="rounded-full bg-zinc-950 px-2.5 py-0.5 text-[10px] font-black uppercase text-white">
                            {String(b.status).replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs font-medium text-zinc-600">
                          Session:{' '}
                          {b.start_time
                            ? `${new Date(String(b.start_time)).toLocaleDateString('en-NG', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })} • ${new Date(String(b.start_time)).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}${
                                b.end_time
                                  ? ` – ${new Date(String(b.end_time)).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}`
                                  : ''
                              }`
                            : b.booking_date
                            ? `${new Date(String(b.booking_date)).toLocaleDateString('en-NG', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                timeZone: 'UTC',
                              })}${b.time_period ? ` • ${String(b.time_period)}` : ''}`
                            : 'Schedule pending confirmation'}{' '}
                          • Fee: <strong>{formatNaira(String(b.price))}</strong>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/bookings/${String(b.id)}`}
                          className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-bold text-zinc-950 hover:border-zinc-950"
                        >
                          <span>Open Session</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                        {b.status === 'awaiting_payment' && (
                          <button
                            type="button"
                            onClick={() => void handlePayBooking(String(b.id))}
                            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-2 text-xs font-black text-white"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            <span>Pay {formatNaira(String(b.price))}</span>
                          </button>
                        )}
                        {['delivered', 'completed'].includes(String(b.status)) && (
                          <button
                            type="button"
                            onClick={() => void handleDownloadBookingZip(String(b.id))}
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Download Clean ZIP</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 3. Equipment Rentals */}
            <section className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 text-white">
                    <PackageCheck className="h-4 w-4" />
                  </div>
                  <h2 className="text-lg font-black text-zinc-950">
                    Cinema &amp; Lighting Gear Rentals ({rentals.length})
                  </h2>
                </div>
                <Link
                  href="/rentals"
                  className="text-xs font-extrabold text-zinc-950 underline"
                >
                  Open Gear Vault →
                </Link>
              </div>
              {rentals.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  No equipment rentals yet. Reserve RED, Hasselblad, Sony, or Profoto kits from our vault.
                </p>
              ) : (
                <div className="space-y-3">
                  {rentals.map((r) => (
                    <div
                      key={String(r.id)}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-5"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-zinc-950">
                            {String(r.item_name)} ({String(r.units)} unit[s])
                          </span>
                          <span className="rounded-full bg-zinc-950 px-2.5 py-0.5 text-[10px] font-black uppercase text-white">
                            {String(r.status)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs font-medium text-zinc-600">
                          Dates: {String(r.start_date).slice(0, 10)} →{' '}
                          {String(r.end_date).slice(0, 10)} • Total:{' '}
                          <strong>{formatNaira(String(r.total_amount))}</strong>
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

      <AppFooter />
    </div>
  );
}
