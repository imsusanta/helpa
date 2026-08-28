import { describe, it, expect, beforeAll } from 'vitest';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { AdminClient, UserClient } from '@/lib/db/server';

/**
 * Live Staging / Production RLS Integration Test for Tour Packages
 *
 * Requirements for execution:
 * - STAGING_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL pointing to live PostgreSQL
 * - SUPABASE_SERVICE_ROLE_KEY for setup and teardown
 * - SUPABASE_TENANT_A_ANON_KEY / TENANT_A_TOKEN for Tenant A session
 * - SUPABASE_TENANT_B_ANON_KEY / TENANT_B_TOKEN for Tenant B session
 */
const LIVE_SUPABASE_URL =
  process.env.STAGING_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_A_TOKEN = process.env.STAGING_TENANT_A_TOKEN;
const TENANT_B_TOKEN = process.env.STAGING_TENANT_B_TOKEN;

const isLiveConfigured = Boolean(
  LIVE_SUPABASE_URL &&
  SERVICE_KEY &&
  !SERVICE_KEY.includes('ci-test') &&
  !SERVICE_KEY.includes('dummy') &&
  TENANT_A_TOKEN &&
  TENANT_B_TOKEN
);

describe('Live PostgreSQL RLS & Tenant Isolation Staging Test (Tour Packages)', () => {
  const accountAId = 'a1111111-1111-1111-1111-111111111111';
  const accountBId = 'b2222222-2222-2222-2222-222222222222';
  const packageAId = 'a1111111-1111-1111-1111-111111111112';

  let adminClient: AdminClient;
  let tenantAClient: UserClient;
  let tenantBClient: UserClient;

  beforeAll(async () => {
    if (!isLiveConfigured) {
      console.warn(
        '[STAGING PENDING] Live PostgreSQL / Supabase staging credentials not configured. Live RLS verification is pending staging environment deployment.'
      );
      return;
    }

    adminClient = createSupabaseClient(
      LIVE_SUPABASE_URL!,
      SERVICE_KEY!
    ) as unknown as AdminClient;
    tenantAClient = createSupabaseClient(
      LIVE_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        global: { headers: { Authorization: `Bearer ${TENANT_A_TOKEN}` } },
      }
    ) as unknown as UserClient;
    tenantBClient = createSupabaseClient(
      LIVE_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        global: { headers: { Authorization: `Bearer ${TENANT_B_TOKEN}` } },
      }
    ) as unknown as UserClient;

    // 1. Verify Setup: Seed test accounts, memberships, and Package A using admin client
    await adminClient.from('accounts').upsert([
      { id: accountAId, name: 'Tenant A Live Staging', industry: 'travel' },
      { id: accountBId, name: 'Tenant B Live Staging', industry: 'travel' },
    ]);

    await adminClient.from('travel_packages').upsert({
      id: packageAId,
      account_id: accountAId,
      name: 'Tenant A Protected Package',
      destination: 'Darjeeling',
      duration_days: 3,
      status: 'published',
      price: 15000,
      base_price: 15000,
    });

    // 2. Assert Tenant A can actually read Package A before running attack tests
    const { data: aData, error: aError } = await tenantAClient
      .from('travel_packages')
      .select('id, name')
      .eq('id', packageAId)
      .single();

    expect(aError).toBeNull();
    expect(aData?.id).toBe(packageAId);
  });

  it('verifies Tenant B cannot SELECT Tenant A tour packages', async () => {
    if (!isLiveConfigured) return;

    const { data } = await tenantBClient
      .from('travel_packages')
      .select('*')
      .eq('id', packageAId);

    // RLS filters out rows from other tenants
    expect(data).toHaveLength(0);
  });

  it('verifies Tenant B cannot INSERT a package using Tenant A account_id', async () => {
    if (!isLiveConfigured) return;

    const { error } = await tenantBClient
      .from('travel_packages')
      .insert({
        account_id: accountAId,
        name: 'Malicious Injected Package',
        destination: 'Nowhere',
        duration_days: 2,
      })
      .select();

    expect(error).not.toBeNull();
    expect(error?.code).toMatch(/42501|PGRST/); // RLS violation
  });

  it('verifies Tenant B cannot UPDATE Tenant A tour packages', async () => {
    if (!isLiveConfigured) return;

    const { data } = await tenantBClient
      .from('travel_packages')
      .update({ name: 'Tampered Name', base_price: 1 })
      .eq('id', packageAId)
      .select();

    expect(data || []).toHaveLength(0);
  });

  it('verifies Tenant B cannot DELETE Tenant A tour packages', async () => {
    if (!isLiveConfigured) return;

    const { data } = await tenantBClient
      .from('travel_packages')
      .delete()
      .eq('id', packageAId)
      .select();

    expect(data || []).toHaveLength(0);
  });

  it('verifies Tenant B cannot insert child records referencing Tenant A package under Tenant B account_id (composite FK violation)', async () => {
    if (!isLiveConfigured) return;

    const { error } = await tenantBClient
      .from('tour_package_itinerary_days')
      .insert({
        account_id: accountBId,
        package_id: packageAId,
        day_number: 1,
        title: 'Cross-tenant injected day',
      })
      .select();

    expect(error).not.toBeNull();
    expect(error?.code).toMatch(/23503/); // Foreign key violation
  });
});
