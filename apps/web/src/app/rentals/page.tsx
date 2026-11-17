'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PackageCheck,
  CreditCard,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  ShoppingBag,
  UploadCloud,
  FileCheck2,
  Pencil,
} from 'lucide-react';
import { formatNaira } from '@icx/ui-core';
import type { EquipmentItemRecord, RentalRecord } from '@icx/shared-types';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import {
  apiFetch,
  ApiError,
  getStoredAccessToken,
  sanitizeNigerianPhoneInput,
  validateNigerianPhone,
} from '@/lib/api';
import { addToRentalCart, getRentalCart } from '@/lib/rentalCart';

interface DayAvailability {
  date: string;
  reservedUnits: number;
  availableUnits: number;
}

const FALLBACK_GEAR_IMG =
  'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1000&q=85';

function getGearImage(photos?: string[] | any): string {
  if (!photos) return FALLBACK_GEAR_IMG;
  let list: any[] = [];
  if (Array.isArray(photos)) {
    list = photos;
  } else if (typeof photos === 'string') {
    try {
      const parsed = JSON.parse(photos);
      list = Array.isArray(parsed) ? parsed : [photos];
    } catch {
      list = [photos];
    }
  }
  const valid = list.find(
    (p) =>
      typeof p === 'string' &&
      (p.startsWith('http') || p.startsWith('/') || p.startsWith('data:image/'))
  );
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
  const [idDocumentType, setIdDocumentType] = useState<
    'International Passport' | 'NIN Slip / Card' | "Driver's License"
  >('International Passport');
  const [idDocumentUrl, setIdDocumentUrl] = useState('');
  const [idDocumentName, setIdDocumentName] = useState('');
  const [uploadingId, setUploadingId] = useState(false);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [cartAddedMsg, setCartAddedMsg] = useState<string | null>(null);
  const [heldRental, setHeldRental] = useState<RentalRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCartCount(getRentalCart().length);
    const onCartUpdate = () => setCartCount(getRentalCart().length);
    window.addEventListener('icx-rental-cart-updated', onCartUpdate);

    apiFetch<{ equipment: EquipmentItemRecord[] }>('/rentals/equipment')
      .then((res) => {
        setEquipment(res.equipment);
        if (res.equipment[0]) {
          void handleSelectItem(res.equipment[0]);
        }
      })
      .catch(() => setError('Unable to load cinema & studio equipment catalog.'));

    if (getStoredAccessToken()) {
      apiFetch<{
        renterProfile: Record<string, any> | null;
        account: { full_name: string; email: string; phone: string | null };
      }>('/rentals/renter-profile')
        .then((res) => {
          const rp = res.renterProfile;
          if (rp && (rp.id_document_url || rp.government_id_number)) {
            setFullName(String(rp.full_name || res.account.full_name || ''));
            setPhone(sanitizeNigerianPhoneInput(String(rp.phone || res.account.phone || '')));
            setEmail(String(rp.email || res.account.email || ''));
            setAddress(String(rp.address || ''));
            if (rp.id_document_type) {
              setIdDocumentType(rp.id_document_type);
            }
            if (rp.id_document_url) {
              setIdDocumentUrl(String(rp.id_document_url));
              setIdDocumentName('Verified ID Document on File');
            }
            setHasSavedProfile(true);
          } else if (res.account) {
            setFullName(res.account.full_name || '');
            setPhone(sanitizeNigerianPhoneInput(res.account.phone || ''));
            setEmail(res.account.email || '');
          }
        })
        .catch(() => {});
    }

    return () => window.removeEventListener('icx-rental-cart-updated', onCartUpdate);
  }, []);

  async function handleSelectItem(item: EquipmentItemRecord) {
    setSelectedItem(item);
    setHeldRental(null);
    setCartAddedMsg(null);
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

  async function handleIdFileUpload(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image (JPG, PNG, WEBP) of your Passport, NIN, or Driver’s License.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('ID document image must be under 15MB.');
      return;
    }
    setError(null);
    setUploadingId(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await apiFetch<{ url: string }>('/uploads/media', {
        method: 'POST',
        body: JSON.stringify({ base64Data }),
      });
      setIdDocumentUrl(res.url);
      setIdDocumentName(file.name);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/auth/login?redirect=/rentals');
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to upload ID document.');
    } finally {
      setUploadingId(false);
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

  function handleAddToCart() {
    if (!selectedItem || !startDate || !endDate) {
      setError('Please select pickup and return dates first.');
      return;
    }
    if (maxFreeUnitsInRange < units) {
      setError('Requested units exceed available inventory for the selected dates.');
      return;
    }
    setError(null);
    const updated = addToRentalCart({
      item_id: selectedItem.id,
      name: selectedItem.name,
      daily_price: selectedItem.daily_price,
      image_url: getGearImage(selectedItem.photos),
      start_date: startDate,
      end_date: endDate,
      units,
      day_count: dayCount,
    });
    setCartCount(updated.length);
    setCartAddedMsg(
      `Added ${units} × ${selectedItem.name} (${startDate} to ${endDate}) to your Rental Cart.`
    );
  }

  async function handleCreate30MinHold(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem) return;
    const phoneErr = validateNigerianPhone(phone);
    if (phoneErr) {
      setError(phoneErr);
      return;
    }
    if (!idDocumentUrl) {
      setError('Please upload a clear photo of your Passport, NIN, or Driver’s License.');
      return;
    }
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
            id_document_type: idDocumentType,
            id_document_url: idDocumentUrl,
          },
        }),
      });
      setHasSavedProfile(true);
      setEditingProfile(false);
      setHeldRental(res.rental);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/auth/login?redirect=/rentals');
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
          <Link
            href="/rentals/cart"
            className="inline-flex items-center gap-2.5 rounded-full bg-zinc-950 px-5 py-3 text-xs font-black text-white shadow-md hover:bg-zinc-800 transition-colors shrink-0 self-start lg:self-auto"
          >
            <ShoppingBag className="h-4 w-4 text-emerald-400" />
            <span>Rental Cart ({cartCount})</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        {cartAddedMsg && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{cartAddedMsg}</span>
            </div>
            <Link
              href="/rentals/cart"
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-2 text-[11px] font-black text-white hover:bg-zinc-800 shrink-0"
            >
              <span>View Cart &amp; Checkout ({cartCount})</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}

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

                  {/* Step 02 — Renter Information & Uploadable ID Verification */}
                  <div className="space-y-4 border-t border-zinc-200 pt-6">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">
                        Step 02 — Renter Information &amp; ID Upload
                      </h3>
                      {hasSavedProfile && !editingProfile && (
                        <button
                          type="button"
                          onClick={() => setEditingProfile(true)}
                          className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-3 py-1 text-[11px] font-bold text-zinc-700 hover:bg-zinc-100"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Update Info</span>
                        </button>
                      )}
                    </div>

                    {hasSavedProfile && !editingProfile ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-black text-emerald-900">
                          <FileCheck2 className="h-4 w-4 text-emerald-600" />
                          <span>Verified Renter Profile &amp; ID Already on File</span>
                        </div>
                        <p className="text-xs text-emerald-800">
                          <strong>{fullName}</strong> • {phone} • {email}
                        </p>
                        <p className="text-[11px] text-emerald-700">
                          Address: {address} • ID Document: <strong>{idDocumentType}</strong> (Uploaded ✓)
                        </p>
                      </div>
                    ) : (
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
                            placeholder="Firstname Lastname"
                            className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-3.5 py-2.5 text-xs text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-900">
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            inputMode="numeric"
                            maxLength={11}
                            required
                            value={phone}
                            onChange={(e) => setPhone(sanitizeNigerianPhoneInput(e.target.value))}
                            placeholder="08012345678"
                            className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-3.5 py-2.5 text-xs text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                          />
                          {phone.length === 11 && validateNigerianPhone(phone) && (
                            <p className="mt-1 text-[11px] text-red-600 font-medium">
                              {validateNigerianPhone(phone)}
                            </p>
                          )}
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
                            ID Document Type
                          </label>
                          <select
                            value={idDocumentType}
                            onChange={(e) =>
                              setIdDocumentType(
                                e.target.value as
                                  | 'International Passport'
                                  | 'NIN Slip / Card'
                                  | "Driver's License"
                              )
                            }
                            className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-3.5 py-2.5 text-xs font-bold text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                          >
                            <option value="International Passport">International Passport</option>
                            <option value="NIN Slip / Card">NIN Slip / Card</option>
                            <option value="Driver's License">Driver&apos;s License</option>
                          </select>
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
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-zinc-900 mb-1">
                            Upload {idDocumentType} (Saved once to your account)
                          </label>
                          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 hover:border-zinc-950 transition-colors">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <UploadCloud className="h-5 w-5 text-zinc-600 shrink-0" />
                              <span className="text-xs font-semibold text-zinc-700 truncate">
                                {uploadingId
                                  ? 'Uploading ID document...'
                                  : idDocumentUrl
                                  ? `${idDocumentName || idDocumentType} (Uploaded ✓)`
                                  : `Click to upload ${idDocumentType} (JPG, PNG, WEBP)`}
                              </span>
                            </div>
                            <span className="rounded-full bg-zinc-950 px-3 py-1 text-[11px] font-black text-white shrink-0">
                              {idDocumentUrl ? 'Change' : 'Upload'}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => void handleIdFileUpload(e.target.files?.[0] || null)}
                            />
                          </label>
                        </div>
                      </div>
                    )}
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={handleAddToCart}
                      disabled={maxFreeUnitsInRange < units}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-full border-2 border-zinc-950 bg-white py-3.5 text-xs sm:text-sm font-black text-zinc-950 hover:bg-zinc-100 disabled:opacity-40 transition-all"
                    >
                      <ShoppingBag className="h-4 w-4" />
                      <span>Add to Rental Cart</span>
                    </button>

                    <button
                      type="submit"
                      disabled={loading || uploadingId || maxFreeUnitsInRange < units}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 py-3.5 text-xs sm:text-sm font-black text-white shadow-xl hover:bg-zinc-800 disabled:opacity-40 transition-all"
                    >
                      <span>
                        {loading ? 'Locking Vault Units...' : 'Reserve & Pay Now'}
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
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
