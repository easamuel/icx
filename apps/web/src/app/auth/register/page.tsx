'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Camera,
  UserCheck,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Upload,
  X,
  MailCheck,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import {
  apiFetch,
  setStoredSession,
  ApiError,
  sanitizeNigerianPhoneInput,
  validateNigerianPhone,
} from '@/lib/api';

interface RegisterResponse {
  user: {
    id: string;
    email: string;
    full_name: string;
    role: 'customer' | 'photographer';
  };
  accessToken: string;
}

const SPECIALTY_OPTIONS = [
  'Editorial & Portrait Photography',
  'Wedding & Luxury Events',
  'Commercial & Product Studio',
  'Fashion & Beauty',
  'Documentary & Lifestyle',
  'Architecture & Real Estate',
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

export default function RegisterPage() {
  const [role, setRole] = useState<'customer' | 'photographer'>('customer');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Photographer onboarding fields
  const [location, setLocation] = useState('Lagos, Nigeria');
  const [specialty, setSpecialty] = useState(SPECIALTY_OPTIONS[0]);
  const [yearsExperience, setYearsExperience] = useState('3');
  const [bio, setBio] = useState('');
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>([]);
  const [uploadingProof, setUploadingProof] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  function handlePhoneChange(val: string) {
    const sanitized = sanitizeNigerianPhoneInput(val);
    setPhone(sanitized);
    if (sanitized.length === 11) {
      setPhoneError(validateNigerianPhone(sanitized));
    } else {
      setPhoneError(null);
    }
  }

  async function handleProofFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const remainingSlots = 10 - portfolioUrls.length;
    if (remainingSlots <= 0) {
      setError('You can upload a maximum of 10 proof-of-work images.');
      return;
    }

    const batch = files.slice(0, remainingSlots);
    setUploadingProof(true);
    setError(null);

    try {
      const uploaded: string[] = [];
      for (const file of batch) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          throw new Error(`${file.name} is not a JPEG, PNG, or WEBP image.`);
        }
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`${file.name} exceeds the 10MB file size limit.`);
        }
        const base64Data = await fileToBase64(file);
        const res = await apiFetch<{ url: string }>('/uploads/portfolio-proof', {
          method: 'POST',
          body: JSON.stringify({ base64Data }),
        });
        uploaded.push(res.url);
      }
      setPortfolioUrls((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload proof-of-work image.');
    } finally {
      setUploadingProof(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const pErr = validateNigerianPhone(phone);
    if (pErr) {
      setPhoneError(pErr);
      setError(pErr);
      return;
    }

    if (role === 'photographer') {
      if (bio.trim().length < 20) {
        setError('Please write a professional bio of at least 20 characters.');
        return;
      }
      if (portfolioUrls.length < 3) {
        setError('Please upload at least 3 proof-of-work portfolio images (3–10 required).');
        return;
      }
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        full_name: fullName.trim(),
        email: email.trim(),
        phone,
        password,
        role,
      };

      if (role === 'photographer') {
        payload.location = location.trim();
        payload.specialty = specialty;
        payload.years_experience = Number(yearsExperience) || 0;
        payload.bio = bio.trim();
        payload.portfolio_urls = portfolioUrls;
      }

      const res = await apiFetch<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setStoredSession(res.accessToken, res.user);
      setRegisteredEmail(res.user.email);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to create account right now.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    setResending(true);
    setResendMessage(null);
    try {
      const res = await apiFetch<{ message: string }>('/auth/resend-verification', {
        method: 'POST',
      });
      setResendMessage(res.message);
    } catch (err) {
      setResendMessage(err instanceof Error ? err.message : 'Unable to resend verification email.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-12">
        {registeredEmail ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-8 sm:p-10 shadow-sm text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
              <MailCheck className="h-8 w-8 text-emerald-600" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950">
                Check Your Email to Verify Your Account
              </h1>
              <p className="text-sm text-zinc-600 max-w-md mx-auto">
                We sent a confirmation link to <strong className="text-zinc-950">{registeredEmail}</strong>.
                Click the link in your inbox to verify your email address.
              </p>
            </div>

            {role === 'photographer' && (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-left space-y-2 text-xs text-zinc-700">
                <p className="font-bold text-zinc-950 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Photographer Verification Pipeline
                </p>
                <p>
                  1. Verify your email address using the link we just sent.
                  <br />
                  2. Once verified, your proof-of-work portfolio enters our Admin Review Queue.
                  <br />
                  3. You will receive an approval email as soon as your profile goes live on ICXORA.
                </p>
              </div>
            )}

            {resendMessage && (
              <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                {resendMessage}
              </p>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={resending}
                onClick={handleResendVerification}
                className="rounded-full border border-zinc-300 bg-white px-6 py-3 text-xs font-bold text-zinc-950 hover:bg-zinc-50 disabled:opacity-50"
              >
                {resending ? 'Sending...' : 'Resend Verification Email'}
              </button>
              <Link
                href={role === 'photographer' ? '/photographer/status' : '/dashboard'}
                className="rounded-full bg-zinc-950 px-6 py-3 text-xs font-black text-white hover:bg-zinc-800"
              >
                {role === 'photographer' ? 'View Application Status →' : 'Go to Dashboard →'}
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-black tracking-tight text-zinc-950">
                Create Your ICXORA Account
              </h1>
              <p className="mt-2 text-sm text-zinc-600">
                Join as a client or apply as a verified partner photographer.
              </p>
            </div>

            {/* Role Toggle */}
            <div className="mb-6 grid grid-cols-2 gap-3 rounded-2xl bg-zinc-100 p-1.5">
              <button
                type="button"
                onClick={() => {
                  setRole('customer');
                  setError(null);
                }}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
                  role === 'customer'
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                <UserCheck className="h-4 w-4" />
                <span>Client Account</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRole('photographer');
                  setError(null);
                }}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
                  role === 'photographer'
                    ? 'bg-zinc-950 text-white shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                <Camera className="h-4 w-4" />
                <span>Photographer</span>
              </button>
            </div>

            {role === 'customer' && (
              <div className="mb-6 space-y-4">
                <a
                  href="/api/v1/auth/google?intent=register"
                  className="w-full inline-flex items-center justify-center gap-2.5 rounded-full border border-zinc-300 bg-white py-3 text-sm font-bold text-zinc-950 hover:bg-zinc-50 transition-all"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                  <span>Sign up with Google</span>
                </a>

                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-zinc-200" />
                  <span className="mx-3 shrink-0 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Or register with email
                  </span>
                  <div className="flex-grow border-t border-zinc-200" />
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-950 focus:border-zinc-950 focus:outline-none"
                    placeholder="Firstname Lastname"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700">
                    Nigerian Phone Number (11 Digits)
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    required
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className={`mt-1 block w-full rounded-xl border px-3.5 py-2.5 text-sm text-zinc-950 focus:outline-none ${
                      phoneError
                        ? 'border-red-400 focus:border-red-600'
                        : 'border-zinc-300 focus:border-zinc-950'
                    }`}
                    placeholder="08012345678"
                  />
                  {phoneError && (
                    <p className="mt-1 text-[11px] font-medium text-red-600">{phoneError}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-950 focus:border-zinc-950 focus:outline-none"
                    placeholder="you@domain.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700">Password</label>
                  <div className="relative mt-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 pr-10 text-sm text-zinc-950 focus:border-zinc-950 focus:outline-none"
                      placeholder="Min 8 chars, 1 upper, 1 number"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Dedicated Photographer Application Fields */}
              {role === 'photographer' && (
                <div className="mt-4 pt-5 border-t border-zinc-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black text-zinc-950">
                      Photographer Application &amp; Proof of Work
                    </h2>
                    <span className="rounded-full bg-amber-100 text-amber-900 px-2.5 py-0.5 text-[10px] font-bold uppercase">
                      Admin Review Required
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700">City / Location</label>
                      <input
                        type="text"
                        required
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Lagos, Nigeria"
                        className="mt-1 block w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-950 focus:border-zinc-950 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-700">Specialty</label>
                      <select
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-950 focus:border-zinc-950 focus:outline-none"
                      >
                        {SPECIALTY_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-700">
                        Years Experience
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={60}
                        required
                        value={yearsExperience}
                        onChange={(e) => setYearsExperience(e.target.value)}
                        className="mt-1 block w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-950 focus:border-zinc-950 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700">
                      Professional Bio (min 20 characters)
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Describe your photography style, studio gear, and notable shoots..."
                      className="mt-1 block w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-950 focus:border-zinc-950 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-zinc-700">
                        Proof-of-Work Portfolio (3 to 10 Images Required)
                      </label>
                      <span className="text-[11px] font-bold text-zinc-500">
                        {portfolioUrls.length} / 10 uploaded
                      </span>
                    </div>

                    <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-5 text-center cursor-pointer hover:border-zinc-950 transition-colors">
                      {uploadingProof ? (
                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-700">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Uploading proof-of-work images...</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-6 h-6 text-zinc-500 mb-1.5" />
                          <span className="text-xs font-bold text-zinc-900">
                            Click to upload portfolio photos (JPEG, PNG, WEBP • max 10MB each)
                          </span>
                          <span className="text-[11px] text-zinc-500 mt-0.5">
                            Minimum 3 images required for curator verification
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleProofFilesSelected}
                        className="hidden"
                      />
                    </label>

                    {portfolioUrls.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 pt-2">
                        {portfolioUrls.map((url, idx) => (
                          <div
                            key={`${url}-${idx}`}
                            className="relative group aspect-square rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100"
                          >
                            <img
                              src={url}
                              alt={`Proof of work ${idx + 1}`}
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setPortfolioUrls((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="absolute top-1 right-1 rounded-full bg-zinc-950/80 p-1 text-white hover:bg-red-600"
                              aria-label="Remove image"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || uploadingProof}
                className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 py-3.5 text-sm font-black text-white shadow-xl hover:bg-zinc-800 disabled:opacity-50 transition-all"
              >
                <span>
                  {loading
                    ? 'Creating Account...'
                    : role === 'photographer'
                    ? 'Submit Photographer Application'
                    : 'Create Account'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-6 border-t border-zinc-200 pt-6 text-center text-xs text-zinc-600">
              Already have an account?{' '}
              <Link href="/auth/login" className="font-semibold text-zinc-950 hover:underline">
                Sign in
              </Link>
            </div>
          </div>
        )}
      </main>

      <AppFooter />
    </div>
  );
}
