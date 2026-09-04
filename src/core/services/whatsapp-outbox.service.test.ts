/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppOutboxService } from './whatsapp-outbox.service';

const mocks = vi.hoisted(() => ({
  sendTextMessage: vi.fn(),
  sendTemplateMessage: vi.fn(),
  sendMediaMessage: vi.fn(),
  touchConversationPreview: vi.fn(),
  decrypt: vi.fn((val: string) => val),
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/whatsapp/meta-api', () => ({
  sendTextMessage: mocks.sendTextMessage,
  sendTemplateMessage: mocks.sendTemplateMessage,
  sendMediaMessage: mocks.sendMediaMessage,
}));

vi.mock('@/lib/whatsapp/encryption', () => ({
  decrypt: mocks.decrypt,
}));

vi.mock('@/lib/whatsapp/persist-outbound-message', () => ({
  touchConversationPreview: mocks.touchConversationPreview,
  outboundPreviewText: vi.fn(() => 'preview text'),
  pauseActiveFlowRuns: vi.fn(),
}));

describe('WhatsAppOutboxService Operations', () => {
  let mockClient: any;
  let service: WhatsAppOutboxService;

  beforeEach(() => {
    vi.clearAllMocks();

    const mockFrom = vi.fn((table: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(async () => {
          if (table === 'whatsapp_configs') {
            return {
              data: {
                account_id: 'acc_1',
                phone_number_id: 'pnid_123',
                encrypted_access_token: 'valid_token',
                status: 'connected',
              },
              error: null,
            };
          }
          if (table === 'conversations') {
            return {
              data: {
                id: 'conv_1',
                account_id: 'acc_1',
                contact: { phone: '+1234567890' },
              },
              error: null,
            };
          }
          if (table === 'whatsapp_outbox') {
            return {
              data: {
                id: 'outbox_1',
                account_id: 'acc_1',
                message_id: 'msg_1',
                status: 'pending',
              },
              error: null,
            };
          }
          return { data: null, error: null };
        }),
      };
      return builder;
    });

    mockClient = {
      rpc: mocks.rpc,
      from: mockFrom,
    };

    service = new WhatsAppOutboxService(mockClient);
  });

  it('enqueueAndProcess enqueues atomically and dispatches successfully', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        ok: true,
        duplicate: false,
        status: 'pending',
        outbox_id: 'outbox_1',
        message_id: 'msg_1',
      },
      error: null,
    });
    mocks.sendTextMessage.mockResolvedValue({ messageId: 'wamid.123' });

    const result = await service.enqueueAndProcess({
      accountId: 'acc_1',
      conversationId: 'conv_1',
      contactPhone: '+1234567890',
      idempotencyKey: 'key_1',
      messageType: 'text',
      contentText: 'Hello test',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('sent');
    expect(result.messageId).toBe('wamid.123');
    expect(result.outboxId).toBe('outbox_1');
    expect(result.id).toBe('msg_1');
    expect(mocks.sendTextMessage).toHaveBeenCalledTimes(1);
    expect(mocks.touchConversationPreview).toHaveBeenCalledTimes(1);
  });

  it('handles duplicate requests idempotently without calling provider', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        ok: true,
        duplicate: true,
        status: 'sent',
        outbox_id: 'outbox_existing',
        message_id: 'msg_existing',
        provider_message_id: 'wamid.previously_sent',
      },
      error: null,
    });

    const result = await service.enqueueAndProcess({
      accountId: 'acc_1',
      conversationId: 'conv_1',
      contactPhone: '+1234567890',
      idempotencyKey: 'key_1',
      messageType: 'text',
      contentText: 'Hello test',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('sent');
    expect(result.messageId).toBe('wamid.previously_sent');
    expect(mocks.sendTextMessage).not.toHaveBeenCalled();
  });

  it('schedules retry on retryable network error during dispatch', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        ok: true,
        duplicate: false,
        status: 'pending',
        outbox_id: 'outbox_1',
        message_id: 'msg_1',
      },
      error: null,
    });
    mocks.sendTextMessage.mockRejectedValue(new Error('ETIMEDOUT'));

    const result = await service.enqueueAndProcess({
      accountId: 'acc_1',
      conversationId: 'conv_1',
      contactPhone: '+1234567890',
      idempotencyKey: 'key_1',
      messageType: 'text',
      contentText: 'Hello test',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('retryable');
    expect(result.retryable).toBe(true);
  });

  it('marks dead letter on permanent error during dispatch', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        ok: true,
        duplicate: false,
        status: 'pending',
        outbox_id: 'outbox_1',
        message_id: 'msg_1',
      },
      error: null,
    });
    mocks.sendTextMessage.mockRejectedValue(
      new Error(
        'Meta API error (#131030): Recipient phone number is not in your Meta allowed test list.'
      )
    );

    const result = await service.enqueueAndProcess({
      accountId: 'acc_1',
      conversationId: 'conv_1',
      contactPhone: '+1234567890',
      idempotencyKey: 'key_1',
      messageType: 'text',
      contentText: 'Hello test',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('dead_letter');
    expect(result.retryable).toBe(false);
  });

  it('claimAndProcessBatch processes claimed jobs and aggregates metrics', async () => {
    mocks.rpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'claim_whatsapp_outbox_batch') {
        return Promise.resolve({
          data: [
            {
              id: 'outbox_batch_1',
              account_id: 'acc_1',
              conversation_id: 'conv_1',
              message_id: 'msg_b1',
              idempotency_key: 'key_b1',
              provider: 'meta',
              attempt_count: 1,
              max_attempts: 8,
              payload: { contactPhone: '+1234567890' },
              content_type: 'text',
              content_text: 'Batch text',
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
    mocks.sendTextMessage.mockResolvedValue({
      messageId: 'wamid.batch_success',
    });

    const metrics = await service.claimAndProcessBatch({
      workerId: 'worker_test_1',
      batchSize: 10,
    });

    expect(metrics.claimed).toBe(1);
    expect(metrics.succeeded).toBe(1);
    expect(metrics.retried).toBe(0);
    expect(metrics.failed).toBe(0);
    expect(mocks.sendTextMessage).toHaveBeenCalledTimes(1);
  });
});
