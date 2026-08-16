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
    <section className="py-20 bg-[#FAF9FC]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 mb-2">
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
                className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4"
                >
                  <span className="text-sm sm:text-base font-bold text-[#110E3D]">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
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
                      className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3"
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
