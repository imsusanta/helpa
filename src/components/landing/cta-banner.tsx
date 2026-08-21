import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

interface CtaBannerProps {
  isAuthenticated: boolean;
}

export function LandingCtaBanner({ isAuthenticated }: CtaBannerProps) {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-[#110E3D] p-8 text-center text-white shadow-2xl sm:p-14">
          <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-[#4EE3C2]/15 blur-3xl" />
          <div className="relative mx-auto max-w-3xl space-y-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[#B4F73C]">
              <Sparkles className="h-3.5 w-3.5" /> Built for independent clinics
            </span>
            <h2 className="text-3xl leading-[1.1] font-extrabold tracking-tight sm:text-5xl">
              Give your front desk a calmer WhatsApp workflow
            </h2>
            <p className="mx-auto max-w-xl text-sm text-slate-300 sm:text-base">
              Start with appointment enquiries, approved FAQs, confirmations,
              reminders, and safe staff takeover.
            </p>
            <div className="pt-4">
              <Link
                href={isAuthenticated ? '/dashboard' : '/signup'}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-r from-[#C4F135] to-[#4EE3C2] px-8 py-3.5 text-sm font-bold text-[#110E3D] shadow-lg sm:text-base"
              >
                {isAuthenticated
                  ? 'Open Helpa Dashboard'
                  : 'Start Clinic Trial'}{' '}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
