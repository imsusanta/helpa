'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';

export function LandingPricingSection() {
  const [isYearly, setIsYearly] = useState(true);

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      description: 'Ideal for solo clinics, private tutors, or small beauty salons.',
      monthlyPrice: 999,
      yearlyPrice: 799,
      popular: false,
      features: [
        '1 WhatsApp Business Number',
        '1,000 Contacts',
        '1,500 AI Copilot Messages / mo',
        'Single Industry Module',
        'Appointment Booking & Reminders',
        'Unified Web Inbox',
        'Standard Community Support',
      ],
    },
    {
      id: 'professional',
      name: 'Professional',
      description: 'Best for growing clinics, institutes, real estate agencies & salons.',
      monthlyPrice: 2499,
      yearlyPrice: 1999,
      popular: true,
      features: [
        '2 WhatsApp Business Numbers',
        '10,000 Contacts',
        '5,000 AI Copilot Messages / mo',
        'All 5 Industry Modules Included',
        'Automated OPD / Invoice PDF Slips',
        'Broadcast Campaigns & Tags',
        'Custom Knowledge Base Training',
        'Priority 24/7 WhatsApp Support',
      ],
    },
    {
      id: 'business',
      name: 'Business',
      description: 'For busy clinics, multi-branch coaching institutes & top real estate firms.',
      monthlyPrice: 5999,
      yearlyPrice: 4799,
      popular: false,
      features: [
        '5 WhatsApp Business Numbers',
        '50,000 Contacts',
        '20,000 AI Messages / mo',
        'Multi-Agent Team Routing (10 Seats)',
        'Visual Automation Flow Builder',
        'Full Webhook & REST API Access',
        'Dedicated Success Account Manager',
        'Custom AI Receptionist Tuning',
      ],
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'For hospital networks, franchise salon chains & large developers.',
      monthlyPrice: 'Custom',
      yearlyPrice: 'Custom',
      popular: false,
      features: [
        'Unlimited WhatsApp Numbers',
        'Unlimited CRM Contacts',
        'Dedicated Custom LLM Instance',
        'Custom On-Premises or Private Cloud',
        '99.99% Guaranteed SLA Uptime',
        'Custom EMR / ERP Database Sync',
        'SOC2 & HIPAA Compliance Review',
      ],
    },
  ];

  return (
    <section id="pricing" className="py-20 bg-gradient-to-b from-white via-slate-50/50 to-[#FAF9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 mb-3">
            Transparent Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#110E3D] tracking-tight">
            Simple, predictable plans for every business
          </h2>
          <p className="text-base text-slate-500 mt-3">
            Every plan includes a 14-day free trial. No credit card required. Cancel anytime.
          </p>

          {/* Monthly / Yearly Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 p-1.5 rounded-full bg-slate-100 border border-slate-200/80">
            <button
              type="button"
              onClick={() => setIsYearly(false)}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
                !isYearly ? 'bg-white text-[#110E3D] shadow-sm' : 'text-slate-500 hover:text-[#110E3D]'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setIsYearly(true)}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                isYearly
                  ? 'bg-[#110E3D] text-white shadow-sm'
                  : 'text-slate-500 hover:text-[#110E3D]'
              }`}
            >
              <span>Yearly Billing</span>
              <span className="px-1.5 py-0.2 rounded-full bg-[#B4F73C] text-[#110E3D] text-[10px] font-extrabold">
                SAVE 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((p) => {
            const price = isYearly ? p.yearlyPrice : p.monthlyPrice;
            return (
              <div
                key={p.id}
                className={`rounded-3xl p-6 flex flex-col justify-between transition-all relative ${
                  p.popular
                    ? 'bg-[#110E3D] text-white shadow-xl ring-2 ring-indigo-600 scale-102'
                    : 'bg-white text-slate-900 border border-slate-200/80 shadow-sm hover:shadow-md'
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-[#C4F135] to-[#4EE3C2] text-[#110E3D] text-[10px] font-extrabold tracking-wider uppercase flex items-center gap-1 shadow-sm">
                    <Sparkles className="w-3 h-3" /> Most Popular
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">{p.name}</h3>
                  </div>
                  <p className={`text-xs mt-1.5 min-h-[36px] ${p.popular ? 'text-slate-300' : 'text-slate-500'}`}>
                    {p.description}
                  </p>

                  <div className="my-6">
                    {typeof price === 'number' ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-extrabold">₹{price}</span>
                        <span className={`text-xs ${p.popular ? 'text-slate-400' : 'text-slate-500'}`}>
                          / month
                        </span>
                      </div>
                    ) : (
                      <div className="text-3xl font-extrabold">Custom</div>
                    )}
                    {isYearly && typeof price === 'number' && (
                      <span className={`text-[11px] ${p.popular ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        Billed annually (Save 20%)
                      </span>
                    )}
                  </div>

                  <div className={`space-y-3 text-xs pt-4 border-t ${p.popular ? 'border-slate-800' : 'border-slate-100'}`}>
                    {p.features.map((f, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <Check className={`w-4 h-4 shrink-0 mt-0.5 ${p.popular ? 'text-[#B4F73C]' : 'text-emerald-600'}`} />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-8">
                  <Link href="/signup">
                    <button
                      type="button"
                      className={`w-full py-3 rounded-full text-xs font-bold transition-all ${
                        p.popular
                          ? 'bg-gradient-to-r from-[#C4F135] to-[#4EE3C2] text-[#110E3D] hover:opacity-95 shadow-md'
                          : 'bg-slate-100 text-[#110E3D] hover:bg-slate-200'
                      }`}
                    >
                      Start 14-Day Free Trial
                    </button>
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
