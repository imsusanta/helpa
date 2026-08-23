'use client';

import Link from 'next/link';
import {
  FileCheck,
  Shield,
  Scale,
  ArrowLeft,
  Mail,
  CreditCard,
  Ban,
} from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F8FAFC] font-sans text-slate-900 antialiased selection:bg-emerald-500 selection:text-white">
      {/* Background Decorative Gradient */}
      <div className="pointer-events-none absolute top-0 left-1/2 h-[500px] w-full max-w-7xl -translate-x-1/2 bg-gradient-to-b from-blue-50/60 via-slate-50/30 to-transparent" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/" className="group flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/helpa-logo.png?v=4"
              alt="Helpa Logo"
              className="h-9 w-9 rounded-xl object-contain shadow-xs transition-transform group-hover:scale-105"
            />
            <span className="text-2xl font-extrabold tracking-tight text-[#110E3D]">
              helpa<span className="text-emerald-500">.</span>
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 mx-auto max-w-4xl px-4 py-12 sm:px-6 md:py-16">
        {/* Title Block */}
        <div className="mb-12 border-b border-slate-200 pb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
            <Scale className="h-3.5 w-3.5 text-blue-600" />
            <span>Official Terms of Service</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Effective Date: January 1, 2026 • Last Updated: August 21, 2026
          </p>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Please read these Terms of Service (&quot;Terms&quot;) carefully
            before using the Helpa Studio CRM platform, AI Receptionist engine,
            and website at{' '}
            <a
              href="https://www.helpa.studio"
              className="font-semibold text-emerald-600 underline"
            >
              https://www.helpa.studio
            </a>{' '}
            (the &quot;Service&quot;), operated by Helpa Studio (&quot;we&quot;,
            &quot;us&quot;, or &quot;our&quot;).
          </p>
        </div>

        {/* Highlight Summary Cards */}
        <div className="mb-12 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <FileCheck className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Authorized Usage
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Your license grants full operational rights to automate your
              business communications and patient/customer records.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Shield className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Data Ownership</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              You retain 100% intellectual property and ownership over your
              patient lists, client contacts, and business documents.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Ban className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Anti-Spam Policy
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Strict prohibition against bulk unsolicited messaging or violating
              WhatsApp Business Messaging policies.
            </p>
          </div>
        </div>

        {/* Terms Body */}
        <div className="prose prose-slate max-w-none space-y-10 text-slate-700">
          {/* Section 1 */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-8">
            <h2 className="flex items-center gap-2.5 text-xl font-bold text-slate-900">
              <FileCheck className="h-5 w-5 text-blue-600" />
              1. Acceptance of Terms & Eligibility
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              By creating an account, accessing the Helpa dashboard, or
              connecting your WhatsApp Business account, you agree to be bound
              by these Terms and our Privacy Policy. You represent that you have
              the legal authority to bind your clinic, hospital, coaching
              center, salon, or commercial business entity to these Terms.
            </p>
          </section>

          {/* Section 2 */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-8">
            <h2 className="flex items-center gap-2.5 text-xl font-bold text-slate-900">
              <Shield className="h-5 w-5 text-blue-600" />
              2. Meta Platform & WhatsApp Business Compliance
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Helpa interfaces directly with the Meta WhatsApp Business Cloud
              API. When utilizing our WhatsApp AI Receptionist, Broadcast, or
              Inbox services, you agree to:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
              <li>
                Comply with the official{' '}
                <strong>WhatsApp Business Messaging Policy</strong> and{' '}
                <strong>Commerce Policy</strong> at all times.
              </li>
              <li>
                Obtain explicit, documented opt-in consent from your customers
                or patients prior to sending outbound marketing or notification
                templates.
              </li>
              <li>
                Refrain from sending spam, fraudulent content, unlawful medical
                advice, or unsolicited bulk promotional broadcasts.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-8">
            <h2 className="flex items-center gap-2.5 text-xl font-bold text-slate-900">
              <CreditCard className="h-5 w-5 text-blue-600" />
              3. Subscriptions, Billing & Cancellation
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Helpa offers subscription plans (Starter, Growth, Clinic Pro) and
              conversation-based utility services:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
              <li>
                <strong>Free Trial:</strong> New workspaces receive a 14-day
                evaluation trial with complete feature access.
              </li>
              <li>
                <strong>Subscription Renewal:</strong> Subscriptions renew
                automatically at the beginning of each billing cycle unless
                cancelled through your dashboard settings prior to the renewal
                date.
              </li>
              <li>
                <strong>Refund Policy:</strong> If you are unsatisfied with the
                Service, you may request a refund within 7 days of initial
                subscription payment by emailing{' '}
                <a
                  href="mailto:support@helpa.studio"
                  className="font-semibold text-emerald-600 underline"
                >
                  support@helpa.studio
                </a>
                .
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-8">
            <h2 className="flex items-center gap-2.5 text-xl font-bold text-slate-900">
              <Scale className="h-5 w-5 text-blue-600" />
              4. Service Availability & Limitations
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              While we strive to provide 99.9% platform uptime, Helpa shall not
              be held liable for temporary interruptions caused by Meta WhatsApp
              API outages, telecommunication provider downtime, or third-party
              AI model latency.
            </p>
          </section>

          {/* Section 5 */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-8">
            <h2 className="flex items-center gap-2.5 text-xl font-bold text-slate-900">
              <Mail className="h-5 w-5 text-blue-600" />
              5. Contact Us
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              For questions regarding these Terms or legal notices:
            </p>
            <div className="mt-3 text-sm text-slate-700">
              <p>
                <strong>Helpa Studio</strong>
              </p>
              <p>
                Legal & Support Team:{' '}
                <a
                  href="mailto:support@helpa.studio"
                  className="text-emerald-600 hover:underline"
                >
                  support@helpa.studio
                </a>
              </p>
              <p>
                Website:{' '}
                <a
                  href="https://www.helpa.studio"
                  className="text-emerald-600 hover:underline"
                >
                  https://www.helpa.studio
                </a>
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/helpa-logo.png?v=4"
              alt="Helpa"
              className="h-6 w-6 rounded-lg object-contain"
            />
            <span className="font-bold text-slate-900">Helpa Studio</span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-slate-600">
            <Link href="/" className="hover:text-slate-900">
              Home
            </Link>
            <Link href="/privacy" className="hover:text-slate-900">
              Privacy Policy
            </Link>
            <Link href="/terms" className="font-bold text-blue-600">
              Terms of Service
            </Link>
            <a
              href="mailto:support@helpa.studio"
              className="hover:text-slate-900"
            >
              Contact Support
            </a>
          </div>
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} Helpa Studio. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
