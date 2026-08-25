import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';

const { createEmptyQuery } = vi.hoisted(() => ({
  createEmptyQuery: () => {
    const query: Record<string, unknown> & {
      then?: (
        resolve: (value: {
          data: unknown[];
          error: null;
          count: number;
        }) => unknown,
        reject?: (reason: unknown) => unknown
      ) => Promise<unknown>;
    } = {
      select: () => query,
      eq: () => query,
      limit: () => query,
      order: () => query,
      then: (resolve, reject) =>
        Promise.resolve({ data: [], error: null, count: 0 }).then(
          resolve,
          reject
        ),
    };
    return query;
  },
}));

vi.mock('@/lib/db/server', () => ({
  getAdminClient: () => ({ from: () => createEmptyQuery() }),
}));

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

  // Behaviour change: an unroutable phone_number_id used to return 500.
  // Retrying can never make an unregistered number routable, so a 500 only
  // produced an unbounded Meta retry storm — which risks Meta disabling the
  // whole webhook subscription and taking every tenant's inbound messages
  // down. We now acknowledge the delivery, count it as skipped, and log it.
  it('acknowledges but skips an inbound message that cannot be routed to a WhatsApp configuration', async () => {
    const req = createSignedRequest({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'test-entry',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'unregistered-test-number' },
                contacts: [
                  { profile: { name: 'Test User' }, wa_id: '15550000000' },
                ],
                messages: [
                  {
                    from: '15550000000',
                    id: 'wamid.test-inbound',
                    timestamp: '1760000000',
                    type: 'text',
                    text: { body: 'Hello from a customer' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('received');
    expect(data.skipped).toBe(1);
    expect(data.persisted).toBe(0);
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
