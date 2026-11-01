'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PackageCheck, Calendar, CreditCard, AlertCircle, ShieldCheck } from 'lucide-react';
import { formatNaira } from '@icx/ui-core';
import type { EquipmentItemRecord, RentalRecord } from '@icx/shared-types';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { apiFetch, ApiError } from '@/lib/api';

interface DayAvailability {
  date: string;
  reservedUnits: number;
  availableUnits: number;
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
      .catch(() => setError('Unable to load studio equipment catalog.'));
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

  // Calculate minimum free units across the chosen date range (ER-02, ER-03)
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
    <div className="min-h-screen bg-icx-slate text-icx-sand">
      <AppNavbar />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-icx-sand">
            Studio Equipment Rental
          </h1>
          <p className="mt-1 text-sm text-icx-sand-muted">
            Multi-unit cinema cameras, lenses, and Profoto lighting kits. Checkout locks
            your units inside a PostgreSQL transaction for 30 minutes so overlapping dates
            can never be double-booked.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-icx-error/40 bg-icx-error/10 p-4 text-xs text-icx-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left Column: Equipment Catalog */}
          <div className="space-y-4">
            {equipment.map((item) => {
              const active = selectedItem?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => void handleSelectItem(item)}
                  className={`cursor-pointer rounded-2xl border p-5 transition-all ${
                    active
                      ? 'border-icx-sand bg-icx-slate-elevated shadow-lg'
                      : 'border-icx-slate-border bg-icx-slate-dark hover:border-icx-sand/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-icx-sand">
                      {item.name}
                    </h2>
                    <span className="rounded-lg bg-icx-sand px-2.5 py-1 text-xs font-extrabold text-icx-slate shrink-0">
                      {formatNaira(item.daily_price)} / day
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-icx-sand-muted leading-relaxed">
                    {item.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-icx-sand-muted">
                    <span>Total Fleet: {item.total_units} unit(s)</span>
                    <span className="uppercase font-semibold text-icx-success">
                      Condition: {item.condition}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right 2 Columns: Availability Calendar + Customer Identity Form + 30-Min Hold */}
          {selectedItem && (
            <div className="lg:col-span-2 rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 sm:p-8 space-y-6">
              {!heldRental ? (
                <form onSubmit={handleCreate30MinHold} className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-icx-sand">
                      Reserve: {selectedItem.name}
                    </h2>
                    <p className="text-xs text-icx-sand-muted mt-0.5">
                      Dates with 0 free units are automatically disabled below (ER-02).
                    </p>
                  </div>

                  {/* Interactive 14-Day Unit Availability Strip */}
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-icx-sand mb-2.5">
                      Live Daily Unit Availability Matrix
                    </span>
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
                            className={`rounded-xl border p-2 text-center transition-all ${
                              disabled
                                ? 'border-icx-error/30 bg-icx-error/10 text-icx-error opacity-50 cursor-not-allowed'
                                : inRange
                                  ? 'border-icx-sand bg-icx-sand text-icx-slate font-bold'
                                  : 'border-icx-slate-border bg-icx-slate text-icx-sand'
                            }`}
                          >
                            <div className="text-[11px]">{d.date.slice(5)}</div>
                            <div className="text-[10px] mt-0.5 opacity-85">
                              {d.availableUnits} free
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-icx-sand">
                        Start Date
                      </label>
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3 py-2 text-xs text-icx-sand"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-icx-sand">
                        End Date
                      </label>
                      <input
                        type="date"
                        required
                        min={startDate}
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3 py-2 text-xs text-icx-sand"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-icx-sand">
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
                        className="mt-1.5 w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3 py-2 text-xs font-bold text-icx-sand"
                      />
                    </div>
                  </div>

                  {/* Customer Identity Form (ER-04) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-icx-slate-border pt-5">
                    <div>
                      <label className="block text-xs font-semibold text-icx-sand">
                        Full Legal Name
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2 text-xs text-icx-sand"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-icx-sand">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2 text-xs text-icx-sand"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-icx-sand">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2 text-xs text-icx-sand"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-icx-sand">
                        NIN / Passport ID Number
                      </label>
                      <input
                        type="text"
                        required
                        value={govIdNumber}
                        onChange={(e) => setGovIdNumber(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2 text-xs text-icx-sand"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-icx-sand">
                        Residential / Studio Pickup Verification Address
                      </label>
                      <input
                        type="text"
                        required
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2 text-xs text-icx-sand"
                      />
                    </div>
                  </div>

                  {/* ER-05: Rental Total = daily price * days * units */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-icx-slate-border bg-icx-slate p-4">
                    <div className="text-xs text-icx-sand-muted">
                      Formula: {formatNaira(selectedItem.daily_price)} × {dayCount} day(s) ×{' '}
                      {units} unit(s)
                    </div>
                    <div className="text-lg font-extrabold text-icx-sand">
                      Total: {formatNaira(totalAmountKobo)}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || maxFreeUnitsInRange < units}
                    className="w-full rounded-xl bg-icx-sand py-3.5 text-sm font-extrabold text-icx-slate shadow-lg hover:bg-icx-sand-light disabled:opacity-40"
                  >
                    {loading
                      ? 'Locking Inventory Units...'
                      : 'Hold Dates for 30 Minutes & Proceed to Checkout'}
                  </button>
                </form>
              ) : (
                <div className="space-y-5 text-center py-6">
                  <ShieldCheck className="mx-auto h-12 w-12 text-icx-success" />
                  <h3 className="text-xl font-bold text-icx-sand">
                    {heldRental.units} Unit(s) Locked for 30 Minutes!
                  </h3>
                  <p className="text-xs text-icx-sand-muted max-w-md mx-auto">
                    Your database reservation hold (#{heldRental.id.slice(0, 8)}) expires at{' '}
                    {heldRental.held_until
                      ? new Date(heldRental.held_until).toLocaleTimeString()
                      : 'in 30 minutes'}
                    . Complete Paystack payment now to confirm your booking.
                  </p>
                  <button
                    type="button"
                    onClick={handlePayRentalHold}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-xl bg-icx-sand px-6 py-3.5 text-sm font-extrabold text-icx-slate shadow-lg"
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
    </div>
  );
}

