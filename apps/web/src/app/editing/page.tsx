'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  Clock,
  RotateCcw,
  CreditCard,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { formatNaira } from '@icx/ui-core';
import type { EditPackageRecord, EditOrderRecord } from '@icx/shared-types';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { TusFileUploader } from '@/components/upload/TusFileUploader';
import { apiFetch, ApiError } from '@/lib/api';

const QUICK_COUNTS = [5, 10, 25, 50, 100];

const BRIEF_TAGS = [
  'Preserve natural skin pores & texture',
  'Warm editorial skin tone calibration',
  'Remove flyaway hairs & sensor dust',
  'Clean studio backdrop creases',
  'Dodge & burn facial contour sculpting',
  'Match color grade across entire batch',
];

export default function PhotoEditingOrderWizardPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<EditPackageRecord[]>([]);
  const [depositPercentage, setDepositPercentage] = useState(70);
  const [selectedPkgId, setSelectedPkgId] = useState<string>('');
  const [pictureCount, setPictureCount] = useState<number>(10);
  const [paymentOption, setPaymentOption] = useState<'deposit' | 'full'>('deposit');
  const [customerNotes, setCustomerNotes] = useState('');
  const [createdOrder, setCreatedOrder] = useState<EditOrderRecord | null>(null);
  const [uploadedPhotoIds, setUploadedPhotoIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ packages: EditPackageRecord[]; depositPercentage: number }>(
      '/editing/packages'
    )
      .then((res) => {
        setPackages(res.packages);
        setDepositPercentage(res.depositPercentage || 70);
        if (res.packages[1]) {
          setSelectedPkgId(res.packages[1].id);
        } else if (res.packages[0]) {
          setSelectedPkgId(res.packages[0].id);
        }
      })
      .catch(() => {
        setError('Unable to load retouching packages. Please refresh the page.');
      });
  }, []);

  const selectedPkg = packages.find((p) => p.id === selectedPkgId);
  const totalAmountKobo = selectedPkg
    ? Number(selectedPkg.price_per_picture) * pictureCount
    : 0;
  const depositAmountKobo = Math.round((totalAmountKobo * depositPercentage) / 100);
  const dueNowKobo = paymentOption === 'deposit' ? depositAmountKobo : totalAmountKobo;

  function appendBriefTag(tag: string) {
    setCustomerNotes((prev) =>
      prev.includes(tag) ? prev : prev ? `${prev.trim()} • ${tag}` : tag
    );
  }

  async function handleCreateOrderStep(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch<{ order: EditOrderRecord }>('/editing/orders', {
        method: 'POST',
        body: JSON.stringify({
          package_id: selectedPkgId,
          picture_count: pictureCount,
          payment_option: paymentOption,
          customer_notes: customerNotes,
        }),
      });
      setCreatedOrder(res.order);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/auth/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to create retouching order.');
    } finally {
      setLoading(false);
    }
  }

  async function handleProceedToPaystack() {
    if (!createdOrder) return;
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch<{
        authorizationUrl: string;
        reference: string;
      }>('/payments/initialize', {
        method: 'POST',
        body: JSON.stringify({
          target_type: 'edit_order',
          target_id: createdOrder.id,
          payment_type: paymentOption,
          callback_url: `${window.location.origin}/editing/${createdOrder.id}`,
        }),
      });

      window.location.href = res.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment initialization failed.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      {/* Studio Header Banner */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                <Sparkles className="h-3 w-3" />
                <span>Post-Production Suite</span>
              </span>
              <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-zinc-950">
                Commission Studio Photo Retouching
              </h1>
              <p className="mt-2 max-w-2xl text-xs sm:text-sm text-zinc-600 leading-relaxed">
                Select your retouching tier, specify your frame count and color direction, and upload uncompressed files up to 50 MB each. Start with a {depositPercentage}% deposit and settle the balance after inspecting watermarked proofs.
              </p>
            </div>

            {/* Step Progress Indicator */}
            <div className="flex items-center gap-2 text-xs font-bold">
              <span
                className={`rounded-full px-3.5 py-1.5 ${
                  !createdOrder
                    ? 'bg-zinc-950 text-white'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                01. Package &amp; Brief
              </span>
              <span className="text-zinc-300">→</span>
              <span
                className={`rounded-full px-3.5 py-1.5 ${
                  createdOrder
                    ? 'bg-zinc-950 text-white'
                    : 'border border-zinc-200 bg-zinc-100 text-zinc-500'
                }`}
              >
                02. Upload &amp; Checkout
              </span>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!createdOrder ? (
          <form onSubmit={handleCreateOrderStep} className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left 8 Columns: Package Selection & Creative Brief */}
            <div className="lg:col-span-8 space-y-8">
              {/* Section 1: Retouching Tier */}
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">
                    Step 01 — Choose Retouching Standard
                  </h2>
                  <span className="text-xs font-semibold text-zinc-500">
                    All tiers include color-calibrated proofing
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {packages.map((pkg, idx) => {
                    const selected = pkg.id === selectedPkgId;
                    return (
                      <div
                        key={pkg.id}
                        onClick={() => setSelectedPkgId(pkg.id)}
                        className={`cursor-pointer rounded-2xl border-2 p-6 transition-all ${
                          selected
                            ? 'border-zinc-950 bg-zinc-950 text-white shadow-xl'
                            : 'border-zinc-200 bg-white text-zinc-950 hover:border-zinc-400'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                                selected
                                  ? 'border-white bg-white text-zinc-950'
                                  : 'border-zinc-300 bg-zinc-100'
                              }`}
                            >
                              {selected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-base sm:text-lg font-black">
                                  {pkg.name}
                                </h3>
                                {idx === 1 && (
                                  <span
                                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                                      selected
                                        ? 'bg-emerald-400 text-zinc-950'
                                        : 'bg-zinc-950 text-white'
                                    }`}
                                  >
                                    Most Popular
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div
                            className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-black ${
                              selected
                                ? 'bg-white text-zinc-950'
                                : 'bg-zinc-100 text-zinc-950'
                            }`}
                          >
                            {formatNaira(pkg.price_per_picture)} / photo
                          </div>
                        </div>

                        <p
                          className={`mt-3 text-xs sm:text-sm leading-relaxed ${
                            selected ? 'text-zinc-300' : 'text-zinc-600'
                          }`}
                        >
                          {pkg.description}
                        </p>

                        <div
                          className={`mt-5 pt-4 border-t flex flex-wrap items-center gap-6 text-xs font-bold ${
                            selected
                              ? 'border-zinc-800 text-zinc-200'
                              : 'border-zinc-100 text-zinc-700'
                          }`}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{pkg.turnaround_hours}-Hour Delivery SLA</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>{pkg.free_revisions} Complimentary Revisions / Frame</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5" />
                            <span>Non-Destructive Skin &amp; Color Mastering</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Frame Count & Creative Direction */}
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
                <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">
                  Step 02 — Frame Quantity &amp; Creative Direction
                </h2>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-extrabold text-zinc-950">
                      Number of Photographs to Retouch (1 – 100 Frames)
                    </label>
                    <span className="rounded-xl bg-zinc-950 px-3.5 py-1 text-sm font-black text-white">
                      {pictureCount} {pictureCount === 1 ? 'Photo' : 'Photos'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {QUICK_COUNTS.map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setPictureCount(cnt)}
                        className={`rounded-xl border px-3.5 py-2 text-xs font-extrabold transition-all ${
                          pictureCount === cnt
                            ? 'border-zinc-950 bg-zinc-950 text-white'
                            : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-950'
                        }`}
                      >
                        {cnt} Photos
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={100}
                      required
                      value={pictureCount}
                      aria-label="Custom number of pictures"
                      onChange={(e) =>
                        setPictureCount(Math.min(100, Math.max(1, Number(e.target.value) || 1)))
                      }
                      className="w-28 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-black text-zinc-950 focus:border-zinc-950 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-3 border-t border-zinc-100 pt-5">
                  <label className="block text-sm font-extrabold text-zinc-950">
                    Retoucher Creative Brief &amp; Color Instructions
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {BRIEF_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => appendBriefTag(tag)}
                        className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:border-zinc-950 hover:bg-zinc-950 hover:text-white transition-colors"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={4}
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="Add specific instructions for our colorists and retouchers (e.g., maintain natural skin texture, match editorial reference, crop 4:5 for print)..."
                    className="w-full rounded-2xl border border-zinc-300 bg-zinc-50/50 p-4 text-sm text-zinc-950 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Right 4 Columns: Sticky Live Invoice & Payment Option */}
            <div className="lg:col-span-4">
              <div className="sticky top-24 rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-lg space-y-6">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Live Studio Estimate
                  </span>
                  <h2 className="mt-1 text-xl font-black text-zinc-950">
                    Payment Schedule
                  </h2>
                </div>

                {/* Split Deposit vs Full Upfront Toggle */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentOption('deposit')}
                    className={`rounded-2xl border-2 p-3.5 text-left transition-all ${
                      paymentOption === 'deposit'
                        ? 'border-zinc-950 bg-zinc-950 text-white'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-900 hover:border-zinc-400'
                    }`}
                  >
                    <div className="text-xs font-black">{depositPercentage}% Deposit</div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        paymentOption === 'deposit' ? 'text-zinc-300' : 'text-zinc-500'
                      }`}
                    >
                      {100 - depositPercentage}% after proof review
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentOption('full')}
                    className={`rounded-2xl border-2 p-3.5 text-left transition-all ${
                      paymentOption === 'full'
                        ? 'border-zinc-950 bg-zinc-950 text-white'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-900 hover:border-zinc-400'
                    }`}
                  >
                    <div className="text-xs font-black">100% Upfront</div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        paymentOption === 'full' ? 'text-zinc-300' : 'text-zinc-500'
                      }`}
                    >
                      Instant master unlock
                    </div>
                  </button>
                </div>

                {/* Price Breakdown */}
                <div className="space-y-3 border-t border-zinc-200 pt-5 text-xs">
                  <div className="flex justify-between text-zinc-600">
                    <span>Selected Tier</span>
                    <span className="font-bold text-zinc-950">
                      {selectedPkg?.name || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Unit Rate × Quantity</span>
                    <span className="font-bold text-zinc-950">
                      {selectedPkg ? formatNaira(selectedPkg.price_per_picture) : '₦0'} ×{' '}
                      {pictureCount}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Gross Project Total</span>
                    <span className="font-bold text-zinc-950">
                      {formatNaira(totalAmountKobo)}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between border-t border-zinc-200 pt-4">
                    <span className="text-sm font-extrabold text-zinc-950">
                      Due Now at Checkout
                    </span>
                    <span className="text-2xl font-black text-zinc-950">
                      {formatNaira(dueNowKobo)}
                    </span>
                  </div>

                  {paymentOption === 'deposit' && (
                    <div className="flex justify-between rounded-xl bg-zinc-100 px-3 py-2 text-[11px] font-semibold text-zinc-700">
                      <span>Balance Due After Proof Review</span>
                      <span>{formatNaira(totalAmountKobo - dueNowKobo)}</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !selectedPkgId}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 py-4 text-sm font-black text-white shadow-xl hover:bg-zinc-800 disabled:opacity-50 transition-all"
                >
                  <span>
                    {loading ? 'Creating Studio Order...' : 'Continue to File Upload'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="flex items-start gap-2 text-[11px] text-zinc-500 leading-relaxed">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Files are stored in isolated private studio vaults and never exposed on public URLs.
                  </span>
                </div>
              </div>
            </div>
          </form>
        ) : (
          /* Step 02: Resumable File Transfer & Paystack Checkout */
          <div className="mx-auto max-w-4xl rounded-3xl border border-zinc-200 bg-white p-6 sm:p-10 shadow-lg space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-6">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                  Order #{createdOrder.id.slice(0, 8)} Initialized
                </span>
                <h2 className="mt-2 text-2xl font-black text-zinc-950">
                  Upload Your Source Photographs ({uploadedPhotoIds.length} /{' '}
                  {createdOrder.picture_count})
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Drop your RAW/TIFF/HEIC/JPG files below, then complete Paystack checkout to dispatch your order to our senior retouchers.
                </p>
              </div>
              <div className="rounded-2xl bg-zinc-950 px-5 py-3 text-right text-white">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Amount Due Now
                </div>
                <div className="text-xl font-black">{formatNaira(dueNowKobo)}</div>
              </div>
            </div>

            <TusFileUploader
              uploadType="order_original"
              targetId={createdOrder.id}
              maxFiles={createdOrder.picture_count}
              onUploadComplete={(ids) =>
                setUploadedPhotoIds((prev) => Array.from(new Set([...prev, ...ids])))
              }
            />

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-zinc-200 pt-6">
              <div className="flex items-center gap-2 text-xs text-zinc-600">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  Retouching begins immediately once Paystack confirms your payment.
                </span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => router.push(`/editing/${createdOrder.id}`)}
                  className="flex-1 sm:flex-initial rounded-full border border-zinc-300 px-5 py-3.5 text-xs font-bold text-zinc-900 hover:border-zinc-950"
                >
                  Open Proof Room
                </button>
                <button
                  type="button"
                  onClick={handleProceedToPaystack}
                  disabled={loading}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 px-7 py-3.5 text-xs sm:text-sm font-black text-white shadow-xl hover:bg-zinc-800"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Pay {formatNaira(dueNowKobo)} via Paystack</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <AppFooter />
    </div>
  );
}
