'use client';

import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';

interface CtaBannerProps {
  isAuthenticated: boolean;
}

export function LandingCtaBanner({ isAuthenticated }: CtaBannerProps) {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-[#110E3D] p-8 sm:p-14 text-center text-white relative overflow-hidden shadow-2xl">
          {/* Subtle Background Glow Circles */}
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[#4EE3C2]/15 blur-3xl pointer-events-none" />

          <div className="relative max-w-3xl mx-auto space-y-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-[#B4F73C] backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5" />
              14-Day Free Trial • Instant 1-Click Setup
            </span>

            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.1]">
              Ready to scale your conversations and skip the chaos?
            </h2>

            <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
              Join thousands of clinics, coaching classes, tutors, salons, and real estate professionals growing with Helpa.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href={isAuthenticated ? '/dashboard' : '/signup'}>
                <button
                  type="button"
                  className="px-8 py-3.5 rounded-full bg-gradient-to-r from-[#C4F135] to-[#4EE3C2] text-[#110E3D] font-bold text-sm sm:text-base shadow-lg hover:scale-105 active:scale-98 transition-all flex items-center gap-2"
                >
                  <span>{isAuthenticated ? 'Open Helpa Dashboard' : 'Start 14-Day Free Trial'}</span>
                  <ArrowRight className="w-4 h-4 text-[#110E3D]" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
