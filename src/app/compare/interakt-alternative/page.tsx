import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Scale, Sparkles } from 'lucide-react';
import { LandingNavbar } from '@/components/landing/navbar';
import { LandingFooter } from '@/components/landing/footer';
import {
  BreadcrumbJsonLd,
  FaqJsonLd,
  ServiceJsonLd,
} from '@/components/seo/json-ld';

export const metadata: Metadata = {
  title: 'Helpa vs Interakt — Compare WhatsApp CRM & AI Receptionist',
  description:
    'Compare Helpa and Interakt for Indian service businesses and clinics. Learn how Helpa provides automated appointment bookings, sub-2-second AI replies, and specialized healthcare workflows.',
  keywords: [
    'Interakt Alternative India',
    'Helpa vs Interakt',
    'Interakt Comparison WhatsApp CRM',
    'Best WhatsApp Receptionist India',
  ],
  alternates: {
    canonical: 'https://helpa.studio/compare/interakt-alternative',
  },
  openGraph: {
    title: 'Helpa vs Interakt — WhatsApp CRM Comparison | Helpa',
    description:
      'Compare Helpa and Interakt to choose the right WhatsApp automation software for your business.',
    url: 'https://helpa.studio/compare/interakt-alternative',
  },
};

const INTERAKT_FAQS = [
  {
    question: 'How is Helpa different from Interakt?',
    answer:
      'Interakt is primarily built around e-commerce order notifications and bulk broadcasting for Shopify/WooCommerce stores. Helpa is specifically engineered for service businesses, outpatient clinics, salons, and coaching centers that require conversational appointment bookings, doctor scheduling, and custom knowledge base AI assistants.',
  },
  {
    question: 'Does Helpa support official WhatsApp Cloud API?',
    answer:
      'Yes. Helpa operates on the official Meta WhatsApp Cloud API with full support for official templates, green-tick verification, and number coexistence.',
  },
];

const COMPARISON_POINTS = [
  {
    feature: 'Primary Focus',
    helpa: 'Clinics, Salons, Coaching & Service Appointments',
    interakt: 'E-commerce (Shopify, WooCommerce, Abandoned Cart)',
  },
  {
    feature: 'AI Receptionist & Custom Knowledge Base',
    helpa: 'Native Generative AI trained on clinic PDFs & schedules',
    interakt: 'Basic rule-based bot trees',
  },
  {
    feature: 'Doctor & Service Slot Booking',
    helpa: 'Built-in real-time calendar slot reservation & OPD passes',
    interakt: 'Not available out of the box',
  },
  {
    feature: 'Coexistence Mode Support',
    helpa: 'Full WhatsApp Business App coexistence support',
    interakt: 'Requires dedicated API number without app sync',
  },
];

export default function InteraktAlternativePage() {
  return (
    <div className="min-h-screen bg-[#FAF9FC] text-[#110E3D] selection:bg-[#B4F73C] selection:text-[#110E3D]">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://helpa.studio' },
          {
            name: 'Compare',
            url: 'https://helpa.studio/compare/interakt-alternative',
          },
          {
            name: 'Helpa vs Interakt',
            url: 'https://helpa.studio/compare/interakt-alternative',
          },
        ]}
      />
      <ServiceJsonLd
        name="Helpa vs Interakt Comparison"
        serviceType="WhatsApp CRM & Automation Platform Comparison"
        description="Detailed comparison between Helpa and Interakt for appointment-based businesses and service professionals."
        url="https://helpa.studio/compare/interakt-alternative"
      />
      <FaqJsonLd items={INTERAKT_FAQS} />

      <LandingNavbar />

      <main className="pt-28 pb-20 sm:pt-36">
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-xs font-black text-emerald-800 shadow-sm">
              <Scale className="h-4 w-4 text-emerald-600" />
              Service Businesses vs E-commerce Tools
            </div>
            <h1 className="text-4xl font-black tracking-tight text-[#110E3D] sm:text-5xl lg:text-6xl">
              Helpa vs Interakt:{' '}
              <span className="bg-gradient-to-r from-[#075E54] via-[#25D366] to-[#075E54] bg-clip-text text-transparent">
                Which is Right for You?
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
              If your business runs on appointments, consultations, and client
              inquiries rather than shipping boxes, Helpa is built for you.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="flex min-h-12 items-center gap-2 rounded-full bg-gradient-to-r from-[#25D366] via-[#20BA5A] to-[#075E54] px-8 py-3 text-base font-extrabold text-white shadow-lg shadow-[#25D366]/25 transition hover:scale-105"
              >
                Try Helpa Free <Sparkles className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="flex min-h-12 items-center gap-2 rounded-full border border-slate-300 bg-white px-8 py-3 text-base font-bold text-[#110E3D] shadow-sm transition hover:bg-slate-50"
              >
                View Pricing Plans
              </Link>
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="mx-auto mt-16 max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 p-5 text-sm font-black text-[#110E3D] sm:p-6 sm:text-base">
              <div>Feature</div>
              <div className="text-emerald-700">Helpa (Service & Clinic)</div>
              <div className="text-slate-500">Interakt (E-commerce)</div>
            </div>

            <div className="divide-y divide-slate-100">
              {COMPARISON_POINTS.map((pt) => (
                <div
                  key={pt.feature}
                  className="grid grid-cols-3 p-5 text-xs sm:p-6 sm:text-sm"
                >
                  <div className="font-bold text-[#110E3D]">{pt.feature}</div>
                  <div className="pr-4 font-semibold text-emerald-800">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      {pt.helpa}
                    </span>
                  </div>
                  <div className="text-slate-500">{pt.interakt}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="mx-auto mt-24 max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-[#110E3D]">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="mt-10 space-y-4">
            {INTERAKT_FAQS.map((faq) => (
              <div
                key={faq.question}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
              >
                <h3 className="text-base font-bold text-[#110E3D]">
                  {faq.question}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto mt-24 max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-[#110E3D] p-10 text-center text-white shadow-xl sm:p-14">
            <h2 className="text-3xl font-extrabold sm:text-4xl">
              Get the WhatsApp platform built for service businesses
            </h2>
            <div className="mt-8 flex justify-center">
              <Link
                href="/signup"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#25D366] px-8 py-3 text-base font-extrabold text-slate-950 shadow-md transition hover:scale-105"
              >
                Start Free Trial <Sparkles className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
