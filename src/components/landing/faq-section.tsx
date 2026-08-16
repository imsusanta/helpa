'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FAQS = [
  {
    q: 'Can I keep my existing WhatsApp Business number?',
    a: 'Yes! Helpa supports official Meta WhatsApp Business App + Cloud API coexistence for eligible accounts. You can continue using your mobile WhatsApp Business app while simultaneously powering Helpa AI receptionist, automations, and team inbox.',
  },
  {
    q: 'Do I need technical skills or developer experience to connect?',
    a: 'Not at all. With Helpa 1-Click Embedded Signup, you simply click "Continue with Meta", select your business account, and Meta automatically configures webhooks and credentials without copy-pasting API keys.',
  },
  {
    q: 'How does Helpa AI learn about my business?',
    a: 'You can upload your price lists, doctor schedules, course fees, treatment menus, and FAQs directly to your Knowledge Base. Helpa AI uses this private knowledge base to answer customer questions accurately without hallucinating.',
  },
  {
    q: 'Can multiple staff members use the same WhatsApp number?',
    a: 'Yes. Helpa includes a Unified Multi-Agent Inbox where doctors, receptionists, teachers, stylists, and agents can collaborate on chats, assign leads, and see live customer timelines.',
  },
  {
    q: 'Is my customer and patient data secure?',
    a: 'Absolutely. Helpa enforces strict tenant isolation, role-based access control, and AES-256-GCM encryption for all stored credentials. Tenant A can never access Tenant B data.',
  },
];

export function LandingFaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="bg-[#FAF9FC] py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <span className="mb-2 inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">
            Frequently Asked Questions
          </span>
          <h2 className="text-3xl font-extrabold text-[#110E3D]">
            Everything you need to know
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left"
                >
                  <span className="text-sm font-bold text-[#110E3D] sm:text-base">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[#110E3D]' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-slate-100 px-5 pt-3 pb-5 text-xs leading-relaxed text-slate-600 sm:text-sm"
                    >
                      {faq.a}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
