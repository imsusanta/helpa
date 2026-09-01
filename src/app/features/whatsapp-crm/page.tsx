import type { Metadata } from 'next';
import Link from 'next/link';
import { Inbox, ShieldCheck, Sparkles, Tag, Users } from 'lucide-react';
import { LandingNavbar } from '@/components/landing/navbar';
import { LandingFooter } from '@/components/landing/footer';
import {
  BreadcrumbJsonLd,
  FaqJsonLd,
  ServiceJsonLd,
} from '@/components/seo/json-ld';

export const metadata: Metadata = {
  title: 'Official Meta WhatsApp Cloud API Team Inbox & CRM',
  description:
    'Manage all customer WhatsApp conversations in one collaborative multi-agent inbox. Tag leads, assign chats, sync customer history, and keep complete team accountability.',
  keywords: [
    'WhatsApp CRM India',
    'Shared Team Inbox WhatsApp',
    'Meta WhatsApp Business Cloud API',
    'Multi-Agent WhatsApp Inbox',
    'WhatsApp Lead Management',
    'WhatsApp CRM for Small Business',
  ],
  alternates: {
    canonical: 'https://helpa.studio/features/whatsapp-crm',
  },
  openGraph: {
    title: 'Official WhatsApp Team Inbox & CRM | Helpa',
    description:
      'A collaborative multi-agent WhatsApp inbox built for growing Indian teams.',
    url: 'https://helpa.studio/features/whatsapp-crm',
  },
};

const CRM_FAQS = [
  {
    question:
      'How many agents can use the shared WhatsApp number simultaneously?',
    answer:
      'Unlimited team members can log into the Helpa dashboard from their desktop or mobile browsers to manage chats on the same official WhatsApp number.',
  },
  {
    question: 'Can we assign chats to specific staff members?',
    answer:
      'Yes. Conversations can be assigned to specific receptionists, counselors, or specialists with automated notifications and status tracking (Open, Pending, Resolved).',
  },
  {
    question: 'Are conversations encrypted and backed up?',
    answer:
      'Yes. Helpa stores all conversation histories securely in PostgreSQL with row-level security and automated backups.',
  },
];

export default function WhatsAppCrmFeaturePage() {
  return (
    <div className="min-h-screen bg-[#FAF9FC] text-[#110E3D] selection:bg-[#B4F73C] selection:text-[#110E3D]">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://helpa.studio' },
          { name: 'Features', url: 'https://helpa.studio/#features' },
          {
            name: 'WhatsApp CRM & Inbox',
            url: 'https://helpa.studio/features/whatsapp-crm',
          },
        ]}
      />
      <ServiceJsonLd
        name="Meta WhatsApp Cloud API Shared Team Inbox & CRM"
        serviceType="WhatsApp Customer Relationship Management"
        description="Multi-agent shared team inbox, customer tagging, role-based access, and conversation management on WhatsApp."
        url="https://helpa.studio/features/whatsapp-crm"
      />
      <FaqJsonLd items={CRM_FAQS} />

      <LandingNavbar />

      <main className="pt-28 pb-20 sm:pt-36">
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-xs font-black text-emerald-800 shadow-sm">
              <Inbox className="h-4 w-4 text-emerald-600" />
              Collaborative WhatsApp Team Inbox
            </div>
            <h1 className="text-4xl font-black tracking-tight text-[#110E3D] sm:text-5xl lg:text-6xl">
              One Official WhatsApp Number,{' '}
              <span className="bg-gradient-to-r from-[#075E54] via-[#25D366] to-[#075E54] bg-clip-text text-transparent">
                Your Entire Team Connected
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
              Eliminate personal phone chaos. Provide your team with a unified
              shared inbox, customer tags, internal private notes, and complete
              conversation history.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="flex min-h-12 items-center gap-2 rounded-full bg-gradient-to-r from-[#25D366] via-[#20BA5A] to-[#075E54] px-8 py-3 text-base font-extrabold text-white shadow-lg shadow-[#25D366]/25 transition hover:scale-105"
              >
                Set Up Team Inbox <Sparkles className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="flex min-h-12 items-center gap-2 rounded-full border border-slate-300 bg-white px-8 py-3 text-base font-bold text-[#110E3D] shadow-sm transition hover:bg-slate-50"
              >
                View Plans
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Users className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-[#110E3D]">
                Multi-Agent Assignments
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Assign inquiries to specific team members. Know exactly who
                replied to which patient or customer in real-time.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Tag className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-[#110E3D]">
                Custom Tags & Segments
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Categorize leads with custom labels (e.g. VIP, High Priority,
                Dental Implant, JEE Batch 2027) for targeted follow-up.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-[#110E3D]">
                Official Meta Cloud Coexistence
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Connect via official Meta Cloud API with optional WhatsApp
                Business App coexistence support.
              </p>
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
            {CRM_FAQS.map((faq) => (
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
              Equip your front desk with a modern WhatsApp CRM
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
