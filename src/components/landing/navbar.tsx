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
    const handleScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <div
        className={`mx-auto w-full max-w-6xl rounded-[22px] border transition-all duration-300 sm:rounded-full ${
          scrolled
            ? 'border-slate-200/80 bg-white/95 shadow-[0_12px_40px_rgba(17,14,61,0.10)] backdrop-blur-xl'
            : 'border-white/70 bg-white/85 shadow-[0_8px_30px_rgba(17,14,61,0.07)] backdrop-blur-lg'
        }`}
      >
        <div className="flex min-h-[62px] items-center justify-between gap-3 px-4 sm:min-h-[68px] sm:px-5 lg:px-6">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/helpa-logo.svg?v=4"
              alt="Helpa"
              className="h-9 w-9 rounded-xl object-contain shadow-sm transition-transform duration-200 group-hover:scale-105"
            />
            <span className="text-[22px] font-extrabold tracking-[-0.04em] text-[#110E3D]">
              helpa<span className="text-[#16A34A]">.</span>
            </span>
          </Link>

          <nav
            className="hidden items-center gap-0.5 rounded-full border border-slate-200/70 bg-slate-50/70 p-1 md:flex"
            aria-label="Primary navigation"
          >
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-[13px] font-semibold text-[#110E3D]/70 transition-all duration-200 hover:bg-white hover:text-[#110E3D] hover:shadow-sm lg:px-4.5"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2.5 md:flex">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="group flex min-h-10 items-center gap-2 rounded-full bg-[#110E3D] px-5 py-2 text-[13px] font-bold text-white shadow-[0_7px_18px_rgba(17,14,61,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(17,14,61,0.22)]"
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4 text-[#B4F73C] transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-full px-3.5 py-2 text-[13px] font-semibold text-[#110E3D]/75 transition-colors hover:text-[#16A34A]"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="group flex min-h-10 items-center gap-1.5 rounded-full bg-[#110E3D] px-5 py-2 text-[13px] font-bold text-white shadow-[0_7px_18px_rgba(17,14,61,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(17,14,61,0.22)]"
                >
                  Start Clinic Trial
                  <ArrowRight className="h-3.5 w-3.5 text-[#B4F73C] transition-transform group-hover:translate-x-0.5" />
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-white/80 text-[#110E3D] transition-colors hover:bg-white md:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <nav
            className="mx-2 mb-2 space-y-1 rounded-[18px] border border-slate-200/80 bg-white/95 p-2 shadow-sm backdrop-blur-xl md:hidden"
            aria-label="Mobile navigation"
          >
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-11 items-center rounded-xl px-3.5 text-sm font-semibold text-[#110E3D]/80 transition-colors hover:bg-slate-50 hover:text-[#110E3D]"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-1 flex flex-col gap-2 border-t border-slate-100 px-1 pt-3">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#110E3D] text-sm font-bold text-white"
                >
                  Go to Dashboard
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
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#110E3D] text-sm font-bold text-white"
                  >
                    Start Clinic Trial
                    <ArrowRight className="h-4 w-4 text-[#B4F73C]" />
                  </Link>
                </>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
