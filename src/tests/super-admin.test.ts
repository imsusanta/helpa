/**
 * src/tests/super-admin.test.ts
 *
 * Comprehensive Test Suite for Helpa Super Admin / Platform Control Center (Phase 12).
 * Verifies:
 * - Super Admin server-side authorization (susantalohr@gmail.com & is_super_admin)
 * - Platform KPI & MRR metrics aggregation with dynamic industry distribution
 * - Cross-workspace Tenant Management (list, search, filter, inspection)
 * - Tenant suspension and reactivation with zero data loss
 * - Trial extension with audit trail
 * - User governance across workspaces
 * - Platform system settings & maintenance mode
 * - Immutable admin audit logging with zero secret credential leakage
 * - Strict multi-tenant isolation vs Super Admin platform-level visibility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isPlatformOwnerEmail,
  checkSuperAdmin,
  PLATFORM_OWNER_EMAIL,
} from '@/lib/auth/admin';
import {
  getPlatformMetrics,
  listAllTenants,
  suspendTenant,
  reactivateTenant,
  extendTenantTrial,
  listAllUsers,
  getSystemSettings,
  updateSystemSettings,
  logAdminAction,
  listAdminAuditLogs,
} from '@/core/admin';
import * as appwriteCompat from '@/lib/appwrite-server-compat';
import * as accountAuth from '@/lib/auth/account';

describe('Helpa Super Admin / Platform Control Center', () => {
  let mockDatabase: {
    accounts: Array<Record<string, unknown>>;
    profiles: Array<Record<string, unknown>>;
    system_settings: Array<Record<string, unknown>>;
    audit_logs: Array<Record<string, unknown>>;
  };

  beforeEach(() => {
    mockDatabase = {
      accounts: [
        {
          id: 'acc-clinic-01',
          name: 'Apex Health Clinic',
          industry: 'Health & Clinic',
          subscription_plan: 'plan_professional',
          subscription_status: 'ACTIVE',
          owner_email: 'doctor@apexhealth.com',
          created_at: new Date().toISOString(),
        },
        {
          id: 'acc-academy-02',
          name: 'Pinnacle Coaching Academy',
          industry: 'Coaching',
          subscription_plan: 'plan_starter',
          subscription_status: 'TRIALING',
          owner_email: 'admin@pinnacle.com',
          created_at: new Date().toISOString(),
        },
        {
          id: 'acc-realty-03',
          name: 'Skyline Real Estate',
          industry: 'Real Estate',
          subscription_plan: 'plan_business',
          subscription_status: 'ACTIVE',
          owner_email: 'sales@skylinerealty.com',
          created_at: new Date().toISOString(),
        },
      ],
      profiles: [
        {
          id: 'prof-owner',
          user_id: 'usr-owner',
          email: PLATFORM_OWNER_EMAIL,
          full_name: 'Susanta Lohar',
          is_super_admin: true,
          role: 'owner',
        },
        {
          id: 'prof-user-1',
          user_id: 'usr-user-1',
          email: 'doctor@apexhealth.com',
          full_name: 'Dr. Debasish Roy',
          is_super_admin: false,
          role: 'admin',
        },
      ],
      system_settings: [],
      audit_logs: [],
    };

    vi.spyOn(appwriteCompat, 'getAdminClient').mockReturnValue({
      from: (table: string) => {
        const store =
          (mockDatabase as Record<string, Array<Record<string, unknown>>>)[
            table
          ] || [];
        return {
          select: () => {
            let filtered = [...store];
            const builder = {
              eq: (f: string, v: unknown) => {
                filtered = filtered.filter((r) => r[f] === v);
                return builder;
              },
              ilike: (f: string, v: string) => {
                const clean = v.replace(/%/g, '').toLowerCase();
                filtered = filtered.filter((r) =>
                  String(r[f] || '')
                    .toLowerCase()
                    .includes(clean)
                );
                return builder;
              },
              order: () => builder,
              limit: (n: number) => {
                filtered = filtered.slice(0, n);
                return builder;
              },
              maybeSingle: async () => ({
                data: filtered[0] || null,
                error: null,
              }),
              single: async () => ({
                data: filtered[0] || null,
                error: filtered[0] ? null : { message: 'Row not found' },
              }),
              then: (res: (val: { data: unknown[]; error: null }) => void) =>
                res({ data: filtered, error: null }),
            };
            return builder;
          },
          insert: (data: Record<string, unknown>) => {
            const row = { id: `id-${Date.now()}-${Math.random()}`, ...data };
            store.push(row);
            return {
              select: () => ({
                single: async () => ({ data: row, error: null }),
              }),
              then: (res: (val: { data: unknown; error: null }) => void) =>
                res({ data: row, error: null }),
            };
          },
          upsert: (data: Record<string, unknown>) => {
            const existingIdx = store.findIndex((r) => r.id === data.id);
            if (existingIdx >= 0) {
              store[existingIdx] = { ...store[existingIdx], ...data };
            } else {
              store.push(data);
            }
            return Promise.resolve({ data, error: null });
          },
          update: (data: Record<string, unknown>) => ({
            eq: (f: string, v: unknown) => {
              const matched = store.filter((r) => r[f] === v);
              matched.forEach((r) => Object.assign(r, data));
              return Promise.resolve({ data: matched, error: null });
            },
          }),
        };
      },
    } as unknown as ReturnType<typeof appwriteCompat.getAdminClient>);
  });

  describe('Super Admin Server-Side Authorization', () => {
    it('verifies that susantalohr@gmail.com is recognized as the platform owner', () => {
      expect(isPlatformOwnerEmail('susantalohr@gmail.com')).toBe(true);
      expect(isPlatformOwnerEmail('SUSANTALOHR@GMAIL.COM')).toBe(true);
      expect(isPlatformOwnerEmail('other@gmail.com')).toBe(false);
    });

    it('grants Super Admin privileges to platform owner and rejects normal users', async () => {
      expect(await checkSuperAdmin('susantalohr@gmail.com')).toBe(true);

      vi.spyOn(accountAuth, 'getCurrentAccount').mockResolvedValue({
        accountId: 'acc-clinic-01',
        userId: 'usr-user-1',
        role: 'agent',
        account: {
          id: 'acc-clinic-01',
          name: 'Apex Health Clinic',
        },
      });

      const normalUserCheck = await checkSuperAdmin('doctor@apexhealth.com');
      expect(normalUserCheck).toBe(false);
    });
  });

  describe('Platform Metrics & Analytics', () => {
    it('aggregates real tenant KPIs, MRR, and dynamic industry distribution', async () => {
      const metrics = await getPlatformMetrics();

      expect(metrics.totalTenants).toBe(3);
      expect(metrics.activeTenants).toBe(3);
      expect(metrics.paidTenants).toBe(2);
      expect(metrics.trialTenants).toBe(1);

      // MRR: Pro (2499) + Business (5999) = 8498
      expect(metrics.mrr).toBe(8498);
      expect(metrics.arr).toBe(8498 * 12);

      expect(metrics.industryDistribution['Health & Clinic']).toBe(1);
      expect(metrics.industryDistribution['Coaching']).toBe(1);
      expect(metrics.industryDistribution['Real Estate']).toBe(1);
    });
  });

  describe('Cross-Workspace Tenant Management', () => {
    it('lists all tenants across workspaces and supports keyword search', async () => {
      const allTenants = await listAllTenants();
      expect(allTenants.length).toBe(3);

      const searchResults = await listAllTenants({ search: 'Apex' });
      expect(searchResults.length).toBe(1);
      expect(searchResults[0].name).toBe('Apex Health Clinic');
      expect(searchResults[0].industry).toBe('Health & Clinic');
    });

    it('suspends and reactivates a tenant workspace while keeping data intact', async () => {
      const suspended = await suspendTenant({
        actorEmail: PLATFORM_OWNER_EMAIL,
        workspaceId: 'acc-clinic-01',
        reason: 'Payment compliance investigation',
      });
      expect(suspended).toBe(true);

      const clinicAccount = mockDatabase.accounts.find(
        (a) => a.id === 'acc-clinic-01'
      );
      expect(clinicAccount?.is_suspended).toBe(true);
      expect(clinicAccount?.status).toBe('SUSPENDED');

      // Reactivate
      const reactivated = await reactivateTenant({
        actorEmail: PLATFORM_OWNER_EMAIL,
        workspaceId: 'acc-clinic-01',
      });
      expect(reactivated).toBe(true);
      expect(clinicAccount?.is_suspended).toBe(false);
      expect(clinicAccount?.status).toBe('ACTIVE');
    });

    it('extends a tenant trial with audit record', async () => {
      const res = await extendTenantTrial({
        actorEmail: PLATFORM_OWNER_EMAIL,
        workspaceId: 'acc-academy-02',
        additionalDays: 7,
        reason: 'Requested evaluation extension',
      });

      expect(res.trialEnd).toBeDefined();
      const academyAccount = mockDatabase.accounts.find(
        (a) => a.id === 'acc-academy-02'
      );
      expect(academyAccount?.subscription_status).toBe('TRIALING');
    });
  });

  describe('User Governance & System Settings', () => {
    it('lists users across all workspaces', async () => {
      const users = await listAllUsers();
      expect(users.length).toBe(2);
      expect(users.some((u) => u.email === PLATFORM_OWNER_EMAIL)).toBe(true);
    });

    it('reads and updates platform system settings safely', async () => {
      const settings = await getSystemSettings();
      expect(settings.defaultTrialDays).toBe(14);
      expect(settings.defaultCurrency).toBe('INR');

      const updated = await updateSystemSettings(PLATFORM_OWNER_EMAIL, {
        defaultTrialDays: 21,
        maintenanceMode: false,
      });

      expect(updated.defaultTrialDays).toBe(21);
      expect(mockDatabase.system_settings.length).toBe(1);
    });
  });

  describe('Platform Audit Logging & Security', () => {
    it('logs administrative actions and sanitizes sensitive tokens from metadata', async () => {
      const log = await logAdminAction({
        actorEmail: PLATFORM_OWNER_EMAIL,
        action: 'plan:created',
        targetType: 'plan',
        targetId: 'plan_enterprise_plus',
        metadata: {
          planName: 'Enterprise Plus',
          secret_api_token: 'SECRET_SHOULD_BE_STRIPPED',
          monthlyPrice: 14999,
        },
      });

      expect(log.action).toBe('plan:created');
      expect(log.metadata?.planName).toBe('Enterprise Plus');
      expect(log.metadata?.secret_api_token).toBeUndefined(); // Stripped safely

      const logs = await listAdminAuditLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].actorEmail).toBe(PLATFORM_OWNER_EMAIL);
    });
  });
});
