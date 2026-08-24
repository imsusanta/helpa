import { getCurrentAccount } from '@/lib/auth/account';
import { LandingNavbar } from '@/components/landing/navbar';
import { LandingHero } from '@/components/landing/hero';
import { LandingInteractiveShowcase } from '@/components/landing/interactive-showcase';
import { LandingIndustrySolutions } from '@/components/landing/industry-solutions';
import { LandingSecurityBadges } from '@/components/landing/security-badges';
import { LandingPricingSection } from '@/components/landing/pricing-section';
import { LandingFaqSection } from '@/components/landing/faq-section';
import { LandingCtaBanner } from '@/components/landing/cta-banner';
import { LandingFooter } from '@/components/landing/footer';

export default async function LandingPage() {
  // Resolve auth on the server so the landing page does not need a client-side
  // auth request before showing the correct CTA. Unauthenticated visitors are
  // handled without an error boundary or a blocking browser fetch.
  let isAuthenticated = false;
  try {
    await getCurrentAccount();
    isAuthenticated = true;
  } catch {
    isAuthenticated = false;
  }

  return (
    <div className="min-h-screen bg-[#FAF9FC] text-[#110E3D] selection:bg-[#B4F73C] selection:text-[#110E3D]">
      <LandingNavbar isAuthenticated={isAuthenticated} />
      <main>
        <LandingHero isAuthenticated={isAuthenticated} />
        <LandingInteractiveShowcase />
        <LandingIndustrySolutions />
        <LandingSecurityBadges />
        <LandingPricingSection />
        <LandingFaqSection />
        <LandingCtaBanner isAuthenticated={isAuthenticated} />
      </main>
      <LandingFooter />
    </div>
  );
}
