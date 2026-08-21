'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles, Zap } from 'lucide-react';

interface DisplayPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  setupFee: number;
  monthlyPrice: number;
  currencySymbol: string;
  isRecommended: boolean;
  features: string[];
}

const DEFAULT_DISPLAY_PLANS: DisplayPlan[] = [
  {
    id: 'plan_starter',
    name: 'Starter',
    slug: 'starter',
    description:
      'Perfect for solo doctors, tutors, and small studios starting out with WhatsApp.',
    setupFee: 7999,
    monthlyPrice: 3499,
    currencySymbol: '₹',
    isRecommended: false,
    features: [
      '1 Official WhatsApp Business Number',
      '1,500 Customer Contacts',
      '1,500 Automated AI Messages / mo',
      'Automatic Appointment Booking & Reminders',
      'Shared Team Inbox on Web & Mobile',
      'Trained on your Services, Prices & FAQs',
      'Friendly Email & Chat Support',
    ],
  },
  {
    id: 'plan_growth',
    name: 'Growth ⭐',
    slug: 'growth',
    description:
      'Most popular for busy clinics, coaching centers, salons, and growing agencies.',
    setupFee: 11999,
    monthlyPrice: 4999,
    currencySymbol: '₹',
    isRecommended: true,
    features: [
      '2 Official WhatsApp Business Numbers',
      '10,000 Customer Contacts',
      '5,000 Smart AI Replies / mo',
      'AI Smart Suggestions while you chat',
      'Visual Patient & Lead Funnels',
      'WhatsApp Broadcasts & Promotions',
      'Priority 24/7 Phone & Chat Support',
    ],
  },
  {
    id: 'plan_pro',
    name: 'Pro',
    slug: 'pro',
    description:
      'For multi-location centers, high-volume campaigns, and large teams.',
    setupFee: 19999,
    monthlyPrice: 7999,
    currencySymbol: '₹',
    isRecommended: false,
    features: [
      '5 Official WhatsApp Business Numbers',
      '50,000 Customer Contacts',
      '25,000 Automated AI Messages / mo',
      '25 Team Member Accounts',
      'Custom AI Voice & Automation Builder',
      'Unlimited Visual Automations & Workflows',
      'Dedicated Personal Account Manager',
    ],
  },
];

export function LandingPricingSection() {
  const [plans, setPlans] = useState<DisplayPlan[]>(DEFAULT_DISPLAY_PLANS);

  useEffect(() => {
    fetch('/api/plans')
      .then((res) => (res.ok ? res.json() : null))
      .then((apiPlans) => {
        if (Array.isArray(apiPlans) && apiPlans.length > 0) {
          const mapped: DisplayPlan[] = apiPlans.map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            description:
              p.description ||
              (p.is_recommended
                ? 'Recommended plan for clinics, institutes, and agencies needing Copilot & Automations.'
                : 'Predictable, scale-ready AI automation for modern teams.'),
            setupFee: Number(p.setup_fee || 0),
            monthlyPrice: Number(p.monthly_price || 0),
            currencySymbol: p.currency_symbol || '₹',
            isRecommended: Boolean(p.is_recommended),
            features: Array.isArray(p.features)
              ? p.features.slice(0, 7)
              : [
                  `${p.max_contacts || 5000} Contacts`,
                  `${p.max_ai_requests || 1500} AI Messages`,
                  'WhatsApp CRM Suite',
                ],
          }));

          setPlans(mapped);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch dynamic plans from API:', err);
      });
  }, []);

  return (
    <section
      id="pricing"
      className="bg-gradient-to-b from-white via-slate-50/50 to-[#FAF9FC] py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <span className="mb-3 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            Official Helpa SaaS Pricing
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#110E3D] sm:text-4xl">
            Simple, transparent plans built for growth
          </h2>
          <p className="mt-3 text-base text-slate-500">
            One-time setup fee + low monthly subscription. No hidden fees.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((p) => {
            const isRecommended = p.isRecommended || p.slug === 'growth';

            return (
              <div
                key={p.id || p.slug}
                className={`relative flex flex-col justify-between rounded-3xl p-6 transition-all ${
                  isRecommended
                    ? 'scale-105 border-2 border-emerald-500 bg-[#110E3D] text-white shadow-2xl ring-2 ring-emerald-500/20'
                    : 'border border-slate-200/80 bg-white text-slate-900 shadow-sm hover:shadow-md'
                }`}
              >
                {isRecommended && (
                  <div className="absolute -top-3.5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-gradient-to-r from-[#C4F135] to-[#4EE3C2] px-3.5 py-1 text-[10px] font-extrabold tracking-wider text-[#110E3D] uppercase shadow-md">
                    <Sparkles className="h-3 w-3" /> Recommended
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-extrabold">{p.name}</h3>
                  </div>
                  <p
                    className={`mt-1.5 min-h-[36px] text-xs leading-relaxed ${
                      isRecommended ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {p.description}
                  </p>

                  <div className="my-6 space-y-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold sm:text-4xl">
                        {p.currencySymbol}
                        {p.monthlyPrice.toLocaleString()}
                      </span>
                      <span
                        className={`text-xs ${
                          isRecommended ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        / month
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1 text-xs">
                      <Zap
                        className={`h-3.5 w-3.5 ${isRecommended ? 'text-[#B4F73C]' : 'text-emerald-600'}`}
                      />
                      <span
                        className={`font-semibold ${isRecommended ? 'text-emerald-300' : 'text-emerald-700'}`}
                      >
                        {p.currencySymbol}
                        {p.setupFee.toLocaleString()} One-time Setup Fee
                      </span>
                    </div>
                  </div>

                  <div
                    className={`space-y-3 border-t pt-4 text-xs ${
                      isRecommended ? 'border-slate-800' : 'border-slate-100'
                    }`}
                  >
                    {p.features.map((f, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <Check
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            isRecommended
                              ? 'text-[#B4F73C]'
                              : 'text-emerald-600'
                          }`}
                        />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-8">
                  <Link href={`/signup?plan=${p.slug}`}>
                    <button
                      type="button"
                      className={`w-full rounded-full py-3 text-xs font-bold transition-all ${
                        isRecommended
                          ? 'bg-gradient-to-r from-[#C4F135] to-[#4EE3C2] text-[#110E3D] shadow-md hover:opacity-95'
                          : 'bg-slate-100 text-[#110E3D] hover:bg-slate-200'
                      }`}
                    >
                      Get Started with {p.name}
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
