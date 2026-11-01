'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Download,
  Lock,
  RotateCcw,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  FileArchive,
} from 'lucide-react';
import { formatNaira } from '@icx/ui-core';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { BeforeAfterSlider } from '@/components/editing/BeforeAfterSlider';
import { TusFileUploader } from '@/components/upload/TusFileUploader';
import { apiFetch } from '@/lib/api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface OrderPhotoView {
  id: string;
  version: number;
  hasEdit: boolean;
  hasPreview: boolean;
  revisions: Array<{
    id: string;
    notes: string;
    requested_at: string;
    resolved_at: string | null;
  }>;
}

interface OrderDetailResponse {
  order: {
    id: string;
    package_name: string;
    free_revisions: number;
    picture_count: number;
    total_amount: string;
    amount_paid: string;
    balance_amount: string;
    payment_state: 'unpaid' | 'deposit_paid' | 'fully_paid';
    status: string;
    due_at: string | null;
  };
  photos: OrderPhotoView[];
  canDownloadClean: boolean;
}

export default function OrderInteractiveReviewPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;

  const [data, setData] = useState<OrderDetailResponse | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [revisionNote, setRevisionNote] = useState('');
  const [submittingRevision, setSubmittingRevision] = useState(false);
  const [cleanDownloadUrl, setCleanDownloadUrl] = useState<string | null>(null);
  const [cleanExpiresAt, setCleanExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    try {
      const res = await apiFetch<OrderDetailResponse>(`/editing/orders/${orderId}`);
      setData(res);
      if (!selectedPhotoId && res.photos[0]) {
        setSelectedPhotoId(res.photos[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load order.');
    }
  }, [orderId, selectedPhotoId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const activePhoto =
    data?.photos.find((p) => p.id === selectedPhotoId) || data?.photos[0] || null;

  async function handleRequestRevision(e: React.FormEvent) {
    e.preventDefault();
    if (!activePhoto || !revisionNote.trim()) return;
    setSubmittingRevision(true);
    setError(null);

    try {
      await apiFetch(`/editing/orders/${orderId}/revisions`, {
        method: 'POST',
        body: JSON.stringify({
          photo_id: activePhoto.id,
          notes: revisionNote,
        }),
      });
      setRevisionNote('');
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit revision.');
    } finally {
      setSubmittingRevision(false);
    }
  }

  async function handlePayBalance() {
    if (!data) return;
    setError(null);
    try {
      const paymentType =
        data.order.payment_state === 'deposit_paid' ? 'balance' : 'deposit';
      const res = await apiFetch<{ authorizationUrl: string }>('/payments/initialize', {
        method: 'POST',
        body: JSON.stringify({
          target_type: 'edit_order',
          target_id: data.order.id,
          payment_type: paymentType,
          callback_url: window.location.href,
        }),
      });
      window.location.href = res.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to initialize payment.');
    }
  }

  async function handleGenerateCleanDownload(photoIdOrZip: string | 'zip') {
    if (!data) return;
    setError(null);
    try {
      const res = await apiFetch<{ downloadUrl: string; expiresAt: string }>(
        '/uploads/clean-link',
        {
          method: 'POST',
          body: JSON.stringify({
            targetType: 'edit_order',
            targetId: data.order.id,
            photoId: photoIdOrZip,
          }),
        }
      );
      const fullStreamUrl = `${API_BASE_URL.replace('/api/v1', '')}${res.downloadUrl}`;
      setCleanDownloadUrl(fullStreamUrl);
      setCleanExpiresAt(res.expiresAt);
      window.open(fullStreamUrl, '_blank');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Clean download blocked: full payment is required.'
      );
    }
  }

  return (
    <div className="min-h-screen bg-icx-slate text-icx-sand">
      <AppNavbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {error && (
          <div className="flex items-center gap-2.5 rounded-xl border border-icx-error/40 bg-icx-error/10 p-4 text-xs text-icx-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {data && (
          <>
            {/* Top Status & Payment Gate Banner */}
            <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="rounded-md bg-icx-sand px-2.5 py-0.5 text-xs font-extrabold uppercase text-icx-slate">
                    {data.order.status.replace(/_/g, ' ')}
                  </span>
                  <span className="rounded-md border border-icx-slate-border px-2.5 py-0.5 text-xs font-semibold text-icx-sand">
                    Payment: {data.order.payment_state.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-icx-sand-muted">
                    Order #{data.order.id.slice(0, 8)} • {data.order.package_name}
                  </span>
                </div>
                <h1 className="mt-2 text-xl sm:text-2xl font-bold text-icx-sand">
                  Interactive Proof Review &amp; Clean Deliverable Gate
                </h1>
                <p className="mt-1 text-xs text-icx-sand-muted">
                  Paid: {formatNaira(data.order.amount_paid)} of{' '}
                  {formatNaira(data.order.total_amount)} • Balance Remaining:{' '}
                  <strong className="text-icx-sand">
                    {formatNaira(data.order.balance_amount)}
                  </strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                {data.order.payment_state !== 'fully_paid' ? (
                  <button
                    type="button"
                    onClick={handlePayBalance}
                    className="inline-flex items-center gap-2 rounded-xl bg-icx-sand px-5 py-3 text-xs sm:text-sm font-extrabold text-icx-slate shadow-lg hover:bg-icx-sand-light"
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>
                      {data.order.payment_state === 'deposit_paid'
                        ? `Pay Remaining 30% Balance (${formatNaira(data.order.balance_amount)})`
                        : 'Complete Checkout Payment'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleGenerateCleanDownload('zip')}
                    className="inline-flex items-center gap-2 rounded-xl bg-icx-success px-5 py-3 text-xs sm:text-sm font-extrabold text-white shadow-lg hover:opacity-95"
                  >
                    <FileArchive className="h-4 w-4" />
                    <span>Download All Clean Files (24h Signed ZIP)</span>
                  </button>
                )}
              </div>
            </div>

            {cleanDownloadUrl && cleanExpiresAt && (
              <div className="rounded-xl border border-icx-success/40 bg-icx-success/10 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-icx-success font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    24-Hour HMAC-Signed Clean Link Active (Expires:{' '}
                    {new Date(cleanExpiresAt).toLocaleString()})
                  </span>
                </div>
                <a
                  href={cleanDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-bold text-icx-sand"
                >
                  Direct Stream Link
                </a>
              </div>
            )}

            {/* Main Workspace: Before/After Slider + Revision Drawer */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-5">
                {activePhoto ? (
                  <BeforeAfterSlider
                    photoId={activePhoto.id}
                    hasEdit={activePhoto.hasEdit}
                  />
                ) : (
                  <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6">
                    <h3 className="text-sm font-bold text-icx-sand mb-3">
                      Upload Photos to This Order
                    </h3>
                    <TusFileUploader
                      uploadType="order_original"
                      targetId={data.order.id}
                      maxFiles={data.order.picture_count}
                      onUploadComplete={() => void loadOrder()}
                    />
                  </div>
                )}

                {/* Photo Selector Strip */}
                {data.photos.length > 0 && (
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-2">
                    {data.photos.map((photo, index) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setSelectedPhotoId(photo.id)}
                        className={`rounded-xl border px-3.5 py-2 text-xs font-semibold shrink-0 transition-all ${
                          activePhoto?.id === photo.id
                            ? 'border-icx-sand bg-icx-sand text-icx-slate'
                            : 'border-icx-slate-border bg-icx-slate-dark text-icx-sand'
                        }`}
                      >
                        Photo #{index + 1} (v{photo.version})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Photo-Level Revision Drawer & Clean Single-File Gate */}
              <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 space-y-6 h-fit">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-icx-sand">
                    Photo Revision &amp; Clean Unlock
                  </h2>
                  {activePhoto && (
                    <p className="mt-1 text-xs text-icx-sand-muted">
                      Free Revisions Used: {activePhoto.revisions.length} /{' '}
                      {data.order.free_revisions}
                    </p>
                  )}
                </div>

                {/* Single Photo Clean Download Button (Payment-Gated PE-10) */}
                {activePhoto && (
                  <div>
                    {data.canDownloadClean ? (
                      <button
                        type="button"
                        onClick={() => handleGenerateCleanDownload(activePhoto.id)}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-icx-sand py-3 text-xs font-extrabold text-icx-slate hover:bg-icx-sand-light"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download Clean Full-Resolution Photo (24h Link)</span>
                      </button>
                    ) : (
                      <div className="rounded-xl border border-icx-warning/30 bg-icx-slate p-3.5 text-xs text-icx-sand-muted flex items-start gap-2.5">
                        <Lock className="h-4 w-4 text-icx-warning shrink-0 mt-0.5" />
                        <span>
                          Clean full-resolution files are locked in private storage until the
                          30% balance is confirmed by Paystack webhook.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Request Revision Form (PE-08) */}
                {activePhoto && (
                  <form onSubmit={handleRequestRevision} className="space-y-3 border-t border-icx-slate-border pt-5">
                    <label className="block text-xs font-semibold text-icx-sand">
                      Request Revision on Selected Photo
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={revisionNote}
                      onChange={(e) => setRevisionNote(e.target.value)}
                      placeholder="Describe specific retouching adjustments needed on this photo..."
                      className="w-full rounded-xl border border-icx-slate-border bg-icx-slate p-3 text-xs text-icx-sand focus:border-icx-sand focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={
                        submittingRevision ||
                        activePhoto.revisions.length >= data.order.free_revisions
                      }
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-icx-sand/40 bg-icx-slate py-2.5 text-xs font-bold text-icx-sand hover:bg-icx-slate-elevated disabled:opacity-40"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>
                        {activePhoto.revisions.length >= data.order.free_revisions
                          ? 'Free Revisions Exhausted'
                          : submittingRevision
                            ? 'Submitting...'
                            : 'Submit Photo Revision Request'}
                      </span>
                    </button>
                  </form>
                )}

                {/* Revision History */}
                {activePhoto && activePhoto.revisions.length > 0 && (
                  <div className="space-y-2 border-t border-icx-slate-border pt-4">
                    <h3 className="text-xs font-bold uppercase text-icx-sand-muted">
                      Revision History
                    </h3>
                    {activePhoto.revisions.map((rev) => (
                      <div
                        key={rev.id}
                        className="rounded-lg border border-icx-slate-border bg-icx-slate p-3 text-xs"
                      >
                        <p className="text-icx-sand">{rev.notes}</p>
                        <p className="mt-1 text-[10px] text-icx-sand-muted">
                          {rev.resolved_at ? 'Resolved by Editor' : 'In Revision Queue'} •{' '}
                          {new Date(rev.requested_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

