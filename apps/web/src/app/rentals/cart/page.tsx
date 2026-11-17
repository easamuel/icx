'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingBag,
  Trash2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  FileCheck2,
  Pencil,
  CreditCard,
} from 'lucide-react';
import { formatNaira } from '@icx/ui-core';
import type { RentalRecord } from '@icx/shared-types';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import {
  apiFetch,
  ApiError,
  getStoredAccessToken,
  sanitizeNigerianPhoneInput,
  validateNigerianPhone,
} from '@/lib/api';
import {
  clearRentalCart,
  getRentalCart,
  removeFromRentalCart,
  type RentalCartItem,
} from '@/lib/rentalCart';

export default function RentalCartPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<RentalCartItem[]>([]);
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

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedOutRentals, setCheckedOutRentals] = useState<RentalRecord[]>([]);
  const [checkedOutTotalKobo, setCheckedOutTotalKobo] = useState<string>('0');

  useEffect(() => {
    setCartItems(getRentalCart());

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
  }, []);

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
        router.push('/auth/login?redirect=/rentals/cart');
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to upload ID document.');
    } finally {
      setUploadingId(false);
    }
  }

  const grandTotalKobo = cartItems.reduce(
    (sum, item) => sum + Number(item.daily_price) * item.day_count * item.units,
    0
  );

  async function handleCheckoutCart(e: React.FormEvent) {
    e.preventDefault();
    if (cartItems.length === 0) return;

    if (!getStoredAccessToken()) {
      router.push('/auth/login?redirect=/rentals/cart');
      return;
    }

    const phoneErr = validateNigerianPhone(phone);
    if (phoneErr) {
      setError(phoneErr);
      return;
    }
    if (!idDocumentUrl) {
      setError('Please upload a clear photo of your Passport, NIN, or Driver’s License.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await apiFetch<{
        rentals: RentalRecord[];
        primaryRentalId: string | null;
        totalAmountKobo: string;
      }>('/rentals/checkout', {
        method: 'POST',
        body: JSON.stringify({
          items: cartItems.map((item) => ({
            item_id: item.item_id,
            units: item.units,
            start_date: item.start_date,
            end_date: item.end_date,
          })),
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

      clearRentalCart();
      setCartItems([]);
      setHasSavedProfile(true);
      setEditingProfile(false);
      setCheckedOutRentals(res.rentals || []);
      setCheckedOutTotalKobo(res.totalAmountKobo || '0');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/auth/login?redirect=/rentals/cart');
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to complete cart checkout.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePayRental(rentalId: string) {
    setSubmitting(true);
    try {
      const res = await apiFetch<{ authorizationUrl: string }>('/payments/initialize', {
        method: 'POST',
        body: JSON.stringify({
          target_type: 'rental',
          target_id: rentalId,
          payment_type: 'full',
          callback_url: `${window.location.origin}/dashboard`,
        }),
      });
      window.location.href = res.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to initialize payment.');
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/rentals"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-950 mb-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Equipment Catalog</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950">
              Your Equipment Rental Cart
            </h1>
          </div>
          <Link
            href="/rentals"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-black text-zinc-950 hover:border-zinc-950"
          >
            <span>+ Add More Gear</span>
          </Link>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {error && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {checkedOutRentals.length > 0 ? (
          <div className="rounded-3xl border border-emerald-200 bg-white p-8 shadow-sm text-center space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-black text-zinc-950">
              {checkedOutRentals.length} Equipment Reservation
              {checkedOutRentals.length > 1 ? 's' : ''} Locked!
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 max-w-lg mx-auto">
              Your gear units are held exclusively for 30 minutes and your renter profile &amp; ID have been saved to your account for future rentals. Combined Total:{' '}
              <strong className="text-zinc-950">{formatNaira(checkedOutTotalKobo)}</strong>.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {checkedOutRentals.map((r, idx) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={submitting}
                  onClick={() => void handlePayRental(r.id)}
                  className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-6 py-3.5 text-xs font-black text-white shadow-lg hover:bg-zinc-800"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>
                    Pay Item #{idx + 1} ({formatNaira(r.total_amount)}) via Paystack
                  </span>
                </button>
              ))}
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-5 py-3.5 text-xs font-bold text-zinc-950 hover:border-zinc-950"
              >
                <span>Manage in Dashboard</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ) : cartItems.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-12 text-center space-y-4">
            <ShoppingBag className="h-10 w-10 text-zinc-300 mx-auto" />
            <h2 className="text-lg font-black text-zinc-950">Your Rental Cart is Empty</h2>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Browse cameras, lenses, lighting, and studio gear to add multiple items to your cart before checking out.
            </p>
            <Link
              href="/rentals"
              className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-6 py-3 text-xs font-black text-white hover:bg-zinc-800"
            >
              <span>Browse Equipment Catalog</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleCheckoutCart} className="space-y-6">
            {/* Cart Items List */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-zinc-500">
                Selected Gear ({cartItems.length})
              </h2>
              <div className="divide-y divide-zinc-200">
                {cartItems.map((item, idx) => {
                  const subtotal = Number(item.daily_price) * item.day_count * item.units;
                  return (
                    <div
                      key={`${item.item_id}-${item.start_date}-${item.end_date}-${idx}`}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-16 w-16 rounded-2xl object-cover border border-zinc-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-black text-zinc-950 truncate">{item.name}</p>
                          <p className="text-xs font-medium text-zinc-600 mt-0.5">
                            {item.start_date} to {item.end_date} ({item.day_count} day
                            {item.day_count > 1 ? 's' : ''}) • {item.units} unit
                            {item.units > 1 ? 's' : ''}
                          </p>
                          <p className="text-xs font-bold text-zinc-900 mt-0.5">
                            {formatNaira(item.daily_price)} / day
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        <span className="text-sm font-black text-zinc-950">
                          {formatNaira(subtotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCartItems(removeFromRentalCart(idx))}
                          className="p-2 text-zinc-400 hover:text-red-600 transition-colors"
                          title="Remove from cart"
                          aria-label="Remove from cart"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Renter Information & ID Verification */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-black uppercase tracking-wider text-zinc-500">
                  Renter Information &amp; ID Verification
                </h2>
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
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-1.5">
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

            {/* Grand Total & Checkout Button */}
            <div className="rounded-3xl bg-zinc-950 p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs text-zinc-400">
                  Combined Rental Total ({cartItems.length} item{cartItems.length > 1 ? 's' : ''})
                </p>
                <p className="text-2xl font-black">{formatNaira(grandTotalKobo)}</p>
              </div>
              <button
                type="submit"
                disabled={submitting || uploadingId}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-black text-zinc-950 hover:bg-zinc-200 disabled:opacity-50 transition-all"
              >
                <span>{submitting ? 'Reserving Cart...' : 'Lock & Checkout Cart'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        )}
      </main>

      <AppFooter />
    </div>
  );
}
