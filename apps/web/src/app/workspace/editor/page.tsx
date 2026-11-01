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
import { TusFileUploader } from '@/components/upload/TusFileUploader';
import { apiFetch, getStoredAccessToken } from '@/lib/api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

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
          : 'Sign in with an Editor or Admin account to access the Editor Workspace.'
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
    <div className="min-h-screen bg-icx-slate text-icx-sand">
      <AppNavbar />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-icx-sand">
              Retoucher &amp; Editor Production Queue
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-icx-sand-muted">
              Download customer originals, upload finished edits (server automatically burns
              1,200px watermarked proofs), and resolve photo revisions.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-icx-success/40 bg-icx-slate-dark px-3.5 py-2 text-xs text-icx-success">
            <ShieldCheck className="h-4 w-4" />
            <span>Zero Customer PII / Financial Data Exposed</span>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-icx-error/40 bg-icx-error/10 p-4 text-xs text-icx-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left Column: Active Editing Jobs */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-icx-sand">
              Assigned &amp; Unclaimed Queue ({jobs.length})
            </h2>
            {jobs.map((job) => {
              const active = selectedJob?.id === job.id;
              return (
                <div
                  key={job.id}
                  onClick={() => void loadJobDetail(job.id)}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                    active
                      ? 'border-icx-sand bg-icx-slate-elevated shadow-lg'
                      : 'border-icx-slate-border bg-icx-slate-dark hover:border-icx-sand/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-icx-sand">
                      Job #{job.id.slice(0, 8)} — {job.package_name}
                    </span>
                    <span className="rounded bg-icx-sand px-2 py-0.5 text-[10px] font-extrabold uppercase text-icx-slate">
                      {job.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-icx-sand-muted">
                    Photos: {job.edited_count} / {job.uploaded_count} edited • Open Revisions:{' '}
                    <strong className="text-icx-warning">{job.open_revisions_count}</strong>
                  </p>
                </div>
              );
            })}
          </div>

          {/* Right 2 Columns: Selected Job Originals, Revisions & Edit Uploader */}
          {selectedJob && (
            <div className="lg:col-span-2 rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-icx-slate-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-icx-sand" />
                    <h2 className="text-lg font-bold text-icx-sand">
                      Job #{selectedJob.id.slice(0, 8)} • {selectedJob.package_name}
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-icx-sand-muted">
                    Brief: {selectedJob.customer_notes || 'Standard package retouching specs'}
                  </p>
                </div>

                {!selectedJob.assignee_id && (
                  <button
                    type="button"
                    onClick={() => void handleClaimJob(selectedJob.id)}
                    className="rounded-xl bg-icx-sand px-4 py-2 text-xs font-extrabold text-icx-slate"
                  >
                    Claim Job &amp; Start Editing
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="rounded-xl border border-icx-slate-border bg-icx-slate p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-icx-sand">
                          Photo #{index + 1} (Version {photo.version})
                        </span>
                        {photo.has_edit && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold text-icx-success">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Edit Uploaded &amp; Watermarked</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleDownloadOriginal(photo.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-icx-sand/40 px-3 py-1.5 text-xs font-semibold text-icx-sand hover:bg-icx-slate-elevated"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Download Original</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setActivePhotoUploadId(
                              activePhotoUploadId === photo.id ? null : photo.id
                            )
                          }
                          className="rounded-lg bg-icx-sand px-3 py-1.5 text-xs font-extrabold text-icx-slate"
                        >
                          {photo.has_edit ? 'Upload New Revision' : 'Upload Finished Edit'}
                        </button>
                      </div>
                    </div>

                    {/* Open Revision Notes for This Photo */}
                    {photo.revisions.length > 0 && (
                      <div className="space-y-1.5 rounded-lg border border-icx-warning/40 bg-icx-warning/10 p-3 text-xs">
                        <span className="font-bold uppercase text-[10px] text-icx-warning">
                          Customer Revision Notes:
                        </span>
                        {photo.revisions.map((r) => (
                          <p key={r.id} className="text-icx-sand">
                            • {r.notes}{' '}
                            <span className="text-[10px] text-icx-sand-muted">
                              ({r.resolved_at ? 'Resolved' : 'Pending'})
                            </span>
                          </p>
                        ))}
                      </div>
                    )}

                    {/* TUS Uploader for Finished Edit */}
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
    </div>
  );
}

