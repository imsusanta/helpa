import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { extractValidAccountId } from '@/core/providers/whatsapp/waha-provider';
import { WahaWhatsAppProvider } from '@/core/providers/whatsapp/waha-provider';
import { POST } from '@/app/api/webhooks/waha/route';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

describe('Security: WAHA webhook tenant attribution', () => {
  describe('extractValidAccountId', () => {
    it('accepts structurally valid UUIDs', () => {
      expect(extractValidAccountId({ account_id: VALID_UUID })).toBe(
        VALID_UUID
      );
      expect(extractValidAccountId({ account_id: `  ${VALID_UUID}  ` })).toBe(
        VALID_UUID
      );
    });

    it('rejects missing or non-string identifiers', () => {
      expect(extractValidAccountId({})).toBeNull();
      expect(extractValidAccountId({ account_id: undefined })).toBeNull();
      expect(extractValidAccountId({ account_id: 12345 })).toBeNull();
    });

    it('rejects malformed UUID-like values instead of coercing them', () => {
      expect(extractValidAccountId({ account_id: 'not-a-uuid' })).toBeNull();
      expect(
        extractValidAccountId({ account_id: ZERO_UUID.slice(1) })
      ).toBeNull();
      expect(extractValidAccountId({ account_id: '' })).toBeNull();
    });
  });

  describe('normalizeWebhook', () => {
    const provider = new WahaWhatsAppProvider();

    it('emits no events when account_id is absent (no fallback tenant)', async () => {
      const events = await provider.normalizeWebhook({
        event: 'message',
        payload: { id: 'msg_1', from: '919999999999@c.us', body: 'hi' },
      });
      expect(events).toEqual([]);
    });

    it('emits no events when account_id is malformed', async () => {
      const events = await provider.normalizeWebhook({
        event: 'message',
        account_id: 'spoofed-account',
        payload: { id: 'msg_1', from: '919999999999@c.us', body: 'hi' },
      });
      expect(events).toEqual([]);
    });

    it('attributes emitted events to the supplied valid tenant only', async () => {
      const events = await provider.normalizeWebhook({
        event: 'message',
        account_id: VALID_UUID,
        payload: { id: 'msg_2', from: '919999999999@c.us', body: 'hi' },
      });
      expect(events).toHaveLength(1);
      expect(events[0].clinicId).toBe(VALID_UUID);
    });
  });

  describe('POST /api/webhooks/waha', () => {
    const originalSecret = process.env.WAHA_WEBHOOK_SECRET;

    beforeEach(() => {
      process.env.WAHA_WEBHOOK_SECRET = 'test-waha-webhook-secret';
    });

    afterEach(() => {
      if (originalSecret === undefined) {
        delete process.env.WAHA_WEBHOOK_SECRET;
      } else {
        process.env.WAHA_WEBHOOK_SECRET = originalSecret;
      }
    });

    function sign(body: string): string {
      return crypto
        .createHmac('sha256', 'test-waha-webhook-secret')
        .update(body)
        .digest('hex');
    }

    function makeRequest(body: string): Request {
      return new Request('https://helpa.studio/api/webhooks/waha', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-waha-signature': sign(body),
        },
        body,
      });
    }

    it('returns 403 when account_id is missing even with a valid signature', async () => {
      const body = JSON.stringify({
        event: 'message',
        payload: { id: 'waha_msg_1', from: '919999999999@c.us' },
      });
      const res = await POST(makeRequest(body));
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('returns 403 when account_id is not a valid UUID', async () => {
      const body = JSON.stringify({
        event: 'message',
        account_id: '../etc/passwd',
        payload: { id: 'waha_msg_1', from: '919999999999@c.us' },
      });
      const res = await POST(makeRequest(body));
      expect(res.status).toBe(403);
    });

    it('returns 403 for a well-formed but unregistered account (fail closed)', async () => {
      const body = JSON.stringify({
        event: 'message',
        account_id: VALID_UUID,
        payload: { id: 'waha_msg_1', from: '919999999999@c.us' },
      });
      const res = await POST(makeRequest(body));
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Unknown account');
    });
  });
});
