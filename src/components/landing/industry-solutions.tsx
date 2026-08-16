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
    badge: 'Healthcare CRM',
    title: 'AI Receptionist for Clinics & Hospitals',
    description:
      'Manage patient inquiries 24/7, book doctor appointments, generate digital OPD slips, and send automated prescription and report alerts.',
    benefits: [
      'Sequential unique Patient IDs (PT-XXXXXX)',
      'Doctor slot availability with real-time conflict checking',
      'OPD Appointment Confirmation PDF generation',
      'Prescription & lab test status delivery on WhatsApp',
    ],
  },
  {
    id: 'coaching',
    name: 'Coaching Institute',
    icon: GraduationCap,
    badge: 'EdTech Pipeline',
    title: 'AI Admission Assistant for Coaching Classes',
    description:
      'Convert course inquiries into enrolled students, track 10-stage admission pipelines, manage batches, and automate fee payment reminders.',
    benefits: [
      'Course catalog and batch seat availability tracking',
      '10-stage admission funnel from Enquiry to Enrolled',
      'Automated parent WhatsApp updates & fee receipts',
      'Bulk broadcast campaigns for new course batches',
    ],
  },
  {
    id: 'tutor',
    name: 'Solo Tutor',
    icon: BookOpen,
    badge: 'Independent Educator',
    title: 'AI Assistant for Private Teachers & Home Tutors',
    description:
      'Keep student parents in the loop without endless phone calls. Automate class schedules, assignment alerts, and doubt resolutions.',
    benefits: [
      'Smart parent ambiguity resolution for multiple siblings',
      'Automated 24h & 2h class reminder notifications',
      'Homework assignment tracking & submission prompts',
      'Zero ERP clutter — streamlined for solo teachers',
    ],
  },
  {
    id: 'salon',
    name: 'Salon & Spa',
    icon: Scissors,
    badge: 'Beauty & Wellness',
    title: 'AI Receptionist for Salons & Beauty Studios',
    description:
      'Fill your salon chairs automatically. Showcase treatment menus, check stylist availability in real time, and trigger re-booking reminders.',
    benefits: [
      'Interactive beauty & hair service menu showcase',
      'Real-time stylist slot conflict prevention',
      'One-click rescheduling & cancellation management',
      'Automated 30-day retention follow-ups for repeat visits',
    ],
  },
  {
    id: 'real_estate',
    name: 'Real Estate',
    icon: Building2,
    badge: 'Property CRM',
    title: 'AI Property Matcher for Brokers & Agencies',
    description:
      'Capture property buyer leads instantly. Match buyer budgets and preferences to available listings and schedule site visits automatically.',
    benefits: [
      'Intelligent property matching ranking top listings with rationales',
      'Sequential Lead IDs (LEAD-XXXXXX) and requirement CRM',
      'Agent assignment & site visit appointment scheduling',
      'Automated WhatsApp follow-ups for warm buyer leads',
    ],
  },
];

export function LandingIndustrySolutions() {
  const [selectedIndustry, setSelectedIndustry] = useState(INDUSTRIES[0]);

  return (
    <section id="industries" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 mb-3">
            Modular Industry Workspaces
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#110E3D] tracking-tight">
            Built specifically for your business workflow
          </h2>
          <p className="text-base text-slate-500 mt-3">
            Helpa adapts terminology, features, and AI workflows dynamically to match your exact industry.
          </p>
        </div>

        {/* Industry Pill Selector */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap mb-10">
          {INDUSTRIES.map((ind) => {
            const Icon = ind.icon;
            const isSelected = selectedIndustry.id === ind.id;
            return (
              <button
                key={ind.id}
                type="button"
                onClick={() => setSelectedIndustry(ind)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all ${
                  isSelected
                    ? 'bg-[#110E3D] text-white shadow-md scale-105'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                <Icon className="w-4 h-4" />
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
            className="rounded-3xl bg-gradient-to-br from-slate-50 to-[#F7F5FC] border border-slate-200/80 p-6 sm:p-10 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
          >
            <div className="lg:col-span-7 space-y-5">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white text-slate-700 shadow-xs border border-slate-100">
                {selectedIndustry.badge}
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-[#110E3D]">
                {selectedIndustry.title}
              </h3>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                {selectedIndustry.description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {selectedIndustry.benefits.map((b, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>

              <div className="pt-3">
                <Link href="/signup">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#110E3D] text-white text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
                  >
                    <span>Launch {selectedIndustry.name} Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-md space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-[#110E3D]">
                    {selectedIndustry.name} Assistant
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">WhatsApp Live</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                <div className="text-[11px] font-bold text-slate-700">Customer Message:</div>
                <p className="text-xs text-slate-600 italic">
                  &ldquo;I need to book for tomorrow. What are the available timings and charges?&rdquo;
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#DCF8C6]/80 border border-emerald-200/60 space-y-1.5">
                <div className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                  <span>Helpa AI Response:</span>
                </div>
                <p className="text-xs text-emerald-950 leading-relaxed">
                  &ldquo;We have open slots tomorrow at 10:30 AM and 02:00 PM. Standard fee is ₹500. Reply with your preferred time to receive instant confirmation!&rdquo;
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
