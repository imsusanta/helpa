'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Stethoscope,
  GraduationCap,
  BookOpen,
  Scissors,
  Building2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LandingIndustryModules() {
  const [activeIndustry, setActiveIndustry] = useState<number>(0);

  const industries = [
    {
      id: 'health',
      name: 'Health & Clinics',
      tagline: 'AI Receptionist & Patient Engagement',
      icon: Stethoscope,
      accentColor: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-600',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      features: [
        'Sequential Patient IDs (PT-000123) with multi-family member phone support',
        'Doctor Directory, consultation fees, and real-time OPD slot availability',
        'Automated OPD queue tokens (A-018) and digital appointment slip PDFs',
        'Automated 24h & 2h WhatsApp visit reminders and report ready alerts',
      ],
      ctaText: 'Explore Health Module',
      link: '/signup?industry=health',
    },
    {
      id: 'coaching',
      name: 'Coaching Institutes',
      tagline: 'AI Admission Desk & Student CRM',
      icon: GraduationCap,
      accentColor: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-600',
      badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      features: [
        'Student CRM with sequential IDs (STU-000123) and guardian linking',
        '10-Stage Admission Pipeline (Enquiry → Counselling → Demo → Admitted)',
        'Course catalog, batch seat limits, and installment fee tracking',
        'Broadcast campaign segmentation by target competitive exam (NEET, JEE, UPSC)',
      ],
      ctaText: 'Explore Coaching Module',
      link: '/signup?industry=coaching',
    },
    {
      id: 'tutor',
      name: 'Solo Tutors & Teachers',
      tagline: 'AI Teaching Assistant & Class CRM',
      icon: BookOpen,
      accentColor: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-600',
      badgeColor: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      features: [
        'Smart Student Resolution on shared parent mobile numbers',
        'Class scheduling with meeting links and 24h & 2h WhatsApp reminders',
        'Homework and assignment tracking with automated submission alerts',
        'Simplified personal educator workspace with zero bloated ERP complexity',
      ],
      ctaText: 'Explore Tutor Module',
      link: '/signup?industry=solo_teacher',
    },
    {
      id: 'salon',
      name: 'Beauty Salons & Spas',
      tagline: 'AI Salon Receptionist & Booking Desk',
      icon: Scissors,
      accentColor: 'from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-600',
      badgeColor: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      features: [
        'Service & treatment menu with pricing, duration, and categories',
        'Stylist directory and real-time conflict-free slot calculation',
        '1-Click WhatsApp appointment booking, rescheduling, and cancellations',
        'Automated retention follow-ups (e.g. 4 weeks after haircut/facial)',
      ],
      ctaText: 'Explore Salon Module',
      link: '/signup?industry=salon',
    },
    {
      id: 'real_estate',
      name: 'Real Estate Agencies',
      tagline: 'AI Property Assistant & Lead CRM',
      icon: Building2,
      accentColor: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-600',
      badgeColor: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
      features: [
        'Structured lead CRM with automatic sequential Lead IDs (LEAD-000123)',
        'Property matching engine ranking listings with plain-English rationales',
        'Site visit scheduling with agent assignment and WhatsApp location pins',
        'Follow-up sequences for hot, warm, and site-visited buyer leads',
      ],
      ctaText: 'Explore Real Estate Module',
      link: '/signup?industry=real_estate',
    },
  ];

  return (
    <section id="industries" className="py-20 lg:py-28 bg-muted/20 border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            Tailored Industry Workflows
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Built for the way your business works.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            Helpa provides a unified core communication engine, configured dynamically with modular features and terminology specific to your industry.
          </p>
        </div>

        {/* Industry Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {industries.map((ind, idx) => {
            const Icon = ind.icon;
            return (
              <div
                key={ind.id}
                className="flex flex-col justify-between p-7 rounded-2xl bg-card border border-border/80 shadow-xs hover:shadow-lg hover:border-emerald-500/40 transition-all group"
              >
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-foreground group-hover:scale-105 transition-transform">
                      <Icon className="w-6 h-6 text-emerald-600" />
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${ind.badgeColor}`}
                    >
                      {ind.name}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      {ind.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ind.tagline}
                    </p>
                  </div>

                  <ul className="space-y-2.5 text-xs text-muted-foreground">
                    {ind.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6 mt-6 border-t border-border">
                  <Link href={ind.link} className="block">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-between border-border text-foreground hover:bg-muted font-medium text-xs h-9"
                    >
                      <span>{ind.ctaText}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
