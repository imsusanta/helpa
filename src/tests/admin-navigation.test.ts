import { describe, expect, it } from 'vitest';
import {
  ADMIN_LEGACY_ROUTES,
  ADMIN_NAV_GROUPS,
  ADMIN_ROUTE_DESCRIPTIONS,
  ADMIN_ROUTE_PATHS,
  getAdminRouteDescription,
  isAdminNavItemActive,
} from '@/components/admin/admin-navigation';

const EXPECTED_GROUPS = [
  { title: 'OVERVIEW', items: [['Dashboard', '/admin']] },
  {
    title: 'BUSINESSES',
    items: [['Businesses', '/admin/subscribers']],
  },
  {
    title: 'REVENUE',
    items: [
      ['Plans & Pricing', '/admin/plans'],
      ['Subscriptions', '/admin/subscriptions'],
      ['Payments', '/admin/payments'],
    ],
  },
  {
    title: 'AI & WHATSAPP',
    items: [
      ['AI Settings', '/admin/ai'],
      ['WhatsApp Accounts', '/admin/whatsapp'],
    ],
  },
  { title: 'SYSTEM', items: [['Settings', '/admin/settings']] },
] as const;

function getNavItem(href: string) {
  const item = ADMIN_NAV_GROUPS.flatMap((group) => group.items).find(
    (candidate) => candidate.href === href
  );
  if (!item) throw new Error(`Missing approved admin route: ${href}`);
  return item;
}

describe('approved Super Admin navigation', () => {
  it('preserves exact groups, labels, order, and routes', () => {
    expect(
      ADMIN_NAV_GROUPS.map((group) => ({
        title: group.title,
        items: group.items.map((item) => [item.label, item.href]),
      }))
    ).toEqual(EXPECTED_GROUPS);
    expect(ADMIN_ROUTE_PATHS).toHaveLength(8);
  });

  it('keeps IDs and destinations unique', () => {
    const items = ADMIN_NAV_GROUPS.flatMap((group) => group.items);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    expect(new Set(items.map((item) => item.href)).size).toBe(items.length);
  });

  it('provides metadata for every approved route', () => {
    for (const route of ADMIN_ROUTE_PATHS) {
      expect(ADMIN_ROUTE_DESCRIPTIONS[route]?.title).toBeTruthy();
      expect(ADMIN_ROUTE_DESCRIPTIONS[route]?.description).toBeTruthy();
    }
  });

  it('preserves legacy tenants compatibility and active state', () => {
    expect(ADMIN_LEGACY_ROUTES['/admin/tenants']).toBe('/admin/subscribers');
    const businesses = getNavItem('/admin/subscribers');
    expect(isAdminNavItemActive('/admin/subscribers', businesses)).toBe(true);
    expect(isAdminNavItemActive('/admin/tenants', businesses)).toBe(true);
    expect(getAdminRouteDescription('/admin/tenants')?.title).toBe('Businesses');
  });

  it('does not activate sibling pages', () => {
    expect(isAdminNavItemActive('/admin/plans', getNavItem('/admin'))).toBe(
      false
    );
    expect(
      isAdminNavItemActive(
        '/admin/subscriptions',
        getNavItem('/admin/plans')
      )
    ).toBe(false);
  });
});
