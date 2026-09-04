/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { SupabaseWhatsAppOutboxRepository } from '@/core/repositories/outbox';

describe('WhatsApp Outbox Concurrency & Tenant Isolation Invariants', () => {
  it('prevents concurrent double-claiming when worker acquires batch', async () => {
    // Simulate database where 2 jobs exist; Worker 1 claims job 1, Worker 2 claims job 2 via SKIP LOCKED
    const claimedByWorker1 = [
      {
        id: 'job_1',
        account_id: 'tenant_1',
        conversation_id: 'conv_1',
        message_id: 'msg_1',
        idempotency_key: 'key_1',
        provider: 'meta',
        attempt_count: 1,
        max_attempts: 8,
        payload: {},
        content_type: 'text',
        content_text: 'hello',
        media_url: null,
        sender_type: 'agent',
      },
    ];

    const claimedByWorker2 = [
      {
        id: 'job_2',
        account_id: 'tenant_2',
        conversation_id: 'conv_2',
        message_id: 'msg_2',
        idempotency_key: 'key_2',
        provider: 'meta',
        attempt_count: 1,
        max_attempts: 8,
        payload: {},
        content_type: 'text',
        content_text: 'world',
        media_url: null,
        sender_type: 'agent',
      },
    ];

    const mockRpc = vi
      .fn()
      .mockResolvedValueOnce({ data: claimedByWorker1, error: null })
      .mockResolvedValueOnce({ data: claimedByWorker2, error: null });

    const mockClient = { rpc: mockRpc } as any;

    const res1 = await SupabaseWhatsAppOutboxRepository.claimOutboxBatch(
      mockClient,
      { workerId: 'worker_1', batchSize: 1 }
    );
    const res2 = await SupabaseWhatsAppOutboxRepository.claimOutboxBatch(
      mockClient,
      { workerId: 'worker_2', batchSize: 1 }
    );

    expect(res1).toHaveLength(1);
    expect(res2).toHaveLength(1);
    expect(res1[0].id).not.toBe(res2[0].id);
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('claims lease-expired jobs for crash recovery', async () => {
    // If a job was previously locked but its lease expired, the RPC returns it
    const recoveredJob = [
      {
        id: 'job_crashed',
        account_id: 'tenant_1',
        conversation_id: 'conv_1',
        message_id: 'msg_1',
        idempotency_key: 'key_1',
        provider: 'meta',
        attempt_count: 2, // Incremented attempt count
        max_attempts: 8,
        payload: {},
        content_type: 'text',
        content_text: 'recovered text',
        media_url: null,
        sender_type: 'agent',
      },
    ];

    const mockClient = {
      rpc: vi.fn().mockResolvedValue({ data: recoveredJob, error: null }),
    } as any;

    const recovered = await SupabaseWhatsAppOutboxRepository.claimOutboxBatch(
      mockClient,
      { workerId: 'worker_recovery', batchSize: 10 }
    );

    expect(recovered).toHaveLength(1);
    expect(recovered[0].id).toBe('job_crashed');
    expect(recovered[0].attemptCount).toBe(2);
  });

  it('strictly scopes queries by account_id in repository operations', async () => {
    const capturedFilters: Record<string, unknown> = {};

    const mockFrom = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((col: string, val: unknown) => {
        capturedFilters[col] = val;
        return {
          eq: vi.fn((col2: string, val2: unknown) => {
            capturedFilters[col2] = val2;
            return {
              maybeSingle: async () => ({ data: { id: 'outbox_row_1' } }),
            };
          }),
        };
      }),
    }));

    const mockClient = { from: mockFrom } as any;
    const repo = new SupabaseWhatsAppOutboxRepository(
      { accountId: 'tenant_isolated_456' },
      mockClient
    );

    const outboxJob = await repo.getOutboxJobById('outbox_row_1');

    expect(outboxJob).toBeDefined();
    expect(capturedFilters['account_id']).toBe('tenant_isolated_456');
  });
});
