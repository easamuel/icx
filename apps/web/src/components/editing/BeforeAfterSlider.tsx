'use client';

import React, { useEffect, useState } from 'react';
import { MoveHorizontal, ShieldAlert } from 'lucide-react';
import { getStoredAccessToken } from '@/lib/api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface BeforeAfterSliderProps {
  photoId: string;
  hasEdit: boolean;
}

/**
 * Interactive Before/After comparison slider (Requirement PE-07, NF-01, NF-02).
 * Streams server-generated 1,200px burned-in watermarked images via authenticated fetch.
 * Zero CSS watermarks; watermarks are burned into the server JPEG pixel stream.
 */
export function BeforeAfterSlider({ photoId, hasEdit }: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [beforeBlobUrl, setBeforeBlobUrl] = useState<string | null>(null);
  const [afterBlobUrl, setAfterBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const token = getStoredAccessToken();

    async function loadWatermarkedStreams() {
      setLoading(true);
      try {
        const beforeRes = await fetch(
          `${API_BASE_URL}/uploads/preview/${photoId}?variant=before`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );
        if (beforeRes.ok && active) {
          const blob = await beforeRes.blob();
          setBeforeBlobUrl(URL.createObjectURL(blob));
        }

        if (hasEdit) {
          const afterRes = await fetch(
            `${API_BASE_URL}/uploads/preview/${photoId}?variant=edit`,
            {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            }
          );
          if (afterRes.ok && active) {
            const blob = await afterRes.blob();
            setAfterBlobUrl(URL.createObjectURL(blob));
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadWatermarkedStreams();

    return () => {
      active = false;
    };
  }, [photoId, hasEdit]);

  if (loading) {
    return (
      <div className="flex h-72 sm:h-96 w-full items-center justify-center rounded-2xl border border-icx-slate-border bg-icx-slate-dark text-xs text-icx-sand-muted">
        Streaming server-burned watermarked proof (max 1,200px)...
      </div>
    );
  }

  return (
    <div
      className="relative select-none overflow-hidden rounded-2xl border border-icx-slate-border bg-icx-slate-dark"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="relative h-72 sm:h-[440px] w-full">
        {/* Base Layer: Edited Watermarked Preview (or Before if edit not uploaded yet) */}
        {(afterBlobUrl || beforeBlobUrl) ? (
          <img
            src={afterBlobUrl || beforeBlobUrl!}
            alt="ICX Studios Burned-in Watermarked Edit Preview"
            draggable={false}
            className="h-full w-full object-contain pointer-events-none"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-icx-sand-muted">
            Preview image processing...
          </div>
        )}

        {/* Clipped Layer: Original Watermarked Preview */}
        {hasEdit && beforeBlobUrl && afterBlobUrl && (
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
          >
            <img
              src={beforeBlobUrl}
              alt="ICX Studios Watermarked Original"
              draggable={false}
              className="h-full w-full object-contain pointer-events-none"
            />
          </div>
        )}

        {/* Badges */}
        <span className="absolute top-3 left-3 rounded-md bg-icx-slate/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-icx-sand">
          Before (Original)
        </span>
        <span className="absolute top-3 right-3 rounded-md bg-icx-sand px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-icx-slate">
          {hasEdit ? 'After (Retouched Proof)' : 'Awaiting Retouch'}
        </span>

        {/* Divider Line */}
        {hasEdit && beforeBlobUrl && afterBlobUrl && (
          <div
            className="absolute inset-y-0 w-0.5 bg-icx-sand shadow-lg pointer-events-none"
            style={{ left: `${sliderPosition}%` }}
          >
            <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-icx-sand text-icx-slate shadow-xl">
              <MoveHorizontal className="h-4 w-4" />
            </div>
          </div>
        )}
      </div>

      {/* Interactive Range Control for Keyboard, Touch & Mouse Accessibility (WCAG 2.1 AA NF-14) */}
      {hasEdit && (
        <div className="border-t border-icx-slate-border bg-icx-slate px-4 py-3 flex items-center gap-4">
          <span className="text-xs font-semibold text-icx-sand-muted shrink-0">
            Before / After Slider
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={sliderPosition}
            aria-label="Compare before and after photo edit"
            onChange={(e) => setSliderPosition(Number(e.target.value))}
            className="w-full accent-icx-sand cursor-ew-resize"
          />
          <span className="inline-flex items-center gap-1 text-[11px] text-icx-warning shrink-0">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>1,200px Burned Watermark</span>
          </span>
        </div>
      )}
    </div>
  );
}

