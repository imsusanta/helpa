'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { CalendarCheck, Clock3, MessageCircle, Sparkles } from 'lucide-react';

interface HeroProps {
  isAuthenticated: boolean;
}

const outcomes = [
  { icon: MessageCircle, label: 'Answer patient questions 24/7' },
  { icon: CalendarCheck, label: 'Book and confirm appointments' },
  { icon: Clock3, label: 'Reduce reception follow-up work' },
];

export function LandingHero({ isAuthenticated }: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#FAF9FC] via-[#F7F5FC] to-[#F1EEFA] pt-32 pb-16">
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp AI receptionist for clinics
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto mb-6 max-w-5xl text-4xl leading-[1.05] font-extrabold tracking-tight text-[#110E3D] sm:text-6xl lg:text-[68px]"
        >
          Turn patient messages into confirmed appointments
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mb-8 max-w-3xl text-base leading-relaxed text-[#55527C] sm:text-xl"
        >
          Helpa helps Indian clinics answer common questions, check doctor
          availability, book visits, and send confirmations through the official
          WhatsApp Cloud API—without replacing the human care team.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Link
            href={isAuthenticated ? '/dashboard' : '/signup'}
            className="flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-r from-[#C4F135] via-[#7EE69D] to-[#4EE3C2] px-8 py-3.5 text-base font-bold text-[#110E3D] shadow-md transition hover:scale-[1.03] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#110E3D]"
          >
            {isAuthenticated ? 'Go to Dashboard' : 'Start Clinic Trial'}
            <Sparkles className="h-4 w-4" />
          </Link>
          <Link
            href="#clinic-workflow"
            className="flex min-h-11 items-center rounded-full border border-slate-300 bg-white px-8 py-3.5 text-base font-bold text-[#110E3D] transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#110E3D]"
          >
            See how it works
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mx-auto grid max-w-4xl gap-3 text-left sm:grid-cols-3"
        >
          {outcomes.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-xl border border-white/80 bg-white/70 p-4 text-sm font-semibold text-slate-700 shadow-sm"
            >
              <Icon className="h-5 w-5 shrink-0 text-emerald-600" />
              <span>{label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
