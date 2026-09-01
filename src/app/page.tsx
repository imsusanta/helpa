import dynamic from 'next/dynamic';
import { LandingNavbar } from '@/components/landing/navbar';
import { LandingHero } from '@/components/landing/hero';
import { LandingIndustrySolutions } from '@/components/landing/industry-solutions';
import { LandingSecurityBadges } from '@/components/landing/security-badges';
import { LandingPricingSection } from '@/components/landing/pricing-section';
import { LandingFaqSection } from '@/components/landing/faq-section';
import { LandingCtaBanner } from '@/components/landing/cta-banner';
import { LandingFooter } from '@/components/landing/footer';

const LandingInteractiveShowcase = dynamic(
  () =>
    import('@/components/landing/interactive-showcase').then(
      (mod) => mod.LandingInteractiveShowcase
    ),
  {
    loading: () => (
      <div className="min-h-[520px] bg-[#F1EEFA]" aria-hidden="true" />
    ),
  }
);

import { FaqJsonLd } from '@/components/seo/json-ld';

const HOME_FAQS = [
  {
    question: 'Can our clinic keep its existing WhatsApp Business number?',
    answer:
      'Eligible Meta accounts can use supported WhatsApp Business App and Cloud API coexistence. Availability depends on Meta’s account and region requirements, which Helpa checks during onboarding.',
  },
  {
    question: 'Does our receptionist need technical skills?',
    answer:
      'No developer setup is expected for normal onboarding. An authorized clinic administrator connects the Meta business account, then configures clinic hours, doctors, services, approved answers, and handoff rules.',
  },
  {
    question: 'Can Helpa make medical decisions?',
    answer:
      'No. Helpa is designed for administrative communication such as approved FAQs, availability, booking, reminders, and staff handoff. Diagnosis, prescribing, triage, and clinical decisions must remain with qualified professionals.',
  },
  {
    question: 'Can multiple clinic staff use the same number?',
    answer:
      'Yes. The shared inbox supports assignments and staff takeover so receptionists and authorized team members can work from the same clinic number with a conversation history.',
  },
  {
    question: 'Is Helpa healthcare-compliance certified?',
    answer:
      'Not currently. Helpa includes security controls for sensitive workflows, but those controls are not a compliance certification. Independent technical and legal reviews are required before making HIPAA, DPDP, or equivalent claims.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FAF9FC] text-[#110E3D] selection:bg-[#B4F73C] selection:text-[#110E3D]">
      <FaqJsonLd items={HOME_FAQS} />
      <LandingNavbar />
      <main>
        <LandingHero isAuthenticated={false} />
        <LandingInteractiveShowcase />
        <LandingIndustrySolutions />
        <LandingSecurityBadges />
        <LandingPricingSection />
        <LandingFaqSection />
        <LandingCtaBanner />
      </main>
      <LandingFooter />
    </div>
  );
}
