import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const catalogMigration = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260827200000_tour_packages_catalog.sql'
  ),
  'utf8'
);

const baseTravelMigration = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260827100000_create_trip_proposals_table.sql'
  ),
  'utf8'
);

describe('Tour Packages RLS & Tenant Invariants Security Audit', () => {
  it('enforces RLS on travel_packages, tour_package_departures, and tour_package_itinerary_days', () => {
    expect(baseTravelMigration).toContain(
      'ALTER TABLE public.travel_packages ENABLE ROW LEVEL SECURITY;'
    );
    expect(catalogMigration).toContain(
      'ALTER TABLE public.tour_package_departures ENABLE ROW LEVEL SECURITY;'
    );
    expect(catalogMigration).toContain(
      'ALTER TABLE public.tour_package_itinerary_days ENABLE ROW LEVEL SECURITY;'
    );
  });

  it('enforces active account member SELECT policy for tenant isolation', () => {
    // travel_packages
    expect(baseTravelMigration).toContain(
      'CREATE POLICY travel_packages_select'
    );
    expect(baseTravelMigration).toContain(
      'USING (public.is_active_account_member(account_id))'
    );

    // tour_package_departures
    expect(catalogMigration).toContain(
      'CREATE POLICY tour_package_departures_select'
    );
    expect(catalogMigration).toContain(
      'USING (public.is_active_account_member(account_id))'
    );

    // tour_package_itinerary_days
    expect(catalogMigration).toContain(
      'CREATE POLICY tour_package_itinerary_days_select'
    );
    expect(catalogMigration).toContain(
      'USING (public.is_active_account_member(account_id))'
    );
  });

  it('restricts management operations (INSERT/UPDATE/DELETE) to agent role or higher', () => {
    // travel_packages
    expect(baseTravelMigration).toContain(
      'CREATE POLICY travel_packages_manage'
    );
    expect(baseTravelMigration).toContain(
      "USING (public.has_account_role(account_id, 'agent'))"
    );

    // tour_package_departures
    expect(catalogMigration).toContain(
      'CREATE POLICY tour_package_departures_manage'
    );
    expect(catalogMigration).toContain(
      "USING (public.has_account_role(account_id, 'agent'))"
    );

    // tour_package_itinerary_days
    expect(catalogMigration).toContain(
      'CREATE POLICY tour_package_itinerary_days_manage'
    );
    expect(catalogMigration).toContain(
      "USING (public.has_account_role(account_id, 'agent'))"
    );
  });

  it('enforces cascade deletion on tenant and package deletion', () => {
    expect(catalogMigration).toContain(
      'REFERENCES public.accounts(id) ON DELETE CASCADE'
    );
    expect(catalogMigration).toContain(
      'REFERENCES public.travel_packages(id) ON DELETE CASCADE'
    );
  });

  it('enforces idempotency and constraint safety for catalog migration', () => {
    expect(catalogMigration).toContain('IF NOT EXISTS');
    expect(catalogMigration).toContain('chk_travel_packages_base_price');
    expect(catalogMigration).toContain('chk_travel_packages_status');
    expect(catalogMigration).toContain('chk_departures_status');
    expect(catalogMigration).toContain('chk_itinerary_day_number');
  });
});
