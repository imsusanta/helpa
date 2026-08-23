import { describe, expect, it } from 'vitest';
import { NAV } from '@/components/layout/sidebar';

function childrenFor(id: string) {
  return NAV.find((item) => item.id === id)?.children ?? [];
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
});
