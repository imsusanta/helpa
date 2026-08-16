'use client';

import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';

interface CtaBannerProps {
  isAuthenticated: boolean;
}

export function LandingCtaBanner({ isAuthenticated }: CtaBannerProps) {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-[#110E3D] p-8 text-center text-white shadow-2xl sm:p-14">
          {/* Subtle Background Glow Circles */}
          <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-[#4EE3C2]/15 blur-3xl" />

          <div className="relative mx-auto max-w-3xl space-y-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[#B4F73C] backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              14-Day Free Trial • Instant 1-Click Setup
            </span>

            <h2 className="text-3xl leading-[1.1] font-extrabold tracking-tight sm:text-5xl">
              Ready to scale your conversations and skip the chaos?
            </h2>

            <p className="mx-auto max-w-xl text-sm text-slate-300 sm:text-base">
              Join thousands of clinics, coaching classes, tutors, salons, and
              real estate professionals growing with Helpa.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
              <Link href={isAuthenticated ? '/dashboard' : '/signup'}>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#C4F135] to-[#4EE3C2] px-8 py-3.5 text-sm font-bold text-[#110E3D] shadow-lg transition-all hover:scale-105 active:scale-98 sm:text-base"
                >
                  <span>
                    {isAuthenticated
                      ? 'Open Helpa Dashboard'
                      : 'Start 14-Day Free Trial'}
                  </span>
                  <ArrowRight className="h-4 w-4 text-[#110E3D]" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
