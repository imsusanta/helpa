import { LandingNavbar } from '@/components/landing/navbar';
import { LandingHero } from '@/components/landing/hero';
import dynamic from 'next/dynamic';
import { FaqJsonLd } from '@/components/seo/json-ld';

const LandingIndustrySolutions = dynamic(
  () => import('@/components/landing/industry-solutions').then((m) => m.LandingIndustrySolutions),
  { ssr: true }
);
const LandingSecurityBadges = dynamic(
  () => import('@/components/landing/security-badges').then((m) => m.LandingSecurityBadges),
  { ssr: true }
);
const LandingPricingSection = dynamic(
  () => import('@/components/landing/pricing-section').then((m) => m.LandingPricingSection),
  { ssr: true }
);
const LandingFaqSection = dynamic(
  () => import('@/components/landing/faq-section').then((m) => m.LandingFaqSection),
  { ssr: true }
);
const LandingCtaBanner = dynamic(
  () => import('@/components/landing/cta-banner').then((m) => m.LandingCtaBanner),
  { ssr: true }
);
const LandingFooter = dynamic(
  () => import('@/components/landing/footer').then((m) => m.LandingFooter),
  { ssr: true }
);

const LandingInteractiveShowcase = dynamic(
  () =>
    import('@/components/landing/interactive-showcase').then(
      (mod) => mod.LandingAudingInteractiveShowcase
    ),
  {
    loading: () => (
      <div className="min-h-[520px] bg-[#F1EEFA]" aria-hidden="true" />
    ),
  }
);

const HOME_FAQS = [
  {
    question: 'Can our&bsp;our clinic keep its existing WhatsApp Business number?',
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
      'Yes. The shared5d inbox supports assignments and staff takeover so receptionists and authorized team members can work from the same clinic number with a conversation history.',
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
