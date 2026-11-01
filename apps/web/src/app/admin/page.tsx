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
import { TusFileUploader } from '@/components/upload/TusFileUploader';
import { apiFetch, getStoredAccessToken } from '@/lib/api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

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
          : 'Sign in with an Admin account to access the Executive Dashboard.'
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

  async function handleDownloadCsv(endpoint: '/admin/payments' | '/admin/audit-logs', filename: string) {
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
    <div className="min-h-screen bg-icx-slate text-icx-sand">
      <AppNavbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-icx-sand">
              ICX Studios Executive Control Center
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-icx-sand-muted">
              Manage editing jobs, photographer onboarding, rental Gantt fleet, dynamic
              pricing, burned watermarks, and CSV financial/audit ledgers.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                void handleDownloadCsv('/admin/payments', 'icx_payments_ledger.csv')
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-icx-sand px-3.5 py-2 text-xs font-extrabold text-icx-slate"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Export Payments CSV</span>
            </button>
            <button
              type="button"
              onClick={() =>
                void handleDownloadCsv('/admin/audit-logs', 'icx_audit_events.csv')
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-icx-sand/40 px-3.5 py-2 text-xs font-bold text-icx-sand"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Export Audit CSV</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-icx-error/40 bg-icx-error/10 p-4 text-xs text-icx-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {statusBanner && (
          <div className="flex items-center gap-2 rounded-xl border border-icx-success/40 bg-icx-success/10 p-4 text-xs text-icx-success font-semibold">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{statusBanner}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-icx-slate-border pb-3">
          {[
            { id: 'overview', label: '1. Daily Overview', icon: Shield },
            { id: 'jobs', label: '2. Editing Jobs & Assignment', icon: Sliders },
            { id: 'photographers', label: '3. Photographer Onboarding', icon: Camera },
            { id: 'equipment', label: '4. Equipment & Rental Gantt', icon: Package },
            { id: 'config', label: '5. Pricing, Watermark & Staff', icon: Users },
            { id: 'audit', label: '6. Immutable Audit Log', icon: FileSpreadsheet },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold shrink-0 transition-all ${
                  active
                    ? 'bg-icx-sand text-icx-slate shadow'
                    : 'bg-icx-slate-dark text-icx-sand-muted hover:text-icx-sand'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: DAILY ACTIVE METRICS OVERVIEW (AD-11) */}
        {activeTab === 'overview' && overview && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-5">
              <div className="text-xs text-icx-sand-muted">Active Editing Jobs</div>
              <div className="mt-2 text-3xl font-extrabold text-icx-sand">
                {overview.metrics.jobs?.active_jobs ?? 0}
              </div>
              <div className="mt-1 text-[11px] text-icx-sand-muted">
                Awaiting Review: {overview.metrics.jobs?.awaiting_review ?? 0}
              </div>
            </div>

            <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-5">
              <div className="text-xs text-icx-sand-muted">Upcoming Shoot Bookings</div>
              <div className="mt-2 text-3xl font-extrabold text-icx-sand">
                {overview.metrics.bookings?.upcoming_bookings ?? 0}
              </div>
              <div className="mt-1 text-[11px] text-icx-success">
                Commission Earned:{' '}
                {formatNaira(overview.metrics.bookings?.total_commission_kobo ?? '0')}
              </div>
            </div>

            <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-5">
              <div className="text-xs text-icx-sand-muted">Equipment Out on Rental</div>
              <div className="mt-2 text-3xl font-extrabold text-icx-warning">
                {overview.metrics.rentals?.items_out_on_rental ?? 0}
              </div>
              <div className="mt-1 text-[11px] text-icx-sand-muted">
                Confirmed Pickups: {overview.metrics.rentals?.confirmed_pickups ?? 0}
              </div>
            </div>

            <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-5">
              <div className="text-xs text-icx-sand-muted">Verified Webhook Revenue</div>
              <div className="mt-2 text-2xl font-extrabold text-icx-success">
                {formatNaira(overview.metrics.finance?.gross_revenue_kobo ?? '0')}
              </div>
              <div className="mt-1 text-[11px] text-icx-sand-muted">
                Pending Photographer Apps:{' '}
                {overview.metrics.pendingPhotographerApplications}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EDITING JOB MANAGEMENT (AD-02: Registered Editor, Self, or Offline Editor) */}
        {activeTab === 'jobs' && (
          <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 space-y-4">
            <h2 className="text-lg font-bold text-icx-sand">
              Editing Jobs — Assign to Editor, Admin Self, or Offline Editor ({jobs.length})
            </h2>
            {jobs.map((job) => (
              <div
                key={job.id}
                className="rounded-xl border border-icx-slate-border bg-icx-slate p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-icx-sand">
                      #{job.id.slice(0, 8)} • {job.package_name}
                    </span>
                    <span className="rounded bg-icx-sand px-2 py-0.5 text-[10px] font-extrabold uppercase text-icx-slate">
                      {job.status}
                    </span>
                    <span className="text-xs text-icx-sand-muted">
                      Customer: {job.customer_name} ({job.customer_email})
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-icx-sand-muted">
                    Assigned To:{' '}
                    <strong className="text-icx-sand">
                      {job.assignee_name || job.offline_editor_name || 'Unassigned'}
                    </strong>{' '}
                    • Photos: {job.edited_count}/{job.uploaded_count}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Assign to registered staff editor"
                    defaultValue={job.assignee_id || ''}
                    onChange={(e) =>
                      void handleAssignJob(job.id, e.target.value || null, undefined)
                    }
                    className="rounded-lg border border-icx-slate-border bg-icx-slate-dark px-3 py-1.5 text-xs text-icx-sand"
                  >
                    <option value="">-- Assign Registered Staff --</option>
                    {(overview?.staffEditors || []).map((ed: any) => (
                      <option key={ed.id} value={ed.id}>
                        {ed.full_name} ({ed.role})
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    placeholder="Or Offline Editor Name..."
                    value={offlineEditorNames[job.id] ?? job.offline_editor_name ?? ''}
                    onChange={(e) =>
                      setOfflineEditorNames((prev) => ({
                        ...prev,
                        [job.id]: e.target.value,
                      }))
                    }
                    className="rounded-lg border border-icx-slate-border bg-icx-slate-dark px-3 py-1.5 text-xs text-icx-sand"
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
                    className="rounded-lg bg-icx-sand px-3 py-1.5 text-xs font-bold text-icx-slate"
                  >
                    Set Offline Editor
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: PHOTOGRAPHER ONBOARDING APPROVALS (AD-01) */}
        {activeTab === 'photographers' && (
          <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 space-y-4">
            <h2 className="text-lg font-bold text-icx-sand">
              Photographer Applications &amp; Directory Status ({photographers.length})
            </h2>
            {photographers.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-icx-slate-border bg-icx-slate p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-icx-sand">{p.full_name}</span>
                    <span className="rounded bg-icx-sand/20 px-2 py-0.5 text-[10px] font-bold uppercase text-icx-sand">
                      {p.approval_status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-icx-sand-muted">
                    {p.email} • {p.location || 'No location set'}
                  </p>
                  <p className="mt-1 text-xs text-icx-sand-muted">{p.bio}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handlePhotographerApproval(p.id, 'approved')}
                    className="rounded-lg bg-icx-success px-3 py-1.5 text-xs font-bold text-white"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void handlePhotographerApproval(p.id, 'suspended')}
                    className="rounded-lg bg-icx-warning px-3 py-1.5 text-xs font-bold text-icx-slate"
                  >
                    Suspend
                  </button>
                  <button
                    type="button"
                    onClick={() => void handlePhotographerApproval(p.id, 'rejected')}
                    className="rounded-lg border border-icx-error/50 px-3 py-1.5 text-xs font-bold text-icx-error"
                  >
                    Reject / Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: EQUIPMENT INVENTORY & RENTAL GANTT CALENDAR (AD-04, AD-05) */}
        {activeTab === 'equipment' && (
          <div className="space-y-8">
            <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 space-y-4">
              <h2 className="text-lg font-bold text-icx-sand">
                Fleet Condition &amp; Repair Blockers (Marking Under Repair Blocks Availability)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {equipment.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-icx-slate-border bg-icx-slate p-4 space-y-3"
                  >
                    <div className="text-xs font-bold text-icx-sand">{item.name}</div>
                    <div className="text-xs text-icx-sand-muted">
                      {formatNaira(item.daily_price)}/day • {item.total_units} total units
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-2">
                      <span className="text-[11px] uppercase font-bold text-icx-sand">
                        Status: {item.condition}
                      </span>
                      <select
                        aria-label="Equipment Condition"
                        value={item.condition}
                        onChange={(e) =>
                          void handleEquipmentCondition(item.id, e.target.value)
                        }
                        className="rounded-lg border border-icx-slate-border bg-icx-slate-dark px-2.5 py-1 text-xs text-icx-sand"
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

            <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 space-y-4">
              <h2 className="text-lg font-bold text-icx-sand">
                Visual Rental Timeline &amp; Dispatch Controls ({rentals.length})
              </h2>
              {rentals.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-icx-slate-border bg-icx-slate p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-icx-sand">
                        {r.item_name} × {r.units} unit(s)
                      </span>
                      <span className="rounded bg-icx-sand px-2 py-0.5 text-[10px] font-extrabold uppercase text-icx-slate">
                        {r.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-icx-sand-muted">
                      Dates: {String(r.start_date).slice(0, 10)} →{' '}
                      {String(r.end_date).slice(0, 10)} • Customer: {r.customer_name} (
                      {r.customer_phone})
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRentalStatus(r.id, 'out')}
                      className="rounded-lg bg-icx-warning px-3 py-1.5 text-xs font-bold text-icx-slate"
                    >
                      Mark Dispatched (Out)
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRentalStatus(r.id, 'returned')}
                      className="rounded-lg bg-icx-success px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Mark Returned
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: PRICING, WATERMARK ARTWORK & STAFF INVITATION (AD-06, AD-09, AC-05) */}
        {activeTab === 'config' && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <form
              onSubmit={handleSavePricingConfig}
              className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 space-y-4"
            >
              <h2 className="text-base font-bold text-icx-sand">
                Dynamic Deposit &amp; Commission Rates (Zero Code Changes)
              </h2>
              <div>
                <label className="block text-xs font-semibold text-icx-sand">
                  Photo Editing Deposit Percentage (%)
                </label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={depositPct}
                  onChange={(e) => setDepositPct(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2 text-sm text-icx-sand"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-icx-sand">
                  Photographer Booking Commission Rate (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={90}
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2 text-sm text-icx-sand"
                />
              </div>
              <button
                type="submit"
                className="rounded-xl bg-icx-sand px-5 py-2.5 text-xs font-extrabold text-icx-slate"
              >
                Save Pricing Rules
              </button>
            </form>

            <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 space-y-4">
              <h2 className="text-base font-bold text-icx-sand">
                Server Burned-In Watermark Artwork &amp; Opacity (AD-09)
              </h2>
              <form onSubmit={handleSaveWatermarkOpacity} className="space-y-3">
                <label className="block text-xs font-semibold text-icx-sand">
                  Watermark Opacity ({Math.round(watermarkOpacity * 100)}%)
                </label>
                <input
                  type="range"
                  min={0.15}
                  max={0.95}
                  step={0.05}
                  value={watermarkOpacity}
                  onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                  className="w-full accent-icx-sand"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-icx-sand px-4 py-2 text-xs font-extrabold text-icx-slate"
                >
                  Save Opacity
                </button>
              </form>
              <div className="pt-3 border-t border-icx-slate-border">
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
              className="lg:col-span-2 rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 space-y-4"
            >
              <h2 className="text-base font-bold text-icx-sand">
                Invite Internal Editor or Administrator Account (Requirement AC-05)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2 text-xs text-icx-sand"
                />
                <input
                  type="email"
                  required
                  placeholder="Staff Email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2 text-xs text-icx-sand"
                />
                <input
                  type="tel"
                  required
                  placeholder="Phone Number"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  className="rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2 text-xs text-icx-sand"
                />
                <select
                  aria-label="Staff Role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'editor' | 'admin')}
                  className="rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2 text-xs text-icx-sand"
                >
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                type="submit"
                className="rounded-xl bg-icx-sand px-5 py-2.5 text-xs font-extrabold text-icx-slate"
              >
                Send Staff Invitation
              </button>
            </form>
          </div>
        )}

        {/* TAB 6: IMMUTABLE APPEND-ONLY AUDIT LOGS (AD-10) */}
        {activeTab === 'audit' && (
          <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark p-6 space-y-3">
            <h2 className="text-lg font-bold text-icx-sand">
              Append-Only Security &amp; Financial Audit Trail ({auditLogs.length})
            </h2>
            <div className="space-y-2 max-h-[540px] overflow-y-auto">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-icx-slate-border bg-icx-slate p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-icx-sand">
                      {log.action}
                    </span>{' '}
                    <span className="text-icx-sand-muted">
                      on {log.target_entity} ({log.target_id ? String(log.target_id).slice(0, 8) : 'global'})
                    </span>
                  </div>
                  <div className="text-[11px] text-icx-sand-muted">
                    Actor: {log.actor_email || 'System/Webhook'} •{' '}
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

