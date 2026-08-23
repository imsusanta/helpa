import { describe, expect, it } from 'vitest';
import { NAV } from '@/components/layout/sidebar';
import {
  buildVisibleNavigation,
  normalizeNavigationDestination,
  validateVisibleNavigation,
  type SidebarNavItem,
} from '@/components/layout/sidebar-navigation';
import { getIndustryTerminology } from '@/modules/terminology';
import { getIndustryModule } from '@/modules/registry';
import { isIndustryRouteAllowed } from '@/modules/routes';

function childrenFor(id: string) {
  return NAV.find((item) => item.id === id)?.children ?? [];
}

const hospitalManifest = getIndustryModule('hospital_clinic');
const hospitalNavigation = buildVisibleNavigation({
  navigation: NAV,
  terminology: getIndustryTerminology('hospital_clinic'),
  currentIndustry: 'hospital_clinic',
  isSuperAdmin: false,
  isRouteAllowed: (pathname) =>
    isIndustryRouteAllowed(hospitalManifest, pathname),
});

function visibleChildrenFor(id: string) {
  return hospitalNavigation.find((item) => item.id === id)?.children ?? [];
}

function visibleLabelsFor(id: string) {
  return visibleChildrenFor(id).map((child) => child.label);
}

describe('authenticated sidebar navigation', () => {
  it('uses stable unique IDs and routes within every menu', () => {
    const topLevelIds = NAV.map((item) => item.id);
    expect(new Set(topLevelIds).size).toBe(topLevelIds.length);

    for (const item of NAV) {
      const children = item.children ?? [];
      const childIds = children.map((child) => child.id);
      const childRoutes = children.map((child) => child.href);
      expect(new Set(childIds).size).toBe(childIds.length);
      expect(new Set(childRoutes).size).toBe(childRoutes.length);
    }
  });

  it('shows one campaign destination in Marketing and WhatsApp', () => {
    expect(
      childrenFor('marketing').filter((child) => child.href === '/broadcasts')
    ).toHaveLength(1);
    expect(
      childrenFor('whatsapp').filter((child) => child.href === '/broadcasts')
    ).toHaveLength(1);
  });

  it('places the hospital-only Patient List under WhatsApp', () => {
    const patientList = childrenFor('whatsapp').filter(
      (child) => child.href === '/patients'
    );
    expect(patientList).toHaveLength(1);
    expect(patientList[0]).toMatchObject({
      id: 'whatsapp-patient-list',
      label: 'Patient List',
      hospitalOnly: true,
      activeHrefs: ['/contacts'],
    });
  });

  it('does not expose known unsupported duplicate destinations', () => {
    const allChildren = NAV.flatMap((item) => item.children ?? []);
    expect(
      allChildren.some((child) =>
        ['/templates', '/forms', '/api-docs'].includes(child.href)
      )
    ).toBe(false);
    expect(allChildren.some((child) => child.href === '/billing/reports')).toBe(
      false
    );
    expect(
      allChildren.some((child) => child.href === '/billing/reminders')
    ).toBe(false);
    expect(
      allChildren.some((child) => child.href === '/billing/settings')
    ).toBe(false);
  });

  it('builds the final Hospital Clinic navigation with distinct labels', () => {
    expect(
      hospitalNavigation.find((item) => item.id === 'conversations')?.label
    ).toBe('Patient Conversations');
    expect(visibleLabelsFor('conversations')).toEqual([
      'Inbox',
      'Follow-ups',
      'Appointments',
    ]);
    expect(visibleLabelsFor('marketing')).toEqual([
      'Campaigns',
      'Campaign Reports',
      'Lead Forms',
    ]);
    expect(visibleLabelsFor('whatsapp')).toEqual([
      'Patient List',
      'Campaigns',
      'WhatsApp API',
    ]);
    expect(
      visibleChildrenFor('conversations').find(
        (child) => child.id === 'conversations-meetings'
      )
    ).toMatchObject({ sourceLabel: 'Meetings', label: 'Appointments' });
  });

  it('allows every route required by the Hospital Clinic menu', () => {
    for (const route of [
      '/inbox',
      '/follow-ups',
      '/appointments',
      '/broadcasts',
      '/campaign-reports',
      '/lead-forms',
      '/patients',
      '/contacts',
      '/settings',
    ]) {
      expect(isIndustryRouteAllowed(hospitalManifest, route), route).toBe(true);
    }
  });

  it('keeps final Hospital Clinic IDs, destinations, and labels unique', () => {
    expect(validateVisibleNavigation(hospitalNavigation)).toEqual([]);

    const topLevelIds = hospitalNavigation.map((item) => item.id);
    expect(new Set(topLevelIds).size).toBe(topLevelIds.length);

    for (const item of hospitalNavigation) {
      const children = item.children ?? [];
      expect(new Set(children.map((child) => child.id)).size).toBe(
        children.length
      );
      expect(
        new Set(
          children.map((child) => normalizeNavigationDestination(child.href))
        ).size
      ).toBe(children.length);
      expect(
        new Set(children.map((child) => child.label.toLocaleLowerCase())).size
      ).toBe(children.length);
    }
  });

  it('retains the Patient List route and active alias only for hospitals', () => {
    const patientList = visibleChildrenFor('whatsapp').find(
      (child) => child.id === 'whatsapp-patient-list'
    );
    expect(patientList).toMatchObject({
      label: 'Patient List',
      href: '/patients',
      hospitalOnly: true,
      activeHrefs: ['/contacts'],
    });

    const generalNavigation = buildVisibleNavigation({
      navigation: NAV,
      terminology: getIndustryTerminology('general'),
      currentIndustry: 'general',
      isSuperAdmin: false,
      isRouteAllowed: () => true,
    });
    expect(
      generalNavigation
        .find((item) => item.id === 'whatsapp')
        ?.children?.some((child) => child.id === 'whatsapp-patient-list')
    ).toBe(false);
  });

  it('does not restore legacy duplicate features after transformation', () => {
    const visibleChildren = hospitalNavigation.flatMap(
      (item) => item.children ?? []
    );
    expect(visibleChildren.some((child) => child.label === 'Calls')).toBe(
      false
    );
    expect(
      visibleChildren.some((child) => child.label === 'Broadcast Logs')
    ).toBe(false);
    expect(
      visibleChildren.filter(
        (child) =>
          child.id === 'conversations-follow-ups' &&
          child.href === '/follow-ups'
      )
    ).toHaveLength(1);
  });

  it('applies route filtering before returning final menu groups', () => {
    const filteredNavigation = buildVisibleNavigation({
      navigation: NAV,
      terminology: getIndustryTerminology('hospital_clinic'),
      currentIndustry: 'hospital_clinic',
      isSuperAdmin: false,
      isRouteAllowed: (pathname) =>
        !['/campaign-reports', '/lead-forms', '/patients'].includes(pathname),
    });

    expect(
      filteredNavigation
        .find((item) => item.id === 'marketing')
        ?.children?.map((child) => child.href)
    ).toEqual(['/broadcasts']);
    expect(
      filteredNavigation
        .find((item) => item.id === 'whatsapp')
        ?.children?.map((child) => child.href)
    ).toEqual(['/broadcasts', '/settings?tab=whatsapp']);
  });

  it('keeps query-specific settings destinations distinct', () => {
    const fixture: SidebarNavItem<null>[] = [
      {
        id: 'settings',
        label: 'Settings',
        icon: null,
        children: [
          { id: 'settings-api', label: 'API', href: '/settings?tab=api' },
          {
            id: 'settings-whatsapp',
            label: 'WhatsApp',
            href: '/settings?tab=whatsapp',
          },
        ],
      },
    ];

    expect(validateVisibleNavigation(fixture)).toEqual([]);
    expect(normalizeNavigationDestination('/settings?b=2&a=1')).toBe(
      '/settings?a=1&b=2'
    );
  });

  it('reports final terminology and active-alias collisions clearly', () => {
    const terminology = {
      ...getIndustryTerminology('hospital_clinic'),
      meetings: 'Follow-ups',
    };
    const collidingNavigation = buildVisibleNavigation({
      navigation: NAV,
      terminology,
      currentIndustry: 'hospital_clinic',
      isSuperAdmin: false,
      isRouteAllowed: () => true,
    });
    expect(validateVisibleNavigation(collidingNavigation)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'duplicate-child-label',
          parentId: 'conversations',
          value: 'follow-ups',
          itemIds: ['conversations-follow-ups', 'conversations-meetings'],
        }),
      ])
    );

    const aliasCollision: SidebarNavItem<null>[] = [
      {
        id: 'whatsapp',
        label: 'WhatsApp',
        icon: null,
        children: [
          {
            id: 'patients',
            label: 'Patient List',
            href: '/patients',
            activeHrefs: ['/contacts'],
          },
          { id: 'contacts', label: 'Contacts', href: '/contacts' },
        ],
      },
    ];
    expect(validateVisibleNavigation(aliasCollision)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'duplicate-child-destination',
          parentId: 'whatsapp',
          value: '/contacts',
          itemIds: ['patients', 'contacts'],
        }),
      ])
    );
  });
});
