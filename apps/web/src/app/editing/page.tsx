'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  MessageCircle,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { formatNaira } from '@icx/ui-core';
import type { EditPackageRecord } from '@icx/shared-types';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { apiFetch } from '@/lib/api';

const WHATSAPP_NUMBER = (
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '2348000000000'
).replace(/\D/g, '');

export default function PhotoEditingFunnelPage() {
  const [packages, setPackages] = useState<EditPackageRecord[]>([]);
  const [selectedPkgId, setSelectedPkgId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [handoffTriggered, setHandoffTriggered] = useState(false);

  useEffect(() => {
    apiFetch<{ packages: EditPackageRecord[] }>('/editing/packages')
      .then((res) => {
        setPackages(res.packages || []);
        if (res.packages?.[1]) {
          setSelectedPkgId(res.packages[1].id);
        } else if (res.packages?.[0]) {
          setSelectedPkgId(res.packages[0].id);
        }
      })
      .catch(() => {
        setError('Unable to load retouching standards. Please refresh the page.');
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedPkg = useMemo(
    () => packages.find((p) => p.id === selectedPkgId) || null,
    [packages, selectedPkgId]
  );

  const whatsappUrl = useMemo(() => {
    const standardName = selectedPkg?.name || 'Retouching Standard';
    const priceLabel = selectedPkg ? `${formatNaira(selectedPkg.price_per_picture)}/frame` : '';
    const message = selectedPkg
      ? `Hello ICXORA Studio! I would like to book the "${standardName}" photo retouching standard (${priceLabel}, ${selectedPkg.turnaround_hours}h turnaround). Please share next steps for sending my frames.`
      : 'Hello ICXORA Studio! I would like to start a photo retouching order.';
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }, [selectedPkg]);

  function handleWhatsAppHandoff() {
    if (!selectedPkg) return;
    setHandoffTriggered(true);
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-zinc-950">
      <AppNavbar />

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        {/* Header */}
        <div className="border-b border-zinc-200 pb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-zinc-950 text-white px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Photo Retouching Studio
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-zinc-950">
              Select Your Retouching Standard.
            </h1>
            <p className="text-zinc-600 text-base leading-relaxed">
              Choose the finishing tier that fits your shoot, then continue directly to our
              studio desk on WhatsApp with your selected standard pre-filled.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold text-zinc-600 bg-white border border-zinc-200 rounded-2xl px-4 py-3 shadow-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Calibrated Editorial Grading • Human Senior Retouchers</span>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 01 — Choose Retouching Standard */}
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-white text-xs font-black">
                01
              </span>
              <div>
                <h2 className="text-xl font-black tracking-tight text-zinc-950">
                  Choose Retouching Standard
                </h2>
                <p className="text-xs text-zinc-500">
                  Select one tier below to unlock Step 02.
                </p>
              </div>
            </div>
            {selectedPkg && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                <Check className="w-3.5 h-3.5" />
                {selectedPkg.name} selected
              </span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[0, 1, 2].map((idx) => (
                <div
                  key={idx}
                  className="h-72 rounded-3xl border border-zinc-200 bg-white p-6 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {packages.map((pkg) => {
                const isSelected = pkg.id === selectedPkgId;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => {
                      setSelectedPkgId(pkg.id);
                      setHandoffTriggered(false);
                    }}
                    className={`group text-left rounded-3xl border p-7 transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-zinc-950 bg-white ring-2 ring-zinc-950 shadow-xl shadow-zinc-950/5'
                        : 'border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-md'
                    }`}
                  >
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-700">
                          <Layers className="w-3 h-3" />
                          Retouching Tier
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                            isSelected
                              ? 'bg-zinc-950 text-white'
                              : 'bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200'
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <Check className="w-3 h-3" /> Selected
                            </>
                          ) : (
                            'Select'
                          )}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-xl font-black text-zinc-950">{pkg.name}</h3>
                        <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
                          {pkg.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-zinc-100 space-y-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-3xl font-black tracking-tight text-zinc-950">
                          {formatNaira(pkg.price_per_picture)}
                        </span>
                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                          per frame
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-zinc-600 font-medium pt-1">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-zinc-400" />
                          {pkg.turnaround_hours}h turnaround
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                          {pkg.revision_limit} revisions
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Step 02 — Continue on WhatsApp */}
        <section className="rounded-3xl border border-zinc-200 bg-zinc-950 text-white p-7 sm:p-10 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-zinc-950 text-xs font-black">
                  02
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  Direct Studio Desk Handoff
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                {selectedPkg
                  ? `Continue with ${selectedPkg.name} on WhatsApp`
                  : 'Select a Retouching Standard Above'}
              </h2>
              <p className="text-sm text-zinc-300 leading-relaxed">
                {selectedPkg
                  ? `You have selected ${selectedPkg.name} (${formatNaira(
                      selectedPkg.price_per_picture
                    )}/frame • ${selectedPkg.turnaround_hours}h turnaround). Click below to open WhatsApp with your order brief pre-filled.`
                  : 'Choose one of the retouching standards in Step 01 to continue.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <button
                type="button"
                disabled={!selectedPkg}
                onClick={handleWhatsAppHandoff}
                className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-500 px-7 py-4 text-sm font-black text-zinc-950 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20"
              >
                <MessageCircle className="w-5 h-5" />
                Continue on WhatsApp
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>

          {handoffTriggered && selectedPkg && (
            <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
              <p className="text-emerald-100">
                WhatsApp opened in a new tab with your{' '}
                <strong className="text-white">{selectedPkg.name}</strong> brief. If your browser
                blocked the popup, use the direct link.
              </p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-bold text-emerald-300 underline hover:text-white shrink-0"
              >
                Open WhatsApp Directly
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
