import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260830120000_travel_tour_packages.sql',
  'utf8'
);

const TABLES = [
  'tour_packages',
  'tour_package_itineraries',
  'tour_package_inclusions',
  'tour_package_exclusions',
  'tour_package_hotels',
  'tour_package_pricing',
  'tour_package_departures',
];

describe('tour package RLS migration', () => {
  it('creates the normalized catalog tables', () => {
    for (const table of TABLES) {
      expect(migration).toMatch(
        new RegExp(`create table if not exists public\\.${table}`, 'i')
      );
    }
  });

  it('enables RLS on every new table and scopes policies by account membership', () => {
    for (const table of TABLES) {
      expect(migration).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`, 'i')
      );
    }
    expect(migration).toContain("is_account_member(account_id, 'viewer'");
    expect(migration).toContain("is_account_member(account_id, 'agent'");
    expect(migration).toContain("is_account_member(account_id, 'admin'");
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });

  it('indexes workspace, package, destination, status, duration, and dates', () => {
    expect(migration).toContain('idx_tour_packages_account_id');
    expect(migration).toContain('idx_tour_packages_destination');
    expect(migration).toContain('idx_tour_packages_status');
    expect(migration).toContain('idx_tour_packages_duration');
    expect(migration).toContain('idx_tour_package_departures_date');
    expect(migration).toContain('idx_tour_packages_valid_from');
    expect(migration).toContain('idx_tour_packages_valid_until');
    expect(migration).toContain('idx_tour_package_itineraries_package_id');
  });
});

describe('tour package simple form columns', () => {
  it('adds cover image and price type without opening RLS', () => {
    const followUp = readFileSync(
      'supabase/migrations/20260830140000_tour_package_simple_fields.sql',
      'utf8'
    );
    expect(followUp).toContain('cover_image_url');
    expect(followUp).toContain('price_type');
    expect(followUp).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });
});
