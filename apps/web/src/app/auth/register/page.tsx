'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Camera, User, ArrowRight } from 'lucide-react';
import { IcxLogo } from '@/components/brand/IcxLogo';
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
        user: { id: string; role: string };
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
      router.push(role === 'photographer' ? '/portal/photographer' : '/dashboard');
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
    <div className="min-h-screen flex flex-col justify-center bg-zinc-50 px-4 py-12 sm:px-6 lg:px-8 text-zinc-950">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center">
          <IcxLogo variant="dark" />
        </Link>
        <h1 className="mt-6 text-center text-3xl font-black tracking-tight text-zinc-950">
          Create Your Studio Account
        </h1>
        <p className="mt-2 text-center text-xs sm:text-sm text-zinc-600">
          Join as a Client to commission projects or apply to our Verified Photographer Roster.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-3xl border border-zinc-200 bg-white px-6 py-8 shadow-sm sm:px-10">
          <div className="grid grid-cols-2 gap-3 mb-6">
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
            <p className="mb-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs text-zinc-600 leading-relaxed">
              Photographer accounts start in <strong className="text-zinc-950">Pending Review</strong> until verified by ICX Studios’ Creative Directors.
            </p>
          )}

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700">
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
                placeholder="Chidi Okafor"
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

          <div className="mt-6 border-t border-zinc-200 pt-5 text-center text-xs text-zinc-600">
            Already have a studio account?{' '}
            <Link href="/auth/login" className="font-black text-zinc-950 hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
