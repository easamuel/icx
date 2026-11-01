'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Download,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sliders,
} from 'lucide-react';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { TusFileUploader } from '@/components/upload/TusFileUploader';
import { apiFetch, getStoredAccessToken } from '@/lib/api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || '/api/v1';

interface EditorJobSummary {
  id: string;
  package_name: string;
  package_description: string;
  turnaround_hours: number;
  free_revisions: number;
  picture_count: number;
  status: string;
  assignee_id: string | null;
  customer_notes: string | null;
  due_at: string | null;
  uploaded_count: number;
  edited_count: number;
  open_revisions_count: number;
}

interface EditorJobPhoto {
  id: string;
  version: number;
  has_edit: boolean;
  has_preview: boolean;
  originalDownloadUrl: string;
  revisions: Array<{
    id: string;
    notes: string;
    requested_at: string;
    resolved_at: string | null;
  }>;
}

export default function EditorWorkspacePage() {
  const [jobs, setJobs] = useState<EditorJobSummary[]>([]);
  const [selectedJob, setSelectedJob] = useState<EditorJobSummary | null>(null);
  const [photos, setPhotos] = useState<EditorJobPhoto[]>([]);
  const [activePhotoUploadId, setActivePhotoUploadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const res = await apiFetch<{ jobs: EditorJobSummary[] }>('/editor/jobs');
      setJobs(res.jobs);
      if (res.jobs[0] && !selectedJob) {
        void loadJobDetail(res.jobs[0].id);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Sign in with a Senior Retoucher or Admin account to access the Production Queue.'
      );
    }
  }, [selectedJob]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  async function loadJobDetail(orderId: string) {
    setError(null);
    try {
      const res = await apiFetch<{
        job: EditorJobSummary;
        photos: EditorJobPhoto[];
      }>(`/editor/jobs/${orderId}`);
      setSelectedJob(res.job);
      setPhotos(res.photos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load job details.');
    }
  }

  async function handleClaimJob(orderId: string) {
    try {
      await apiFetch(`/editor/jobs/${orderId}/claim`, { method: 'POST' });
      await loadQueue();
      await loadJobDetail(orderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim job.');
    }
  }

  async function handleDownloadOriginal(photoId: string) {
    const token = getStoredAccessToken();
    const res = await fetch(`${API_BASE_URL}/uploads/editor-original/${photoId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      setError('Unable to stream original file.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ICX_Original_${photoId.slice(0, 8)}.jpg`;
    a.click();
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
              <Sliders className="h-3 w-3" />
              <span>Color &amp; Retouching Suite</span>
            </span>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-zinc-950">
              Senior Retoucher Production Queue
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-600">
              Download uncompressed client originals, upload finished masters, and resolve frame-level revision notes.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800">
            <ShieldCheck className="h-4 w-4" />
            <span>Client PII &amp; Financial Isolation Active</span>
          </div>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left Column: Active Editing Jobs */}
          <div className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Active &amp; Unclaimed Queue ({jobs.length})
            </h2>
            {jobs.map((job) => {
              const active = selectedJob?.id === job.id;
              return (
                <div
                  key={job.id}
                  onClick={() => void loadJobDetail(job.id)}
                  className={`cursor-pointer rounded-3xl border-2 p-5 transition-all ${
                    active
                      ? 'border-zinc-950 bg-zinc-950 text-white shadow-xl'
                      : 'border-zinc-200 bg-white text-zinc-950 hover:border-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black">
                      Job #{job.id.slice(0, 8)} — {job.package_name}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                        active ? 'bg-white text-zinc-950' : 'bg-zinc-950 text-white'
                      }`}
                    >
                      {job.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p
                    className={`mt-2 text-xs font-medium ${
                      active ? 'text-zinc-300' : 'text-zinc-600'
                    }`}
                  >
                    Frames: {job.edited_count} / {job.uploaded_count} mastered • Open Revisions:{' '}
                    <strong className={active ? 'text-amber-300' : 'text-amber-700'}>
                      {job.open_revisions_count}
                    </strong>
                  </p>
                </div>
              );
            })}
          </div>

          {/* Right 2 Columns: Selected Job Originals, Revisions & Master Uploader */}
          {selectedJob && (
            <div className="lg:col-span-2 rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-zinc-950" />
                    <h2 className="text-xl font-black text-zinc-950">
                      Job #{selectedJob.id.slice(0, 8)} • {selectedJob.package_name}
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">
                    Client Brief: {selectedJob.customer_notes || 'Standard studio retouching specifications'}
                  </p>
                </div>

                {!selectedJob.assignee_id && (
                  <button
                    type="button"
                    onClick={() => void handleClaimJob(selectedJob.id)}
                    className="rounded-full bg-zinc-950 px-5 py-2.5 text-xs font-black text-white shadow"
                  >
                    Claim Job &amp; Start Retouching
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-black text-zinc-950">
                          Frame #{index + 1} (Version {photo.version})
                        </span>
                        {photo.has_edit && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Master Uploaded &amp; Watermarked</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleDownloadOriginal(photo.id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-bold text-zinc-900 hover:border-zinc-950"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Download Source</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setActivePhotoUploadId(
                              activePhotoUploadId === photo.id ? null : photo.id
                            )
                          }
                          className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-black text-white"
                        >
                          {photo.has_edit ? 'Upload New Revision' : 'Upload Finished Master'}
                        </button>
                      </div>
                    </div>

                    {photo.revisions.length > 0 && (
                      <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs">
                        <span className="font-black uppercase text-[10px] text-amber-800">
                          Client Revision Notes:
                        </span>
                        {photo.revisions.map((r) => (
                          <p key={r.id} className="text-zinc-900 font-medium">
                            • {r.notes}{' '}
                            <span className="text-[10px] text-zinc-500">
                              ({r.resolved_at ? 'Resolved' : 'Pending'})
                            </span>
                          </p>
                        ))}
                      </div>
                    )}

                    {activePhotoUploadId === photo.id && (
                      <div className="pt-2">
                        <TusFileUploader
                          uploadType="editor_edit"
                          targetId={selectedJob.id}
                          photoId={photo.id}
                          maxFiles={1}
                          onUploadComplete={() => {
                            setActivePhotoUploadId(null);
                            void loadJobDetail(selectedJob.id);
                            void loadQueue();
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
