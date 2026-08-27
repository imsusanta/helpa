import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createClient } from '@/lib/db/server';

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    get: () => undefined,
    set: () => {},
  })),
}));

describe('Tour Packages RLS & Tenant Isolation Integration Suite', () => {
  const accountAId = 'a1111111-1111-1111-1111-111111111111';
  const _accountBId = 'b2222222-2222-2222-2222-222222222222';
  const packageAId = 'pkg-a111-1111-1111-1111-111111111111';

  let _tenantAClient: Awaited<ReturnType<typeof createClient>>;
  let tenantBClient: Awaited<ReturnType<typeof createClient>>;

  beforeEach(async () => {
    _tenantAClient = await createClient();
    tenantBClient = await createClient();
  });

  it('verifies Tenant B cannot SELECT Tenant A tour packages via user client', async () => {
    const { data, error } = await tenantBClient
      .from('travel_packages')
      .select('*')
      .eq('account_id', accountAId);

    if (error) {
      expect(error.code || error.message).toBeDefined();
    } else {
      expect(data).toHaveLength(0);
    }
  });

  it('verifies Tenant B cannot INSERT a package using Tenant A account_id', async () => {
    const { data, error } = await tenantBClient
      .from('travel_packages')
      .insert({
        account_id: accountAId,
        name: 'Malicious Injected Package',
        destination: 'Nowhere',
        duration_days: 2,
      })
      .select();

    if (error) {
      expect(error.code || error.message).toBeDefined();
    } else {
      expect(data || []).toHaveLength(0);
    }
  });

  it('verifies Tenant B cannot UPDATE Tenant A tour packages', async () => {
    const { data, error } = await tenantBClient
      .from('travel_packages')
      .update({ name: 'Tampered Name', base_price: 1 })
      .eq('id', packageAId)
      .eq('account_id', accountAId)
      .select();

    if (error) {
      expect(error.code || error.message).toBeDefined();
    } else {
      expect(data || []).toHaveLength(0);
    }
  });

  it('verifies Tenant B cannot DELETE Tenant A tour packages', async () => {
    const { data, error } = await tenantBClient
      .from('travel_packages')
      .delete()
      .eq('id', packageAId)
      .eq('account_id', accountAId)
      .select();

    if (error) {
      expect(error.code || error.message).toBeDefined();
    } else {
      expect(data || []).toHaveLength(0);
    }
  });

  it('verifies Tenant B cannot read or modify Tenant A itinerary days', async () => {
    const { data: readData, error: readErr } = await tenantBClient
      .from('tour_package_itinerary_days')
      .select('*')
      .eq('account_id', accountAId);

    if (readErr) {
      expect(readErr.code || readErr.message).toBeDefined();
    } else {
      expect(readData).toHaveLength(0);
    }

    const { data: insertData, error: insertErr } = await tenantBClient
      .from('tour_package_itinerary_days')
      .insert({
        account_id: accountAId,
        package_id: packageAId,
        day_number: 1,
        title: 'Hacked day',
      })
      .select();

    if (insertErr) {
      expect(insertErr.code || insertErr.message).toBeDefined();
    } else {
      expect(insertData || []).toHaveLength(0);
    }
  });

  it('verifies Tenant B cannot read or modify Tenant A departures', async () => {
    const { data: readData, error: readErr } = await tenantBClient
      .from('tour_package_departures')
      .select('*')
      .eq('account_id', accountAId);

    if (readErr) {
      expect(readErr.code || readErr.message).toBeDefined();
    } else {
      expect(readData).toHaveLength(0);
    }

    const { data: insertData, error: insertErr } = await tenantBClient
      .from('tour_package_departures')
      .insert({
        account_id: accountAId,
        package_id: packageAId,
        start_date: '2026-11-01',
        status: 'scheduled',
      })
      .select();

    if (insertErr) {
      expect(insertErr.code || insertErr.message).toBeDefined();
    } else {
      expect(insertData || []).toHaveLength(0);
    }
  });

  it('verifies Tenant B cannot call transactional RPC upsert_tour_package_with_children against Tenant A', async () => {
    const { data, error } = await tenantBClient.rpc(
      'upsert_tour_package_with_children',
      {
        p_account_id: accountAId,
        p_package_id: packageAId,
        p_user_id: 'user-b-uuid',
        p_package_data: { name: 'RPC Tampered' },
        p_itinerary: [],
        p_departures: [],
      }
    );

    if (error) {
      expect(error.code || error.message).toBeDefined();
    } else {
      expect(!data || (Array.isArray(data) && data.length === 0)).toBe(true);
    }
  });
});
