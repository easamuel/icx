'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, LogOut, UserCheck } from 'lucide-react';
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
    { href: '/editing', label: 'Photo Editing' },
    { href: '/photographers', label: 'Book Photographers' },
    { href: '/rentals', label: 'Equipment Rental' },
    { href: '/dashboard', label: 'My Account' },
  ];

  if (user?.role === 'photographer' || user?.role === 'admin') {
    navLinks.push({ href: '/portal/photographer', label: 'Photographer Portal' });
  }
  if (user?.role === 'editor' || user?.role === 'admin') {
    navLinks.push({ href: '/workspace/editor', label: 'Editor Workspace' });
  }
  if (user?.role === 'admin') {
    navLinks.push({ href: '/admin', label: 'Admin Control' });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-icx-slate-border bg-icx-slate/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <IcxLogo variant="sand-on-slate" className="h-8 sm:h-9 w-auto" />
        </Link>

        {/* Desktop Links */}
        <nav className="hidden lg:flex items-center gap-6 text-xs xl:text-sm font-medium">
          {navLinks.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`transition-colors ${
                  active
                    ? 'text-icx-sand font-bold underline underline-offset-8'
                    : 'text-icx-sand-muted hover:text-icx-sand'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-icx-slate-border bg-icx-slate-dark px-3 py-1.5 text-xs text-icx-sand">
                <UserCheck className="h-3.5 w-3.5 text-icx-success" />
                <span className="font-semibold">{user.full_name}</span>
                <span className="rounded bg-icx-sand/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-icx-sand">
                  {user.role}
                </span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-icx-slate-border px-3 py-1.5 text-xs font-medium text-icx-sand-muted hover:border-icx-error hover:text-icx-error transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/auth/login"
                className="rounded-lg border border-icx-sand/30 px-3.5 py-1.5 text-xs font-semibold text-icx-sand hover:bg-icx-slate-elevated"
              >
                Sign In
              </Link>
              <Link
                href="/auth/register"
                className="rounded-lg bg-icx-sand px-3.5 py-1.5 text-xs font-bold text-icx-slate hover:bg-icx-sand-light"
              >
                Register
              </Link>
            </div>
          )}
        </div>

        {/* Mobile 360px Hamburger Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label="Toggle Navigation Menu"
          className="lg:hidden rounded-lg border border-icx-slate-border p-2 text-icx-sand"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Responsive Drawer (Zero Horizontal Scroll down to 360px) */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-icx-slate-border bg-icx-slate-dark px-4 py-4 space-y-3">
          <div className="flex flex-col space-y-2">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-icx-sand hover:bg-icx-slate"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-icx-slate-border pt-3 flex items-center justify-between">
            {user ? (
              <>
                <span className="text-xs text-icx-sand-muted truncate max-w-[200px]">
                  {user.full_name} ({user.role})
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-icx-error/40 px-3 py-1.5 text-xs font-semibold text-icx-error"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex w-full gap-2">
                <Link
                  href="/auth/login"
                  className="flex-1 text-center rounded-lg border border-icx-sand/30 py-2 text-xs font-semibold text-icx-sand"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/register"
                  className="flex-1 text-center rounded-lg bg-icx-sand py-2 text-xs font-bold text-icx-slate"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

