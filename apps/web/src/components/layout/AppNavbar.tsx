'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Menu,
  X,
  LogOut,
  Sliders,
  Camera,
  PackageCheck,
  LayoutDashboard,
  Shield,
} from 'lucide-react';
import { IcxLogo } from '@/components/brand/IcxLogo';
import { apiFetch, clearStoredSession } from '@/lib/api';

interface StoredUser {
  id: string;
  email: string;
  full_name: string;
  role: 'customer' | 'photographer' | 'editor' | 'admin';
}

export function AppNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem('icx_user');
    if (raw) {
      try {
        setUser(JSON.parse(raw) as StoredUser);
      } catch {
        setUser(null);
      }
    }
  }, [pathname]);

  async function handleLogout() {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network error on logout
    }
    clearStoredSession();
    setUser(null);
    router.push('/auth/login');
  }

  const navLinks = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/editing', label: 'Photo Editing', icon: Sliders },
    { href: '/photographers', label: 'Photographers', icon: Camera },
    { href: '/rentals', label: 'Rent Equipment', icon: PackageCheck },
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ];

  if (user?.role === 'photographer' || user?.role === 'admin') {
    navLinks.push({ href: '/portal/photographer', label: 'Photographer Portal', icon: Camera });
  }
  if (user?.role === 'editor' || user?.role === 'admin') {
    navLinks.push({ href: '/workspace/editor', label: 'Editor Queue', icon: Sliders });
  }
  if (user?.role === 'admin') {
    navLinks.push({ href: '/admin', label: 'Admin', icon: Shield });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950 text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="ICX Studios Home"
          className="inline-flex items-center shrink-0"
        >
          <IcxLogo variant="light" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1" aria-label="Main Navigation">
          {navLinks.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-xs xl:text-sm font-semibold transition-all ${
                  active
                    ? 'bg-white text-zinc-950'
                    : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="hidden lg:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2.5">
              <Link
                href="/account/security"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:border-zinc-600 transition-colors"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="max-w-[140px] truncate">{user.full_name}</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 hover:border-red-500 hover:text-red-400 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Link
                href="/auth/login"
                className={`rounded-full border px-4 py-2 text-xs font-bold transition-all ${
                  pathname === '/auth/login'
                    ? 'border-white bg-white text-zinc-950'
                    : 'border-zinc-700 bg-zinc-900 text-white hover:border-white'
                }`}
              >
                Sign In
              </Link>
              <Link
                href="/auth/register"
                className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-bold transition-all ${
                  pathname === '/auth/register'
                    ? 'bg-emerald-400 text-zinc-950'
                    : 'bg-white text-zinc-950 hover:bg-zinc-200'
                }`}
              >
                Create Account
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label="Toggle Menu"
          className="lg:hidden rounded-xl border border-zinc-800 p-2 text-white hover:bg-zinc-900"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-zinc-800 bg-zinc-950 px-4 py-5 space-y-4">
          <div className="flex flex-col space-y-1.5">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold ${
                    active
                      ? 'bg-white text-zinc-950'
                      : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
          <div className="border-t border-zinc-800 pt-4 flex items-center justify-between">
            {user ? (
              <>
                <div className="text-xs">
                  <div className="font-bold text-white">{user.full_name}</div>
                  <div className="text-zinc-400 text-[11px]">{user.email}</div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-red-800 bg-red-950/60 px-3.5 py-1.5 text-xs font-bold text-red-300"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex w-full gap-2.5">
                <Link
                  href="/auth/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center rounded-full border border-zinc-700 py-2.5 text-xs font-bold text-white"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center rounded-full bg-white py-2.5 text-xs font-bold text-zinc-950"
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
