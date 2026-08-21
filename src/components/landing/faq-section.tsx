'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FAQS = [
  {
    q: 'Can I keep my current WhatsApp number?',
    a: 'Yes, absolutely! You do not need a new SIM or phone number. You can keep using your existing WhatsApp number and mobile app, while Helpa handles automated replies, bookings, and reminders in the background.',
  },
  {
    q: 'Do I need any technical skills or coding knowledge?',
    a: 'None at all! Connecting your WhatsApp takes less than 2 minutes. You simply click "Continue with Meta", select your business page, and everything is set up automatically. No developer required.',
  },
  {
    q: 'How does the AI know what to reply to my clients?',
    a: 'You can simply type or upload your service menu, doctor timings, course fees, treatment prices, and FAQs. Helpa AI reads your information and answers customer questions accurately, just like a well-trained front-desk staff.',
  },
  {
    q: 'Can my staff members use this together on different devices?',
    a: 'Yes! Your entire team — doctors, receptionists, teachers, stylists, or assistants — can log in from their computers or phones to view chats, reply to clients, and manage appointments together.',
  },
  {
    q: 'What happens if a customer wants to talk to a real person?',
    a: 'Whenever a client asks for human assistance or a complex question comes up, the AI steps aside and notifies your team. You or your staff can jump into the chat and reply at any time.',
  },
  {
    q: 'Is my customer and patient data safe and private?',
    a: '100% private. Your patient records, student details, and chat conversations are encrypted with bank-grade security and are strictly private to your business.',
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
