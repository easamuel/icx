'use client';

import React, { useEffect, useState } from 'react';
import { MoveHorizontal, ShieldCheck } from 'lucide-react';
import { getStoredAccessToken } from '@/lib/api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || '/api/v1';

interface BeforeAfterSliderProps {
  photoId: string;
  hasEdit: boolean;
}

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
      <div className="flex h-80 sm:h-[460px] w-full items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-950 text-xs font-medium text-zinc-400">
        Loading High-Definition Studio Proof...
      </div>
    );
  }

  return (
    <div
      className="relative select-none overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 shadow-xl"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="relative h-80 sm:h-[480px] w-full">
        {(afterBlobUrl || beforeBlobUrl) ? (
          <img
            src={afterBlobUrl || beforeBlobUrl!}
            alt="ICX Studios Retouched Proof"
            draggable={false}
            className="h-full w-full object-contain pointer-events-none"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
            Generating studio proof...
          </div>
        )}

        {hasEdit && beforeBlobUrl && afterBlobUrl && (
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
          >
            <img
              src={beforeBlobUrl}
              alt="ICX Studios Original Source"
              draggable={false}
              className="h-full w-full object-contain pointer-events-none"
            />
          </div>
        )}

        <span className="absolute top-4 left-4 rounded-full bg-black/80 backdrop-blur px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white border border-white/15">
          Original Capture
        </span>
        <span className="absolute top-4 right-4 rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-950 shadow">
          {hasEdit ? 'Master Retouch' : 'In Studio Queue'}
        </span>

        {hasEdit && beforeBlobUrl && afterBlobUrl && (
          <div
            className="absolute inset-y-0 w-0.5 bg-white shadow-lg pointer-events-none"
            style={{ left: `${sliderPosition}%` }}
          >
            <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-zinc-950 shadow-2xl ring-4 ring-black/20">
              <MoveHorizontal className="h-4 w-4" />
            </div>
          </div>
        )}
      </div>

      {hasEdit && (
        <div className="border-t border-zinc-800 bg-zinc-900 px-5 py-3.5 flex items-center gap-4 text-white">
          <span className="text-xs font-semibold text-zinc-300 shrink-0">
            Compare Before / After
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={sliderPosition}
            aria-label="Compare before and after photo edit"
            onChange={(e) => setSliderPosition(Number(e.target.value))}
            className="w-full accent-white cursor-ew-resize"
          />
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 shrink-0">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Protected Proof</span>
          </span>
        </div>
      )}
    </div>
  );
}
