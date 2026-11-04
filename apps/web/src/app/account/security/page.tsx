'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Shield,
  KeyRound,
  User,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  ArrowRight,
  ExternalLink,
  QrCode,
  LogOut,
} from 'lucide-react';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { apiFetch, clearStoredSession, setStoredSession, ApiError } from '@/lib/api';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: 'customer' | 'photographer' | 'editor' | 'admin';
  two_factor_enabled: boolean;
  email_verified_at: string | null;
  created_at: string;
}

export default function AccountProfileAndSecurityPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Notifications
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Profile Form
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Change Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // 2FA Setup
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null);
  const [twoFactorUri, setTwoFactorUri] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [verifying2FA, setVerifying2FA] = useState(false);

  const loadUserData = useCallback(async () => {
    try {
      const res = await apiFetch<{ user: UserProfile }>('/auth/me');
      setUser(res.user);
      setFullName(res.user.full_name || '');
      setPhone(res.user.phone || '');

      // Sync to local storage
      const token = window.localStorage.getItem('icx_token');
      if (token) {
        setStoredSession(token, res.user);
      }
    } catch {
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifiedParam = params.get('verified');
    const verifyToken = params.get('verify');

    if (verifiedParam === '1') {
      setStatusBanner('Your email address has been verified successfully.');
    }

    if (verifyToken) {
      apiFetch<{ status: string }>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: verifyToken }),
      })
        .then(() => {
          setStatusBanner('Your email address has been confirmed and verified.');
          void loadUserData();
        })
        .catch((err) => {
          setErrorBanner(err instanceof ApiError ? err.message : 'Invalid or expired verification token.');
        });
    }

    void loadUserData();
  }, [loadUserData]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setStatusBanner(null);
    setErrorBanner(null);
    setSavingProfile(true);

    try {
      const res = await apiFetch<{ user: UserProfile }>('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
        }),
      });
      setUser(res.user);
      setStatusBanner('Account profile updated successfully.');
    } catch (err) {
      setErrorBanner(err instanceof ApiError ? err.message : 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setStatusBanner(null);
    setErrorBanner(null);

    if (newPassword.length < 8) {
      setErrorBanner('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorBanner('New passwords do not match. Please verify and retype.');
      return;
    }

    setChangingPassword(true);

    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      setStatusBanner('Your password has been changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setErrorBanner(err instanceof ApiError ? err.message : 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleStart2FASetup() {
    setErrorBanner(null);
    try {
      const res = await apiFetch<{ secret: string; otpauthUri: string }>('/auth/2fa/setup', {
        method: 'POST',
      });
      setTwoFactorSecret(res.secret);
      setTwoFactorUri(res.otpauthUri);
      setShow2FASetup(true);
    } catch (err) {
      setErrorBanner(err instanceof ApiError ? err.message : 'Failed to initialize 2FA setup.');
    }
  }

  async function handleVerify2FA(e: React.FormEvent) {
    e.preventDefault();
    setErrorBanner(null);
    setVerifying2FA(true);

    try {
      await apiFetch('/auth/2fa/enable', {
        method: 'POST',
        body: JSON.stringify({ totp_code: totpCode.trim() }),
      });
      setStatusBanner('Two-Factor Authentication (2FA) is now enabled for your account.');
      setShow2FASetup(false);
      setTotpCode('');
      await loadUserData();
    } catch (err) {
      setErrorBanner(err instanceof ApiError ? err.message : 'Invalid authenticator code.');
    } finally {
      setVerifying2FA(false);
    }
  }

  async function handleResendVerification() {
    setErrorBanner(null);
    try {
      await apiFetch('/auth/resend-verification', { method: 'POST' });
      setStatusBanner(`A verification link has been sent to ${user?.email}.`);
    } catch (err) {
      setErrorBanner(err instanceof ApiError ? err.message : 'Failed to resend confirmation email.');
    }
  }

  function handleLogout() {
    clearStoredSession();
    router.push('/auth/login');
  }

  const roleTitle =
    user?.role === 'photographer'
      ? 'Studio Photographer'
      : user?.role === 'editor'
      ? 'Senior Retoucher & Editor'
      : user?.role === 'admin'
      ? 'Executive Administrator'
      : 'Studio Client';

  const portalHref =
    user?.role === 'photographer'
      ? '/portal/photographer'
      : user?.role === 'editor'
      ? '/workspace/editor'
      : user?.role === 'admin'
      ? '/admin'
      : '/dashboard';

  const portalLabel =
    user?.role === 'photographer'
      ? 'Go to Photographer Workspace'
      : user?.role === 'editor'
      ? 'Go to Retouching Queue'
      : user?.role === 'admin'
      ? 'Go to Admin Console'
      : 'Go to Client Dashboard';

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
                Account Profile &amp; Settings
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-zinc-600">
                Manage your personal information, credentials, and two-factor authentication.
              </p>
            </div>

            <Link
              href={portalHref}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 transition"
            >
              <span>{portalLabel}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Feedback Banners */}
          {statusBanner && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900 shadow-xs">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{statusBanner}</span>
            </div>
          )}

          {errorBanner && (
            <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-900 shadow-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{errorBanner}</span>
            </div>
          )}

          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-zinc-900 border-r-transparent" />
              <p className="mt-4 text-xs font-semibold text-zinc-600">Loading account details...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8">
              {/* SECTION 1: Personal Profile */}
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm">
                <div className="flex items-center gap-3 border-b border-zinc-100 pb-4 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-zinc-950">Profile Information</h2>
                    <p className="text-xs text-zinc-500">Your public identity and contact details.</p>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+234 800 000 0000"
                        className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                        Account Email Address
                      </label>
                      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-100 px-3.5 py-2.5 text-sm text-zinc-800">
                        <span className="truncate font-medium">{user?.email}</span>
                        {user?.email_verified_at ? (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            Verified
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleResendVerification}
                            className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 hover:bg-amber-200"
                          >
                            Unverified (Resend)
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                        Platform Role &amp; Access Tier
                      </label>
                      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-100 px-3.5 py-2.5 text-sm text-zinc-800">
                        <span className="font-bold text-zinc-900">{roleTitle}</span>
                        <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-[10px] font-black text-white uppercase tracking-wider">
                          {user?.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="rounded-xl bg-zinc-950 px-5 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition"
                    >
                      {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                    </button>
                  </div>
                </form>
              </div>

              {/* SECTION 2: Security & Password */}
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm">
                <div className="flex items-center gap-3 border-b border-zinc-100 pb-4 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-zinc-950">Change Password</h2>
                    <p className="text-xs text-zinc-500">Ensure your account uses a confidential, strong password.</p>
                  </div>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                      Current Password
                    </label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={8}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min 8 characters"
                          className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                        Confirm New Password
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Retype password"
                        className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={changingPassword}
                      className="rounded-xl bg-zinc-950 px-5 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition"
                    >
                      {changingPassword ? 'Updating Password...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>

              {/* SECTION 3: Two-Factor Authentication (2FA) */}
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm">
                <div className="flex items-center gap-3 border-b border-zinc-100 pb-4 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-zinc-950">Two-Factor Authentication (2FA)</h2>
                    <p className="text-xs text-zinc-500">Add an extra layer of security using Google Authenticator or 1Password.</p>
                  </div>
                </div>

                {user?.two_factor_enabled ? (
                  <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-950">2FA Protection Active</p>
                        <p className="text-[11px] text-emerald-800">Your account requires a 6-digit authenticator code on each sign-in.</p>
                      </div>
                    </div>
                  </div>
                ) : show2FASetup ? (
                  <div className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                    <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Configure Authenticator App</h3>
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      1. Open your authenticator app (Google Authenticator, Apple Passwords, or 1Password).<br/>
                      2. Add a new manual key using the code below:
                    </p>
                    <div className="rounded-xl border border-zinc-300 bg-white p-3 font-mono text-sm font-bold text-zinc-950 text-center tracking-widest break-all select-all">
                      {twoFactorSecret}
                    </div>

                    <form onSubmit={handleVerify2FA} className="pt-2 space-y-3 max-w-sm">
                      <label className="block text-xs font-bold text-zinc-800">
                        Enter 6-Digit Verification Code
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-center font-mono text-lg font-bold tracking-widest text-zinc-950 focus:border-zinc-950 focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={verifying2FA || totpCode.length !== 6}
                          className="flex-1 rounded-xl bg-zinc-950 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition"
                        >
                          {verifying2FA ? 'Verifying...' : 'Enable 2FA'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShow2FASetup(false)}
                          className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div>
                      <p className="text-xs font-bold text-zinc-950">Two-Factor Authentication is Not Enabled</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Protect your bookings, payouts, and client edits from unauthorized access.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleStart2FASetup}
                      className="rounded-xl bg-zinc-950 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition"
                    >
                      Set Up 2FA
                    </button>
                  </div>
                )}
              </div>

              {/* SECTION 4: Sign Out */}
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-black text-zinc-950">Sign Out of Session</h2>
                  <p className="text-xs text-zinc-500">Sign out of your active ICX Studios session on this browser.</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 hover:border-red-300 hover:bg-red-50 hover:text-red-700 px-4 py-2.5 text-xs font-bold text-zinc-700 transition"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
