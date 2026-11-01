'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Camera, User } from 'lucide-react';
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
    <div className="min-h-screen flex flex-col justify-center bg-icx-slate px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center">
          <IcxLogo variant="sand-on-slate" className="h-11 w-auto" />
        </Link>
        <h1 className="mt-6 text-center text-2xl font-bold tracking-tight text-icx-sand">
          Create your ICX Studios Account
        </h1>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-icx-slate-border bg-icx-slate-dark px-6 py-8 shadow-xl sm:px-10">
          {/* Role Selector (AC-01 vs AC-04) */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => setRole('customer')}
              className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-3 text-xs font-semibold transition-all ${
                role === 'customer'
                  ? 'border-icx-sand bg-icx-sand text-icx-slate'
                  : 'border-icx-slate-border bg-icx-slate text-icx-sand-muted'
              }`}
            >
              <User className="h-4 w-4" />
              <span>Customer</span>
            </button>
            <button
              type="button"
              onClick={() => setRole('photographer')}
              className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-3 text-xs font-semibold transition-all ${
                role === 'photographer'
                  ? 'border-icx-sand bg-icx-sand text-icx-slate'
                  : 'border-icx-slate-border bg-icx-slate text-icx-sand-muted'
              }`}
            >
              <Camera className="h-4 w-4" />
              <span>Photographer</span>
            </button>
          </div>

          {role === 'photographer' && (
            <p className="mb-5 rounded-xl border border-icx-sand/20 bg-icx-slate p-3 text-xs text-icx-sand-muted">
              Photographer accounts start in <strong className="text-icx-sand">Pending Approval</strong> status until reviewed by an ICX Studios administrator.
            </p>
          )}

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-icx-error/40 bg-icx-error/10 p-3.5 text-xs text-icx-error">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-icx-sand">
                Full Name / Studio Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2.5 text-sm text-icx-sand focus:border-icx-sand focus:outline-none"
                placeholder="Chidi Okafor"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-icx-sand">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2.5 text-sm text-icx-sand focus:border-icx-sand focus:outline-none"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-icx-sand">
                Phone Number (WhatsApp Active)
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2.5 text-sm text-icx-sand focus:border-icx-sand focus:outline-none"
                placeholder="+234 800 000 0000"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-icx-sand">
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-icx-slate-border bg-icx-slate px-3.5 py-2.5 text-sm text-icx-sand focus:border-icx-sand focus:outline-none"
                placeholder="Min 8 chars, uppercase, lowercase & digit"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-icx-sand py-3 text-sm font-bold text-icx-slate shadow hover:bg-icx-sand-light disabled:opacity-50 transition-colors"
            >
              {loading
                ? 'Creating Account...'
                : role === 'photographer'
                  ? 'Submit Photographer Application'
                  : 'Create Customer Account'}
            </button>
          </form>

          <div className="mt-6 border-t border-icx-slate-border pt-5 text-center text-xs text-icx-sand-muted">
            Already registered?{' '}
            <Link href="/auth/login" className="font-semibold text-icx-sand hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

