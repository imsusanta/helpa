import { LandingNavbar } from '@/components/landing/navbar';
import { LandingHero } from '@/components/landing/hero';
import { LandingIndustrySolutions } from '@/components/landing/industry-solutions';
import { LandingSecurityBadges } from '@/components/landing/security-badges';
import { LandingPricingSection } from '@/components/landing/pricing-section';
import { LandingFaqSection } from '@/components/landing/faq-section';
import { LandingCtaBanner } from '@/components/landing/cta-banner';
import { LandingFooter } from '@/components/landing/footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FAF9FC] text-[#110E3D] selection:bg-[#B4F73C] selection:text-[#110E3D]">
      <LandingNavbar />
      <main>
        <LandingHero isAuthenticated={false} />
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
