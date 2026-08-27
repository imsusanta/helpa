import { describe, expect, it } from 'vitest';
import { NAV, pathIsActive } from '@/components/layout/sidebar';
import { NAVIGATION_FEATURE_STATUSES } from '@/components/layout/navigation-registry';
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

function buildHospitalNavigation(
  accountRole?: 'owner' | 'admin' | 'agent' | 'viewer' | null,
  isSuperAdmin = false
) {
  return buildVisibleNavigation({
    navigation: NAV,
    terminology: getIndustryTerminology('hospital_clinic'),
    currentIndustry: 'hospital_clinic',
    isSuperAdmin,
    accountRole,
    manifest: hospitalManifest,
    routeRoleRequirements: hospitalManifest.sidebar,
    featureStatuses: NAVIGATION_FEATURE_STATUSES,
    isRouteAllowed: (pathname) =>
      isIndustryRouteAllowed(hospitalManifest, pathname),
  });
}

const hospitalNavigation = buildHospitalNavigation();

function visibleChildrenFor(id: string) {
  return hospitalNavigation.find((item) => item.id === id)?.children ?? [];
}

function visibleLabelsFor(id: string) {
  return visibleChildrenFor(id).map((child) => child.label);
}

describe('authenticated sidebar navigation', () => {
  it('keeps top-level IDs and destinations unique', () => {
    const topLevelIds = NAV.map((item) => item.id);
    expect(new Set(topLevelIds).size).toBe(topLevelIds.length);
    expect(validateVisibleNavigation(NAV)).toEqual([]);

    for (const item of NAV) {
      const children = item.children ?? [];
      expect(new Set(children.map((child) => child.id)).size).toBe(
        children.length
      );
      expect(
        new Set(
          children.map((child) => normalizeNavigationDestination(child.href))
        ).size
      ).toBe(children.length);
    }
  });

  it('matches the requested global menu structure', () => {
    expect(NAV.map((item) => item.id)).toEqual([
      'dashboard',
      'conversations',
      'crm',
      'marketing',
      'automation-ai',
      'integrations',
      'billing',
      'settings',
      'admin',
    ]);

    expect(childrenFor('conversations').map((child) => child.href)).toEqual([
      '/inbox',
      '/follow-ups',
      '/appointments',
    ]);
    expect(childrenFor('crm').map((child) => child.href)).toEqual([
      '/leads',
      '/customers',
      '/pipelines',
      '/quotations',
      '/trip-proposals',
      '/settings?tab=tags',
    ]);
    expect(childrenFor('marketing').map((child) => child.href)).toEqual([
      '/broadcasts',
      '/campaign-reports',
      '/lead-forms',
    ]);
    expect(childrenFor('automation-ai').map((child) => child.href)).toEqual([
      '/chatbot',
      '/faq-bot',
      '/automations',
      '/knowledge-base',
    ]);
    expect(NAV.find((item) => item.id === 'integrations')).toMatchObject({
      href: '/integrations',
      label: 'Integrations',
    });
    expect(childrenFor('billing').map((child) => child.href)).toEqual([
      '/invoices',
      '/settings?tab=billing',
    ]);
    expect(NAV.find((item) => item.id === 'settings')).toMatchObject({
      href: '/settings?tab=profile',
      label: 'Settings',
    });
  });

  it('does not expose Operations, Services, or Patient List in the global menu', () => {
    expect(NAV.some((item) => item.id === 'operations')).toBe(false);
    expect(NAV.some((item) => item.label === 'Operations')).toBe(false);
    expect(
      NAV.flatMap((item) => item.children ?? []).some(
        (child) => child.href === '/services'
      )
    ).toBe(false);
    expect(
      NAV.flatMap((item) => item.children ?? []).some(
        (child) => child.href === '/patients'
      )
    ).toBe(false);
  });

  it('exposes Integrations directly with admin role requirement', () => {
    const integrations = NAV.find((item) => item.id === 'integrations');
    expect(integrations).toBeDefined();
    expect(integrations?.href).toBe('/integrations');
    expect(integrations?.roleMin).toBe('admin');
  });

  it('builds Clinic Operations with only Doctors and Medical Reports', () => {
    const clinicOperations = hospitalNavigation.find(
      (item) => item.id === 'industry-operations'
    );
    expect(clinicOperations?.label).toBe('Clinic Operations');
    expect(clinicOperations?.children?.map((child) => child.label)).toEqual([
      'Doctors',
      'Medical Reports',
    ]);
    expect(clinicOperations?.children?.map((child) => child.href)).toEqual([
      '/doctors',
      '/lab-reports',
    ]);
  });

  it('keeps Appointments in Conversations and out of Clinic Operations', () => {
    expect(visibleLabelsFor('conversations')).toEqual([
      'Inbox',
      'Follow-ups',
      'Appointments',
    ]);
    expect(
      visibleChildrenFor('industry-operations').some(
        (child) => child.href === '/appointments'
      )
    ).toBe(false);
  });

  it('keeps clinic-specific operations out of general workspaces', () => {
    const generalNavigation = buildVisibleNavigation({
      navigation: NAV,
      terminology: getIndustryTerminology('general'),
      currentIndustry: 'general',
      isSuperAdmin: false,
      isRouteAllowed: () => true,
    });

    expect(
      generalNavigation.some((item) => item.id === 'industry-operations')
    ).toBe(false);
  });

  it('applies role requirements to integrations and admin-gated features', () => {
    for (const role of ['owner', 'admin'] as const) {
      const navigation = buildHospitalNavigation(role);
      expect(navigation.some((item) => item.id === 'integrations')).toBe(true);
      expect(
        navigation
          .find((item) => item.id === 'crm')
          ?.children?.some((child) => child.id === 'crm-tags')
      ).toBe(true);
      expect(
        navigation
          .find((item) => item.id === 'billing')
          ?.children?.some((child) => child.id === 'billing-settings')
      ).toBe(true);
    }

    for (const role of ['agent', 'viewer'] as const) {
      const navigation = buildHospitalNavigation(role);
      expect(navigation.some((item) => item.id === 'integrations')).toBe(false);
      expect(
        navigation
          .find((item) => item.id === 'crm')
          ?.children?.some((child) => child.id === 'crm-tags')
      ).toBe(false);
      expect(
        navigation
          .find((item) => item.id === 'billing')
          ?.children?.some((child) => child.id === 'billing-settings')
      ).toBe(false);
    }
  });

  it('keeps final clinic navigation unique and collision-free', () => {
    expect(validateVisibleNavigation(hospitalNavigation)).toEqual([]);

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

  it('allows routes required by the requested menu', () => {
    for (const route of [
      '/dashboard',
      '/inbox',
      '/follow-ups',
      '/appointments',
      '/leads',
      '/customers',
      '/pipelines',
      '/quotations',
      '/broadcasts',
      '/campaign-reports',
      '/lead-forms',
      '/chatbot',
      '/faq-bot',
      '/automations',
      '/knowledge-base',
      '/integrations',
      '/invoices',
      '/settings',
      '/doctors',
      '/lab-reports',
    ]) {
      expect(isIndustryRouteAllowed(hospitalManifest, route), route).toBe(true);
    }
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

  it('matches only the selected settings query tab', () => {
    expect(
      pathIsActive(
        '/settings',
        new URLSearchParams('tab=team'),
        '/settings?tab=team'
      )
    ).toBe(true);
    expect(
      pathIsActive(
        '/settings',
        new URLSearchParams('tab=profile'),
        '/settings?tab=team'
      )
    ).toBe(false);
  });
});
