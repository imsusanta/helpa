'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';

interface NavbarProps {
  isAuthenticated: boolean;
}

const NAV_ITEMS = [
  { href: '#clinic-workflow', label: 'How it works' },
  { href: '#features', label: 'Product' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#security', label: 'Security' },
];

export function LandingNavbar({ isAuthenticated }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 right-0 left-0 z-50 transition-all ${scrolled ? 'border-b border-slate-100 bg-white/90 py-3 shadow-sm backdrop-blur-md' : 'bg-white py-4'}`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="group flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/helpa-logo.png"
              alt="Helpa"
              className="h-9 w-9 rounded-xl object-contain shadow-sm transition-transform group-hover:scale-105"
            />
            <span className="text-2xl font-extrabold tracking-tight text-[#110E3D]">
              helpa<span className="text-[#0866FF]">.</span>
            </span>
          </Link>
          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Primary navigation"
          >
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3.5 py-2 text-sm font-semibold text-[#110E3D]/80 transition-colors hover:bg-slate-50 hover:text-[#110E3D]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="flex min-h-11 items-center gap-2 rounded-full bg-[#110E3D] px-6 py-2.5 text-sm font-semibold text-white shadow-md"
            >
              Go to Dashboard <ArrowRight className="h-4 w-4 text-[#B4F73C]" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-semibold text-[#110E3D] hover:text-[#0866FF]"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="flex min-h-11 items-center rounded-full bg-[#110E3D] px-5 py-2.5 text-sm font-semibold text-white shadow-md"
              >
                Start Clinic Trial
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[#110E3D] hover:bg-slate-100 md:hidden"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <nav
          className="space-y-1 border-b border-slate-100 bg-white px-4 pt-2 pb-6 md:hidden"
          aria-label="Mobile navigation"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block min-h-11 py-3 text-base font-semibold text-[#110E3D]"
            >
              {item.label}
            </Link>
          ))}
          <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#110E3D] text-sm font-semibold text-white"
              >
                Go to Dashboard{' '}
                <ArrowRight className="h-4 w-4 text-[#B4F73C]" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-[#110E3D]"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-11 items-center justify-center rounded-xl bg-[#110E3D] text-sm font-semibold text-white"
                >
                  Start Clinic Trial
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
