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

describe('Tour Packages RLS & Tenant Invariants Security Audit', () => {
  it('enforces RLS on travel_packages, tour_package_departures, and tour_package_itinerary_days', () => {
    expect(catalogMigration).toContain(
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
    expect(catalogMigration).toContain('CREATE POLICY travel_packages_select');
    expect(catalogMigration).toContain(
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
    expect(catalogMigration).toContain('CREATE POLICY travel_packages_manage');
    expect(catalogMigration).toContain(
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

  it('enforces database-level composite tenant foreign key integrity', () => {
    // Unique composite on parent
    expect(catalogMigration).toContain('uq_travel_packages_account_id_id');
    expect(catalogMigration).toContain('(account_id, id)');

    // Composite foreign keys on child tables
    expect(catalogMigration).toContain(
      'fk_tour_package_departures_package_tenant'
    );
    expect(catalogMigration).toContain(
      'fk_tour_package_itinerary_package_tenant'
    );
    expect(catalogMigration).toContain('FOREIGN KEY (account_id, package_id)');
    expect(catalogMigration).toContain(
      'REFERENCES public.travel_packages(account_id, id)'
    );
  });

  it('hardens transactional RPC function with immutable search_path and role checks', () => {
    expect(catalogMigration).toContain(
      'CREATE OR REPLACE FUNCTION public.upsert_tour_package_with_children'
    );
    expect(catalogMigration).toContain('SECURITY DEFINER');
    expect(catalogMigration).toContain('SET search_path = public, pg_temp');
    expect(catalogMigration).toContain('public.has_account_role');
    expect(catalogMigration).toContain('public.is_active_account_member');
  });

  it('enforces idempotency and constraint safety for catalog migration', () => {
    expect(catalogMigration).toContain('IF NOT EXISTS');
    expect(catalogMigration).toContain('chk_travel_packages_base_price');
    expect(catalogMigration).toContain('chk_travel_packages_status');
    expect(catalogMigration).toContain('chk_departures_status');
    expect(catalogMigration).toContain('chk_itinerary_day_number');
  });
});
