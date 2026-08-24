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
  it('uses stable unique IDs and destinations within every menu', () => {
    const topLevelIds = NAV.map((item) => item.id);
    expect(new Set(topLevelIds).size).toBe(topLevelIds.length);

    for (const item of NAV) {
      const children = item.children ?? [];
      const childIds = children.map((child) => child.id);
      const childRoutes = children.map((child) =>
        normalizeNavigationDestination(child.href)
      );
      expect(new Set(childIds).size).toBe(childIds.length);
      expect(new Set(childRoutes).size).toBe(childRoutes.length);
    }

    expect(validateVisibleNavigation(NAV)).toEqual([]);
  });

  it('has one canonical Campaigns destination under Marketing', () => {
    expect(childrenFor('marketing').filter((child) => child.href === '/broadcasts')).toEqual([
      expect.objectContaining({
        id: 'marketing-campaigns',
        label: 'Campaigns',
      }),
    ]);

    expect(NAV.some((item) => item.id === 'whatsapp')).toBe(false);
    expect(
      NAV.flatMap((item) => item.children ?? []).filter(
        (child) => child.href === '/broadcasts'
      )
    ).toHaveLength(1);
  });

  it('keeps WhatsApp and Integrations setup in Channels & Integrations', () => {
    expect(childrenFor('channels').map((child) => child.href)).toEqual([
      '/settings?tab=whatsapp',
      '/integrations',
    ]);
    expect(childrenFor('channels')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'channels-whatsapp',
          label: 'WhatsApp',
          roleMin: 'admin',
          featureKey: 'whatsapp_setup',
        }),
        expect.objectContaining({
          id: 'channels-integrations',
          label: 'Integrations',
          roleMin: 'admin',
          featureKey: 'integrations',
        }),
      ])
    );
  });

  it('keeps CRM focused on customer lifecycle data', () => {
    expect(childrenFor('crm').map((child) => child.href)).toEqual([
      '/leads',
      '/customers',
      '/pipelines',
      '/quotations',
      '/settings?tab=tags',
    ]);
  });

  it('keeps appointments and services in Operations', () => {
    expect(childrenFor('operations').map((child) => child.href)).toEqual([
      '/appointments',
      '/services',
    ]);
  });

  it('does not expose known unsupported legacy destinations', () => {
    const allChildren = NAV.flatMap((item) => item.children ?? []);
    expect(
      allChildren.some((child) =>
        [
          '/templates',
          '/forms',
          '/api-docs',
          '/billing/reports',
          '/billing/reminders',
          '/billing/settings',
          '/settings?tab=api',
          '/settings?tab=columns',
          '/settings?tab=consent',
          '/settings?tab=organization',
          '/settings?tab=roles',
          '/settings?tab=webhooks',
        ].includes(child.href)
      )
    ).toBe(false);
    expect(NAV.some((item) => item.id === 'developers')).toBe(false);
  });

  it('applies role requirements to marketing and channel setup', () => {
    for (const role of ['owner', 'admin'] as const) {
      const navigation = buildHospitalNavigation(role);
      expect(
        navigation
          .find((item) => item.id === 'marketing')
          ?.children?.some((child) => child.href === '/broadcasts')
      ).toBe(true);
      expect(
        navigation
          .find((item) => item.id === 'channels')
          ?.children?.some((child) => child.href === '/settings?tab=whatsapp')
      ).toBe(true);
    }

    for (const role of ['agent', 'viewer'] as const) {
      const navigation = buildHospitalNavigation(role);
      expect(
        navigation
          .find((item) => item.id === 'marketing')
          ?.children?.some((child) => child.href === '/broadcasts')
      ).toBe(false);
      expect(
        navigation
          .find((item) => item.id === 'channels')
          ?.children?.some((child) => child.href === '/settings?tab=whatsapp')
      ).toBe(false);
    }
  });

  it('builds the final Hospital Clinic navigation with the intended structure', () => {
    expect(
      hospitalNavigation.map((item) => item.id)
    ).toEqual([
      'dashboard',
      'conversations',
      'crm',
      'operations',
      'marketing',
      'automation-ai',
      'channels',
      'billing',
      'settings',
    ]);

    expect(hospitalNavigation.find((item) => item.id === 'conversations')?.label).toBe(
      'Patient Conversations'
    );
    expect(visibleLabelsFor('conversations')).toEqual(['Inbox', 'Follow-ups', 'Appointments']);
    expect(visibleLabelsFor('crm')).toEqual([
      'Leads',
      'Patients',
      'Pipelines',
      'Quotations',
      'Tags',
    ]);
    expect(visibleLabelsFor('operations')).toEqual(['Appointments', 'Services']);
    expect(visibleLabelsFor('marketing')).toEqual([
      'Campaigns',
      'Campaign Reports',
      'Lead Forms',
    ]);
    expect(visibleLabelsFor('automation-ai')).toEqual([
      'Chatbot',
      'FAQ Bot',
      'AI Assistant',
      'Automations',
      'Knowledge Base',
    ]);
    expect(visibleLabelsFor('channels')).toEqual(['WhatsApp API', 'Integrations']);
    expect(visibleLabelsFor('billing')).toEqual(['Invoices', 'Billing Settings']);
    expect(visibleLabelsFor('settings')).toEqual(['Profile', 'Team']);
  });

  it('allows routes required by the final Hospital Clinic menu', () => {
    for (const route of [
      '/dashboard',
      '/inbox',
      '/follow-ups',
      '/contacts',
      '/leads',
      '/customers',
      '/pipelines',
      '/quotations',
      '/appointments',
      '/services',
      '/broadcasts',
      '/campaign-reports',
      '/lead-forms',
      '/chatbot',
      '/faq-bot',
      '/ai-assistant',
      '/automations',
      '/knowledge-base',
      '/integrations',
      '/invoices',
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
      expect(new Set(children.map((child) => child.id)).size).toBe(children.length);
      expect(
        new Set(children.map((child) => normalizeNavigationDestination(child.href))).size
      ).toBe(children.length);
      expect(
        new Set(children.map((child) => child.label.toLocaleLowerCase())).size
      ).toBe(children.length);
    }
  });

  it('keeps Tags, Team and Profile under Settings-related destinations only once', () => {
    const allChildren = NAV.flatMap((item) => item.children ?? []);
    expect(allChildren.filter((child) => child.href === '/settings?tab=profile')).toHaveLength(1);
    expect(allChildren.filter((child) => child.href === '/settings?tab=team')).toHaveLength(1);
    expect(allChildren.filter((child) => child.href === '/settings?tab=tags')).toHaveLength(1);
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
    expect(normalizeNavigationDestination('/settings?b=2&a=1')).toBe('/settings?a=1&b=2');
  });

  it('matches only the selected settings query tab', () => {
    expect(
      pathIsActive('/settings', new URLSearchParams('tab=team'), '/settings?tab=team')
    ).toBe(true);
    expect(
      pathIsActive('/settings', new URLSearchParams('tab=profile'), '/settings?tab=team')
    ).toBe(false);
  });

  it('reports terminology collisions when a future customization creates them', () => {
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
        }),
      ])
    );
  });
});
