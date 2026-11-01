'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Users,
  Camera,
  Package,
  Shield,
} from 'lucide-react';
import { formatNaira } from '@icx/ui-core';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { TusFileUploader } from '@/components/upload/TusFileUploader';
import { apiFetch, getStoredAccessToken } from '@/lib/api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || '/api/v1';

type AdminTab =
  | 'overview'
  | 'jobs'
  | 'photographers'
  | 'equipment'
  | 'config'
  | 'audit';

export default function AdminExecutiveDashboardPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<Record<string, any> | null>(null);
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
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAdminData = useCallback(async () => {
    try {
      const [ov, jb, ph, eq, au] = await Promise.all([
        apiFetch<Record<string, any>>('/admin/overview'),
        apiFetch<{ jobs: Array<Record<string, any>> }>('/admin/jobs'),
        apiFetch<{ photographers: Array<Record<string, any>> }>('/admin/photographers'),
        apiFetch<{
          equipment: Array<Record<string, any>>;
          rentals: Array<Record<string, any>>;
        }>('/admin/equipment'),
        apiFetch<{ auditLogs: Array<Record<string, any>> }>('/admin/audit-logs'),
      ]);

      setOverview(ov);
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
    }
  }, []);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

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

  async function handleEquipmentCondition(itemId: string, condition: string) {
    await apiFetch(`/admin/equipment/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ condition }),
    });
    setStatusBanner(`Equipment condition updated to ${condition}`);
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

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
              <Shield className="h-3 w-3" />
              <span>Executive Governance</span>
            </span>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-zinc-950">
              ICX Studios Executive Control Center
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-600">
              Oversee retouching queues, photographer roster approvals, cinema fleet dispatches, dynamic pricing, and financial ledgers.
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
            { id: 'jobs', label: '02. Retouching Queue', icon: Sliders },
            { id: 'photographers', label: '03. Photographer Roster', icon: Camera },
            { id: 'equipment', label: '04. Cinema Vault & Dispatch', icon: Package },
            { id: 'config', label: '05. Pricing, Watermark & Staff', icon: Users },
            { id: 'audit', label: '06. Immutable Audit Ledger', icon: FileSpreadsheet },
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-bold text-zinc-500">Active Retouching Orders</div>
              <div className="mt-2 text-3xl font-black text-zinc-950">
                {overview.metrics.jobs?.active_jobs ?? 0}
              </div>
              <div className="mt-1 text-[11px] font-semibold text-zinc-500">
                Awaiting Client Review: {overview.metrics.jobs?.awaiting_review ?? 0}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-bold text-zinc-500">Upcoming Shoot Bookings</div>
              <div className="mt-2 text-3xl font-black text-zinc-950">
                {overview.metrics.bookings?.upcoming_bookings ?? 0}
              </div>
              <div className="mt-1 text-[11px] font-bold text-emerald-700">
                Commission Earned:{' '}
                {formatNaira(overview.metrics.bookings?.total_commission_kobo ?? '0')}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
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
        )}

        {/* TAB 2: EDITING JOB MANAGEMENT */}
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

        {/* TAB 3: PHOTOGRAPHER ONBOARDING APPROVALS */}
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
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-zinc-950">{p.full_name}</span>
                    <span className="rounded-full bg-zinc-950 px-2.5 py-0.5 text-[10px] font-black uppercase text-white">
                      {p.approval_status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-zinc-500">
                    {p.email} • {p.location || 'Lagos, Nigeria'}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">{p.bio}</p>
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

        {/* TAB 4: EQUIPMENT INVENTORY & RENTAL TIMELINE */}
        {activeTab === 'equipment' && (
          <div className="space-y-8">
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
              <h2 className="text-lg font-black text-zinc-950">
                Cinema Fleet Condition &amp; Maintenance Controls
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {equipment.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 space-y-3"
                  >
                    <div className="text-sm font-black text-zinc-950">{item.name}</div>
                    <div className="text-xs font-semibold text-zinc-500">
                      {formatNaira(item.daily_price)}/day • {item.total_units} total units
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-200">
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
                      Dates: {String(r.start_date).slice(0, 10)} →{' '}
                      {String(r.end_date).slice(0, 10)} • Producer: {r.customer_name} (
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

        {/* TAB 5: PRICING, WATERMARK ARTWORK & STAFF INVITATION */}
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

        {/* TAB 6: IMMUTABLE APPEND-ONLY AUDIT LOGS */}
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
