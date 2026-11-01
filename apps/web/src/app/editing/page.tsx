'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, RotateCcw, CreditCard, ShieldCheck, AlertCircle } from 'lucide-react';
import { formatNaira } from '@icx/ui-core';
import type { EditPackageRecord, EditOrderRecord } from '@icx/shared-types';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { TusFileUploader } from '@/components/upload/TusFileUploader';
import { apiFetch, ApiError } from '@/lib/api';

export default function PhotoEditingOrderWizardPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<EditPackageRecord[]>([]);
  const [depositPercentage, setDepositPercentage] = useState(70);
  const [selectedPkgId, setSelectedPkgId] = useState<string>('');
  const [pictureCount, setPictureCount] = useState<number>(5);
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
        if (res.packages[0]) {
          setSelectedPkgId(res.packages[0].id);
        }
      })
      .catch(() => {
        setError('Unable to load editing packages. Ensure the ICX API server is running.');
      });
  }, []);

  const selectedPkg = packages.find((p) => p.id === selectedPkgId);
  const totalAmountKobo = selectedPkg
    ? Number(selectedPkg.price_per_picture) * pictureCount
    : 0;
  const depositAmountKobo = Math.round((totalAmountKobo * depositPercentage) / 100);
  const dueNowKobo = paymentOption === 'deposit' ? depositAmountKobo : totalAmountKobo;

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
      setError(err instanceof Error ? err.message : 'Failed to create editing order.');
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
    <div className="min-h-screen bg-icx-slate text-icx-sand">
      <AppNavbar />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-icx-sand">
            Order Studio Photo Editing
          </h1>
          <p className="mt-1 text-sm text-icx-sand-muted">
            Choose a package, upload up to 100 RAW/TIFF/HEIC/JPG files (50MB each) with
            resumable TUS transfer, and pay a {depositPercentage}% deposit or 100% upfront.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-icx-error/40 bg-icx-error/10 p-4 text-xs text-icx-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!createdOrder ? (
          <form onSubmit={handleCreateOrderStep} className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Left 2 Columns: Package Cards & Configuration */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-icx-sand">
                  1. Select Retouching Package
                </h2>
                <div className="mt-3 grid grid-cols-1 gap-4">
                  {packages.map((pkg) => {
                    const selected = pkg.id === selectedPkgId;
                    return (
                      <div
                        key={pkg.id}
                        onClick={() => setSelectedPkgId(pkg.id)}
                        className={`cursor-pointer rounded-2xl border p-5 transition-all ${
                          selected
                            ? 'border-icx-sand bg-icx-slate-elevated shadow-lg'
                            : 'border-icx-slate-border bg-icx-slate-dark hover:border-icx-sand/40'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                                selected
                                  ? 'border-icx-sand bg-icx-sand text-icx-slate'
                                  : 'border-icx-sand-muted'
                              }`}
                            >
                              {selected && <Check className="h-3.5 w-3.5" />}
                            </span>
                            <h3 className="text-base font-bold text-icx-sand">{pkg.name}</h3>
                          </div>
                          <span className="rounded-lg bg-icx-sand px-3 py-1 text-xs font-extrabold text-icx-slate">
                            {formatNaira(pkg.price_per_picture)} / photo
                          </span>
                        </div>

                        <p className="mt-2.5 text-xs text-icx-sand-muted leading-relaxed">
                          {pkg.description}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-icx-sand">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-icx-sand-muted" />
                            <span>{pkg.turnaround_hours}h Turnaround</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <RotateCcw className="h-3.5 w-3.5 text-icx-sand-muted" />
                            <span>{pkg.free_revisions} Free Revisions / Photo</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 space-y-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-icx-sand">
                  2. Picture Count &amp; Creative Brief
                </h2>

                <div>
                  <label className="block text-xs font-semibold text-icx-sand">
                    Number of Pictures (1 – 100 files)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={pictureCount}
                    onChange={(e) =>
                      setPictureCount(Math.min(100, Math.max(1, Number(e.target.value) || 1)))
                    }
                    className="mt-1.5 w-full sm:w-48 rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2.5 text-sm font-bold text-icx-sand focus:border-icx-sand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-icx-sand">
                    Retouching Notes &amp; Color Reference Instructions
                  </label>
                  <textarea
                    rows={3}
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="Specify skin tone preferences, crop ratios, background cleanup details..."
                    className="mt-1.5 w-full rounded-xl border border-icx-slate-border bg-icx-slate p-3.5 text-sm text-icx-sand placeholder-icx-sand-muted/50 focus:border-icx-sand focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Live Price Preview & Payment Option (PE-03, PE-04) */}
            <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 h-fit space-y-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-icx-sand">
                3. Payment Option &amp; Summary
              </h2>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentOption('deposit')}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    paymentOption === 'deposit'
                      ? 'border-icx-sand bg-icx-sand text-icx-slate'
                      : 'border-icx-slate-border bg-icx-slate text-icx-sand'
                  }`}
                >
                  <div className="text-xs font-bold">{depositPercentage}% Deposit</div>
                  <div className="text-[11px] opacity-80">
                    Pay {100 - depositPercentage}% after review
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentOption('full')}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    paymentOption === 'full'
                      ? 'border-icx-sand bg-icx-sand text-icx-slate'
                      : 'border-icx-slate-border bg-icx-slate text-icx-sand'
                  }`}
                >
                  <div className="text-xs font-bold">100% Upfront</div>
                  <div className="text-[11px] opacity-80">Instant clean unlock</div>
                </button>
              </div>

              <div className="space-y-2.5 border-t border-icx-slate-border pt-4 text-xs">
                <div className="flex justify-between text-icx-sand-muted">
                  <span>Package Rate</span>
                  <span>
                    {selectedPkg ? formatNaira(selectedPkg.price_per_picture) : '₦0'} ×{' '}
                    {pictureCount}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-icx-sand">
                  <span>Order Total</span>
                  <span>{formatNaira(totalAmountKobo)}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-icx-success pt-2 border-t border-icx-slate-border">
                  <span>Due at Checkout</span>
                  <span>{formatNaira(dueNowKobo)}</span>
                </div>
                {paymentOption === 'deposit' && (
                  <div className="flex justify-between text-[11px] text-icx-sand-muted">
                    <span>Remaining Balance (After Preview)</span>
                    <span>{formatNaira(totalAmountKobo - dueNowKobo)}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !selectedPkgId}
                className="w-full rounded-xl bg-icx-sand py-3.5 text-sm font-extrabold text-icx-slate shadow-lg hover:bg-icx-sand-light disabled:opacity-50 transition-colors"
              >
                {loading ? 'Initializing Order...' : 'Continue to Upload Photos'}
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: Resumable TUS Photo Upload + Paystack Checkout Trigger */
          <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-icx-slate-border pb-5">
              <div>
                <span className="text-xs uppercase tracking-wider text-icx-success font-bold">
                  Order #{createdOrder.id.slice(0, 8)} Created
                </span>
                <h2 className="text-xl font-bold text-icx-sand mt-1">
                  Upload Your Source Photos ({uploadedPhotoIds.length} / {createdOrder.picture_count})
                </h2>
              </div>
              <div className="text-right">
                <div className="text-xs text-icx-sand-muted">Checkout Amount</div>
                <div className="text-lg font-extrabold text-icx-sand">
                  {formatNaira(dueNowKobo)}
                </div>
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

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-icx-slate-border pt-6">
              <div className="flex items-center gap-2 text-xs text-icx-sand-muted">
                <ShieldCheck className="h-4 w-4 text-icx-success shrink-0" />
                <span>
                  Your order enters the active editing queue immediately once Paystack confirms
                  your payment via verified webhook.
                </span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => router.push(`/editing/${createdOrder.id}`)}
                  className="flex-1 sm:flex-initial rounded-xl border border-icx-slate-border px-4 py-3 text-xs font-semibold text-icx-sand hover:bg-icx-slate"
                >
                  View Order Page
                </button>
                <button
                  type="button"
                  onClick={handleProceedToPaystack}
                  disabled={loading}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-icx-sand px-6 py-3 text-xs sm:text-sm font-extrabold text-icx-slate shadow-lg hover:bg-icx-sand-light"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Pay {formatNaira(dueNowKobo)} via Paystack</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

