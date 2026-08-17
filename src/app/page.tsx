'use client';

import { useState, useEffect } from 'react';
import { LandingNavbar } from '@/components/landing/navbar';
import { LandingHero } from '@/components/landing/hero';
import { LandingInteractiveShowcase } from '@/components/landing/interactive-showcase';
import { LandingIndustrySolutions } from '@/components/landing/industry-solutions';
import { LandingSecurityBadges } from '@/components/landing/security-badges';
import { LandingPricingSection } from '@/components/landing/pricing-section';
import { LandingFaqSection } from '@/components/landing/faq-section';
import { LandingCtaBanner } from '@/components/landing/cta-banner';
import { LandingFooter } from '@/components/landing/footer';

export default function LandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is authenticated via /api/auth/me
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if ((data?.success || data?.authenticated) && data?.user) {
          setIsAuthenticated(true);
        }
      })
      .catch(() => {
        // Fallback: unauthenticated
      });
  }, []);

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
