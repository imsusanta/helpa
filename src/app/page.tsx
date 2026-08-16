import type { Metadata } from 'next';
import { LandingNavbar } from '@/components/landing/landing-navbar';
import { LandingHero } from '@/components/landing/landing-hero';
import { LandingTrustBar } from '@/components/landing/landing-trust-bar';
import { LandingProblemSolution } from '@/components/landing/landing-problem-solution';
import { LandingProductTabs } from '@/components/landing/landing-product-tabs';
import { LandingAiDualEngine } from '@/components/landing/landing-ai-dual-engine';
import { LandingIndustryModules } from '@/components/landing/landing-industry-modules';
import { LandingAutomationBuilder } from '@/components/landing/landing-automation-builder';
import { LandingSecuritySection } from '@/components/landing/landing-security-section';
import { LandingPricing } from '@/components/landing/landing-pricing';
import { LandingFaq } from '@/components/landing/landing-faq';
import { LandingCta } from '@/components/landing/landing-cta';
import { LandingFooter } from '@/components/landing/landing-footer';

export const metadata: Metadata = {
  title: 'Helpa — AI WhatsApp Communication Platform for Modern Businesses',
  description:
    'Turn every WhatsApp conversation into a customer, appointment, lead, or follow-up with AI. Helpa unifies team inbox, CRM, autonomous AI agents, and workflow automations into one powerful workspace.',
  openGraph: {
    title: 'Helpa — Your WhatsApp. Powered by AI.',
    description:
      'Turn every WhatsApp conversation into a customer, appointment, lead, or follow-up with AI.',
    url: 'https://www.helpa.studio/',
    siteName: 'Helpa by Helpa Studio',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Helpa — Your WhatsApp. Powered by AI.',
    description:
      'AI Communication Platform for modern businesses: WhatsApp + AI + CRM + Automations.',
  },
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-emerald-500/20 selection:text-emerald-700 dark:selection:text-emerald-300">
      <LandingNavbar />
      <LandingHero />
      <LandingTrustBar />
      <LandingProblemSolution />
      <LandingProductTabs />
      <LandingAiDualEngine />
      <LandingIndustryModules />
      <LandingAutomationBuilder />
      <LandingSecuritySection />
      <LandingPricing />
      <LandingFaq />
      <LandingCta />
      <LandingFooter />
    </main>
  );
}
