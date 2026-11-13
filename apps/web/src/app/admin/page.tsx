'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
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
  ExternalLink,
  LogOut,
  RefreshCw,
  Search,
  LayoutDashboard,
  ArrowRight,
  UploadCloud,
  ImagePlus,
  Trash2,
  Eye,
  LogIn,
  X,
} from 'lucide-react';
import { formatNaira } from '@icx/ui-core';
import { IcxLogo } from '@/components/brand/IcxLogo';
import { TusFileUploader } from '@/components/upload/TusFileUploader';
import { apiFetch, clearStoredSession, setStoredSession, getStoredAccessToken } from '@/lib/api';

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

function resolveGearPhoto(photos: any): string {
  if (!photos) return DEFAULT_GEAR_IMG;
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
  return valid || DEFAULT_GEAR_IMG;
}

type AdminTab =
  | 'overview'
  | 'users'
  | 'bookings'
  | 'jobs'
  | 'photographers'
  | 'equipment'
  | 'config';

export default function AdminExecutiveDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [adminUser, setAdminUser] = useState<{ full_name: string; email: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [overview, setOverview] = useState<Record<string, any> | null>(null);
  const [users, setUsers] = useState<Array<Record<string, any>>>([]);
  const [userFilter, setUserFilter] = useState<'all' | 'confirmed' | 'unconfirmed'>('all');
  const [bookings, setBookings] = useState<Array<Record<string, any>>>([]);
  const [jobs, setJobs] = useState<Array<Record<string, any>>>([]);
  const [photographers, setPhotographers] = useState<Array<Record<string, any>>>([]);
  const [photographerFilter, setPhotographerFilter] = useState<
    'all' | 'pending' | 'approved' | 'confirmed' | 'unconfirmed' | 'suspended_rejected'
  >('all');
  const [photographerSearch, setPhotographerSearch] = useState('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [rejectingProfileId, setRejectingProfileId] = useState<string | null>(null);
  const [rejectionReasonText, setRejectionReasonText] = useState('');
  const [updatingProfileId, setUpdatingProfileId] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<Array<Record<string, any>>>([]);
  const [rentals, setRentals] = useState<Array<Record<string, any>>>([]);
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
  const [equipPhotoFileName, setEquipPhotoFileName] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [newEquipCondition, setNewEquipCondition] = useState<'excellent' | 'good' | 'fair'>('excellent');
  const [postingEquip, setPostingEquip] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inspectingUser, setInspectingUser] = useState<any | null>(null);
  const [inspectingLoading, setInspectingLoading] = useState(false);
  const [inspectingDetails, setInspectingDetails] = useState<any | null>(null);

  useEffect(() => {
    try {
      const token = getStoredAccessToken();
      const raw = window.localStorage.getItem('icx_user');
      if (!token || !raw) {
        router.push('/l/admin/login');
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed.role !== 'admin') {
        clearStoredSession();
        router.push('/l/admin/login');
        return;
      }
      setAdminUser(parsed);
    } catch {
      router.push('/l/admin/login');
    }
  }, [router]);

  function handleLogout() {
    clearStoredSession();
    router.push('/l/admin/login');
  }

  const loadAdminData = useCallback(async () => {
    try {
      const [ov, us, bk, jb, ph, eq] = await Promise.all([
        apiFetch<Record<string, any>>('/admin/overview'),
        apiFetch<{ users: Array<Record<string, any>> }>('/admin/users'),
        apiFetch<{ bookings: Array<Record<string, any>> }>('/admin/bookings'),
        apiFetch<{ jobs: Array<Record<string, any>> }>('/admin/jobs'),
        apiFetch<{ photographers: Array<Record<string, any>> }>('/admin/photographers'),
        apiFetch<{
          equipment: Array<Record<string, any>>;
          rentals: Array<Record<string, any>>;
        }>('/admin/equipment'),
      ]);

      setOverview(ov);
      setUsers(us.users);
      setBookings(bk.bookings);
      setJobs(jb.jobs);
      setPhotographers(ph.photographers);
      setEquipment(eq.equipment);
      setRentals(eq.rentals);

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
    setError(null);
    setUpdatingUserId(userId);
    try {
      const res = await apiFetch<{ user: Record<string, any> }>(`/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (res?.user) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, ...res.user } : u))
        );
        if (payload.verify_email) {
          setPhotographers((prev) =>
            prev.map((p) =>
              p.user_id === userId
                ? { ...p, email_verified_at: res.user.email_verified_at || new Date().toISOString() }
                : p
            )
          );
        }
      }
      setStatusBanner('Updated user account record.');
      void loadAdminData().catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update user account.');
    } finally {
      setUpdatingUserId(null);
    }
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

  async function handlePhotographerApproval(
    profileId: string,
    approvalStatus: string,
    rejectionReason?: string
  ) {
    setError(null);
    setUpdatingProfileId(profileId);
    try {
      const res = await apiFetch<{ profile: Record<string, any> }>(
        `/admin/photographers/${profileId}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            approval_status: approvalStatus,
            rejection_reason: rejectionReason,
          }),
        }
      );

      setPhotographers((prev) =>
        prev.map((p) =>
          p.id === profileId
            ? {
                ...p,
                approval_status: res?.profile?.approval_status ?? approvalStatus,
                rejection_reason:
                  approvalStatus === 'rejected'
                    ? (res?.profile?.rejection_reason ?? rejectionReason ?? null)
                    : null,
                ...(approvalStatus === 'approved' && !p.email_verified_at
                  ? { email_verified_at: new Date().toISOString() }
                  : {}),
              }
            : p
        )
      );

      if (inspectingDetails?.photographerProfile?.id === profileId) {
        setInspectingDetails((prev: any) =>
          prev
            ? {
                ...prev,
                photographerProfile: {
                  ...prev.photographerProfile,
                  approval_status: res?.profile?.approval_status ?? approvalStatus,
                  rejection_reason:
                    approvalStatus === 'rejected'
                      ? (res?.profile?.rejection_reason ?? rejectionReason ?? null)
                      : null,
                },
              }
            : prev
        );
      }

      setRejectingProfileId(null);
      setRejectionReasonText('');
      setStatusBanner(`Photographer profile updated to ${approvalStatus}.`);
      void loadAdminData().catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update photographer status.');
    } finally {
      setUpdatingProfileId(null);
    }
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
      setEquipPhotoFileName('');
      setNewEquipDailyNgn('85000');
      setNewEquipUnits('2');
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post equipment for rentage.');
    } finally {
      setPostingEquip(false);
    }
  }

  function handleEquipPhotoFileSelect(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image file size must be less than 10MB.');
      return;
    }
    setPhotoUploading(true);
    setEquipPhotoFileName(file.name);
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        const dataUri = reader.result;
        setNewEquipPhotoUrl(dataUri);
        try {
          const res = await apiFetch<{ url: string }>('/uploads/media', {
            method: 'POST',
            body: JSON.stringify({
              base64Data: dataUri,
              filename: file.name,
            }),
          });
          if (res.url) {
            setNewEquipPhotoUrl(res.url);
          }
        } catch {
          // Keep dataUri as fallback
        }
      }
      setPhotoUploading(false);
    };
    reader.onerror = () => {
      setError('Failed to process the chosen image file.');
      setPhotoUploading(false);
    };
    reader.readAsDataURL(file);
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
    await apiFetch('/auth/admin/invite', {
      method: 'POST',
      body: JSON.stringify({
        email: inviteEmail,
        full_name: inviteName,
        phone: invitePhone,
        role: inviteRole,
      }),
    });
    setStatusBanner(
      `Invitation sent to ${inviteEmail}. An activation link has been dispatched for them to set their password.`
    );
    setInviteEmail('');
    setInviteName('');
    setInvitePhone('');
    await loadAdminData();
  }

  async function handleDownloadCsv(
    endpoint: '/admin/payments',
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

  async function handleOpenUserDetails(u: any) {
    setInspectingUser(u);
    setInspectingLoading(true);
    setInspectingDetails(null);
    try {
      const data = await apiFetch<any>(`/admin/users/${u.id}/details`);
      setInspectingDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve user details.');
    } finally {
      setInspectingLoading(false);
    }
  }

  async function handleImpersonateUser(targetUser: any) {
    const ok = window.confirm(
      `Sign in to workspace as ${targetUser.full_name} (${targetUser.email})?\n\nYou will experience the platform directly with this account's permissions. You can return to the Executive Console at any time via the top banner.`
    );
    if (!ok) return;

    try {
      const currentToken = getStoredAccessToken();
      const currentUserRaw = window.localStorage.getItem('icx_user');

      const res = await apiFetch<{ user: any; accessToken: string }>(
        `/admin/users/${targetUser.id}/impersonate`,
        { method: 'POST' }
      );

      if (currentToken) {
        window.localStorage.setItem('icx_impersonator_token', currentToken);
      }
      if (currentUserRaw) {
        window.localStorage.setItem('icx_impersonator_user', currentUserRaw);
      }

      setStoredSession(res.accessToken, res.user);

      if (res.user.role === 'photographer') {
        window.location.href = '/portal/photographer';
      } else if (res.user.role === 'editor') {
        window.location.href = '/workspace/editor';
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to impersonate user.');
    }
  }

  const confirmedUsersCount = users.filter((u) => Boolean(u.email_verified_at)).length;
  const unconfirmedUsersCount = users.length - confirmedUsersCount;
  const filteredUsers = users.filter((u) => {
    if (userFilter === 'confirmed' && !u.email_verified_at) return false;
    if (userFilter === 'unconfirmed' && u.email_verified_at) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = String(u.full_name || '').toLowerCase().includes(q);
      const matchEmail = String(u.email || '').toLowerCase().includes(q);
      const matchPhone = String(u.phone || '').toLowerCase().includes(q);
      const matchRole = String(u.role || '').toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchPhone && !matchRole) return false;
    }
    return true;
  });

  const pendingPhotographersCount = photographers.filter(
    (p) => p.approval_status === 'pending'
  ).length;
  const approvedPhotographersCount = photographers.filter(
    (p) => p.approval_status === 'approved'
  ).length;
  const confirmedPhotographersCount = photographers.filter((p) =>
    Boolean(p.email_verified_at)
  ).length;
  const unconfirmedPhotographersCount = photographers.length - confirmedPhotographersCount;
  const suspendedOrRejectedPhotographersCount = photographers.filter(
    (p) => p.approval_status === 'suspended' || p.approval_status === 'rejected'
  ).length;

  const filteredPhotographers = photographers.filter((p) => {
    if (photographerFilter === 'pending' && p.approval_status !== 'pending') return false;
    if (photographerFilter === 'approved' && p.approval_status !== 'approved') return false;
    if (photographerFilter === 'confirmed' && !p.email_verified_at) return false;
    if (photographerFilter === 'unconfirmed' && p.email_verified_at) return false;
    if (
      photographerFilter === 'suspended_rejected' &&
      p.approval_status !== 'suspended' &&
      p.approval_status !== 'rejected'
    ) {
      return false;
    }
    if (photographerSearch.trim()) {
      const q = photographerSearch.toLowerCase().trim();
      const matchName = String(p.full_name || '').toLowerCase().includes(q);
      const matchEmail = String(p.email || '').toLowerCase().includes(q);
      const matchPhone = String(p.phone || '').toLowerCase().includes(q);
      const matchLocation = String(p.location || '').toLowerCase().includes(q);
      const matchSpecialty = String(p.specialty || '').toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchPhone && !matchLocation && !matchSpecialty) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" target="_blank" title="View Storefront" className="flex items-center gap-2 group">
              <IcxLogo variant="dark" mark="slash" showText={true} />
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-zinc-950 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-zinc-100"
              title="View Public Storefront"
            >
              <span className="hidden sm:inline">Storefront</span>
              <ExternalLink className="h-3.5 w-3.5 text-zinc-500" />
            </Link>

            <div className="h-4 w-px bg-zinc-200" />

            {/* Admin identity badge */}
            <div className="flex items-center gap-2.5">
              <Link
                href="/account/security"
                className="text-right hidden md:block group hover:opacity-80 transition"
                title="Edit Admin Profile & Security Settings"
              >
                <div className="text-xs font-black text-zinc-950 leading-none group-hover:underline">
                  {adminUser?.full_name || 'Admin'}
                </div>
                <div className="text-[10px] font-bold text-zinc-400 mt-0.5">
                  {adminUser?.email || 'admin@icxstudios.com'}
                </div>
              </Link>
              <Link
                href="/account/security"
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white hover:bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-800 transition-colors shadow-xs"
                title="Edit My Profile & Phone"
              >
                <span>Edit Profile</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 text-xs font-black text-zinc-800 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Sub-Header with Quick Actions */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:py-6 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-zinc-950">
              Operations &amp; Fleet Management
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-600">
              Real-time directory, shoot bookings, high-res retouching queues, and cinema equipment vaults.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleDownloadCsv('/admin/payments', 'icx_payments_ledger.csv')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 px-3 py-2 text-xs font-black text-zinc-800 transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-zinc-700" />
              <span>Payments CSV</span>
            </button>
            <button
              type="button"
              onClick={() => void loadAdminData()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 px-3.5 py-2 text-xs font-black text-white shadow-xs transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 no-scrollbar scroll-smooth">
            {[
              { id: 'overview', label: 'Overview', icon: LayoutDashboard },
              { id: 'users', label: 'Users & Roles', count: users.length, icon: Users },
              { id: 'bookings', label: 'Bookings', count: bookings.length, icon: Calendar },
              { id: 'jobs', label: 'Retouching', count: jobs.length, icon: Sliders },
              { id: 'photographers', label: 'Photographers', count: photographers.length, icon: Camera },
              { id: 'equipment', label: 'Cinema Fleet', count: equipment.length, icon: Package },
              { id: 'config', label: 'Settings', icon: Shield },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as AdminTab)}
                  className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-3.5 py-2 text-xs font-black shrink-0 transition-all ${
                    active
                      ? 'bg-zinc-950 text-white shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                        active ? 'bg-white/20 text-white' : 'bg-zinc-200 text-zinc-700'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl flex-1 px-4 py-6 sm:py-8 sm:px-6 lg:px-8 space-y-6 sm:space-y-8 w-full">
        {statusBanner && (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-xs font-bold text-emerald-800 shadow-xs">
            <span>{statusBanner}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-emerald-700 hover:text-emerald-950 font-black ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-xs font-bold text-red-800 shadow-xs">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-700 hover:text-red-950 font-black ml-4"
            >
              ✕
            </button>
          </div>
        )}
        {/* TAB 1: DAILY ACTIVE METRICS OVERVIEW */}
        {activeTab === 'overview' && overview && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
              <div
                onClick={() => setActiveTab('users')}
                className="cursor-pointer rounded-2xl sm:rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm hover:border-zinc-950 transition-all min-w-0"
              >
                <div className="text-xs font-bold text-zinc-500">Registered Accounts</div>
                <div className="mt-2 text-2xl sm:text-3xl font-black text-zinc-950 truncate">{users.length}</div>
                <div className="mt-1 text-[11px] font-bold text-emerald-700 truncate">
                  {confirmedUsersCount} Confirmed • {unconfirmedUsersCount} Unconfirmed
                </div>
              </div>

              <div
                onClick={() => setActiveTab('jobs')}
                className="cursor-pointer rounded-2xl sm:rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm hover:border-zinc-950 transition-all min-w-0"
              >
                <div className="text-xs font-bold text-zinc-500">Active Retouching Orders</div>
                <div className="mt-2 text-2xl sm:text-3xl font-black text-zinc-950 truncate">
                  {overview.metrics.jobs?.active_jobs ?? 0}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-zinc-500 truncate">
                  Awaiting Review: {overview.metrics.jobs?.awaiting_review ?? 0}
                </div>
              </div>

              <div
                onClick={() => setActiveTab('bookings')}
                className="cursor-pointer rounded-2xl sm:rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm hover:border-zinc-950 transition-all min-w-0"
              >
                <div className="text-xs font-bold text-zinc-500">Photographer Bookings</div>
                <div className="mt-2 text-2xl sm:text-3xl font-black text-zinc-950 truncate">
                  {bookings.length}
                </div>
                <div className="mt-1 text-[11px] font-bold text-emerald-700 truncate">
                  Commission: {formatNaira(overview.metrics.bookings?.total_commission_kobo ?? '0')}
                </div>
              </div>

              <div
                onClick={() => setActiveTab('equipment')}
                className="cursor-pointer rounded-2xl sm:rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm hover:border-zinc-950 transition-all min-w-0"
              >
                <div className="text-xs font-bold text-zinc-500">Equipment Dispatched</div>
                <div className="mt-2 text-2xl sm:text-3xl font-black text-amber-600 truncate">
                  {overview.metrics.rentals?.items_out_on_rental ?? 0}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-zinc-500 truncate">
                  Pickups: {overview.metrics.rentals?.confirmed_pickups ?? 0}
                </div>
              </div>

              <div className="rounded-2xl sm:rounded-3xl border border-zinc-200 bg-zinc-950 p-5 sm:p-6 text-white shadow-lg min-w-0">
                <div className="text-xs font-bold text-zinc-400">Verified Gross Revenue</div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-emerald-400 truncate">
                  {formatNaira(overview.metrics.finance?.gross_revenue_kobo ?? '0')}
                </div>
                <div className="mt-1 text-[11px] text-zinc-400 truncate">
                  Pending Photographers: {overview.metrics.pendingPhotographerApplications}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: USER DIRECTORY & ROLE MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
              <div>
                <h2 className="text-lg font-black text-zinc-950">
                  User Accounts &amp; Role Management ({users.length})
                </h2>
                <p className="mt-1 text-xs text-zinc-600">
                  Manage accounts and verify emails in 1-click. Photographers must onboard through the dedicated verification pipeline.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUserFilter('all')}
                  className={`rounded-full px-4 py-2 text-xs font-black transition-all ${
                    userFilter === 'all'
                      ? 'bg-zinc-950 text-white'
                      : 'border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
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
                      : 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
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
                      : 'border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                  }`}
                >
                  Unconfirmed Email ({unconfirmedUsersCount})
                </button>
              </div>
            </div>

            {/* Live Filter Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search users by name, email, phone number, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 pl-10 pr-12 py-2.5 text-xs font-medium text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950/10 focus:border-zinc-950 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-zinc-400 hover:text-zinc-700 font-bold"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="space-y-3">
              {filteredUsers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-xs text-zinc-500">
                  No accounts found matching &ldquo;{searchQuery || userFilter}&rdquo;
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isVerified = Boolean(u.email_verified_at);
                  const isCustomer = u.role === 'customer';
                  const isPhotog = u.role === 'photographer';
                  const isEditor = u.role === 'editor';
                  const isAdmin = u.role === 'admin';

                  return (
                    <div
                      key={u.id}
                      className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-zinc-300 transition-colors min-w-0"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-zinc-950 break-words">
                            {u.full_name || 'Unnamed Account'}
                          </span>

                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                              isAdmin
                                ? 'bg-zinc-950 text-[#E6D8C3]'
                                : isPhotog
                                ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                : isEditor
                                ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                : 'bg-zinc-200 text-zinc-800'
                            }`}
                          >
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
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-black uppercase text-white">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>
                                Email Confirmed ({new Date(u.email_verified_at).toLocaleDateString()})
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-900">
                              <Clock className="h-3 w-3" />
                              <span>Awaiting Email Confirmation</span>
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-medium text-zinc-600 break-all sm:break-normal">
                          {u.email} • {u.phone || 'No phone'} • Joined {new Date(u.created_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* Inspect User Account Details */}
                        <button
                          type="button"
                          onClick={() => void handleOpenUserDetails(u)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white hover:bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-800 transition-colors shadow-xs"
                          title="Inspect full account profile, orders, bookings, and ledger"
                        >
                          <Eye className="h-3.5 w-3.5 text-zinc-600" />
                          <span>View Details</span>
                        </button>

                        {/* Sign in directly as this user */}
                        <button
                          type="button"
                          onClick={() => void handleImpersonateUser(u)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-900 bg-zinc-950 hover:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-white transition-colors shadow-xs"
                          title="Sign in and impersonate this account to inspect portal exactly as the user"
                        >
                          <LogIn className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Login As User</span>
                        </button>

                        {!isVerified && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleModifyUser(u.id, { verify_email: true })
                            }
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-700 transition-colors shadow-xs"
                          >
                            <MailCheck className="h-3.5 w-3.5" />
                            <span>Verify Email</span>
                          </button>
                        )}

                        {u.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() =>
                              void handleModifyUser(u.id, { status: 'suspended' })
                            }
                            className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              void handleModifyUser(u.id, { status: 'active' })
                            }
                            className="rounded-full bg-zinc-950 px-3 py-1.5 text-xs font-black text-white hover:bg-zinc-800 transition-colors"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* USER DETAILS INSPECTION MODAL */}
        {inspectingUser && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="relative w-full max-w-3xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-zinc-200 space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black text-zinc-950">{inspectingUser.full_name}</h2>
                    <span className="rounded-full bg-zinc-950 px-2.5 py-0.5 text-[10px] font-black uppercase text-white">
                      {inspectingUser.role}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      inspectingUser.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
                    }`}>
                      {inspectingUser.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 font-mono">{inspectingUser.email} • ID: {inspectingUser.id}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleImpersonateUser(inspectingUser)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 px-3.5 py-2 text-xs font-bold text-white transition shadow-xs"
                  >
                    <LogIn className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Sign In As User</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectingUser(null)}
                    className="rounded-xl border border-zinc-200 hover:bg-zinc-100 p-2 text-zinc-600 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {inspectingLoading ? (
                <div className="py-16 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-zinc-900 border-r-transparent" />
                  <p className="mt-3 text-xs font-semibold text-zinc-600">Loading user history and activity...</p>
                </div>
              ) : inspectingDetails ? (
                <div className="space-y-6 text-xs text-zinc-800">
                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl bg-zinc-50 p-4 border border-zinc-200">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-400">Phone</span>
                      <p className="font-semibold text-zinc-950">{inspectingDetails.user?.phone || 'Not provided'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-400">Email Verification</span>
                      <p className="font-semibold text-zinc-950">
                        {inspectingDetails.user?.email_verified_at
                          ? new Date(inspectingDetails.user.email_verified_at).toLocaleDateString()
                          : 'Unverified'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-400">2FA Security</span>
                      <p className="font-semibold text-zinc-950">
                        {inspectingDetails.user?.two_factor_enabled ? 'Active' : 'Disabled'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-400">Member Since</span>
                      <p className="font-semibold text-zinc-950">
                        {new Date(inspectingDetails.user?.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Photo Retouching Orders */}
                  <div>
                    <h3 className="text-sm font-black text-zinc-950 mb-2">
                      Photo Retouching Orders ({inspectingDetails.orders?.length || 0})
                    </h3>
                    {inspectingDetails.orders?.length === 0 ? (
                      <p className="text-zinc-500 italic">No retouching orders created.</p>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {inspectingDetails.orders.map((o: any) => (
                          <div key={o.id} className="flex items-center justify-between rounded-xl border border-zinc-200 p-2.5 bg-white">
                            <div>
                              <span className="font-mono font-bold text-zinc-950">#{o.id.slice(0, 8)}</span>
                              <span className="text-zinc-500 ml-2">{o.picture_count || o.photo_count || 0} photos • {formatNaira(Number(o.total_amount || o.total_price || 0))}</span>
                            </div>
                            <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-700">
                              {o.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Shoot Bookings */}
                  <div>
                    <h3 className="text-sm font-black text-zinc-950 mb-2">
                      Photographer Shoot Bookings ({inspectingDetails.bookings?.length || 0})
                    </h3>
                    {inspectingDetails.bookings?.length === 0 ? (
                      <p className="text-zinc-500 italic">No photographer bookings.</p>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {inspectingDetails.bookings.map((b: any) => (
                          <div key={b.id} className="flex items-center justify-between rounded-xl border border-zinc-200 p-2.5 bg-white">
                            <div>
                              <span className="font-bold text-zinc-950">{b.service_title}</span>
                              <span className="text-zinc-500 ml-2">{formatNaira(Number(b.price))}</span>
                            </div>
                            <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-700">
                              {b.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Equipment Rentals */}
                  <div>
                    <h3 className="text-sm font-black text-zinc-950 mb-2">
                      Cinema Equipment Rentals ({inspectingDetails.rentals?.length || 0})
                    </h3>
                    {inspectingDetails.rentals?.length === 0 ? (
                      <p className="text-zinc-500 italic">No gear rentals recorded.</p>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {inspectingDetails.rentals.map((r: any) => (
                          <div key={r.id} className="flex items-center justify-between rounded-xl border border-zinc-200 p-2.5 bg-white">
                            <div>
                              <span className="font-bold text-zinc-950">{r.item_name}</span>
                              <span className="text-zinc-500 ml-2">
                                {new Date(r.start_date).toLocaleDateString()} – {new Date(r.end_date).toLocaleDateString()} • {formatNaira(Number(r.total_amount || r.total_price || 0))}
                              </span>
                            </div>
                            <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-700">
                              {r.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Photographer Profile if applicable */}
                  {inspectingDetails.photographerProfile && (
                    <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-black text-purple-950">Photographer Roster Record</h3>
                          <p className="text-[11px] text-purple-700 mt-0.5 font-semibold">
                            {inspectingDetails.photographerProfile.specialty || 'General Photography'} •{' '}
                            {inspectingDetails.photographerProfile.years_experience ?? 0} yrs experience •{' '}
                            {inspectingDetails.photographerProfile.location || 'Lagos'} • Approval:{' '}
                            <span className="uppercase font-black">
                              {inspectingDetails.photographerProfile.approval_status}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={updatingProfileId === inspectingDetails.photographerProfile.id}
                            onClick={() =>
                              void handlePhotographerApproval(
                                inspectingDetails.photographerProfile.id,
                                'approved'
                              )
                            }
                            className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                          >
                            {updatingProfileId === inspectingDetails.photographerProfile.id
                              ? 'Updating...'
                              : inspectingDetails.photographerProfile.approval_status === 'approved'
                              ? 'Approved ✓'
                              : 'Approve Photographer'}
                          </button>
                          <button
                            type="button"
                            disabled={updatingProfileId === inspectingDetails.photographerProfile.id}
                            onClick={() =>
                              void handlePhotographerApproval(
                                inspectingDetails.photographerProfile.id,
                                'suspended'
                              )
                            }
                            className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-black text-zinc-950 hover:bg-amber-600 disabled:opacity-50 transition-colors"
                          >
                            Suspend
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-purple-900">
                        {inspectingDetails.photographerProfile.bio || 'No bio provided.'}
                      </p>
                      {inspectingDetails.photographerProfile.rejection_reason && (
                        <p className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                          Rejection Reason: {inspectingDetails.photographerProfile.rejection_reason}
                        </p>
                      )}
                      {Array.isArray(inspectingDetails.photographerProfile.portfolio_urls) &&
                        inspectingDetails.photographerProfile.portfolio_urls.filter(Boolean).length > 0 && (
                          <div className="pt-2 border-t border-purple-200/70">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700 mb-2">
                              Proof-of-Work Portfolio (
                              {inspectingDetails.photographerProfile.portfolio_urls.filter(Boolean).length} photos — click to inspect)
                            </p>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                              {(inspectingDetails.photographerProfile.portfolio_urls as string[])
                                .filter(Boolean)
                                .map((imgUrl, idx) => (
                                  <button
                                    key={`modal-proof-${idx}`}
                                    type="button"
                                    onClick={() => setLightboxImage(imgUrl)}
                                    className="aspect-square rounded-xl overflow-hidden border border-purple-200 bg-white hover:ring-2 hover:ring-purple-900 transition-all"
                                  >
                                    <img
                                      src={imgUrl}
                                      alt={`Portfolio sample ${idx + 1}`}
                                      className="h-full w-full object-cover"
                                    />
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* TAB 3: PHOTOGRAPHER SHOOT BOOKINGS LEDGER */}
        {activeTab === 'bookings' && (
          <div className="rounded-2xl sm:rounded-3xl border border-zinc-200 bg-white p-4 sm:p-6 lg:p-8 shadow-sm space-y-4">
            <h2 className="text-base sm:text-lg font-black text-zinc-950">
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
                  className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-zinc-950 break-words">
                        #{String(b.id).slice(0, 8)} • {b.service_title}
                      </span>
                      <span className="rounded-full bg-zinc-950 px-2.5 py-0.5 text-[10px] font-black uppercase text-white">
                        {String(b.status).replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-zinc-600 break-words">
                      Client: <strong>{b.customer_name}</strong> ({b.customer_email}) • Photographer:{' '}
                      <strong>{b.photographer_name}</strong>
                    </p>
                    <p className="text-xs text-zinc-500">
                      Session Window: {formatAdminDateTime(b.start_time, b.end_time)}
                    </p>
                  </div>

                  <div className="text-left md:text-right shrink-0">
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
          <div className="rounded-2xl sm:rounded-3xl border border-zinc-200 bg-white p-4 sm:p-6 lg:p-8 shadow-sm space-y-4">
            <h2 className="text-base sm:text-lg font-black text-zinc-950">
              Retouching Orders — Assign to Senior Retoucher, Self, or External Studio ({jobs.length})
            </h2>
            {jobs.map((job) => (
              <div
                key={job.id}
                className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black text-zinc-950 break-words">
                      #{job.id.slice(0, 8)} • {job.package_name}
                    </span>
                    <span className="rounded-full bg-zinc-950 px-2.5 py-0.5 text-[10px] font-black uppercase text-white">
                      {job.status}
                    </span>
                    <span className="text-xs font-medium text-zinc-500 break-words">
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

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <select
                    aria-label="Assign to registered staff editor"
                    defaultValue={job.assignee_id || ''}
                    onChange={(e) =>
                      void handleAssignJob(job.id, e.target.value || null, undefined)
                    }
                    className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-950 max-w-full"
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
                    className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-950 max-w-full"
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
                    className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-black text-white hover:bg-zinc-800 transition-colors"
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
          <div className="rounded-2xl sm:rounded-3xl border border-zinc-200 bg-white p-4 sm:p-6 lg:p-8 shadow-sm space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-base sm:text-lg font-black text-zinc-950">
                  Photographer Roster &amp; Applications ({filteredPhotographers.length})
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Inspect full portfolios, verify email confirmations, impersonate workspaces, and approve photographers.
                </p>
              </div>
              <input
                type="search"
                value={photographerSearch}
                onChange={(e) => setPhotographerSearch(e.target.value)}
                placeholder="Search name, email, phone, location, specialty..."
                className="w-full lg:w-80 rounded-full border border-zinc-300 bg-zinc-50 px-4 py-2 text-xs text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'all', label: `All (${photographers.length})` },
                  { id: 'pending', label: `Pending (${pendingPhotographersCount})` },
                  { id: 'approved', label: `Approved (${approvedPhotographersCount})` },
                  { id: 'confirmed', label: `Email Confirmed (${confirmedPhotographersCount})` },
                  { id: 'unconfirmed', label: `Email Unconfirmed (${unconfirmedPhotographersCount})` },
                  {
                    id: 'suspended_rejected',
                    label: `Suspended / Rejected (${suspendedOrRejectedPhotographersCount})`,
                  },
                ] as const
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setPhotographerFilter(pill.id)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    photographerFilter === pill.id
                      ? 'bg-zinc-950 text-white'
                      : 'border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Compact High-Density Roster Rows */}
            <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-2xl overflow-hidden bg-white">
              {filteredPhotographers.length === 0 ? (
                <div className="p-8 text-center text-xs font-medium text-zinc-500">
                  No photographers match your current filter.
                </div>
              ) : (
                filteredPhotographers.map((p) => {
                  const proofImages = Array.isArray(p.portfolio_urls)
                    ? (p.portfolio_urls as string[]).filter(Boolean)
                    : [];
                  const emailVerified = Boolean(p.email_verified_at);
                  const userTarget = {
                    id: p.user_id,
                    full_name: p.full_name,
                    email: p.email,
                    role: 'photographer',
                    status: p.user_status || 'active',
                    email_verified_at: p.email_verified_at,
                  };

                  const approvalBadgeClass =
                    p.approval_status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : p.approval_status === 'pending'
                      ? 'bg-amber-100 text-amber-900 border-amber-200'
                      : p.approval_status === 'suspended'
                      ? 'bg-orange-100 text-orange-800 border-orange-200'
                      : 'bg-red-100 text-red-700 border-red-200';

                  return (
                    <div
                      key={p.id}
                      className="p-3.5 sm:px-5 sm:py-4 hover:bg-zinc-50/80 transition-colors space-y-3"
                    >
                      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="h-11 w-11 rounded-xl overflow-hidden bg-zinc-200 shrink-0 border border-zinc-200">
                            <img
                              src={p.avatar_url || proofImages[0] || DEFAULT_PHOTOG_IMG}
                              alt={p.full_name}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = DEFAULT_PHOTOG_IMG;
                              }}
                              className="h-full w-full object-cover"
                            />
                          </div>

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-black text-zinc-950 truncate">
                                {p.full_name}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${approvalBadgeClass}`}
                              >
                                {p.approval_status}
                              </span>
                              {emailVerified ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  <span>Email Confirmed</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900">
                                  <Clock className="h-2.5 w-2.5" />
                                  <span>Email Unconfirmed</span>
                                </span>
                              )}
                              {p.user_status === 'suspended' && (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase text-red-700">
                                  Account Suspended
                                </span>
                              )}
                            </div>

                            <p className="text-xs font-medium text-zinc-600 truncate">
                              {p.email} • {p.phone || 'No phone'} • {p.location || 'Lagos'} •{' '}
                              {p.specialty || 'General'} ({p.years_experience ?? 0}y) •{' '}
                              <span className="font-bold text-zinc-800">
                                {proofImages.length} portfolio photos
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleOpenUserDetails(userTarget)}
                            className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white hover:bg-zinc-100 px-2.5 py-1.5 text-[11px] font-bold text-zinc-800 transition-colors"
                            title="Inspect full photographer profile, portfolio gallery, bookings, and ledger"
                          >
                            <Eye className="h-3 w-3 text-zinc-600" />
                            <span>View Details</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleImpersonateUser(userTarget)}
                            className="inline-flex items-center gap-1 rounded-full border border-zinc-900 bg-zinc-950 hover:bg-zinc-800 px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors"
                            title="Sign in directly to Photographer Portal as this photographer"
                          >
                            <LogIn className="h-3 w-3 text-emerald-400" />
                            <span>Login As</span>
                          </button>

                          {!emailVerified && (
                            <button
                              type="button"
                              disabled={updatingUserId === p.user_id || updatingProfileId === p.id}
                              onClick={() => void handleModifyUser(p.user_id, { verify_email: true })}
                              className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1.5 text-[11px] font-black text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                              title="Verify email address for this photographer"
                            >
                              <MailCheck className="h-3 w-3" />
                              <span>{updatingUserId === p.user_id ? 'Verifying...' : 'Verify Email'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={updatingProfileId === p.id}
                            onClick={() => void handlePhotographerApproval(p.id, 'approved')}
                            className="rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                          >
                            {updatingProfileId === p.id
                              ? 'Updating...'
                              : p.approval_status === 'approved'
                              ? 'Approved ✓'
                              : 'Approve'}
                          </button>

                          <button
                            type="button"
                            disabled={updatingProfileId === p.id}
                            onClick={() => void handlePhotographerApproval(p.id, 'suspended')}
                            className="rounded-full bg-amber-500 px-2.5 py-1.5 text-[11px] font-black text-zinc-950 hover:bg-amber-600 disabled:opacity-50 transition-colors"
                          >
                            Suspend
                          </button>

                          <button
                            type="button"
                            disabled={updatingProfileId === p.id}
                            onClick={() => {
                              setRejectingProfileId(rejectingProfileId === p.id ? null : p.id);
                              setRejectionReasonText('');
                            }}
                            className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      </div>

                      {p.rejection_reason && (
                        <p className="text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                          Rejection Reason: {p.rejection_reason}
                        </p>
                      )}

                  {/* Inline Rejection Reason Form */}
                  {rejectingProfileId === p.id && (
                    <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 space-y-2">
                      <label className="block text-xs font-bold text-red-900">
                        Reason for Rejection (sent to applicant by email)
                      </label>
                      <textarea
                        rows={2}
                        value={rejectionReasonText}
                        onChange={(e) => setRejectionReasonText(e.target.value)}
                        placeholder="e.g., Please upload higher-resolution uncropped editorial samples..."
                        className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-xs text-zinc-950 focus:outline-none"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={rejectionReasonText.trim().length < 5}
                          onClick={() =>
                            void handlePhotographerApproval(
                              p.id,
                              'rejected',
                              rejectionReasonText.trim()
                            )
                          }
                          className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-40"
                        >
                          Confirm Rejection
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingProfileId(null)}
                          className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-xs font-bold text-zinc-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                  );
                })
              )}
            </div>
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
                  <label className="block text-xs font-extrabold text-zinc-900">
                    Equipment Product Photo
                  </label>

                  {newEquipPhotoUrl ? (
                    <div className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="h-24 w-24 shrink-0 rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100 flex items-center justify-center">
                        <img
                          src={newEquipPhotoUrl}
                          alt="Product preview"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0 text-center sm:text-left">
                        <p className="text-xs font-bold text-zinc-900 truncate">
                          {equipPhotoFileName || 'Imported Product Image'}
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          High-resolution asset ready for catalog publication
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
                          <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 px-3 py-1.5 text-xs font-bold text-zinc-700 transition">
                            <UploadCloud className="h-3.5 w-3.5" />
                            <span>Change Image</span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/jpg"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleEquipPhotoFileSelect(f);
                              }}
                              className="hidden"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setNewEquipPhotoUrl('');
                              setEquipPhotoFileName('');
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 hover:bg-zinc-100 p-6 cursor-pointer transition text-center group">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 group-hover:bg-zinc-300 text-zinc-800 transition mb-3">
                        <ImagePlus className="h-6 w-6" />
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-zinc-900">
                        {photoUploading ? 'Processing Image...' : 'Click to select photo or drag & drop'}
                      </span>
                      <span className="text-[11px] text-zinc-500 mt-1">
                        Select a high-resolution photo from your device (PNG, JPG, WEBP up to 10MB)
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/jpg"
                        disabled={photoUploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleEquipPhotoFileSelect(f);
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
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
                            src={resolveGearPhoto(item.photos)}
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

            <div className="rounded-2xl sm:rounded-3xl border border-zinc-200 bg-white p-4 sm:p-6 lg:p-8 shadow-sm space-y-4">
              <h2 className="text-base sm:text-lg font-black text-zinc-950">
                Active Rental Timeline &amp; Vault Dispatch ({rentals.length})
              </h2>
              {rentals.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-zinc-950 break-words">
                        {r.item_name} × {r.units} unit(s)
                      </span>
                      <span className="rounded-full bg-zinc-950 px-2.5 py-0.5 text-[10px] font-black uppercase text-white">
                        {r.status}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-zinc-600 break-words">
                      Dates: {formatAdminDateTime(r.start_date, r.end_date)} • Producer: {r.customer_name} (
                      {r.customer_phone})
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleRentalStatus(r.id, 'out')}
                      className="rounded-full bg-amber-500 px-3.5 py-1.5 text-xs font-black text-zinc-950 hover:bg-amber-600 transition-colors"
                    >
                      Mark Dispatched (Out)
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRentalStatus(r.id, 'returned')}
                      className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-black text-white hover:bg-emerald-700 transition-colors"
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
              className="lg:col-span-2 rounded-2xl sm:rounded-3xl border border-zinc-200 bg-white p-4 sm:p-6 lg:p-8 shadow-sm space-y-4"
            >
              <h2 className="text-base font-black text-zinc-950">
                Invite Internal Senior Retoucher or Administrator
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <button
                  type="submit"
                  className="rounded-full bg-zinc-950 px-5 py-2.5 text-xs font-black text-white hover:bg-zinc-800 transition-colors"
                >
                  Send Staff Invitation
                </button>
                <p className="text-[11px] text-zinc-500">
                  The recipient will receive an activation email to securely choose their own password.
                </p>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Lightbox Modal for Proof-of-Work Inspection */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute top-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-zinc-950 hover:bg-white"
            >
              Close
            </button>
            <img
              src={lightboxImage}
              alt="Proof of work inspection"
              className="max-h-[85vh] w-auto object-contain"
            />
          </div>
        </div>
      )}

      {/* Floating Toast Feedback (always visible regardless of scroll) */}
      {(statusBanner || error) && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0">
          {statusBanner && (
            <div className="flex items-center justify-between rounded-2xl border border-emerald-300 bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-xl">
              <span>{statusBanner}</span>
              <button
                type="button"
                onClick={() => setStatusBanner(null)}
                className="ml-3 font-black text-emerald-100 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}
          {error && (
            <div className="flex items-center justify-between rounded-2xl border border-red-300 bg-red-600 px-4 py-3 text-xs font-bold text-white shadow-xl">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="ml-3 font-black text-red-100 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* Minimal Footer */}
      <footer className="border-t border-zinc-200 bg-white py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500 text-center sm:text-left">
          <div className="flex items-center gap-2 font-bold text-zinc-700">
            <span>ICX Studios</span>
            <span>•</span>
            <span>Lagos &amp; Abuja</span>
          </div>
          <div className="text-[11px] font-medium text-zinc-400">© 2026 ICX Studios (LearnArk Technology Limited)</div>
        </div>
      </footer>
    </div>
  );
}
