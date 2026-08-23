import { hasMinRole, type AccountRole } from '@/lib/auth/roles';
import { resolveIndustryAlias } from '@/modules/terminology';
import type { IndustryModule, IndustryTerminology } from '@/modules/types';
import {
  Calendar,
  Clock,
  FileText,
  GitBranch,
  UserCheck,
  Users,
} from 'lucide-react';

export type SidebarNavChild = {
  id: string;
  label: string;
  sourceLabel?: string;
  href: string;
  hospitalOnly?: boolean;
  activeHrefs?: string[];
  roleMin?: AccountRole;
  featureKey?: string;
  requiredModule?: string;
  badge?: 'beta' | 'coming-soon' | 'setup-required';
  activeMatchers?: Array<{ pathname: string; query?: Record<string, string> }>;
};

export type SidebarNavItem<TIcon = unknown> = {
  id: string;
  label: string;
  sourceLabel?: string;
  href?: string;
  icon: TIcon;
  children?: SidebarNavChild[];
  superAdminOnly?: boolean;
  roleMin?: AccountRole;
  featureKey?: string;
  requiredModule?: string;
  badge?: 'beta' | 'coming-soon' | 'setup-required';
  activeMatchers?: Array<{ pathname: string; query?: Record<string, string> }>;
};

export type NavigationFeatureStatus =
  | 'WORKING'
  | 'PARTIAL'
  | 'BROKEN'
  | 'PLACEHOLDER'
  | 'CREDENTIAL_GATED'
  | 'COMING_SOON';

type BuildVisibleNavigationOptions<TIcon> = {
  navigation: readonly SidebarNavItem<TIcon>[];
  terminology: IndustryTerminology;
  currentIndustry: string;
  isSuperAdmin: boolean;
  isRouteAllowed: (pathname: string) => boolean;
  accountRole?: AccountRole | null;
  routeRoleRequirements?: readonly {
    href: string;
    roleMin?: AccountRole;
  }[];
  manifest?: IndustryModule;
  enabledModules?: readonly string[];
  featureStatuses?: Record<string, NavigationFeatureStatus>;
};

export type NavigationValidationIssueCode =
  | 'duplicate-top-level-id'
  | 'duplicate-child-id'
  | 'duplicate-child-destination'
  | 'duplicate-child-label';

export type NavigationValidationIssue = {
  code: NavigationValidationIssueCode;
  parentId?: string;
  parentLabel?: string;
  value: string;
  itemIds: string[];
  routes: string[];
  message: string;
};

function getLabelByHref(terminology: IndustryTerminology) {
  return new Map<string, string>([
    ['/leads', terminology.pipelineItems],
    ['/customers', terminology.people],
    ['/pipelines', terminology.pipelines],
    ['/inbox', 'Inbox'],
    ['/follow-ups', terminology.followUps],
    ['/appointments', terminology.meetings],
    ['/broadcasts', terminology.campaigns],
    ['/forms', `${terminology.pipelineItem} Forms`],
    ['/services', terminology.services],
    ['/billing/reports', terminology.reports],
    ['/settings?tab=team', terminology.staffMembers],
    ['/doctors', terminology.staffMembers],
    ['/lab-reports', terminology.reports],
  ]);
}

const MANIFEST_ICON_BY_PATH: Record<string, typeof FileText> = {
  '/doctors': UserCheck,
  '/lab-reports': FileText,
  '/patients': Users,
  '/appointments': Calendar,
  '/follow-ups': Clock,
  '/pipelines': GitBranch,
};

export function getNavigationPathname(href: string) {
  try {
    return new URL(href, 'https://navigation.local').pathname;
  } catch {
    return href.split(/[?#]/, 1)[0];
  }
}

/**
 * Produces a stable representation of an internal navigation destination.
 * Query parameter values remain part of the destination, while parameter
 * ordering does not create false differences.
 */
export function normalizeNavigationDestination(href: string) {
  try {
    const url = new URL(href, 'https://navigation.local');
    url.searchParams.sort();
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}

export function buildVisibleNavigation<TIcon>({
  navigation,
  terminology,
  currentIndustry,
  isSuperAdmin,
  isRouteAllowed,
  accountRole,
  routeRoleRequirements = [],
  manifest,
  enabledModules = [],
  featureStatuses = {},
}: BuildVisibleNavigationOptions<TIcon>): SidebarNavItem<TIcon>[] {
  const isHospitalWorkspace =
    resolveIndustryAlias(currentIndustry) === 'hospital_clinic';
  const labelByHref = getLabelByHref(terminology);

  const roleMinByDestination = new Map<string, AccountRole>();
  for (const requirement of routeRoleRequirements) {
    if (!requirement.roleMin) continue;
    const destination = normalizeNavigationDestination(requirement.href);
    const existing = roleMinByDestination.get(destination);
    if (!existing || hasMinRole(requirement.roleMin, existing)) {
      roleMinByDestination.set(destination, requirement.roleMin);
    }
  }

  const isRoleAllowed = (href: string, explicitRoleMin?: AccountRole) => {
    if (
      explicitRoleMin &&
      !isSuperAdmin &&
      accountRole !== undefined &&
      (!accountRole || !hasMinRole(accountRole, explicitRoleMin))
    )
      return false;
    const roleMin = roleMinByDestination.get(
      normalizeNavigationDestination(href)
    );
    if (!roleMin || isSuperAdmin || accountRole === undefined) return true;
    return Boolean(accountRole && hasMinRole(accountRole, roleMin));
  };

  const isFeatureVisible = (
    item: Pick<SidebarNavChild, 'requiredModule' | 'featureKey'>
  ) => {
    if (
      item.requiredModule &&
      enabledModules.length > 0 &&
      !enabledModules.includes(item.requiredModule)
    )
      return false;
    const status = item.featureKey
      ? featureStatuses[item.featureKey]
      : undefined;
    return (
      !status || !['BROKEN', 'PLACEHOLDER', 'COMING_SOON'].includes(status)
    );
  };

  const manifestRoutes =
    manifest?.status === 'ACTIVE'
      ? manifest.sidebar
          .filter((item) => !navigationHasPathname(navigation, item.href))
          .map((item) => ({
            id: `industry-${item.href.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`,
            label: labelByHref.get(item.href) ?? item.label,
            href: item.href,
            icon: MANIFEST_ICON_BY_PATH[item.href] ?? FileText,
            roleMin: item.roleMin,
          }))
      : [];
  const navigationWithManifest = manifestRoutes.length
    ? [
        ...navigation,
        {
          id: 'industry-operations',
          label: 'Clinic Operations',
          icon: FileText,
          children: manifestRoutes,
        } as unknown as SidebarNavItem<TIcon>,
      ]
    : navigation;

  return navigationWithManifest
    .filter(
      (item) => (!item.superAdminOnly || isSuperAdmin) && isFeatureVisible(item)
    )
    .map((item) => {
      const children = item.children
        ?.filter(
          (child) =>
            (!child.hospitalOnly || isHospitalWorkspace) &&
            isRouteAllowed(getNavigationPathname(child.href)) &&
            isRoleAllowed(child.href, child.roleMin) &&
            isFeatureVisible(child)
        )
        .map((child) => ({
          ...child,
          sourceLabel: child.sourceLabel ?? child.label,
          label: labelByHref.get(child.href) ?? child.label,
        }));

      return {
        ...item,
        sourceLabel: item.sourceLabel ?? item.label,
        label:
          item.href === '/services'
            ? terminology.services
            : item.id === 'conversations'
              ? terminology.conversations
              : item.label,
        children,
      };
    })
    .filter((item) => {
      if (item.href && !isRouteAllowed(getNavigationPathname(item.href))) {
        return false;
      }

      if (item.href && !isRoleAllowed(item.href, item.roleMin)) {
        return false;
      }

      // Do not leave behind an expandable heading with no accessible routes.
      return Boolean(item.href || !item.children || item.children.length > 0);
    });
}

function navigationHasPathname<TIcon>(
  navigation: readonly SidebarNavItem<TIcon>[],
  href: string
) {
  const pathname = getNavigationPathname(href);
  return navigation.some(
    (item) =>
      (item.href && getNavigationPathname(item.href) === pathname) ||
      (item.children ?? []).some(
        (child) => getNavigationPathname(child.href) === pathname
      )
  );
}

function normalizeLabel(label: string) {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

function duplicateGroups<T>(
  items: readonly T[],
  valuesFor: (item: T) => readonly string[]
) {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    for (const value of new Set(valuesFor(item))) {
      const existing = grouped.get(value) ?? [];
      existing.push(item);
      grouped.set(value, existing);
    }
  }

  return [...grouped.entries()].filter(([, matches]) => matches.length > 1);
}

/**
 * Reports invalid final navigation without mutating or hiding any item. Tests
 * are the primary enforcement; callers may log these issues in development.
 */
export function validateVisibleNavigation<TIcon>(
  navigation: readonly SidebarNavItem<TIcon>[]
): NavigationValidationIssue[] {
  const issues: NavigationValidationIssue[] = [];

  for (const [id, matches] of duplicateGroups(navigation, (item) => [
    item.id,
  ])) {
    const itemIds = matches.map((item) => item.id);
    const routes = matches.flatMap((item) => (item.href ? [item.href] : []));
    issues.push({
      code: 'duplicate-top-level-id',
      value: id,
      itemIds,
      routes,
      message: `Top-level navigation has duplicate ID "${id}" (items: ${itemIds.join(', ')}; routes: ${routes.join(', ') || 'none'}).`,
    });
  }

  for (const parent of navigation) {
    const children = parent.children ?? [];
    const parentDetails = {
      parentId: parent.id,
      parentLabel: parent.label,
    };

    for (const [id, matches] of duplicateGroups(children, (child) => [
      child.id,
    ])) {
      const itemIds = matches.map((child) => child.id);
      const routes = matches.map((child) => child.href);
      issues.push({
        code: 'duplicate-child-id',
        ...parentDetails,
        value: id,
        itemIds,
        routes,
        message: `Navigation parent "${parent.label}" (${parent.id}) has duplicate child ID "${id}" (items: ${itemIds.join(', ')}; routes: ${routes.join(', ')}).`,
      });
    }

    for (const [destination, matches] of duplicateGroups(children, (child) =>
      [child.href, ...(child.activeHrefs ?? [])].map(
        normalizeNavigationDestination
      )
    )) {
      const itemIds = matches.map((child) => child.id);
      const routes = matches.map((child) => child.href);
      issues.push({
        code: 'duplicate-child-destination',
        ...parentDetails,
        value: destination,
        itemIds,
        routes,
        message: `Navigation parent "${parent.label}" (${parent.id}) has duplicate destination "${destination}" (items: ${itemIds.join(', ')}; routes: ${routes.join(', ')}).`,
      });
    }

    for (const [label, matches] of duplicateGroups(children, (child) => [
      normalizeLabel(child.label),
    ])) {
      const itemIds = matches.map((child) => child.id);
      const routes = matches.map((child) => child.href);
      issues.push({
        code: 'duplicate-child-label',
        ...parentDetails,
        value: label,
        itemIds,
        routes,
        message: `Navigation parent "${parent.label}" (${parent.id}) has duplicate final label "${matches[0].label}" (items: ${itemIds.join(', ')}; routes: ${routes.join(', ')}).`,
      });
    }
  }

  return issues;
}
