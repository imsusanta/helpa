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
    id: 'plan_starter', name: 'Starter', slug: 'starter',
    description: 'For a small clinic starting with WhatsApp enquiries and appointment reminders.',
    setupFee: 7999, monthlyPrice: 3499, currencySymbol: '₹', isRecommended: false,
    features: ['1 WhatsApp Business Number', '1,500 Patient Contacts', '1,500 AI Messages / mo', 'Appointment Booking & Reminders', 'Shared Reception Inbox', 'Clinic Knowledge Base', 'Standard Support'],
  },
  {
    id: 'plan_growth', name: 'Growth', slug: 'growth',
    description: 'For growing outpatient teams that need automation, pipelines, and more capacity.',
    setupFee: 11999, monthlyPrice: 4999, currencySymbol: '₹', isRecommended: true,
    features: ['2 WhatsApp Business Numbers', '10,000 Patient Contacts', '5,000 AI Messages / mo', 'Staff Copilot Suggestions', 'Patient & Appointment Pipelines', 'Campaigns & Automations', 'Priority Support'],
  },
  {
    id: 'plan_pro', name: 'Pro', slug: 'pro',
    description: 'For multi-location clinics with larger reception teams and custom workflows.',
    setupFee: 19999, monthlyPrice: 7999, currencySymbol: '₹', isRecommended: false,
    features: ['5 WhatsApp Business Numbers', '50,000 Patient Contacts', '25,000 AI Messages / mo', 'Up to 25 Team Seats', 'Custom Model Support', 'Visual Flow Builder & Webhooks', 'Dedicated Account Manager'],
  },
];

export function LandingPricingSection() {
  const [plans, setPlans] = useState<DisplayPlan[]>(DEFAULT_DISPLAY_PLANS);

  useEffect(() => {
    fetch('/api/plans')
      .then((res) => (res.ok ? res.json() : null))
      .then((apiPlans) => {
        if (!Array.isArray(apiPlans) || apiPlans.length === 0) return;
        setPlans(apiPlans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          description: plan.description || 'WhatsApp patient communication and appointment automation for clinics.',
          setupFee: Number(plan.setup_fee || 0),
          monthlyPrice: Number(plan.monthly_price || 0),
          currencySymbol: plan.currency_symbol || '₹',
          isRecommended: Boolean(plan.is_recommended),
          features: Array.isArray(plan.features) ? plan.features.slice(0, 7) : [`${plan.max_contacts || 5000} Patient Contacts`, `${plan.max_ai_requests || 1500} AI Messages`, 'Clinic WhatsApp CRM'],
        })));
      })
      .catch(() => undefined);
  }, []);

  return (
    <section id="pricing" className="bg-gradient-to-b from-white via-slate-50/50 to-[#FAF9FC] py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <span className="mb-3 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Clinic plans</span>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#110E3D] sm:text-4xl">Choose the capacity your clinic needs</h2>
          <p className="mt-3 text-base text-slate-600">Setup and monthly software fees are shown separately. Meta messaging charges and taxes may apply.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const recommended = plan.isRecommended || plan.slug === 'growth';
            return (
              <article key={plan.id || plan.slug} className={`relative flex flex-col justify-between rounded-3xl p-6 ${recommended ? 'scale-[1.02] border-2 border-emerald-500 bg-[#110E3D] text-white shadow-2xl' : 'border border-slate-200 bg-white text-slate-900 shadow-sm'}`}>
                {recommended && <div className="absolute -top-3.5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-gradient-to-r from-[#C4F135] to-[#4EE3C2] px-3.5 py-1 text-[10px] font-extrabold tracking-wider text-[#110E3D] uppercase"><Sparkles className="h-3 w-3" /> Recommended</div>}
                <div>
                  <h3 className="text-xl font-extrabold">{plan.name}</h3>
                  <p className={`mt-2 min-h-12 text-xs leading-relaxed ${recommended ? 'text-slate-300' : 'text-slate-600'}`}>{plan.description}</p>
                  <div className="my-6">
                    <div className="flex items-baseline gap-1"><span className="text-4xl font-extrabold">{plan.currencySymbol}{plan.monthlyPrice.toLocaleString()}</span><span className="text-xs opacity-70">/ month</span></div>
                    <div className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${recommended ? 'text-emerald-300' : 'text-emerald-700'}`}><Zap className="h-3.5 w-3.5" />{plan.currencySymbol}{plan.setupFee.toLocaleString()} one-time setup</div>
                  </div>
                  <div className={`space-y-3 border-t pt-4 text-xs ${recommended ? 'border-slate-800' : 'border-slate-100'}`}>
                    {plan.features.map((feature) => <div key={feature} className="flex items-start gap-2.5"><Check className={`mt-0.5 h-4 w-4 shrink-0 ${recommended ? 'text-[#B4F73C]' : 'text-emerald-600'}`} /><span>{feature}</span></div>)}
                  </div>
                </div>
                <Link href={`/signup?plan=${plan.slug}`} className={`mt-8 flex min-h-11 items-center justify-center rounded-full text-xs font-bold ${recommended ? 'bg-gradient-to-r from-[#C4F135] to-[#4EE3C2] text-[#110E3D]' : 'bg-slate-100 text-[#110E3D]'}`}>Start {plan.name}</Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
