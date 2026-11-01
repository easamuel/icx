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
import { AppFooter } from '@/components/layout/AppFooter';
import { BeforeAfterSlider } from '@/components/editing/BeforeAfterSlider';
import { TusFileUploader } from '@/components/upload/TusFileUploader';
import { apiFetch } from '@/lib/api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || '/api/v1';

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
          : 'Un-watermarked master download requires full balance settlement.'
      );
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        {error && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {data && (
          <>
            {/* Top Status & Payment Gate Header */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="rounded-full bg-zinc-950 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white">
                    {data.order.status.replace(/_/g, ' ')}
                  </span>
                  <span className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-[11px] font-bold uppercase text-zinc-800">
                    Payment: {data.order.payment_state.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs font-semibold text-zinc-500">
                    Order #{data.order.id.slice(0, 8)} • {data.order.package_name}
                  </span>
                </div>
                <h1 className="mt-3 text-2xl sm:text-3xl font-black text-zinc-950">
                  Interactive Studio Proof Room
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-zinc-600">
                  Paid: <strong>{formatNaira(data.order.amount_paid)}</strong> of{' '}
                  {formatNaira(data.order.total_amount)} • Balance Remaining:{' '}
                  <strong className="text-zinc-950">
                    {formatNaira(data.order.balance_amount)}
                  </strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                {data.order.payment_state !== 'fully_paid' ? (
                  <button
                    type="button"
                    onClick={handlePayBalance}
                    className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-6 py-3.5 text-xs sm:text-sm font-black text-white shadow-xl hover:bg-zinc-800"
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>
                      {data.order.payment_state === 'deposit_paid'
                        ? `Settle Remaining Balance (${formatNaira(data.order.balance_amount)})`
                        : 'Complete Checkout Payment'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleGenerateCleanDownload('zip')}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3.5 text-xs sm:text-sm font-black text-white shadow-xl hover:bg-emerald-700"
                  >
                    <FileArchive className="h-4 w-4" />
                    <span>Download All Uncompressed Masters (24h ZIP)</span>
                  </button>
                )}
              </div>
            </div>

            {cleanDownloadUrl && cleanExpiresAt && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-emerald-800 font-bold">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    24-Hour Signed Master Link Active (Expires:{' '}
                    {new Date(cleanExpiresAt).toLocaleString()})
                  </span>
                </div>
                <a
                  href={cleanDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-black text-zinc-950"
                >
                  Open Direct Download Stream
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
                  <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm">
                    <h3 className="text-base font-black text-zinc-950 mb-4">
                      Upload Source Photographs to This Order
                    </h3>
                    <TusFileUploader
                      uploadType="order_original"
                      targetId={data.order.id}
                      maxFiles={data.order.picture_count}
                      onUploadComplete={() => void loadOrder()}
                    />
                  </div>
                )}

                {data.photos.length > 0 && (
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-2">
                    {data.photos.map((photo, index) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setSelectedPhotoId(photo.id)}
                        className={`rounded-full border px-4 py-2 text-xs font-extrabold shrink-0 transition-all ${
                          activePhoto?.id === photo.id
                            ? 'border-zinc-950 bg-zinc-950 text-white shadow'
                            : 'border-zinc-200 bg-white text-zinc-800 hover:border-zinc-950'
                        }`}
                      >
                        Frame #{index + 1} (v{photo.version})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Revision Drawer & Master Unlock */}
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-6 h-fit">
                <div>
                  <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">
                    Frame Inspection &amp; Master Unlock
                  </h2>
                  {activePhoto && (
                    <p className="mt-1 text-xs font-semibold text-zinc-600">
                      Complimentary Revisions Used: {activePhoto.revisions.length} /{' '}
                      {data.order.free_revisions}
                    </p>
                  )}
                </div>

                {activePhoto && (
                  <div>
                    {data.canDownloadClean ? (
                      <button
                        type="button"
                        onClick={() => handleGenerateCleanDownload(activePhoto.id)}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 py-3.5 text-xs font-black text-white hover:bg-zinc-800"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download Clean Full-Resolution Frame</span>
                      </button>
                    ) : (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-2.5">
                        <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          Un-watermarked full-resolution masters are locked in the studio vault until the remaining 30% balance is settled.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {activePhoto && (
                  <form
                    onSubmit={handleRequestRevision}
                    className="space-y-3 border-t border-zinc-200 pt-5"
                  >
                    <label className="block text-xs font-extrabold text-zinc-950">
                      Request Retouching Adjustment on This Frame
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={revisionNote}
                      onChange={(e) => setRevisionNote(e.target.value)}
                      placeholder="Describe specific retouching refinements needed on this frame..."
                      className="w-full rounded-2xl border border-zinc-300 bg-zinc-50 p-3.5 text-xs text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={
                        submittingRevision ||
                        activePhoto.revisions.length >= data.order.free_revisions
                      }
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-full border border-zinc-950 bg-white py-3 text-xs font-black text-zinc-950 hover:bg-zinc-950 hover:text-white disabled:opacity-40 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>
                        {activePhoto.revisions.length >= data.order.free_revisions
                          ? 'Complimentary Revisions Used'
                          : submittingRevision
                            ? 'Sending to Retoucher...'
                            : 'Submit Revision Note'}
                      </span>
                    </button>
                  </form>
                )}

                {activePhoto && activePhoto.revisions.length > 0 && (
                  <div className="space-y-2 border-t border-zinc-200 pt-4">
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
                      Revision Log
                    </h3>
                    {activePhoto.revisions.map((rev) => (
                      <div
                        key={rev.id}
                        className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs"
                      >
                        <p className="font-medium text-zinc-950">{rev.notes}</p>
                        <p className="mt-1 text-[10px] font-semibold text-zinc-500">
                          {rev.resolved_at ? 'Resolved by Retoucher' : 'In Retoucher Queue'} •{' '}
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

      <AppFooter />
    </div>
  );
}
