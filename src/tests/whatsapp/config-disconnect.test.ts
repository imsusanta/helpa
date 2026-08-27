import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/account', () => ({
  getCurrentAccount: vi.fn(),
  requireRole: mocks.requireRole,
}));

vi.mock('@/lib/supabase/server', () => ({
  getAdminClient: mocks.getAdminClient,
}));

vi.mock('@/lib/whatsapp/meta-service', () => ({
  checkConnectionHealth: vi.fn(),
  getPhoneNumberDetails: vi.fn(),
  subscribeWabaWebhook: vi.fn(),
}));

vi.mock('@/lib/whatsapp/encryption', () => ({
  encrypt: vi.fn(),
  decrypt: vi.fn(),
}));

import { DELETE } from '@/app/api/whatsapp/config/route';

describe('WhatsApp disconnect cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({
      accountId: 'account-1',
      userId: 'user-1',
    });
  });

  it('removes canonical and legacy credentials for the tenant', async () => {
    const deletedTables: string[] = [];

    mocks.getAdminClient.mockReturnValue({
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data:
                table === 'whatsapp_configs'
                  ? { phone_number_id: 'phone-1', waba_id: 'waba-1' }
                  : null,
              error: null,
            }),
          }),
        }),
        delete: () => ({
          eq: async () => {
            deletedTables.push(table);
            return { error: null };
          },
        }),
        insert: async () => ({ data: null, error: null }),
      }),
    });

    const response = await DELETE();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(deletedTables).toEqual(
      expect.arrayContaining(['whatsapp_configs', 'whatsapp_config'])
    );
  });
});
