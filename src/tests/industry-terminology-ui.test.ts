import { describe, expect, it } from 'vitest';
import { NAV } from '@/components/layout/sidebar';
import { NAVIGATION_FEATURE_STATUSES } from '@/components/layout/navigation-registry';
import { buildVisibleNavigation } from '@/components/layout/sidebar-navigation';
import { getSectionMeta } from '@/components/settings/settings-sections';
import {
  GENERAL_INDUSTRY_TERMINOLOGY,
  getIndustryTerminology,
  resolveIndustryAlias,
  type CanonicalIndustry,
} from '@/modules/terminology';
import { getIndustryModule } from '@/modules/registry';
import { isIndustryRouteAllowed } from '@/modules/routes';

/**
 * Guards the industry-aware terminology contract used across the
 * workspace UI: page titles, sidebar labels, table headers, buttons,
 * search placeholders and empty states all read from
 * `getIndustryTerminology()` (via `useWorkspace()`), so this suite
 * verifies the vocabulary each industry receives from that single
 * source of truth.
 */

interface ExpectedVocabulary {
  contact: string;
  contacts: string;
  staffMembers: string;
  services: string;
  bookings: string;
  bookingAction: string;
  pipelineItems: string;
}

const EXPECTED: Record<CanonicalIndustry, ExpectedVocabulary> = {
  hospital_clinic: {
    contact: 'Patient',
    contacts: 'Patients',
    staffMembers: 'Doctors',
    services: 'Treatments',
    bookings: 'Appointments',
    bookingAction: 'Book Appointment',
    pipelineItems: 'Patient Inquiries',
  },
  travel: {
    contact: 'Traveller',
    contacts: 'Travellers',
    staffMembers: 'Travel Advisors',
    services: 'Packages',
    bookings: 'Trip Bookings',
    bookingAction: 'Book Trip',
    pipelineItems: 'Travel Enquiries',
  },
  restaurant: {
    contact: 'Guest',
    contacts: 'Guests',
    staffMembers: 'Staff',
    services: 'Menu Items',
    bookings: 'Reservations',
    bookingAction: 'Make Reservation',
    pipelineItems: 'Reservation Requests',
  },
  coaching: {
    contact: 'Student',
    contacts: 'Students',
    staffMembers: 'Teachers',
    services: 'Courses',
    bookings: 'Admission Enquiries',
    bookingAction: 'Create Admission Enquiry',
    pipelineItems: 'Admission Enquiries',
  },
  solo_teacher: {
    contact: 'Student',
    contacts: 'Students',
    staffMembers: 'Teachers',
    services: 'Courses',
    bookings: 'Class Bookings',
    bookingAction: 'Book Class',
    pipelineItems: 'Student Enquiries',
  },
  salon: {
    contact: 'Client',
    contacts: 'Clients',
    staffMembers: 'Stylists',
    services: 'Services',
    bookings: 'Appointments',
    bookingAction: 'Book Appointment',
    pipelineItems: 'Enquiries',
  },
  real_estate: {
    contact: 'Lead',
    contacts: 'Leads',
    staffMembers: 'Agents',
    services: 'Properties',
    bookings: 'Site Visit Bookings',
    bookingAction: 'Book Site Visit',
    pipelineItems: 'Property Enquiries',
  },
  gym: {
    contact: 'Member',
    contacts: 'Members',
    staffMembers: 'Trainers',
    services: 'Plans & Classes',
    bookings: 'Session Bookings',
    bookingAction: 'Book Session',
    pipelineItems: 'Membership Enquiries',
  },
  general: {
    contact: 'Contact',
    contacts: 'Contacts',
    staffMembers: 'Staff Members',
    services: 'Services',
    bookings: 'Bookings',
    bookingAction: 'Create Booking',
    pipelineItems: 'Leads',
  },
};

const ALL_INDUSTRIES = Object.keys(EXPECTED) as CanonicalIndustry[];

function buildNavigationFor(industry: string) {
  const manifest = getIndustryModule(industry);
  return buildVisibleNavigation({
    navigation: NAV,
    terminology: getIndustryTerminology(industry),
    currentIndustry: industry,
    isSuperAdmin: false,
    accountRole: 'owner',
    manifest,
    routeRoleRequirements: manifest.sidebar,
    featureStatuses: NAVIGATION_FEATURE_STATUSES,
    isRouteAllowed: (pathname) => isIndustryRouteAllowed(manifest, pathname),
  });
}

function flattenNavigation(items: ReturnType<typeof buildNavigationFor>) {
  return items.flatMap((item) => [
    { href: item.href, label: item.label },
    ...(item.children ?? []).map((child) => ({
      href: child.href,
      label: child.label,
    })),
  ]);
}

describe('industry terminology vocabulary', () => {
  it.each(ALL_INDUSTRIES)(
    '%s exposes the expected business vocabulary',
    (industry) => {
      const terms = getIndustryTerminology(industry);
      const expected = EXPECTED[industry];
      expect(terms.contact).toBe(expected.contact);
      expect(terms.contacts).toBe(expected.contacts);
      expect(terms.staffMembers).toBe(expected.staffMembers);
      expect(terms.services).toBe(expected.services);
      expect(terms.bookings).toBe(expected.bookings);
      expect(terms.bookingAction).toBe(expected.bookingAction);
      expect(terms.pipelineItems).toBe(expected.pipelineItems);
    }
  );

  it.each(ALL_INDUSTRIES)(
    '%s provides every terminology key so UI never renders blanks',
    (industry) => {
      const terms = getIndustryTerminology(industry);
      for (const key of Object.keys(
        GENERAL_INDUSTRY_TERMINOLOGY
      ) as (keyof typeof GENERAL_INDUSTRY_TERMINOLOGY)[]) {
        expect(terms[key], `missing terminology key "${key}"`).toBeTruthy();
      }
    }
  );

  it('resolves human-friendly aliases to canonical industries', () => {
    expect(resolveIndustryAlias('health')).toBe('hospital_clinic');
    expect(resolveIndustryAlias('education')).toBe('coaching');
    expect(resolveIndustryAlias('fitness')).toBe('gym');
    expect(resolveIndustryAlias('property')).toBe('real_estate');
    expect(resolveIndustryAlias('spa')).toBe('salon');
    expect(resolveIndustryAlias('cafe')).toBe('restaurant');
    expect(resolveIndustryAlias('other')).toBe('general');
  });
});

describe('industry terminology in sidebar navigation', () => {
  it.each(ALL_INDUSTRIES)(
    '%s sidebar uses the industry nouns for shared routes',
    (industry) => {
      const terms = getIndustryTerminology(industry);
      const entries = flattenNavigation(buildNavigationFor(industry));
      const byHref = new Map(entries.map((e) => [e.href, e.label]));

      expect(byHref.get('/customers')).toBe(terms.people);
      expect(byHref.get('/leads')).toBe(terms.pipelineItems);
      expect(byHref.get('/pipelines')).toBe(terms.pipelines);
      expect(byHref.get('/appointments')).toBe(terms.meetings);
      expect(byHref.get('/follow-ups')).toBe(terms.followUps);
      expect(byHref.get('/broadcasts')).toBe(terms.campaigns);
    }
  );

  it('labels hospital-only operations routes with hospital vocabulary', () => {
    const entries = flattenNavigation(buildNavigationFor('hospital_clinic'));
    const byHref = new Map(entries.map((e) => [e.href, e.label]));
    expect(byHref.get('/doctors')).toBe('Doctors');
    expect(byHref.get('/lab-reports')).toBe('Medical Reports');
  });

  it('does not surface hospital-only routes for other industries', () => {
    for (const industry of ['travel', 'salon', 'gym', 'general'] as const) {
      const hrefs = flattenNavigation(buildNavigationFor(industry)).map(
        (e) => e.href
      );
      expect(hrefs).not.toContain('/doctors');
      expect(hrefs).not.toContain('/lab-reports');
    }
  });

  it('never leaks another industry noun into a workspace sidebar', () => {
    const spellings: Record<CanonicalIndustry, string[]> = {
      hospital_clinic: ['Traveller', 'Guest', 'Stylist', 'Trainer'],
      travel: ['Patient', 'Guest', 'Stylist', 'Trainer', 'Doctor'],
      restaurant: ['Patient', 'Traveller', 'Stylist', 'Doctor'],
      coaching: ['Patient', 'Traveller', 'Guest', 'Doctor'],
      solo_teacher: ['Patient', 'Traveller', 'Guest', 'Doctor'],
      salon: ['Patient', 'Traveller', 'Guest', 'Doctor', 'Trainer'],
      real_estate: ['Patient', 'Traveller', 'Guest', 'Doctor', 'Stylist'],
      gym: ['Patient', 'Traveller', 'Guest', 'Doctor', 'Stylist'],
      general: ['Patient', 'Traveller', 'Guest', 'Doctor', 'Stylist'],
    };
    for (const industry of ALL_INDUSTRIES) {
      const labels = flattenNavigation(buildNavigationFor(industry)).map(
        (e) => e.label
      );
      for (const foreignNoun of spellings[industry]) {
        for (const label of labels) {
          expect(
            label.includes(foreignNoun),
            `"${label}" leaks "${foreignNoun}" into ${industry} sidebar`
          ).toBe(false);
        }
      }
    }
  });
});

describe('industry terminology in settings sections', () => {
  it.each(ALL_INDUSTRIES)(
    '%s labels the custom fields section with the contact noun',
    (industry) => {
      const terms = getIndustryTerminology(industry);
      const meta = getSectionMeta(industry);
      expect(meta.fields.label).toBe(`${terms.contact} Custom Fields`);
    }
  );

  it('resolves aliases before looking up settings labels', () => {
    expect(getSectionMeta('health').fields.label).toBe('Patient Custom Fields');
    expect(getSectionMeta('fitness').fields.label).toBe('Member Custom Fields');
    expect(getSectionMeta('education').fields.label).toBe(
      'Student Custom Fields'
    );
  });
});
