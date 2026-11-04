'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PackageCheck,
  CreditCard,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { formatNaira } from '@icx/ui-core';
import type { EquipmentItemRecord, RentalRecord } from '@icx/shared-types';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { apiFetch, ApiError } from '@/lib/api';

interface DayAvailability {
  date: string;
  reservedUnits: number;
  availableUnits: number;
}

const FALLBACK_GEAR_IMG =
  'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1000&q=85';

function getGearImage(photos?: string[]): string {
  const valid = (photos || []).find((p) => typeof p === 'string' && (p.startsWith('http') || p.startsWith('/')));
  return valid || FALLBACK_GEAR_IMG;
}

export default function EquipmentRentalPage() {
  const router = useRouter();
  const [equipment, setEquipment] = useState<EquipmentItemRecord[]>([]);
  const [selectedItem, setSelectedItem] = useState<EquipmentItemRecord | null>(null);
  const [calendarDays, setCalendarDays] = useState<DayAvailability[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [units, setUnits] = useState(1);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [govIdNumber, setGovIdNumber] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [heldRental, setHeldRental] = useState<RentalRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ equipment: EquipmentItemRecord[] }>('/rentals/equipment')
      .then((res) => {
        setEquipment(res.equipment);
        if (res.equipment[0]) {
          void handleSelectItem(res.equipment[0]);
        }
      })
      .catch(() => setError('Unable to load cinema & studio equipment catalog.'));
  }, []);

  async function handleSelectItem(item: EquipmentItemRecord) {
    setSelectedItem(item);
    setHeldRental(null);
    setError(null);
    setUnits(1);

    try {
      const res = await apiFetch<{ dates: DayAvailability[] }>(
        `/rentals/equipment/${item.id}/availability`
      );
      setCalendarDays(res.dates);
      const firstAvailable = res.dates.find((d) => d.availableUnits > 0);
      if (firstAvailable) {
        setStartDate(firstAvailable.date);
        setEndDate(firstAvailable.date);
      }
    } catch {
      setError('Failed to load unit availability calendar.');
    }
  }

  const selectedRangeDays = calendarDays.filter(
    (d) => startDate && endDate && d.date >= startDate && d.date <= endDate
  );
  const maxFreeUnitsInRange =
    selectedRangeDays.length > 0
      ? Math.min(...selectedRangeDays.map((d) => d.availableUnits))
      : selectedItem?.total_units || 0;

  const dayCount = Math.max(1, selectedRangeDays.length);
  const totalAmountKobo = selectedItem
    ? Number(selectedItem.daily_price) * dayCount * units
    : 0;

  async function handleCreate30MinHold(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem) return;
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch<{ rental: RentalRecord }>('/rentals/hold', {
        method: 'POST',
        body: JSON.stringify({
          item_id: selectedItem.id,
          units,
          start_date: startDate,
          end_date: endDate,
          form_details: {
            full_name: fullName,
            phone,
            email,
            address,
            government_id_number: govIdNumber,
            project_description: projectDesc,
          },
        }),
      });
      setHeldRental(res.rental);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/auth/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to lock equipment units.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePayRentalHold() {
    if (!heldRental) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ authorizationUrl: string }>('/payments/initialize', {
        method: 'POST',
        body: JSON.stringify({
          target_type: 'rental',
          target_id: heldRental.id,
          payment_type: 'full',
          callback_url: `${window.location.origin}/dashboard`,
        }),
      });
      window.location.href = res.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to initialize payment.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      {/* Studio Header */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950">
              Rent Insured Cinema &amp; Studio Equipment
            </h1>
            <p className="mt-2 max-w-2xl text-xs sm:text-sm text-zinc-600 leading-relaxed">
              Multi-unit RED digital cinema packages, Hasselblad 100MP medium format systems, Sony G-Master lens trinities, and Profoto Pro-11 generators. Every item is owned, bench-tested, and posted exclusively by ICX Studios Administration.
            </p>
          </div>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        {error && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left 5 Columns: Equipment Vault Catalog */}
          <div className="lg:col-span-5 space-y-4">
            {equipment.map((item) => {
              const active = selectedItem?.id === item.id;
              const imgUrl = getGearImage(item.photos);

              return (
                <div
                  key={item.id}
                  onClick={() => void handleSelectItem(item)}
                  className={`cursor-pointer overflow-hidden rounded-3xl border-2 transition-all ${
                    active
                      ? 'border-zinc-950 bg-zinc-950 text-white shadow-xl'
                      : 'border-zinc-200 bg-white text-zinc-950 hover:border-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-4 p-4">
                    <img
                      src={imgUrl}
                      alt={item.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = FALLBACK_GEAR_IMG;
                      }}
                      className="h-24 w-24 rounded-2xl object-cover shrink-0 bg-zinc-200"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-sm font-black leading-snug line-clamp-2">
                          {item.name}
                        </h2>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-0.5 text-xs font-black ${
                            active
                              ? 'bg-white text-zinc-950'
                              : 'bg-zinc-950 text-white'
                          }`}
                        >
                          {formatNaira(item.daily_price)} / day
                        </span>
                        <span
                          className={`text-[11px] font-bold ${
                            active ? 'text-zinc-300' : 'text-zinc-500'
                          }`}
                        >
                          {item.total_units} Units in Vault
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right 7 Columns: Selected Gear Details + 14-Day Matrix + 30-Min Hold Form */}
          {selectedItem && (
            <div className="lg:col-span-7 rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-8">
              {!heldRental ? (
                <form onSubmit={handleCreate30MinHold} className="space-y-7">
                  {/* Top Gear Showcase */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center border-b border-zinc-200 pb-6">
                    <div className="sm:col-span-5 h-44 overflow-hidden rounded-2xl bg-zinc-900">
                      <img
                        src={getGearImage(selectedItem.photos)}
                        alt={selectedItem.name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = FALLBACK_GEAR_IMG;
                        }}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="sm:col-span-7 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-50 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 border border-emerald-200">
                          Condition: {selectedItem.condition}
                        </span>
                        <span className="text-xs font-bold text-zinc-500">
                          Fleet: {selectedItem.total_units} Units
                        </span>
                      </div>
                      <h2 className="text-xl font-black text-zinc-950 leading-snug">
                        {selectedItem.name}
                      </h2>
                      <p className="text-xs text-zinc-600 leading-relaxed">
                        {selectedItem.description}
                      </p>
                    </div>
                  </div>

                  {/* Interactive 14-Day Unit Availability Matrix */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-black uppercase tracking-widest text-zinc-500">
                        Step 01 — 14-Day Live Unit Availability Matrix
                      </span>
                      <span className="text-xs font-semibold text-zinc-500">
                        Click dates to select range
                      </span>
                    </div>
                    <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-7 gap-2">
                      {calendarDays.slice(0, 14).map((d) => {
                        const disabled = d.availableUnits === 0;
                        const inRange =
                          startDate && endDate && d.date >= startDate && d.date <= endDate;
                        return (
                          <button
                            key={d.date}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              if (!startDate || (startDate && endDate && startDate !== endDate)) {
                                setStartDate(d.date);
                                setEndDate(d.date);
                              } else if (d.date >= startDate) {
                                setEndDate(d.date);
                              } else {
                                setStartDate(d.date);
                              }
                            }}
                            className={`rounded-2xl border-2 p-2.5 text-center transition-all ${
                              disabled
                                ? 'border-red-200 bg-red-50 text-red-400 opacity-50 cursor-not-allowed'
                                : inRange
                                  ? 'border-zinc-950 bg-zinc-950 text-white font-black shadow'
                                  : 'border-zinc-200 bg-zinc-50 text-zinc-900 hover:border-zinc-400'
                            }`}
                          >
                            <div className="text-xs font-extrabold">{d.date.slice(5)}</div>
                            <div
                              className={`text-[10px] mt-0.5 font-semibold ${
                                inRange ? 'text-emerald-300' : 'text-zinc-500'
                              }`}
                            >
                              {d.availableUnits} free
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Date & Unit Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-zinc-950">
                        Pickup Date
                      </label>
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs font-bold text-zinc-950 focus:border-zinc-950 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-zinc-950">
                        Return Date
                      </label>
                      <input
                        type="date"
                        required
                        min={startDate}
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs font-bold text-zinc-950 focus:border-zinc-950 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-zinc-950">
                        Units ({maxFreeUnitsInRange} Available)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, maxFreeUnitsInRange)}
                        required
                        value={units}
                        onChange={(e) =>
                          setUnits(
                            Math.min(
                              Math.max(1, maxFreeUnitsInRange),
                              Math.max(1, Number(e.target.value) || 1)
                            )
                          )
                        }
                        className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs font-black text-zinc-950 focus:border-zinc-950 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Customer Production Verification Form */}
                  <div className="space-y-4 border-t border-zinc-200 pt-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">
                      Step 02 — Production Pickup &amp; Identity Verification
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-900">
                          Full Legal Name / Producer Name
                        </label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Chukwudi Okafor"
                          className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-3.5 py-2.5 text-xs text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-900">
                          Active Phone Number
                        </label>
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+234 800 000 0000"
                          className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-3.5 py-2.5 text-xs text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-900">
                          Production Email Address
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="producer@agency.com"
                          className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-3.5 py-2.5 text-xs text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-900">
                          NIN or International Passport Number
                        </label>
                        <input
                          type="text"
                          required
                          value={govIdNumber}
                          onChange={(e) => setGovIdNumber(e.target.value)}
                          placeholder="Government ID for Vault Release"
                          className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-3.5 py-2.5 text-xs text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-zinc-900">
                          Studio / Set Location Address
                        </label>
                        <input
                          type="text"
                          required
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Plot 14, Admiralty Way, Lekki Phase 1, Lagos"
                          className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-3.5 py-2.5 text-xs text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Total Calculation Bar */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl bg-zinc-950 p-5 text-white">
                    <div className="text-xs text-zinc-300">
                      Rate Calculation: {formatNaira(selectedItem.daily_price)} × {dayCount}{' '}
                      day(s) × {units} unit(s)
                    </div>
                    <div className="text-xl font-black text-white">
                      Total: {formatNaira(totalAmountKobo)}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || maxFreeUnitsInRange < units}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 py-4 text-sm font-black text-white shadow-xl hover:bg-zinc-800 disabled:opacity-40 transition-all"
                  >
                    <span>
                      {loading
                        ? 'Locking Vault Units...'
                        : 'Lock Units for 30 Minutes & Proceed to Checkout'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              ) : (
                <div className="space-y-6 text-center py-10">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-2xl font-black text-zinc-950">
                    {heldRental.units} Unit(s) Locked Exclusively for 30 Minutes
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-600 max-w-md mx-auto leading-relaxed">
                    Your equipment reservation hold (#{heldRental.id.slice(0, 8)}) is active until{' '}
                    <strong>
                      {heldRental.held_until
                        ? new Date(heldRental.held_until).toLocaleTimeString()
                        : '30 minutes from now'}
                    </strong>
                    . Complete Paystack payment below to finalize dispatch.
                  </p>
                  <button
                    type="button"
                    onClick={handlePayRentalHold}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-8 py-4 text-sm font-black text-white shadow-xl hover:bg-zinc-800"
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>Pay {formatNaira(heldRental.total_amount)} via Paystack</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
