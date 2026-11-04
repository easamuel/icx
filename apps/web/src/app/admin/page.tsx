'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Users,
  Camera,
  Package,
  Shield,
  Calendar,
  MailCheck,
  Clock,
} from 'lucide-react';
import { formatNaira } from '@icx/ui-core';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { TusFileUploader } from '@/components/upload/TusFileUploader';
import { apiFetch, getStoredAccessToken } from '@/lib/api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || '/api/v1';

const DEFAULT_GEAR_IMG =
  'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1000&q=85';

const DEFAULT_PHOTOG_IMG =
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=1000&q=85';

function formatAdminDateTime(iso: string, endIso?: string) {
  try {
    const s = new Date(iso);
    const dateStr = s.toLocaleDateString('en-NG', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const startTime = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (!endIso) return `${dateStr} at ${startTime}`;
    const e = new Date(endIso);
    const endTime = e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} • ${startTime} – ${endTime}`;
  } catch {
    return iso;
  }
}

type AdminTab =
  | 'overview'
  | 'users'
  | 'bookings'
  | 'jobs'
  | 'photographers'
  | 'equipment'
  | 'config'
  | 'audit';

export default function AdminExecutiveDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<Record<string, any> | null>(null);
  const [users, setUsers] = useState<Array<Record<string, any>>>([]);
  const [userFilter, setUserFilter] = useState<'all' | 'confirmed' | 'unconfirmed'>('all');
  const [bookings, setBookings] = useState<Array<Record<string, any>>>([]);
  const [jobs, setJobs] = useState<Array<Record<string, any>>>([]);
  const [photographers, setPhotographers] = useState<Array<Record<string, any>>>([]);
  const [equipment, setEquipment] = useState<Array<Record<string, any>>>([]);
  const [rentals, setRentals] = useState<Array<Record<string, any>>>([]);
  const [auditLogs, setAuditLogs] = useState<Array<Record<string, any>>>([]);
  const [depositPct, setDepositPct] = useState(70);
  const [commissionRate, setCommissionRate] = useState(15);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.45);
  const [offlineEditorNames, setOfflineEditorNames] = useState<Record<string, string>>({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'admin'>('editor');
  const [newEquipName, setNewEquipName] = useState('');
  const [newEquipDesc, setNewEquipDesc] = useState('');
  const [newEquipDailyNgn, setNewEquipDailyNgn] = useState('85000');
  const [newEquipUnits, setNewEquipUnits] = useState('2');
  const [newEquipPhotoUrl, setNewEquipPhotoUrl] = useState('');
  const [newEquipCondition, setNewEquipCondition] = useState<'excellent' | 'good' | 'fair'>('excellent');
  const [postingEquip, setPostingEquip] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAdminData = useCallback(async () => {
    try {
      const [ov, us, bk, jb, ph, eq, au] = await Promise.all([
        apiFetch<Record<string, any>>('/admin/overview'),
        apiFetch<{ users: Array<Record<string, any>> }>('/admin/users'),
        apiFetch<{ bookings: Array<Record<string, any>> }>('/admin/bookings'),
        apiFetch<{ jobs: Array<Record<string, any>> }>('/admin/jobs'),
        apiFetch<{ photographers: Array<Record<string, any>> }>('/admin/photographers'),
        apiFetch<{
          equipment: Array<Record<string, any>>;
          rentals: Array<Record<string, any>>;
        }>('/admin/equipment'),
        apiFetch<{ auditLogs: Array<Record<string, any>> }>('/admin/audit-logs'),
      ]);

      setOverview(ov);
      setUsers(us.users);
      setBookings(bk.bookings);
      setJobs(jb.jobs);
      setPhotographers(ph.photographers);
      setEquipment(eq.equipment);
      setRentals(eq.rentals);
      setAuditLogs(au.auditLogs);

      if (ov.platformSettings?.pricing_config) {
        setDepositPct(Number(ov.platformSettings.pricing_config.deposit_percentage ?? 70));
        setCommissionRate(
          Number(ov.platformSettings.pricing_config.photographer_commission_rate ?? 15)
        );
      }
      if (ov.platformSettings?.watermark_config) {
        setWatermarkOpacity(Number(ov.platformSettings.watermark_config.opacity ?? 0.45));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Sign in with an Executive Admin account to access the Control Center.'
      );
      router.push('/l/admin/login');
    }
  }, [router]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  async function handleModifyUser(
    userId: string,
    payload: { status?: string; role?: string; verify_email?: boolean }
  ) {
    await apiFetch(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    setStatusBanner('Updated user account record.');
    await loadAdminData();
  }

  async function handleAssignJob(
    orderId: string,
    assigneeId: string | null,
    offlineEditorName?: string
  ) {
    await apiFetch(`/admin/jobs/${orderId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({
        assignee_id: assigneeId,
        offline_editor_name: offlineEditorName || null,
      }),
    });
    setStatusBanner(`Updated job assignment for #${orderId.slice(0, 8)}`);
    await loadAdminData();
  }

  async function handlePhotographerApproval(profileId: string, approvalStatus: string) {
    await apiFetch(`/admin/photographers/${profileId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ approval_status: approvalStatus }),
    });
    setStatusBanner(`Photographer profile updated to ${approvalStatus}`);
    await loadAdminData();
  }

  async function handleCreateEquipment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPostingEquip(true);
    try {
      const dailyKobo = Math.round(Number(newEquipDailyNgn) * 100);
      const photos = newEquipPhotoUrl.trim()
        ? [newEquipPhotoUrl.trim()]
        : [
            'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1000&q=85',
          ];

      await apiFetch('/admin/equipment', {
        method: 'POST',
        body: JSON.stringify({
          name: newEquipName.trim(),
          description: newEquipDesc.trim(),
          photos,
          daily_price: dailyKobo,
          total_units: Math.max(1, Number(newEquipUnits) || 1),
          condition: newEquipCondition,
          active: true,
        }),
      });

      setStatusBanner(`Published "${newEquipName.trim()}" to the live Rentage Vault.`);
      setNewEquipName('');
      setNewEquipDesc('');
      setNewEquipPhotoUrl('');
      setNewEquipDailyNgn('85000');
      setNewEquipUnits('2');
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post equipment for rentage.');
    } finally {
      setPostingEquip(false);
    }
  }

  async function handleEquipmentCondition(itemId: string, condition: string) {
    await apiFetch(`/admin/equipment/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ condition }),
    });
    setStatusBanner(`Equipment condition updated to ${condition}`);
    await loadAdminData();
  }

  async function handleToggleEquipmentActive(itemId: string, active: boolean) {
    await apiFetch(`/admin/equipment/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    });
    setStatusBanner(
      active ? 'Equipment item activated in live rentage catalog.' : 'Equipment item hidden from live rentage catalog.'
    );
    await loadAdminData();
  }

  async function handleRentalStatus(rentalId: string, status: string) {
    await apiFetch(`/admin/rentals/${rentalId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setStatusBanner(`Rental #${rentalId.slice(0, 8)} marked as ${status}`);
    await loadAdminData();
  }

  async function handleSavePricingConfig(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch('/admin/settings/pricing', {
      method: 'PUT',
      body: JSON.stringify({
        deposit_percentage: depositPct,
        photographer_commission_rate: commissionRate,
      }),
    });
    setStatusBanner('Dynamic pricing & commission configuration saved.');
    await loadAdminData();
  }

  async function handleSaveWatermarkOpacity(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch('/admin/settings/watermark', {
      method: 'PUT',
      body: JSON.stringify({ opacity: watermarkOpacity }),
    });
    setStatusBanner('Server-side burned watermark opacity updated.');
  }

  async function handleInviteStaff(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiFetch<{ temporaryPassword: string }>('/auth/admin/invite', {
      method: 'POST',
      body: JSON.stringify({
        email: inviteEmail,
        full_name: inviteName,
        phone: invitePhone,
        role: inviteRole,
      }),
    });
    setStatusBanner(
      `Invited ${inviteRole} (${inviteEmail}). Temporary password: ${res.temporaryPassword}`
    );
    setInviteEmail('');
    setInviteName('');
    setInvitePhone('');
    await loadAdminData();
  }

  async function handleDownloadCsv(
    endpoint: '/admin/payments' | '/admin/audit-logs',
    filename: string
  ) {
    const token = getStoredAccessToken();
    const res = await fetch(`${API_BASE_URL}${endpoint}?format=csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }

  const confirmedUsersCount = users.filter((u) => Boolean(u.email_verified_at)).length;
  const unconfirmedUsersCount = users.length - confirmedUsersCount;
  const filteredUsers = users.filter((u) => {
    if (userFilter === 'confirmed') return Boolean(u.email_verified_at);
    if (userFilter === 'unconfirmed') return !u.email_verified_at;
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950">
              ICX Studios Executive Control Center
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-600">
              Oversee registered users &amp; email confirmations, photographer bookings, retouching queues, cinema fleet dispatches, and financial ledgers.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() =>
                void handleDownloadCsv('/admin/payments', 'icx_payments_ledger.csv')
              }
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-zinc-800"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Export Payments CSV</span>
            </button>
            <button
              type="button"
              onClick={() =>
                void handleDownloadCsv('/admin/audit-logs', 'icx_audit_events.csv')
              }
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-xs font-bold text-zinc-900 hover:border-zinc-950"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Export Audit CSV</span>
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {statusBanner && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{statusBanner}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-zinc-200 pb-3">
          {[
            { id: 'overview', label: '01. Daily Metrics', icon: Shield },
            { id: 'users', label: `02. Users & Email Status (${users.length})`, icon: MailCheck },
            { id: 'bookings', label: `03. Shoot Bookings (${bookings.length})`, icon: Calendar },
            { id: 'jobs', label: `04. Retouching Queue (${jobs.length})`, icon: Sliders },
            { id: 'photographers', label: `05. Photographer Roster (${photographers.length})`, icon: Camera },
            { id: 'equipment', label: `06. Cinema Vault & Rentage (${equipment.length})`, icon: Package },
            { id: 'config', label: '07. Pricing, Watermark & Staff', icon: Users },
            { id: 'audit', label: '08. Immutable Audit Ledger', icon: FileSpreadsheet },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-black shrink-0 transition-all ${
                  active
                    ? 'bg-zinc-950 text-white shadow'
                    : 'border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-950 hover:text-zinc-950'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: DAILY ACTIVE METRICS OVERVIEW */}
        {activeTab === 'overview' && overview && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div
                onClick={() => setActiveTab('users')}
                className="cursor-pointer rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-zinc-950 transition-all"
              >
                <div className="text-xs font-bold text-zinc-500">Registered Accounts</div>
                <div className="mt-2 text-3xl font-black text-zinc-950">{users.length}</div>
                <div className="mt-1 text-[11px] font-bold text-emerald-700">
                  {confirmedUsersCount} Confirmed • {unconfirmedUsersCount} Unconfirmed
                </div>
              </div>

              <div
                onClick={() => setActiveTab('jobs')}
                className="cursor-pointer rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-zinc-950 transition-all"
              >
                <div className="text-xs font-bold text-zinc-500">Active Retouching Orders</div>
                <div className="mt-2 text-3xl font-black text-zinc-950">
                  {overview.metrics.jobs?.active_jobs ?? 0}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-zinc-500">
                  Awaiting Client Review: {overview.metrics.jobs?.awaiting_review ?? 0}
                </div>
              </div>

              <div
                onClick={() => setActiveTab('bookings')}
                className="cursor-pointer rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-zinc-950 transition-all"
              >
                <div className="text-xs font-bold text-zinc-500">Photographer Bookings</div>
                <div className="mt-2 text-3xl font-black text-zinc-950">
                  {bookings.length}
                </div>
                <div className="mt-1 text-[11px] font-bold text-emerald-700">
                  Commission Earned:{' '}
                  {formatNaira(overview.metrics.bookings?.total_commission_kobo ?? '0')}
                </div>
              </div>

              <div
                onClick={() => setActiveTab('equipment')}
                className="cursor-pointer rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-zinc-950 transition-all"
              >
                <div className="text-xs font-bold text-zinc-500">Equipment Dispatched</div>
                <div className="mt-2 text-3xl font-black text-amber-600">
                  {overview.metrics.rentals?.items_out_on_rental ?? 0}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-zinc-500">
                  Confirmed Pickups: {overview.metrics.rentals?.confirmed_pickups ?? 0}
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-zinc-950 p-6 text-white shadow-lg">
                <div className="text-xs font-bold text-zinc-400">Verified Gross Revenue</div>
                <div className="mt-2 text-2xl font-black text-emerald-400">
                  {formatNaira(overview.metrics.finance?.gross_revenue_kobo ?? '0')}
                </div>
                <div className="mt-1 text-[11px] text-zinc-400">
                  Pending Photographer Reviews:{' '}
                  {overview.metrics.pendingPhotographerApplications}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: USERS & EMAIL CONFIRMATION STATUS */}
        {activeTab === 'users' && (
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
              <div>
                <h2 className="text-lg font-black text-zinc-950">
                  Registered Users &amp; Email Confirmation Directory ({users.length})
                </h2>
                <p className="mt-1 text-xs text-zinc-600">
                  Track every client, photographer, retoucher, and administrator—including real-time email confirmation status.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUserFilter('all')}
                  className={`rounded-full px-4 py-2 text-xs font-black transition-all ${
                    userFilter === 'all'
                      ? 'bg-zinc-950 text-white'
                      : 'border border-zinc-200 bg-zinc-50 text-zinc-700'
                  }`}
                >
                  All ({users.length})
                </button>
                <button
                  type="button"
                  onClick={() => setUserFilter('confirmed')}
                  className={`rounded-full px-4 py-2 text-xs font-black transition-all ${
                    userFilter === 'confirmed'
                      ? 'bg-emerald-600 text-white'
                      : 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                  }`}
                >
                  Confirmed Email ({confirmedUsersCount})
                </button>
                <button
                  type="button"
                  onClick={() => setUserFilter('unconfirmed')}
                  className={`rounded-full px-4 py-2 text-xs font-black transition-all ${
                    userFilter === 'unconfirmed'
                      ? 'bg-amber-500 text-zinc-950'
                      : 'border border-amber-200 bg-amber-50 text-amber-900'
                  }`}
                >
                  Unconfirmed Email ({unconfirmedUsersCount})
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {filteredUsers.map((u) => {
                const isVerified = Boolean(u.email_verified_at);
                return (
                  <div
                    key={u.id}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-zinc-950">
                          {u.full_name}
                        </span>
                        <span className="rounded-full bg-zinc-950 px-2.5 py-0.5 text-[10px] font-black uppercase text-white">
                          {u.role}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                            u.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {u.status}
                        </span>
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-0.5 text-[10px] font-black uppercase text-white">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>
                              Email Confirmed ({new Date(u.email_verified_at).toLocaleDateString()})
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-3 py-0.5 text-[10px] font-black uppercase text-amber-900">
                            <Clock className="h-3 w-3" />
                            <span>Awaiting Email Confirmation</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-zinc-600">
                        {u.email} • {u.phone} • Joined {new Date(u.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {!isVerified && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleModifyUser(u.id, { verify_email: true })
                          }
                          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700"
                        >
                          Verify Email Now
                        </button>
                      )}
                      {u.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() =>
                            void handleModifyUser(u.id, { status: 'suspended' })
                          }
                          className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                        >
                          Suspend Account
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            void handleModifyUser(u.id, { status: 'active' })
                          }
                          className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-black text-white"
                        >
                          Reactivate Account
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: PHOTOGRAPHER SHOOT BOOKINGS LEDGER */}
        {activeTab === 'bookings' && (
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-zinc-950">
              Photographer Session Bookings &amp; Slot Holds ({bookings.length})
            </h2>
            {bookings.length === 0 ? (
              <p className="text-xs text-zinc-500">
                No photographer bookings recorded yet.
              </p>
            ) : (
              bookings.map((b) => (
                <div
                  key={b.id}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-zinc-950">
                        #{String(b.id).slice(0, 8)} • {b.service_title}
                      </span>
                      <span className="rounded-full bg-zinc-950 px-2.5 py-0.5 text-[10px] font-black uppercase text-white">
                        {String(b.status).replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-zinc-600">
                      Client: <strong>{b.customer_name}</strong> ({b.customer_email}) • Photographer:{' '}
                      <strong>{b.photographer_name}</strong>
                    </p>
                    <p className="text-xs text-zinc-500">
                      Session Window: {formatAdminDateTime(b.start_time, b.end_time)}
                    </p>
                  </div>

                  <div className="text-left lg:text-right shrink-0">
                    <div className="text-sm font-black text-zinc-950">
                      Total Fee: {formatNaira(b.price)}
                    </div>
                    <div className="text-xs font-bold text-emerald-700">
                      Studio Commission: {formatNaira(b.commission_amount)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: EDITING JOB MANAGEMENT */}
        {activeTab === 'jobs' && (
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-zinc-950">
              Retouching Orders — Assign to Senior Retoucher, Self, or External Studio ({jobs.length})
            </h2>
            {jobs.map((job) => (
              <div
                key={job.id}
                className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black text-zinc-950">
                      #{job.id.slice(0, 8)} • {job.package_name}
                    </span>
                    <span className="rounded-full bg-zinc-950 px-2.5 py-0.5 text-[10px] font-black uppercase text-white">
                      {job.status}
                    </span>
                    <span className="text-xs font-medium text-zinc-500">
                      Client: {job.customer_name} ({job.customer_email})
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-600">
                    Assigned To:{' '}
                    <strong className="text-zinc-950">
                      {job.assignee_name || job.offline_editor_name || 'Unassigned'}
                    </strong>{' '}
                    • Frames: {job.edited_count}/{job.uploaded_count}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Assign to registered staff editor"
                    defaultValue={job.assignee_id || ''}
                    onChange={(e) =>
                      void handleAssignJob(job.id, e.target.value || null, undefined)
                    }
                    className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-950"
                  >
                    <option value="">-- Assign Staff Retoucher --</option>
                    {(overview?.staffEditors || []).map((ed: any) => (
                      <option key={ed.id} value={ed.id}>
                        {ed.full_name} ({ed.role})
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    placeholder="Or External Retoucher..."
                    value={offlineEditorNames[job.id] ?? job.offline_editor_name ?? ''}
                    onChange={(e) =>
                      setOfflineEditorNames((prev) => ({
                        ...prev,
                        [job.id]: e.target.value,
                      }))
                    }
                    className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-950"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void handleAssignJob(
                        job.id,
                        null,
                        offlineEditorNames[job.id] || ''
                      )
                    }
                    className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-black text-white"
                  >
                    Assign External
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 5: PHOTOGRAPHER ONBOARDING APPROVALS */}
        {activeTab === 'photographers' && (
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-zinc-950">
              Photographer Roster &amp; Applications ({photographers.length})
            </h2>
            {photographers.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className="h-16 w-16 rounded-2xl overflow-hidden bg-zinc-200 shrink-0 border border-zinc-200 shadow-sm">
                    <img
                      src={p.avatar_url || (Array.isArray(p.portfolio_urls) && p.portfolio_urls[0]) || DEFAULT_PHOTOG_IMG}
                      alt={p.full_name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_PHOTOG_IMG;
                      }}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-zinc-950 truncate">{p.full_name}</span>
                      <span className="rounded-full bg-zinc-950 px-2.5 py-0.5 text-[10px] font-black uppercase text-white shrink-0">
                        {p.approval_status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-zinc-500">
                      {p.email} • {p.location || 'Lagos, Nigeria'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600 line-clamp-2">{p.bio}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handlePhotographerApproval(p.id, 'approved')}
                    className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void handlePhotographerApproval(p.id, 'suspended')}
                    className="rounded-full bg-amber-500 px-4 py-2 text-xs font-black text-zinc-950"
                  >
                    Suspend
                  </button>
                  <button
                    type="button"
                    onClick={() => void handlePhotographerApproval(p.id, 'rejected')}
                    className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 6: EQUIPMENT INVENTORY & RENTAL TIMELINE (ADMIN-ONLY RENTAGE POSTING) */}
        {activeTab === 'equipment' && (
          <div className="space-y-8">
            <form
              onSubmit={handleCreateEquipment}
              className="rounded-3xl border-2 border-zinc-950 bg-white p-6 sm:p-8 shadow-sm space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-4">
                <div>
                  <h2 className="text-xl font-black text-zinc-950">
                    Post New Cinema &amp; Studio Equipment for Rentage (Admin Exclusive)
                  </h2>
                  <p className="text-xs text-zinc-600">
                    Only Executive Administrators can publish equipment to the live rentage catalog on /rentals.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                <div className="sm:col-span-6">
                  <label className="block text-xs font-extrabold text-zinc-900">
                    Equipment Title / Package Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newEquipName}
                    onChange={(e) => setNewEquipName(e.target.value)}
                    placeholder="e.g. ARRI Alexa Mini LF 4.5K Cinema Package"
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs font-bold text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-zinc-900">
                    Daily Rate (₦ NGN)
                  </label>
                  <input
                    type="number"
                    required
                    min={1000}
                    step={500}
                    value={newEquipDailyNgn}
                    onChange={(e) => setNewEquipDailyNgn(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs font-black text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-zinc-900">
                    Total Units in Vault
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={50}
                    value={newEquipUnits}
                    onChange={(e) => setNewEquipUnits(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs font-black text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-zinc-900">
                    Initial Condition
                  </label>
                  <select
                    aria-label="Initial Condition"
                    value={newEquipCondition}
                    onChange={(e) =>
                      setNewEquipCondition(e.target.value as 'excellent' | 'good' | 'fair')
                    }
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-xs font-bold text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                  >
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                  </select>
                </div>

                <div className="sm:col-span-12 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <label className="block text-xs font-extrabold text-zinc-900">
                      Equipment Product Photo URL (Live HTTPS)
                    </label>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setNewEquipName('ARRI Alexa Mini LF 4.5K Large Format Package');
                          setNewEquipDailyNgn('185000');
                          setNewEquipPhotoUrl('https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1000&q=85');
                          setNewEquipDesc('ARRI Alexa Mini LF body, LPL mount, EF adapter, Codex Compact Drive reader, Bebob V-mount cage, Arri viewfinder, Pelican flight case.');
                        }}
                        className="rounded-lg bg-zinc-100 hover:bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-800"
                      >
                        Preset: ARRI LF
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewEquipName('RED V-Raptor 8K VV Cinema Production Pack');
                          setNewEquipDailyNgn('150000');
                          setNewEquipPhotoUrl('https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1000&q=85');
                          setNewEquipDesc('RED V-Raptor 8K multi-format sensor, Canon RF mount, 2TB RED PRO CFexpress, DSMC3 monitor, dual Anton Bauer Titon batteries.');
                        }}
                        className="rounded-lg bg-zinc-100 hover:bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-800"
                      >
                        Preset: RED Raptor
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewEquipName('Sony FX6 Full-Frame Cinema Camera Kit');
                          setNewEquipDailyNgn('85000');
                          setNewEquipPhotoUrl('https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=1000&q=85');
                          setNewEquipDesc('Sony FX6 4K full-frame sensor, top handle with XLR inputs, LCD monitor, 2x 160GB CFexpress Type A cards, BP-U batteries.');
                        }}
                        className="rounded-lg bg-zinc-100 hover:bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-800"
                      >
                        Preset: Sony FX6
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewEquipName('Profoto B10X Plus 500Ws Studio Flash Duo');
                          setNewEquipDailyNgn('60000');
                          setNewEquipPhotoUrl('https://images.unsplash.com/photo-1512790182412-b19e6d62bc39?auto=format&fit=crop&w=1000&q=85');
                          setNewEquipDesc('Two Profoto B10X Plus 500Ws battery-powered heads, Air Remote TTL-C/N/S, 2x OCF speedrings, 2x softboxes, stands, and backpack.');
                        }}
                        className="rounded-lg bg-zinc-100 hover:bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-800"
                      >
                        Preset: Profoto Kit
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 items-center">
                    <input
                      type="url"
                      value={newEquipPhotoUrl}
                      onChange={(e) => setNewEquipPhotoUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1000&q=85"
                      className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                    />
                    <div className="h-10 w-10 shrink-0 rounded-xl overflow-hidden border border-zinc-300 bg-zinc-100 flex items-center justify-center shadow-sm">
                      <img
                        src={newEquipPhotoUrl.trim() || DEFAULT_GEAR_IMG}
                        alt="Preview"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = DEFAULT_GEAR_IMG;
                        }}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-12">
                  <label className="block text-xs font-extrabold text-zinc-900">
                    Technical Specifications &amp; Included Vault Accessories
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={newEquipDesc}
                    onChange={(e) => setNewEquipDesc(e.target.value)}
                    placeholder="List sensor specs, mounts, batteries, media cards, flight case, and modifiers included with this rental..."
                    className="mt-1 w-full rounded-2xl border border-zinc-300 bg-zinc-50 p-3.5 text-xs text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={postingEquip}
                  className="rounded-full bg-zinc-950 px-7 py-3 text-xs font-black text-white shadow-lg hover:bg-zinc-800 disabled:opacity-50"
                >
                  {postingEquip ? 'Publishing to Vault...' : '+ Publish Equipment for Rentage'}
                </button>
              </div>
            </form>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
              <h2 className="text-lg font-black text-zinc-950">
                Cinema Fleet Condition &amp; Catalog Visibility Controls ({equipment.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {equipment.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex gap-3 items-center">
                        <div className="h-16 w-16 rounded-xl overflow-hidden bg-zinc-200 shrink-0 border border-zinc-200 shadow-sm">
                          <img
                            src={(Array.isArray(item.photos) && item.photos[0]) || (typeof item.photos === 'string' ? item.photos : DEFAULT_GEAR_IMG)}
                            alt={item.name}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = DEFAULT_GEAR_IMG;
                            }}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1">
                            <div className="text-sm font-black text-zinc-950 truncate leading-snug">{item.name}</div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase shrink-0 ${
                                item.active
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-zinc-200 text-zinc-600'
                              }`}
                            >
                              {item.active ? 'Live' : 'Hidden'}
                            </span>
                          </div>
                          <div className="mt-1 text-xs font-semibold text-zinc-500">
                            {formatNaira(item.daily_price)}/day • {item.total_units} units
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 pt-3 border-t border-zinc-200">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] uppercase font-black text-zinc-950">
                          {item.condition}
                        </span>
                        <select
                          aria-label="Equipment Condition"
                          value={item.condition}
                          onChange={(e) =>
                            void handleEquipmentCondition(item.id, e.target.value)
                          }
                          className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-950"
                        >
                          <option value="excellent">Excellent</option>
                          <option value="good">Good</option>
                          <option value="fair">Fair</option>
                          <option value="under_repair">Under Repair (Blocks Rentals)</option>
                          <option value="retired">Retired</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void handleToggleEquipmentActive(item.id, !item.active)
                        }
                        className="w-full rounded-xl border border-zinc-300 bg-white py-1.5 text-[11px] font-bold text-zinc-800 hover:border-zinc-950"
                      >
                        {item.active ? 'Hide from Public Rentals' : 'Publish to Public Rentals'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
              <h2 className="text-lg font-black text-zinc-950">
                Active Rental Timeline &amp; Vault Dispatch ({rentals.length})
              </h2>
              {rentals.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-zinc-950">
                        {r.item_name} × {r.units} unit(s)
                      </span>
                      <span className="rounded-full bg-zinc-950 px-2.5 py-0.5 text-[10px] font-black uppercase text-white">
                        {r.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-zinc-600">
                      Dates: {formatAdminDateTime(r.start_date, r.end_date)} • Producer: {r.customer_name} (
                      {r.customer_phone})
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRentalStatus(r.id, 'out')}
                      className="rounded-full bg-amber-500 px-4 py-2 text-xs font-black text-zinc-950"
                    >
                      Mark Dispatched (Out)
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRentalStatus(r.id, 'returned')}
                      className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white"
                    >
                      Mark Returned
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 7: PRICING, WATERMARK ARTWORK & STAFF INVITATION */}
        {activeTab === 'config' && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <form
              onSubmit={handleSavePricingConfig}
              className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-4"
            >
              <h2 className="text-base font-black text-zinc-950">
                Dynamic Deposit &amp; Commission Rates
              </h2>
              <div>
                <label className="block text-xs font-extrabold text-zinc-900">
                  Photo Retouching Deposit Percentage (%)
                </label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={depositPct}
                  onChange={(e) => setDepositPct(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-sm font-bold text-zinc-950"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-zinc-900">
                  Photographer Booking Commission Rate (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={90}
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-sm font-bold text-zinc-950"
                />
              </div>
              <button
                type="submit"
                className="rounded-full bg-zinc-950 px-6 py-3 text-xs font-black text-white"
              >
                Save Pricing Rules
              </button>
            </form>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
              <h2 className="text-base font-black text-zinc-950">
                Server Burned-In Watermark Artwork &amp; Opacity
              </h2>
              <form onSubmit={handleSaveWatermarkOpacity} className="space-y-3">
                <label className="block text-xs font-extrabold text-zinc-900">
                  Watermark Opacity ({Math.round(watermarkOpacity * 100)}%)
                </label>
                <input
                  type="range"
                  min={0.15}
                  max={0.95}
                  step={0.05}
                  value={watermarkOpacity}
                  onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                  className="w-full accent-zinc-950"
                />
                <button
                  type="submit"
                  className="rounded-full bg-zinc-950 px-5 py-2.5 text-xs font-black text-white"
                >
                  Save Opacity
                </button>
              </form>
              <div className="pt-4 border-t border-zinc-200">
                <TusFileUploader
                  uploadType="watermark_asset"
                  targetId="system"
                  maxFiles={1}
                  onUploadComplete={() =>
                    setStatusBanner('Uploaded new custom PNG watermark asset.')
                  }
                />
              </div>
            </div>

            <form
              onSubmit={handleInviteStaff}
              className="lg:col-span-2 rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-4"
            >
              <h2 className="text-base font-black text-zinc-950">
                Invite Internal Senior Retoucher or Administrator
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-950"
                />
                <input
                  type="email"
                  required
                  placeholder="Staff Email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-950"
                />
                <input
                  type="tel"
                  required
                  placeholder="Phone Number"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  className="rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-950"
                />
                <select
                  aria-label="Staff Role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'editor' | 'admin')}
                  className="rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs font-bold text-zinc-950"
                >
                  <option value="editor">Senior Retoucher (Editor)</option>
                  <option value="admin">Executive Admin</option>
                </select>
              </div>
              <button
                type="submit"
                className="rounded-full bg-zinc-950 px-6 py-3 text-xs font-black text-white"
              >
                Send Staff Invitation
              </button>
            </form>
          </div>
        )}

        {/* TAB 8: IMMUTABLE APPEND-ONLY AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-zinc-950">
              Append-Only Security &amp; Financial Audit Trail ({auditLogs.length})
            </h2>
            <div className="space-y-2 max-h-[540px] overflow-y-auto">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-mono font-black text-zinc-950">
                      {log.action}
                    </span>{' '}
                    <span className="text-zinc-500 font-medium">
                      on {log.target_entity} (
                      {log.target_id ? String(log.target_id).slice(0, 8) : 'global'})
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-zinc-500">
                    Actor: {log.actor_email || 'System/Webhook'} •{' '}
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <AppFooter />
    </div>
  );
}
