import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutboxService } from '@/lib/whatsapp/outbox-service';

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockMaybeSingle = vi.fn();
const mockEq2 = vi.fn();

vi.mock('@/lib/db/server', () => ({
  getAdminClient: () => ({
    from: (_collection: string) => ({
      insert: (payload: unknown) => {
        mockInsert(payload);
        return {
          select: () => ({
            single: async () => mockSelect(),
          }),
        };
      },
      update: (payload: unknown) => {
        mockUpdate(payload);
        return {
          eq: (field1: string, val1: string) => ({
            eq: (field2: string, val2: string) => {
              mockEq2(field1, val1, field2, val2);
              return Promise.resolve({ data: null, error: null });
            },
          }),
        };
      },
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => mockMaybeSingle(),
          }),
        }),
      }),
    }),
  }),
}));

describe('OutboxService Tenant Isolation & Reliability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates pre-send outbox entry successfully with tenant scoping', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSelect.mockResolvedValue({
      data: { id: 'outbox_new_1' },
      error: null,
    });

    const res = await OutboxService.createPreSendOutbox({
      accountId: 'acc_1',
      idempotencyKey: 'key_1',
      requestHash: 'hash_123',
      channel: 'whatsapp',
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.status).toBe('created');
      expect(res.outboxId).toBe('outbox_new_1');
    }
  });

  it('detects existing outbox entry with same hash and returns existing status', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'outbox_existing_2',
        requestHash: 'hash_123',
        status: 'sent',
        providerMessageId: 'wamid.123',
      },
      error: null,
    });

    const res = await OutboxService.createPreSendOutbox({
      accountId: 'acc_1',
      idempotencyKey: 'key_1',
      requestHash: 'hash_123',
      channel: 'whatsapp',
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.status).toBe('existing');
      expect(res.existingStatus).toBe('sent');
      expect(res.providerMessageId).toBe('wamid.123');
    }
  });

  it('rejects with IDEMPOTENCY_CONFLICT when same key is used with different hash', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'outbox_existing_2',
        requestHash: 'different_hash_999',
        status: 'sent',
      },
      error: null,
    });

    const res = await OutboxService.createPreSendOutbox({
      accountId: 'acc_1',
      idempotencyKey: 'key_1',
      requestHash: 'hash_123',
      channel: 'whatsapp',
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('IDEMPOTENCY_CONFLICT');
      expect(res.retryable).toBe(false);
    }
  });

  it('fails closed when outbox persistence fails', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSelect.mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed' },
    });

    const res = await OutboxService.createPreSendOutbox({
      accountId: 'acc_1',
      idempotencyKey: 'key_1',
      requestHash: 'hash_123',
      channel: 'whatsapp',
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('OUTBOX_PERSISTENCE_FAILED');
      expect(res.retryable).toBe(true);
    }
  });

  it('enforces tenant-scoped update in markSent', async () => {
    await OutboxService.markSent('outbox_123', 'acc_tenant_a', 'wamid_123');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'sent',
        meta_message_id: 'wamid_123',
      })
    );
    expect(mockEq2).toHaveBeenCalledWith(
      'id',
      'outbox_123',
      'account_id',
      'acc_tenant_a'
    );
  });

  it('enforces tenant-scoped update in markReconciliationRequired', async () => {
    await OutboxService.markReconciliationRequired(
      'outbox_1',
      'acc_tenant_a',
      'wamid.abc',
      'Table locked'
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'reconciliation_required',
      })
    );
    expect(mockEq2).toHaveBeenCalledWith(
      'id',
      'outbox_1',
      'account_id',
      'acc_tenant_a'
    );
  });

  it('enforces tenant-scoped update in markDeadLetter', async () => {
    await OutboxService.markDeadLetter(
      'outbox_fail_1',
      'acc_tenant_a',
      'Permanent provider error'
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'dead_letter',
      })
    );
    expect(mockEq2).toHaveBeenCalledWith(
      'id',
      'outbox_fail_1',
      'account_id',
      'acc_tenant_a'
    );
  });
});
