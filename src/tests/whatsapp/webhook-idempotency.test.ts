import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'node:crypto';
import {
  POST as webhookHandler,
  GET as webhookGetHandler,
} from '@/app/api/whatsapp/webhook/route';
import * as supabaseServer from '@/lib/supabase/server';
import * as tenantResolver from '@/core/whatsapp/tenant-resolver';
import * as processMsgModule from '@/app/api/whatsapp/webhook/process-message';

describe('WhatsApp Webhook & Idempotency Engine', () => {
  const secret = 'test-meta-app-secret';
  const tenantA = { id: 'account-alpha', userId: 'user-alpha' };

  let mockWebhookEvents: Array<Record<string, unknown>>;
  let mockWhatsappConfigs: Array<Record<string, unknown>>;

  function signPayload(body: string): string {
    const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return `sha256=${hmac}`;
  }

  beforeEach(() => {
    mockWebhookEvents = [];
    mockWhatsappConfigs = [];
    process.env.META_APP_SECRET = secret;
    process.env.META_WEBHOOK_VERIFY_TOKEN = 'test-verify-token-123';

    vi.spyOn(supabaseServer, 'getAdminClient').mockReturnValue({
      from: (table: string) => {
        if (table === 'webhook_events') {
          return {
            insert: (data: Record<string, unknown>) => {
              const duplicate = mockWebhookEvents.find(
                (e) =>
                  e.provider === data.provider &&
                  e.provider_event_id === data.provider_event_id
              );
              if (duplicate) {
                return Promise.resolve({
                  data: null,
                  error: { code: '23505', message: 'Unique violation' },
                });
              }
              const row = { id: `event-${Date.now()}`, ...data };
              mockWebhookEvents.push(row);
              return Promise.resolve({ data: row, error: null });
            },
            update: (updateData: Record<string, unknown>) => {
              const builder = {
                eq: (f1: string, v1: unknown) => {
                  const m1 = mockWebhookEvents.filter((r) => r[f1] === v1);
                  return {
                    eq: (f2: string, v2: unknown) => {
                      const m2 = m1.filter((r) => r[f2] === v2);
                      m2.forEach((r) => Object.assign(r, updateData));
                      return Promise.resolve({ data: m2, error: null });
                    },
                  };
                },
              };
              return builder;
            },
          };
        }

        if (table === 'whatsapp_configs' || table === 'whatsapp_config') {
          return {
            update: (updateData: Record<string, unknown>) => ({
              eq: (field: string, val: unknown) => {
                const matched = mockWhatsappConfigs.filter(
                  (r) => r[field] === val
                );
                matched.forEach((r) => Object.assign(r, updateData));
                return Promise.resolve({ data: matched, error: null });
              },
            }),
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          };
        }

        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null }) }),
          }),
          update: () => ({ eq: () => Promise.resolve({ data: [] }) }),
          insert: () => Promise.resolve({ data: [] }),
        };
      },
    } as unknown as ReturnType<typeof supabaseServer.getAdminClient>);

    vi.spyOn(processMsgModule, 'processMessage').mockResolvedValue(
      undefined as never
    );
  });

  describe('1. Webhook Challenge GET', () => {
    it('successfully verifies Meta webhook challenge when verify_token matches', async () => {
      const request = new Request(
        'http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.challenge=test_challenge_12345&hub.verify_token=test-verify-token-123',
        { method: 'GET' }
      );

      const response = await webhookGetHandler(request);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(text).toBe('test_challenge_12345');
    });

    it('rejects verification challenge when verify_token does not match', async () => {
      const request = new Request(
        'http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.challenge=test_challenge_12345&hub.verify_token=wrong-token',
        { method: 'GET' }
      );

      const response = await webhookGetHandler(request);
      expect(response.status).toBe(403);
    });
  });

  describe('2. Webhook Signature Security', () => {
    it('rejects POST with invalid HMAC-SHA256 signature', async () => {
      const payload = JSON.stringify({ entry: [] });
      const request = new Request(
        'http://localhost:3000/api/whatsapp/webhook',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-hub-signature-256': 'sha256=invalid_signature_hex',
          },
          body: payload,
        }
      );

      const response = await webhookHandler(request);
      expect(response.status).toBe(401);
    });

    it('rejects POST with missing signature header', async () => {
      const payload = JSON.stringify({ entry: [] });
      const request = new Request(
        'http://localhost:3000/api/whatsapp/webhook',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        }
      );

      const response = await webhookHandler(request);
      expect(response.status).toBe(401);
    });
  });

  describe('3. Idempotency & Duplicate Delivery Protection', () => {
    it('processes message on first delivery and records webhook_event in Supabase', async () => {
      vi.spyOn(
        tenantResolver,
        'resolveTenantByPhoneNumberId'
      ).mockResolvedValue({
        tenantId: tenantA.id,
        userId: tenantA.userId,
        phoneNumberId: 'phone-100200',
        wabaId: 'waba-123',
        accessToken: 'TOKEN',
      });

      const payload = JSON.stringify({
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: { phone_number_id: 'phone-100200' },
                  contacts: [
                    {
                      wa_id: '919876543210',
                      profile: { name: 'Patient John' },
                    },
                  ],
                  messages: [
                    {
                      id: 'wamid.HBgNNzk5OTk5OTk5FQIAERgSN0YxM0Q3QjI3RDU4QjM2QkU0AA==',
                      from: '919876543210',
                      timestamp: '1700000000',
                      type: 'text',
                      text: { body: 'Hello doctor, I need an appointment' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      const request = new Request(
        'http://localhost:3000/api/whatsapp/webhook',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-hub-signature-256': signPayload(payload),
          },
          body: payload,
        }
      );

      const response = await webhookHandler(request);
      expect(response.status).toBe(200);

      // Verify event was saved to Supabase webhook_events
      expect(mockWebhookEvents.length).toBe(1);
      expect(mockWebhookEvents[0].provider_event_id).toBe(
        'wamid.HBgNNzk5OTk5OTk5FQIAERgSN0YxM0Q3QjI3RDU4QjM2QkU0AA=='
      );
      expect(mockWebhookEvents[0].status).toBe('processed');
      expect(processMsgModule.processMessage).toHaveBeenCalledTimes(1);
    });

    it('skips duplicate webhook events safely without reprocessing (idempotency guarantee)', async () => {
      vi.spyOn(
        tenantResolver,
        'resolveTenantByPhoneNumberId'
      ).mockResolvedValue({
        tenantId: tenantA.id,
        userId: tenantA.userId,
        phoneNumberId: 'phone-100200',
        wabaId: 'waba-123',
        accessToken: 'TOKEN',
      });

      const messageId = 'wamid.DUPLICATE_TEST_EVENT_ID_9999';

      // Pre-seed existing event in Supabase
      mockWebhookEvents.push({
        id: 'event-existing',
        account_id: tenantA.id,
        provider: 'whatsapp',
        provider_event_id: messageId,
        status: 'processed',
      });

      const payload = JSON.stringify({
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: { phone_number_id: 'phone-100200' },
                  contacts: [
                    {
                      wa_id: '919876543210',
                      profile: { name: 'Patient John' },
                    },
                  ],
                  messages: [
                    {
                      id: messageId,
                      from: '919876543210',
                      timestamp: '1700000000',
                      type: 'text',
                      text: { body: 'Duplicate message' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      const request = new Request(
        'http://localhost:3000/api/whatsapp/webhook',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-hub-signature-256': signPayload(payload),
          },
          body: payload,
        }
      );

      const response = await webhookHandler(request);
      expect(response.status).toBe(200);

      // processMessage must NOT have been called for the duplicate!
      expect(processMsgModule.processMessage).not.toHaveBeenCalled();
    });
  });

  describe('4. Unknown Phone Number Handling', () => {
    it('safely discards events for phone numbers not registered to any tenant', async () => {
      vi.spyOn(
        tenantResolver,
        'resolveTenantByPhoneNumberId'
      ).mockResolvedValue(null);

      const payload = JSON.stringify({
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: { phone_number_id: 'phone-unregistered-999' },
                  contacts: [{ wa_id: '919876543210' }],
                  messages: [
                    {
                      id: 'wamid.UNREGISTERED_MSG_1',
                      from: '919876543210',
                      timestamp: '1700000000',
                      type: 'text',
                      text: { body: 'Hello' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      const request = new Request(
        'http://localhost:3000/api/whatsapp/webhook',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-hub-signature-256': signPayload(payload),
          },
          body: payload,
        }
      );

      const response = await webhookHandler(request);
      expect(response.status).toBe(500);
      expect(processMsgModule.processMessage).not.toHaveBeenCalled();
    });
  });
});
