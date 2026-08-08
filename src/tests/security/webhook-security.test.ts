import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { POST } from '@/app/api/whatsapp/webhook/route';
import { verifyMetaWebhookSignature } from '@/lib/whatsapp/webhook-signature';

const TEST_SECRET = 'meta-app-secret-test-32-chars-long!';

function sign(body: string, secret: string = TEST_SECRET): string {
  return (
    'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex')
  );
}

describe('Security: Webhook Verification & Resilience', () => {
  it('rejects inbound POST with missing signature header (401 Unauthorized)', async () => {
    const rawBody = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [],
    });
    const req = new Request('https://helpa.studio/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawBody,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Invalid webhook signature');
  });

  it('rejects inbound POST with incorrect signature (401 Unauthorized)', async () => {
    const rawBody = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [],
    });
    const badSig = sign(rawBody, 'wrong-secret-key-1234567890');
    const req = new Request('https://helpa.studio/api/whatsapp/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': badSig,
      },
      body: rawBody,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects inbound POST when body was tampered with after signing (401 Unauthorized)', async () => {
    const originalBody = JSON.stringify({ test: 'legitimate' });
    const signature = sign(
      originalBody,
      process.env.META_APP_SECRET || 'ci-dummy-meta-secret'
    );
    const tamperedBody = JSON.stringify({ test: 'malicious-injection' });

    const req = new Request('https://helpa.studio/api/whatsapp/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': signature,
      },
      body: tamperedBody,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('fails closed when META_APP_SECRET is unset in environment', () => {
    const originalSecret = process.env.META_APP_SECRET;
    delete process.env.META_APP_SECRET;

    try {
      const isValid = verifyMetaWebhookSignature('{"test":1}', 'sha256=123456');
      expect(isValid).toBe(false);
    } finally {
      process.env.META_APP_SECRET = originalSecret;
    }
  });

  it('accepts valid payload signed with correct META_APP_SECRET (200 OK)', async () => {
    const secret = process.env.META_APP_SECRET || 'ci-dummy-meta-secret';
    const payload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [],
    });
    const signature = sign(payload, secret);

    const req = new Request('https://helpa.studio/api/whatsapp/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': signature,
      },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('received');
  });
});
