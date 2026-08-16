'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LandingPricing() {
  const [isYearly, setIsYearly] = useState(false);

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      description: 'Ideal for solo tutors, small clinics, and emerging salons.',
      monthlyPrice: '₹999',
      yearlyPrice: '₹799',
      popular: false,
      features: [
        '1 Official WhatsApp Business Number',
        'Up to 3 Team Members',
        '2,500 Active Contacts',
        '1,500 AI Inbound & Outbound Messages / mo',
        'Multichannel Team Inbox & CRM',
        '1-Click Meta Embedded Signup',
        'Standard Industry Module Access',
        'Email Support',
      ],
      ctaText: 'Start Free 14-Day Trial',
      link: '/signup?plan=starter',
    },
    {
      id: 'professional',
      name: 'Professional',
      description: 'Best for growing clinics, academies, and multi-staff studios.',
      monthlyPrice: '₹2,499',
      yearlyPrice: '₹1,999',
      popular: true,
      features: [
        '2 Official WhatsApp Business Numbers',
        'Up to 10 Team Members',
        '15,000 Active Contacts',
        '8,000 AI Messages & Copilot Inferences / mo',
        'Dual AI Agent & Staff Copilot',
        'Automated OPD Tokens & PDF Appointment Slips',
        'Visual Automation Builder & Workflows',
        'Targeted WhatsApp Broadcast Campaigns',
        'All 5 Industry Modules Included',
        'Priority Support & Onboarding Assistance',
      ],
      ctaText: 'Start Free 14-Day Trial',
      link: '/signup?plan=professional',
    },
    {
      id: 'business',
      name: 'Business',
      description: 'For high-volume multi-branch institutes, hospitals, and brokers.',
      monthlyPrice: '₹4,999',
      yearlyPrice: '₹3,999',
      popular: false,
      features: [
        '5 Official WhatsApp Business Numbers',
        'Up to 25 Team Members',
        '50,000 Active Contacts',
        '25,000 AI Messages & RAG Queries / mo',
        'Advanced Custom Knowledge Base (PDFs & Docs)',
        'Custom Webhooks & REST API Integrations',
        'Advanced Analytics & Staff Performance KPIs',
        'Multi-Branch Organization Setup',
        'Dedicated WhatsApp Onboarding Specialist',
      ],
      ctaText: 'Start Free 14-Day Trial',
      link: '/signup?plan=business',
    },
  ];

  return (
    <section id="pricing" className="py-20 lg:py-28 bg-background relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            Simple & Transparent Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Predictable plans that scale with your growth.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            Try any plan free for 14 days. No credit card required. Cancel or upgrade anytime.
          </p>

          {/* Monthly / Yearly Billing Toggle */}
          <div className="flex items-center justify-center pt-2">
            <div className="bg-muted p-1 rounded-xl flex items-center gap-1 border border-border">
              <button
                onClick={() => setIsYearly(false)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  !isYearly
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setIsYearly(true)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  isYearly
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Yearly Billing</span>
                <span className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`flex flex-col justify-between p-8 rounded-2xl border transition-all ${
                plan.popular
                  ? 'bg-card border-emerald-500 shadow-xl ring-2 ring-emerald-500/20 relative'
                  : 'bg-card border-border/80 shadow-xs hover:border-border'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                  Most Popular Plan
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-foreground">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 min-h-[32px]">
                    {plan.description}
                  </p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-foreground">
                    {isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    / month {isYearly && '(billed annually)'}
                  </span>
                </div>

                <div className="pt-4 border-t border-border space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                    What&apos;s Included:
                  </span>
                  <ul className="space-y-2.5 text-xs text-muted-foreground">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-foreground">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-8 mt-6">
                <Link href={plan.link} className="block">
                  <Button
                    className={`w-full font-semibold text-sm h-11 ${
                      plan.popular
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25'
                        : 'bg-muted hover:bg-muted/80 text-foreground border border-border'
                    }`}
                  >
                    <span>{plan.ctaText}</span>
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
