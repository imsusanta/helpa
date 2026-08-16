'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'What is Helpa and how does it work?',
      a: 'Helpa is an AI Business Communication Platform built on the official Meta WhatsApp Cloud API. It connects your WhatsApp Business number to a unified team workspace with automated AI agents, an intelligent staff copilot, an integrated contact CRM, visual workflow automations, and modular industry tools (for clinics, coaching, tutors, salons, and real estate).',
    },
    {
      q: 'Can I connect my existing WhatsApp Business number?',
      a: 'Yes! Helpa uses Meta\'s official 1-Click Embedded Signup. Where eligible, Meta supports coexistence, allowing you to use your mobile WhatsApp Business app while simultaneously powering Helpa\'s AI auto-replies, team inbox, and broadcast campaigns.',
    },
    {
      q: 'How does Helpa\'s AI differ from generic chatbots?',
      a: 'Unlike rigid button bots or hallucinating chatbots, Helpa provides a Dual AI Engine. The AI Agent answers queries based strictly on your uploaded knowledge base (pricing, timings, doctor schedules), while the Staff Copilot provides real-time intent analysis and 1-click suggested actions (e.g. generating queue tokens or booking appointments) for your human team.',
    },
    {
      q: 'Can multiple staff members use Helpa together?',
      a: 'Absolutely. Helpa provides a shared multi-agent inbox where you can assign conversations to specific staff members, create private internal notes, and manage customer tickets with role-based access control (Owner, Admin, Staff, Viewer).',
    },
    {
      q: 'Which industries are supported on Helpa?',
      a: 'Helpa comes pre-configured with 5 modular industry packages: Health & Clinics (patient IDs, doctor OPD slots, PDF tokens), Coaching Institutes (admission pipelines, course batches), Solo Tutors (homework & class reminders), Beauty Salons (stylist conflict-free bookings), and Real Estate (property requirement matching & site visits).',
    },
    {
      q: 'How does the 14-day free trial work?',
      a: 'You get full access to all Professional features for 14 days without entering a credit card. At the end of the trial, you can choose a paid plan or continue with our basic Free tier.',
    },
    {
      q: 'Is our business and customer data secure?',
      a: 'Yes. Helpa is built with strict server-side multi-tenant isolation, ensuring your customer records, messages, and AI memory are never accessible to any other tenant. All API tokens and credentials are encrypted at rest with AES-256-GCM authenticated cryptography.',
    },
  ];

  return (
    <section id="faq" className="py-20 lg:py-28 bg-muted/20 border-t border-border/60">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16 space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            Got Questions?
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-base text-muted-foreground">
            Everything you need to know about Helpa, WhatsApp Cloud API, AI Copilot, and security.
          </p>
        </div>

        {/* Accordion FAQ List */}
        <div className="space-y-3.5">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-border/80 bg-card overflow-hidden transition-all shadow-xs"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full text-left p-5 sm:p-6 flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-foreground focus:outline-none"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-emerald-600' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 sm:px-6 pb-6 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/40 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
