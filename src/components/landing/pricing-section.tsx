'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';

interface DisplayPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number | string;
  yearlyMonthlyPrice: number | string;
  yearlyTotalPrice?: number;
  popular: boolean;
  features: string[];
}

const DEFAULT_DISPLAY_PLANS: DisplayPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description:
      'Ideal for solo clinics, private tutors, or small beauty salons.',
    monthlyPrice: 999,
    yearlyMonthlyPrice: 799,
    yearlyTotalPrice: 9990,
    popular: false,
    features: [
      '1 WhatsApp Business Number',
      '1,500 Contacts',
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
    description:
      'Best for growing clinics, institutes, real estate agencies & salons.',
    monthlyPrice: 2499,
    yearlyMonthlyPrice: 1999,
    yearlyTotalPrice: 24990,
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
    description:
      'For busy clinics, multi-branch coaching institutes & top real estate firms.',
    monthlyPrice: 5999,
    yearlyMonthlyPrice: 4799,
    yearlyTotalPrice: 59990,
    popular: false,
    features: [
      '5 WhatsApp Business Numbers',
      '50,000 Contacts',
      '20,000 AI Messages / mo',
      'Multi-Agent Team Routing (25 Seats)',
      'Visual Automation Flow Builder',
      'Full Webhook & REST API Access',
      'Dedicated Success Account Manager',
      'Custom AI Receptionist Tuning',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description:
      'For hospital networks, franchise salon chains & large developers.',
    monthlyPrice: 'Custom',
    yearlyMonthlyPrice: 'Custom',
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

export function LandingPricingSection() {
  const [isYearly, setIsYearly] = useState(true);
  const [plans, setPlans] = useState<DisplayPlan[]>(DEFAULT_DISPLAY_PLANS);

  useEffect(() => {
    // Dynamically sync plans from Admin Panel / API
    fetch('/api/plans')
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        return null;
      })
      .then((apiPlans) => {
        if (Array.isArray(apiPlans) && apiPlans.length > 0) {
          const mapped: DisplayPlan[] = apiPlans.map((p) => {
            const mPrice = Number(p.monthly_price ?? p.monthlyPrice ?? 0);
            const yPrice = Number(
              p.yearly_price ?? p.yearlyPrice ?? mPrice * 10
            );
            const yMonthly =
              yPrice > 0 ? Math.round(yPrice / 12) : Math.round(mPrice * 0.8);
            const isPop =
              String(p.name).toLowerCase().includes('pro') ||
              String(p.name).toLowerCase().includes('growth');

            // Parse features array
            let featList: string[] = [];
            if (Array.isArray(p.features)) {
              featList = p.features.map((f: unknown) => {
                if (typeof f === 'string') {
                  // Format human-readable features
                  if (f === 'ai_chat' || f === 'core.ai')
                    return 'AI Receptionist & Chatbot';
                  if (f === 'pipelines' || f === 'core.inbox')
                    return 'Multi-Agent WhatsApp Team Inbox';
                  if (f === 'automations' || f === 'core.automations')
                    return 'Workflow Automation Builder';
                  if (f === 'ai_copilot' || f === 'core.ai_copilot')
                    return 'Smart AI Copilot Suggestions';
                  if (f === 'analytics' || f === 'core.analytics')
                    return 'Real-time ROI & Analytics';
                  if (f === 'opd_slips' || f === 'health.appointments')
                    return 'Signed OPD Slips & Appointments';
                  if (f === 'custom_models' || f === 'core.custom_models')
                    return 'Custom LLM & Knowledge Base';
                  if (f === 'dedicated_support')
                    return 'Dedicated Priority WhatsApp Support';
                  return f.replace(/^[a-z_]+\./, '').replace(/_/g, ' ');
                }
                return String(f);
              });
            }

            // Fallback limits if not explicitly provided
            if (p.max_whatsapp_numbers) {
              featList.unshift(
                `${p.max_whatsapp_numbers} WhatsApp Business Number(s)`
              );
            }
            if (p.max_contacts) {
              featList.splice(
                1,
                0,
                `${Number(p.max_contacts).toLocaleString()} Contacts`
              );
            }
            if (p.max_ai_requests) {
              featList.splice(
                2,
                0,
                `${Number(p.max_ai_requests).toLocaleString()} AI Messages / mo`
              );
            }

            return {
              id: p.id || String(p.name).toLowerCase(),
              name: p.name,
              description:
                p.description ||
                (isPop
                  ? 'Best for growing clinics, institutes, real estate agencies & salons.'
                  : 'Predictable, scale-ready AI automation for modern teams.'),
              monthlyPrice: mPrice > 0 ? mPrice : 'Free',
              yearlyMonthlyPrice: yMonthly > 0 ? yMonthly : 'Free',
              yearlyTotalPrice: yPrice > 0 ? yPrice : undefined,
              popular: isPop,
              features:
                featList.length > 0
                  ? featList.slice(0, 7)
                  : ['Full WhatsApp CRM Features'],
            };
          });

          // Ensure Enterprise is included if not in custom plans list
          const hasEnterprise = mapped.some((m) =>
            m.name.toLowerCase().includes('enterprise')
          );
          if (!hasEnterprise) {
            mapped.push({
              id: 'enterprise',
              name: 'Enterprise',
              description:
                'For hospital networks, franchise salon chains & large developers.',
              monthlyPrice: 'Custom',
              yearlyMonthlyPrice: 'Custom',
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
            });
          }

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
            Transparent Pricing
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#110E3D] sm:text-4xl">
            Simple, predictable plans for every business
          </h2>
          <p className="mt-3 text-base text-slate-500">
            Every plan includes a 14-day free trial. No credit card required.
            Cancel anytime.
          </p>

          {/* Monthly / Yearly Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-slate-100 p-1.5">
            <button
              type="button"
              onClick={() => setIsYearly(false)}
              className={`rounded-full px-5 py-2 text-xs font-bold transition-all ${
                !isYearly
                  ? 'bg-white text-[#110E3D] shadow-xs'
                  : 'text-slate-500 hover:text-[#110E3D]'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setIsYearly(true)}
              className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold transition-all ${
                isYearly
                  ? 'bg-[#110E3D] text-white shadow-xs'
                  : 'text-slate-500 hover:text-[#110E3D]'
              }`}
            >
              <span>Yearly Billing</span>
              <span className="rounded-full bg-[#B4F73C] px-1.5 py-0.5 text-[10px] font-extrabold text-[#110E3D]">
                SAVE 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const price = isYearly ? p.yearlyMonthlyPrice : p.monthlyPrice;
            return (
              <div
                key={p.id}
                className={`relative flex flex-col justify-between rounded-3xl p-6 transition-all ${
                  p.popular
                    ? 'scale-102 bg-[#110E3D] text-white shadow-xl ring-2 ring-indigo-600'
                    : 'border border-slate-200/80 bg-white text-slate-900 shadow-xs hover:shadow-md'
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3.5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-gradient-to-r from-[#C4F135] to-[#4EE3C2] px-3 py-1 text-[10px] font-extrabold tracking-wider text-[#110E3D] uppercase shadow-xs">
                    <Sparkles className="h-3 w-3" /> Most Popular
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">{p.name}</h3>
                  </div>
                  <p
                    className={`mt-1.5 min-h-[36px] text-xs ${
                      p.popular ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {p.description}
                  </p>

                  <div className="my-6">
                    {typeof price === 'number' ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold sm:text-4xl">
                          ₹{price.toLocaleString()}
                        </span>
                        <span
                          className={`text-xs ${
                            p.popular ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          / month
                        </span>
                      </div>
                    ) : (
                      <div className="text-3xl font-extrabold">{price}</div>
                    )}
                    {isYearly && typeof price === 'number' && (
                      <span
                        className={`mt-0.5 block text-[11px] ${
                          p.popular ? 'text-emerald-400' : 'text-emerald-600'
                        }`}
                      >
                        Billed annually{' '}
                        {p.yearlyTotalPrice
                          ? `(₹${p.yearlyTotalPrice.toLocaleString()}/yr)`
                          : '(Save 20%)'}
                      </span>
                    )}
                  </div>

                  <div
                    className={`space-y-3 border-t pt-4 text-xs ${
                      p.popular ? 'border-slate-800' : 'border-slate-100'
                    }`}
                  >
                    {p.features.map((f, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <Check
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            p.popular ? 'text-[#B4F73C]' : 'text-emerald-600'
                          }`}
                        />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-8">
                  <Link href="/signup">
                    <button
                      type="button"
                      className={`w-full rounded-full py-3 text-xs font-bold transition-all ${
                        p.popular
                          ? 'bg-gradient-to-r from-[#C4F135] to-[#4EE3C2] text-[#110E3D] shadow-md hover:opacity-95'
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
