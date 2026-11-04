'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Camera, User, ArrowRight } from 'lucide-react';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { apiFetch, setStoredSession, ApiError } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<'customer' | 'photographer'>('customer');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch<{
        accessToken: string;
        user: { id: string; email: string; full_name: string; role: string };
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone,
          password,
          role,
        }),
      });

      setStoredSession(res.accessToken, res.user);
      router.push(`/account/security?registered=1&email=${encodeURIComponent(email)}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Registration failed. Please verify your connection.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden border border-zinc-200 bg-white shadow-sm">
          {/* Left 5 Columns: Nigerian Creative Roster Showcase */}
          <div className="hidden lg:flex lg:col-span-5 flex-col justify-between bg-zinc-950 p-10 text-white">
            <div className="space-y-5">
              <div className="overflow-hidden rounded-2xl border border-zinc-800 h-60 w-full">
                <img
                  src="https://images.unsplash.com/photo-1531384441138-2736e62e0919?auto=format&fit=crop&w=900&q=85"
                  alt="ICX Studios Nigerian Photographer"
                  className="h-full w-full object-cover"
                />
              </div>
              <h2 className="text-2xl font-black tracking-tight leading-snug">
                Built for Nigeria’s Leading Brands, Agencies &amp; Visual Creators.
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Every new account receives an instant confirmation email from our studio server. Verify your email address to unlock full retouching, booking, and cinema rental privileges.
              </p>
            </div>

            <div className="border-t border-zinc-800 pt-5 text-xs text-zinc-400">
              Instant Email Confirmation • Paystack Escrow Protection
            </div>
          </div>

          {/* Right 7 Columns: Registration Form */}
          <div className="lg:col-span-7 flex flex-col justify-center p-6 sm:p-10 lg:p-12">
            <div className="mx-auto w-full max-w-md space-y-6">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-zinc-950">
                  Create Your Studio Account
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-zinc-600">
                  Join as a Client to commission projects or apply to our Verified Photographer Roster.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('customer')}
                  className={`flex items-center justify-center gap-2 rounded-2xl border-2 py-3 px-3 text-xs font-black transition-all ${
                    role === 'customer'
                      ? 'border-zinc-950 bg-zinc-950 text-white shadow'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-700'
                  }`}
                >
                  <User className="h-4 w-4" />
                  <span>Client Account</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('photographer')}
                  className={`flex items-center justify-center gap-2 rounded-2xl border-2 py-3 px-3 text-xs font-black transition-all ${
                    role === 'photographer'
                      ? 'border-zinc-950 bg-zinc-950 text-white shadow'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-700'
                  }`}
                >
                  <Camera className="h-4 w-4" />
                  <span>Photographer</span>
                </button>
              </div>

              {role === 'photographer' && (
                <p className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs text-zinc-600 leading-relaxed">
                  Photographer accounts start in <strong className="text-zinc-950">Pending Review</strong> until verified by ICX Studios’ Creative Directors.
                </p>
              )}

              {error && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-zinc-900">
                    Full Name / Studio Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1.5 block w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-4 py-3 text-sm text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                    placeholder="Chukwudi Okafor"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-zinc-900">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 block w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-4 py-3 text-sm text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                    placeholder="you@company.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-zinc-900">
                    Phone Number (WhatsApp Active)
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1.5 block w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-4 py-3 text-sm text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                    placeholder="+234 800 000 0000"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-zinc-900">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1.5 block w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-4 py-3 text-sm text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                    placeholder="Min 8 chars, uppercase, lowercase & digit"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 py-3.5 text-sm font-black text-white shadow-xl hover:bg-zinc-800 disabled:opacity-50 transition-all"
                >
                  <span>
                    {loading
                      ? 'Creating Account...'
                      : role === 'photographer'
                        ? 'Submit Photographer Application'
                        : 'Create Client Account'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <div className="border-t border-zinc-200 pt-5 text-center text-xs text-zinc-600">
                Already have a studio account?{' '}
                <Link href="/auth/login" className="font-black text-zinc-950 hover:underline">
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
