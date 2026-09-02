import { describe, expect, it } from 'vitest';
import { isIndustryRouteAllowed } from '@/modules/routes';
import { getIndustryModule, INDUSTRY_REGISTRY } from '@/modules/registry';
import { aiToolRegistry } from '@/core/ai/tools';
import { buildReceptionistSystemPrompt } from '@/lib/whatsapp/ai-prompt';

const CANONICAL_INDUSTRIES = [
  'hospital_clinic',
  'travel',
  'restaurant',
  'coaching',
  'solo_teacher',
  'salon',
  'real_estate',
  'gym',
  'general',
] as const;

describe('Cross-Industry Workplace Isolation Suite', () => {
  describe('1. Route Isolation Across All 8 Canonical Industries', () => {
    const SHARED_ROUTES = [
      '/inbox',
      '/contacts',
      '/deals',
      '/automations',
      '/settings',
      '/broadcasts',
      '/help',
    ];

    it('allows all shared CRM routes for all supported industries', () => {
      for (const industry of CANONICAL_INDUSTRIES) {
        const manifest = getIndustryModule(industry);
        for (const route of SHARED_ROUTES) {
          expect(
            isIndustryRouteAllowed(manifest, route),
            `Industry ${industry} should have access to shared route ${route}`
          ).toBe(true);
        }
      }
    });

    it('strictly isolates Health / Clinic routes', () => {
      const healthRoutes = [
        '/patients',
        '/doctors',
        '/departments',
        '/lab-reports',
        '/website',
      ];
      for (const industry of CANONICAL_INDUSTRIES) {
        const manifest = getIndustryModule(industry);
        const shouldHaveAccess = industry === 'hospital_clinic';
        for (const route of healthRoutes) {
          expect(
            isIndustryRouteAllowed(manifest, route),
            `Industry ${industry} access to ${route} must be ${shouldHaveAccess}`
          ).toBe(shouldHaveAccess);
        }
      }
    });

    it('strictly isolates Travel Agency routes', () => {
      const travelRoutes = [
        '/booking-trip',
        '/bookings',
        '/trip-proposals',
        '/packages',
        '/tour-packages',
        '/quotations',
      ];
      for (const industry of CANONICAL_INDUSTRIES) {
        const manifest = getIndustryModule(industry);
        const shouldHaveAccess = industry === 'travel';
        for (const route of travelRoutes) {
          expect(
            isIndustryRouteAllowed(manifest, route),
            `Industry ${industry} access to ${route} must be ${shouldHaveAccess}`
          ).toBe(shouldHaveAccess);
        }
      }
    });

    it('strictly isolates Coaching / Education routes', () => {
      const coachingOnlyRoutes = ['/admissions'];
      for (const industry of CANONICAL_INDUSTRIES) {
        const manifest = getIndustryModule(industry);
        const shouldHaveAccess = industry === 'coaching';
        for (const route of coachingOnlyRoutes) {
          expect(
            isIndustryRouteAllowed(manifest, route),
            `Industry ${industry} access to ${route} must be ${shouldHaveAccess}`
          ).toBe(shouldHaveAccess);
        }
      }

      const sharedEducationRoutes = [
        '/courses',
        '/classes',
        '/students',
        '/teachers',
      ];
      for (const industry of CANONICAL_INDUSTRIES) {
        const manifest = getIndustryModule(industry);
        const shouldHaveAccess =
          industry === 'coaching' || industry === 'solo_teacher';
        for (const route of sharedEducationRoutes) {
          expect(
            isIndustryRouteAllowed(manifest, route),
            `Industry ${industry} access to ${route} must be ${shouldHaveAccess}`
          ).toBe(shouldHaveAccess);
        }
      }
    });

    it('strictly isolates Fitness / Gym routes', () => {
      const gymRoutes = ['/members', '/memberships', '/trainers'];
      for (const industry of CANONICAL_INDUSTRIES) {
        const manifest = getIndustryModule(industry);
        const shouldHaveAccess = industry === 'gym';
        for (const route of gymRoutes) {
          expect(
            isIndustryRouteAllowed(manifest, route),
            `Industry ${industry} access to ${route} must be ${shouldHaveAccess}`
          ).toBe(shouldHaveAccess);
        }
      }
    });

    it('strictly isolates Restaurant routes', () => {
      const restaurantRoutes = ['/orders', '/reservations', '/tables'];
      for (const industry of CANONICAL_INDUSTRIES) {
        const manifest = getIndustryModule(industry);
        const shouldHaveAccess = industry === 'restaurant';
        for (const route of restaurantRoutes) {
          expect(
            isIndustryRouteAllowed(manifest, route),
            `Industry ${industry} access to ${route} must be ${shouldHaveAccess}`
          ).toBe(shouldHaveAccess);
        }
      }
    });

    it('strictly isolates Real Estate routes', () => {
      const realEstateRoutes = ['/properties', '/agents', '/site-visits'];
      for (const industry of CANONICAL_INDUSTRIES) {
        const manifest = getIndustryModule(industry);
        const shouldHaveAccess = industry === 'real_estate';
        for (const route of realEstateRoutes) {
          expect(
            isIndustryRouteAllowed(manifest, route),
            `Industry ${industry} access to ${route} must be ${shouldHaveAccess}`
          ).toBe(shouldHaveAccess);
        }
      }
    });

    it('strictly isolates Salon routes', () => {
      const salonRoutes = ['/services', '/staff'];
      for (const industry of CANONICAL_INDUSTRIES) {
        const manifest = getIndustryModule(industry);
        const shouldHaveAccess = industry === 'salon';
        for (const route of salonRoutes) {
          expect(
            isIndustryRouteAllowed(manifest, route),
            `Industry ${industry} access to ${route} must be ${shouldHaveAccess}`
          ).toBe(shouldHaveAccess);
        }
      }
    });

    it('ensures General CRM workspaces cannot access any industry-specific routes', () => {
      const generalManifest = INDUSTRY_REGISTRY.general;
      const allIndustrySpecificRoutes = [
        '/patients',
        '/doctors',
        '/departments',
        '/lab-reports',
        '/booking-trip',
        '/tour-packages',
        '/quotations',
        '/admissions',
        '/courses',
        '/classes',
        '/students',
        '/members',
        '/memberships',
        '/orders',
        '/reservations',
        '/tables',
        '/properties',
        '/agents',
        '/site-visits',
        '/services',
        '/staff',
      ];
      for (const route of allIndustrySpecificRoutes) {
        expect(
          isIndustryRouteAllowed(generalManifest, route),
          `General workspace must NOT have access to ${route}`
        ).toBe(false);
      }
    });
  });

  describe('2. AI Tool Registry Scoping', () => {
    it('only exposes travel booking tools to travel industry', () => {
      const travelTools = aiToolRegistry
        .getToolsForIndustry('travel')
        .map((t) => t.name);
      const healthTools = aiToolRegistry
        .getToolsForIndustry('hospital_clinic')
        .map((t) => t.name);
      const generalTools = aiToolRegistry
        .getToolsForIndustry('general')
        .map((t) => t.name);

      expect(travelTools).toContain('offerTravelBookingConfirm');
      expect(travelTools).toContain('confirmTravelBooking');

      expect(healthTools).not.toContain('offerTravelBookingConfirm');
      expect(healthTools).not.toContain('confirmTravelBooking');

      expect(generalTools).not.toContain('offerTravelBookingConfirm');
      expect(generalTools).not.toContain('confirmTravelBooking');
    });

    it('correctly maps legacy alias "health" to hospital_clinic tools', () => {
      const aliasTools = aiToolRegistry.getToolsForIndustry('health');
      const canonicalTools =
        aiToolRegistry.getToolsForIndustry('hospital_clinic');
      expect(aliasTools.map((t) => t.name)).toEqual(
        canonicalTools.map((t) => t.name)
      );
    });
  });

  describe('3. AI System Prompt Isolation', () => {
    it('does NOT leak hospital instructions into travel receptionist prompt', () => {
      const prompt = buildReceptionistSystemPrompt({
        industry: 'travel',
        businessName: 'Wanderlust Travels',
        responseStyle: 'balanced',
        kbContext: '',
        hospitalContext: '',
        coachingContext: '',
        isHospitalEnabled: false,
        isCoachingEnabled: false,
        isTravelEnabled: true,
      });

      expect(prompt).toContain('Wanderlust Travels');
      expect(prompt).toContain('TRAVEL WORKPLACE TOUR PACKAGE CONTEXT');
      expect(prompt).not.toContain('PAT-XXXXXX');
      expect(prompt).not.toContain('hospital_profile_update');
      expect(prompt).not.toContain('HOSPITAL & CLINIC SYSTEM CONTEXT');
      expect(prompt).not.toContain('Available Doctors & Clinic Schedules');
    });

    it('injects clinical instructions only when isHospitalEnabled is true', () => {
      const prompt = buildReceptionistSystemPrompt({
        industry: 'hospital_clinic',
        businessName: 'Care Clinic',
        responseStyle: 'balanced',
        kbContext: '',
        coachingContext: '',
        isHospitalEnabled: true,
        isCoachingEnabled: false,
        isTravelEnabled: false,
        hospitalContext: 'Doctors: Dr. Smith (Cardiology)',
      });

      expect(prompt).toContain('Care Clinic');
      expect(prompt).toContain('HOSPITAL & CLINIC SYSTEM CONTEXT');
      expect(prompt).toContain('PAT-XXXXXX');
      expect(prompt).toContain('hospital_profile_update');
      expect(prompt).not.toContain('TRAVEL WORKPLACE TOUR PACKAGE CONTEXT');
    });
  });
});
