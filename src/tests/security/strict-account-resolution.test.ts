import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCurrentAccount,
  requireRole,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/auth/account';
import { requireSuperAdmin, checkSuperAdmin } from '@/lib/auth/admin';

const mockGetUser = vi.fn();
const mockAdminSelect = vi.fn();
const mockAdminEq = vi.fn();
const mockAdminMaybeSingle = vi.fn();
const mockRedirect = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    const err = new Error(`NEXT_REDIRECT:${url}`);
    (err as unknown as { digest: string }).digest = `NEXT_REDIRECT;${url}`;
    throw err;
  },
}));

vi.mock('@/lib/runtime-config', () => ({
  getRuntimeConfig: () => ({
    authProvider: 'supabase',
    migrationMode: 'cutover',
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
  getAdminClient: () => ({
    from: (table: string) => ({
      select: (_fields: string) => ({
        eq: (field1: string, val1: string) => ({
          eq: (field2: string, val2: string) => {
            mockAdminEq(table, field1, val1, field2, val2);
            return mockAdminSelect(table);
          },
          maybeSingle: () => {
            mockAdminEq(table, field1, val1);
            return mockAdminMaybeSingle(table);
          },
        }),
      }),
      upsert: () => Promise.resolve({ data: null, error: null }),
    }),
  }),
}));

vi.mock('@/lib/appwrite-server-compat', () => ({
  appwriteAdmin: () => ({}),
}));

describe('Strict Multi-Tenant Account Resolution & RBAC Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with UnauthorizedError (401)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid session' },
    });

    await expect(getCurrentAccount()).rejects.toThrow(UnauthorizedError);
  });

  it('resolves active account membership with exact role and tenant ID', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user_clinic_doc_1', email: 'doctor@clinic.com' } },
      error: null,
    });

    // Mock account_members query response
    mockAdminSelect.mockImplementation((table: string) => {
      if (table === 'account_members') {
        return Promise.resolve({
          data: [
            { account_id: 'account_clinic_100', role: 'admin', active: true },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    // Mock accounts query response
    mockAdminMaybeSingle.mockImplementation((table: string) => {
      if (table === 'accounts') {
        return Promise.resolve({
          data: { id: 'account_clinic_100', name: 'Apex Health Clinic' },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const ctx = await getCurrentAccount();
    expect(ctx.userId).toBe('user_clinic_doc_1');
    expect(ctx.accountId).toBe('account_clinic_100');
    expect(ctx.role).toBe('admin');
    expect(ctx.account.name).toBe('Apex Health Clinic');
  });

  it('fails closed with ForbiddenError when user has zero active memberships (no auto-attach)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user_random_new_guy', email: 'random@gmail.com' } },
      error: null,
    });

    // Zero rows in account_members and no profile account
    mockAdminSelect.mockImplementation(() =>
      Promise.resolve({ data: [], error: null })
    );
    mockAdminMaybeSingle.mockImplementation(() =>
      Promise.resolve({ data: null, error: null })
    );

    await expect(getCurrentAccount()).rejects.toThrow(ForbiddenError);
  });

  it('enforces role hierarchy strictly in requireRole (agent cannot perform admin actions)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user_receptionist', email: 'staff@clinic.com' } },
      error: null,
    });

    mockAdminSelect.mockImplementation((table: string) => {
      if (table === 'account_members') {
        return Promise.resolve({
          data: [
            { account_id: 'account_clinic_100', role: 'agent', active: true },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockAdminMaybeSingle.mockImplementation((table: string) => {
      if (table === 'accounts') {
        return Promise.resolve({
          data: { id: 'account_clinic_100', name: 'Apex Health Clinic' },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    // Agent can perform agent actions
    const agentCtx = await requireRole('agent');
    expect(agentCtx.role).toBe('agent');

    // Agent CANNOT perform admin actions
    await expect(requireRole('admin')).rejects.toThrow(ForbiddenError);
  });

  it('prevents account owners from automatically escalating to global Super Admin', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user_clinic_owner', email: 'owner@clinic.com' } },
      error: null,
    });

    mockAdminSelect.mockImplementation((table: string) => {
      if (table === 'account_members') {
        return Promise.resolve({
          data: [
            { account_id: 'account_clinic_100', role: 'owner', active: true },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockAdminMaybeSingle.mockImplementation((table: string) => {
      if (table === 'accounts') {
        return Promise.resolve({
          data: { id: 'account_clinic_100', name: 'Apex Health Clinic' },
          error: null,
        });
      }
      if (table === 'profiles') {
        // Profile is NOT a system super-admin
        return Promise.resolve({
          data: { is_super_admin: false },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    // checkSuperAdmin must return false for a regular clinic owner
    const isSuper = await checkSuperAdmin();
    expect(isSuper).toBe(false);

    // requireSuperAdmin must redirect to dashboard
    await expect(requireSuperAdmin()).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard'
    );
  });

  it('allows verified global super admin with explicit is_super_admin: true', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user_root_admin', email: 'root@platform.io' } },
      error: null,
    });

    mockAdminSelect.mockImplementation((table: string) => {
      if (table === 'account_members') {
        return Promise.resolve({
          data: [
            { account_id: 'account_system_admin', role: 'owner', active: true },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockAdminMaybeSingle.mockImplementation((table: string) => {
      if (table === 'accounts') {
        return Promise.resolve({
          data: { id: 'account_system_admin', name: 'System Platform' },
          error: null,
        });
      }
      if (table === 'profiles') {
        return Promise.resolve({
          data: { is_super_admin: true },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const isSuper = await checkSuperAdmin();
    expect(isSuper).toBe(true);

    const adminCtx = await requireSuperAdmin();
    expect(adminCtx.id).toBe('user_root_admin');
  });
});
