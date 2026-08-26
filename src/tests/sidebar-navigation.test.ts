import { describe, expect, it } from 'vitest';
import { NAV, pathIsActive } from '@/components/layout/sidebar';
import { NAVIGATION_FEATURE_STATUSES } from '@/components/layout/navigation-registry';
import {
  buildVisibleNavigation,
  normalizeNavigationDestination,
  validateVisibleNavigation,
} from '@/components/layout/sidebar-navigation';
import { getIndustryTerminology } from '@/modules/terminology';
import { getIndustryModule } from '@/modules/registry';
import { isIndustryRouteAllowed } from '@/modules/routes';

const hospitalManifest = getIndustryModule('hospital_clinic');
const hospitalNavigation = buildVisibleNavigation({
  navigation: NAV,
  terminology: getIndustryTerminology('hospital_clinic'),
  currentIndustry: 'hospital_clinic',
  isSuperAdmin: false,
  manifest: hospitalManifest,
  routeRoleRequirements: hospitalManifest.sidebar,
  featureStatuses: NAVIGATION_FEATURE_STATUSES,
  isRouteAllowed: (pathname) =>
    isIndustryRouteAllowed(hospitalManifest, pathname),
});

describe('authenticated sidebar navigation', () => {
  it('keeps navigation IDs and destinations unique', () => {
    expect(validateVisibleNavigation(NAV)).toEqual([]);
    expect(validateVisibleNavigation(hospitalNavigation)).toEqual([]);
    expect(new Set(NAV.map((item) => item.id)).size).toBe(NAV.length);
    for (const item of hospitalNavigation) {
      const children = item.children ?? [];
      expect(
        new Set(
          children.map((child) => normalizeNavigationDestination(child.href))
        ).size
      ).toBe(children.length);
    }
  });

  it('shows Patients, Doctors and Medical Reports in Clinic Operations', () => {
    const clinicOperations = hospitalNavigation.find(
      (item) => item.id === 'industry-operations'
    );
    expect(clinicOperations?.label).toBe('Clinic Operations');
    expect(clinicOperations?.children?.map((child) => child.label)).toEqual([
      'Patients',
      'Doctors',
      'Medical Reports',
    ]);
    expect(clinicOperations?.children?.map((child) => child.href)).toEqual([
      '/patients',
      '/doctors',
      '/lab-reports?scope=patients',
    ]);
    expect(
      clinicOperations?.children?.some((child) => child.label === 'Contacts')
    ).toBe(false);
  });

  it('keeps clinic operations out of general workspaces', () => {
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

  it('allows every clinic operation route', () => {
    for (const route of ['/patients', '/doctors', '/lab-reports', '/website']) {
      expect(isIndustryRouteAllowed(hospitalManifest, route), route).toBe(true);
    }
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
