import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { POST, GET } from './route';

const SECRET = 'test-meta-secret-1234567890123456';
process.env.META_APP_SECRET = SECRET;

function createSignedRequest(
  bodyObj: unknown,
  secret: string = SECRET
): Request {
  const rawBody = JSON.stringify(bodyObj);
  const sig =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return new Request('https://helpa.studio/api/whatsapp/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': sig,
    },
    body: rawBody,
  });
}

describe('WhatsApp Webhook Route (Modular Fail-Closed)', () => {
  it('rejects POST with missing signature header with 401 Unauthorized', async () => {
    const req = new Request('https://helpa.studio/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ object: 'whatsapp_business_account' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Invalid webhook signature');
  });

  it('rejects POST with invalid/tampered signature with 401 Unauthorized', async () => {
    const req = createSignedRequest(
      { object: 'whatsapp_business_account' },
      'wrong-secret'
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Invalid webhook signature');
  });

  it('accepts correctly signed POST and returns 200 { status: "received" }', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [],
    };
    const req = createSignedRequest(payload);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('received');
  });

  it('handles GET challenge verification with missing parameters by returning 400', async () => {
    const req = new Request(
      'https://helpa.studio/api/whatsapp/webhook?hub.mode=subscribe'
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Missing verification parameters');
  });
});
