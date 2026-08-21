'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const FAQS = [
  {
    q: 'Can our clinic keep its existing WhatsApp Business number?',
    a: 'Eligible Meta accounts can use supported WhatsApp Business App and Cloud API coexistence. Availability depends on Meta’s account and region requirements, which Helpa checks during onboarding.',
  },
  {
    q: 'Does our receptionist need technical skills?',
    a: 'No developer setup is expected for normal onboarding. An authorized clinic administrator connects the Meta business account, then configures clinic hours, doctors, services, approved answers, and handoff rules.',
  },
  {
    q: 'Can Helpa make medical decisions?',
    a: 'No. Helpa is designed for administrative communication such as approved FAQs, availability, booking, reminders, and staff handoff. Diagnosis, prescribing, triage, and clinical decisions must remain with qualified professionals.',
  },
  {
    q: 'Can multiple clinic staff use the same number?',
    a: 'Yes. The shared inbox supports assignments and staff takeover so receptionists and authorized team members can work from the same clinic number with a conversation history.',
  },
  {
    q: 'Is Helpa healthcare-compliance certified?',
    a: 'Not currently. Helpa includes security controls for sensitive workflows, but those controls are not a compliance certification. Independent technical and legal reviews are required before making HIPAA, DPDP, or equivalent claims.',
  },
];

export function LandingFaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="bg-[#FAF9FC] py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <span className="mb-2 inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">Clinic FAQ</span>
          <h2 className="text-3xl font-extrabold text-[#110E3D]">Questions before your clinic starts</h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={faq.q} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button type="button" aria-expanded={isOpen} onClick={() => setOpenIndex(isOpen ? null : index)} className="flex min-h-11 w-full items-center justify-between gap-4 p-5 text-left">
                  <span className="text-sm font-bold text-[#110E3D] sm:text-base">{faq.q}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-[#110E3D]' : ''}`} />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-slate-100 px-5 pt-3 pb-5 text-sm leading-relaxed text-slate-600">
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
