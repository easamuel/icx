'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertTriangle, RefreshCw, Pause, Play, FileImage } from 'lucide-react';
import { getStoredAccessToken } from '@/lib/api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || '/api/v1';

const CHUNK_SIZE_BYTES = 2 * 1024 * 1024; // 2MB resumable chunks
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB max per file

export interface UploadQueueItem {
  id: string;
  file: File;
  uploadUrl: string | null;
  bytesUploaded: number;
  progress: number;
  status: 'queued' | 'uploading' | 'paused' | 'completed' | 'error';
  errorMessage?: string;
  photoId?: string;
}

interface TusFileUploaderProps {
  uploadType: 'order_original' | 'editor_edit' | 'booking_delivery' | 'watermark_asset';
  targetId: string;
  photoId?: string;
  maxFiles?: number;
  onUploadComplete?: (photoIds: string[]) => void;
}

function encodeMetadata(meta: Record<string, string>): string {
  return Object.entries(meta)
    .filter(([, val]) => Boolean(val))
    .map(([key, val]) => `${key} ${window.btoa(unescape(encodeURIComponent(val)))}`)
    .join(',');
}

export function TusFileUploader({
  uploadType,
  targetId,
  photoId,
  maxFiles = 100,
  onUploadComplete,
}: TusFileUploaderProps) {
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const pausedMapRef = useRef<Record<string, boolean>>({});

  function getFingerprint(file: File): string {
    return `icx_tus_${uploadType}_${targetId}_${photoId || 'new'}_${file.name}_${file.size}_${file.lastModified}`;
  }

  function handleFileSelection(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const selected = Array.from(fileList).slice(0, maxFiles - items.length);
    const newItems: UploadQueueItem[] = selected.map((file) => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return {
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          uploadUrl: null,
          bytesUploaded: 0,
          progress: 0,
          status: 'error',
          errorMessage: 'Exceeds 50 MB per-file studio limit',
        };
      }

      const savedUrl = window.localStorage.getItem(getFingerprint(file));
      return {
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        uploadUrl: savedUrl,
        bytesUploaded: 0,
        progress: 0,
        status: 'queued',
      };
    });

    setItems((prev) => [...prev, ...newItems]);
    for (const item of newItems) {
      if (item.status === 'queued') {
        void startOrResumeUpload(item);
      }
    }
  }

  async function startOrResumeUpload(item: UploadQueueItem) {
    const token = getStoredAccessToken();
    if (!token) {
      updateItem(item.id, {
        status: 'error',
        errorMessage: 'Please sign in before uploading files.',
      });
      return;
    }

    pausedMapRef.current[item.id] = false;
    updateItem(item.id, { status: 'uploading', errorMessage: undefined });

    try {
      let uploadUrl = item.uploadUrl;
      let offset = 0;

      if (uploadUrl) {
        const headRes = await fetch(uploadUrl, {
          method: 'HEAD',
          headers: {
            Authorization: `Bearer ${token}`,
            'Tus-Resumable': '1.0.0',
          },
        });

        if (headRes.ok) {
          offset = Number(headRes.headers.get('Upload-Offset') || '0');
        } else {
          uploadUrl = null;
          window.localStorage.removeItem(getFingerprint(item.file));
        }
      }

      if (!uploadUrl) {
        const metadataHeader = encodeMetadata({
          uploadType,
          targetId,
          photoId: photoId || '',
          filename: item.file.name,
          filetype: item.file.type || 'image/jpeg',
        });

        const createRes = await fetch(`${API_BASE_URL}/uploads/tus`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Tus-Resumable': '1.0.0',
            'Upload-Length': String(item.file.size),
            'Upload-Metadata': metadataHeader,
          },
        });

        if (!createRes.ok) {
          const errBody = await createRes.json().catch(() => ({}));
          throw new Error(errBody.message || 'Failed to initialize resumable transfer.');
        }

        const location = createRes.headers.get('Location');
        if (!location) {
          throw new Error('Server did not return an upload Location header.');
        }

        uploadUrl = location;
        window.localStorage.setItem(getFingerprint(item.file), uploadUrl);
        updateItem(item.id, { uploadUrl });
      }

      let createdPhotoId: string | undefined;

      while (offset < item.file.size) {
        if (pausedMapRef.current[item.id]) {
          updateItem(item.id, { status: 'paused' });
          return;
        }

        const chunkEnd = Math.min(offset + CHUNK_SIZE_BYTES, item.file.size);
        const chunkBlob = item.file.slice(offset, chunkEnd);

        const patchRes = await fetch(uploadUrl, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Tus-Resumable': '1.0.0',
            'Content-Type': 'application/offset+octet-stream',
            'Upload-Offset': String(offset),
          },
          body: chunkBlob,
        });

        if (!patchRes.ok) {
          const errData = await patchRes.json().catch(() => ({}));
          throw new Error(
            errData.message || 'Transfer interrupted. Click Resume to continue from last byte.'
          );
        }

        const newOffsetHeader = patchRes.headers.get('Upload-Offset');
        offset = newOffsetHeader ? Number(newOffsetHeader) : chunkEnd;

        const returnedPhotoId = patchRes.headers.get('X-ICX-Photo-Id');
        if (returnedPhotoId) {
          createdPhotoId = returnedPhotoId;
        }

        const pct = Math.min(100, Math.round((offset / item.file.size) * 100));
        updateItem(item.id, {
          bytesUploaded: offset,
          progress: pct,
        });
      }

      window.localStorage.removeItem(getFingerprint(item.file));
      updateItem(item.id, {
        status: 'completed',
        progress: 100,
        bytesUploaded: item.file.size,
        photoId: createdPhotoId,
      });

      if (onUploadComplete && createdPhotoId) {
        onUploadComplete([createdPhotoId]);
      }
    } catch (error) {
      updateItem(item.id, {
        status: 'error',
        errorMessage:
          error instanceof Error
            ? error.message
            : 'Network connection dropped. Click Resume to continue.',
      });
    }
  }

  function updateItem(id: string, patch: Partial<UploadQueueItem>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
  }

  function togglePause(item: UploadQueueItem) {
    if (item.status === 'uploading') {
      pausedMapRef.current[item.id] = true;
      updateItem(item.id, { status: 'paused' });
    } else if (item.status === 'paused' || item.status === 'error') {
      void startOrResumeUpload(item);
    }
  }

  return (
    <div className="space-y-4">
      <label className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50/70 p-8 text-center hover:border-zinc-950 hover:bg-zinc-100/60 transition-all">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-sm group-hover:scale-105 transition-transform">
          <UploadCloud className="h-6 w-6" />
        </div>
        <span className="mt-3.5 text-sm font-bold text-zinc-950">
          Drop Uncompressed Studio Files Here or Click to Browse
        </span>
        <span className="mt-1 text-xs text-zinc-500">
          JPG, PNG, HEIC, 16-bit TIFF &amp; WebP • Up to 50 MB per file • Auto-resumable transfer
        </span>
        <input
          type="file"
          multiple={maxFiles > 1}
          accept=".jpg,.jpeg,.png,.heic,.heif,.tif,.tiff,.webp"
          onChange={handleFileSelection}
          className="hidden"
        />
      </label>

      {items.length > 0 && (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900">
                    <FileImage className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-zinc-950">
                      {item.file.name}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {(item.bytesUploaded / (1024 * 1024)).toFixed(2)} MB /{' '}
                      {(item.file.size / (1024 * 1024)).toFixed(2)} MB ({item.progress}%)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.status === 'uploading' && (
                    <button
                      type="button"
                      onClick={() => togglePause(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100"
                    >
                      <Pause className="h-3.5 w-3.5" />
                      <span>Pause</span>
                    </button>
                  )}

                  {(item.status === 'paused' || item.status === 'error') && (
                    <button
                      type="button"
                      onClick={() => togglePause(item)}
                      className="inline-flex items-center gap-1 rounded-lg bg-zinc-950 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      {item.status === 'paused' ? (
                        <>
                          <Play className="h-3.5 w-3.5" />
                          <span>Resume</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Resume ({item.progress}%)</span>
                        </>
                      )}
                    </button>
                  )}

                  {item.status === 'completed' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Uploaded &amp; Protected</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={`h-full transition-all duration-200 ${
                    item.status === 'error'
                      ? 'bg-red-600'
                      : item.status === 'completed'
                        ? 'bg-emerald-600'
                        : 'bg-zinc-950'
                  }`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>

              {item.errorMessage && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-red-600">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.errorMessage}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
