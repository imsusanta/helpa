'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  GraduationCap,
  BookOpen,
  Scissors,
  Building2,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

const INDUSTRIES = [
  {
    id: 'health',
    name: 'Health & Clinic',
    icon: Stethoscope,
    badge: 'Healthcare & Doctors',
    title: '24/7 AI Receptionist for Clinics & Doctors',
    description:
      'Answer patient queries around the clock, book doctor consultations with zero double-bookings, and deliver digital OPD slips and lab reports instantly on WhatsApp.',
    benefits: [
      'Instant appointment booking with live doctor schedule checking',
      'Automatic digital OPD slips & tokens delivered to patients in 2 seconds',
      'Automated WhatsApp reminders so patients never miss their visits',
      'Send lab test reports and prescription updates directly on chat',
    ],
  },
  {
    id: 'coaching',
    name: 'Coaching Institute',
    icon: GraduationCap,
    badge: 'Education & Classes',
    title: 'AI Admission Assistant for Coaching Classes',
    description:
      'Turn course inquiries into enrolled students. Answer fee and syllabus questions 24/7, track admissions, and send automated fee payment reminders to parents.',
    benefits: [
      'Instant 24/7 replies to course, batch timing, and fee inquiries',
      'Simple admission pipeline to follow up with interested students',
      'Automated parent fee payment reminders and payment confirmations',
      'Announce new batches to thousands of students with 1-click broadcasts',
    ],
  },
  {
    id: 'tutor',
    name: 'Solo Tutor',
    icon: BookOpen,
    badge: 'Independent Teachers',
    title: 'WhatsApp Assistant for Private Teachers & Tutors',
    description:
      'Keep parents updated without answering dozens of phone calls during your teaching hours. Automate class schedules, homework alerts, and test score updates.',
    benefits: [
      'Automated class reminders sent 2 hours before every session',
      'Smart parent chat management for siblings and multi-child families',
      'Homework reminders and test score updates delivered directly to parents',
      'Simple, clean, and built for independent teachers with zero tech clutter',
    ],
  },
  {
    id: 'salon',
    name: 'Salon & Spa',
    icon: Scissors,
    badge: 'Beauty & Wellness',
    title: '24/7 Booking Assistant for Salons & Beauty Studios',
    description:
      'Keep your salon chairs booked all day. Showcase hair and beauty menus, check stylist timings in real time, and bring customers back every month on autopilot.',
    benefits: [
      'Clients can view service menus and book slots in under 30 seconds',
      'Real-time stylist calendar management with zero double-bookings',
      'Instant one-tap rescheduling for busy clients on WhatsApp',
      'Automated 30-day friendly reminders for repeat cuts, facials & spas',
    ],
  },
  {
    id: 'real_estate',
    name: 'Real Estate',
    icon: Building2,
    badge: 'Property & Brokers',
    title: 'Instant Lead Matcher for Real Estate Brokers & Agencies',
    description:
      'Never lose a high-value buyer lead again. Capture inquiries instantly, match buyer budgets to available listings, and book site visits automatically on WhatsApp.',
    benefits: [
      'Instant replies to property buyers within 3 seconds of inquiry',
      'Automatically match buyer budgets and preferred areas to listings',
      'Schedule site visits and automatically assign leads to your field agents',
      'Smart WhatsApp follow-ups that turn casual inquiries into serious buyers',
    ],
  },
];

export function LandingIndustrySolutions() {
  const [selectedIndustry, setSelectedIndustry] = useState(INDUSTRIES[0]);

  return (
    <section id="industries" className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <span className="mb-3 inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
            Modular Industry Workspaces
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#110E3D] sm:text-4xl">
            Built specifically for your business workflow
          </h2>
          <p className="mt-3 text-base text-slate-500">
            Helpa adapts terminology, features, and AI workflows dynamically to
            match your exact industry.
          </p>
        </div>

        {/* Industry Pill Selector */}
        <div className="mb-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {INDUSTRIES.map((ind) => {
            const Icon = ind.icon;
            const isSelected = selectedIndustry.id === ind.id;
            return (
              <button
                key={ind.id}
                type="button"
                onClick={() => setSelectedIndustry(ind)}
                className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold transition-all sm:text-sm ${
                  isSelected
                    ? 'scale-105 bg-[#110E3D] text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{ind.name}</span>
              </button>
            );
          })}
        </div>

        {/* Industry Feature Spotlight Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedIndustry.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 items-center gap-8 rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-[#F7F5FC] p-6 shadow-sm sm:p-10 lg:grid-cols-12"
          >
            <div className="space-y-5 lg:col-span-7">
              <span className="inline-flex items-center rounded-full border border-slate-100 bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-xs">
                {selectedIndustry.badge}
              </span>
              <h3 className="text-2xl font-extrabold text-[#110E3D] sm:text-3xl">
                {selectedIndustry.title}
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                {selectedIndustry.description}
              </p>

              <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                {selectedIndustry.benefits.map((b, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-xs text-slate-700"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>

              <div className="pt-3">
                <Link href="/signup">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full bg-[#110E3D] px-6 py-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
                  >
                    <span>Launch {selectedIndustry.name} Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </Link>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-md lg:col-span-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-[#110E3D]">
                    {selectedIndustry.name} Assistant
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  WhatsApp Live
                </span>
              </div>

              <div className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="text-[11px] font-bold text-slate-700">
                  Customer Message:
                </div>
                <p className="text-xs text-slate-600 italic">
                  &ldquo;I need to book for tomorrow. What are the available
                  timings and charges?&rdquo;
                </p>
              </div>

              <div className="space-y-1.5 rounded-xl border border-emerald-200/60 bg-[#DCF8C6]/80 p-3">
                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-900">
                  <span>Helpa AI Response:</span>
                </div>
                <p className="text-xs leading-relaxed text-emerald-950">
                  &ldquo;We have open slots tomorrow at 10:30 AM and 02:00 PM.
                  Standard fee is ₹500. Reply with your preferred time to
                  receive instant confirmation!&rdquo;
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
