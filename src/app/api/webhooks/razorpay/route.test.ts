import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const { getAdminClient } = vi.hoisted(() => ({ getAdminClient: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({ getAdminClient }));

beforeEach(() => {
  getAdminClient.mockReset();
  getAdminClient.mockImplementation(() => {
    throw new Error('Unexpected database access before webhook verification');
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(body: string, signature?: string) {
  return new Request('http://localhost/api/webhooks/razorpay', {
    method: 'POST',
    headers: signature ? { 'x-razorpay-signature': signature } : {},
    body,
  }) as never;
}

describe('POST /api/webhooks/razorpay', () => {
  it('fails closed with 503 without exposing missing-secret configuration', async () => {
    vi.stubEnv('RAZORPAY_WEBHOOK_SECRET', undefined);
    const response = await POST(
      request(JSON.stringify({ event: 'payment.captured' }), 'anything')
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Webhook service is unavailable',
    });
    expect(getAdminClient).not.toHaveBeenCalled();
  });

  it.each([undefined, 'not-a-valid-hmac', '0'.repeat(64)])(
    'rejects an absent or invalid signature before database access (%s)',
    async (signature) => {
      vi.stubEnv('RAZORPAY_WEBHOOK_SECRET', 'test-webhook-secret');
      const response = await POST(
        request(JSON.stringify({ event: 'payment.captured' }), signature)
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'Invalid webhook request',
      });
      expect(getAdminClient).not.toHaveBeenCalled();
    }
  );

  it('rejects malformed JSON only after checking its valid signature', async () => {
    const secret = 'test-webhook-secret';
    vi.stubEnv('RAZORPAY_WEBHOOK_SECRET', secret);
    const body = '{';
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    const response = await POST(request(body, signature));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Invalid webhook payload',
    });
    expect(getAdminClient).not.toHaveBeenCalled();
  });

  it('accepts an authenticated irrelevant event without accessing payment data', async () => {
    const secret = 'test-webhook-secret';
    vi.stubEnv('RAZORPAY_WEBHOOK_SECRET', secret);
    const body = JSON.stringify({ event: 'subscription.authenticated' });
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    const response = await POST(request(body, signature));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: true,
      event: 'subscription.authenticated',
    });
    expect(getAdminClient).not.toHaveBeenCalled();
  });
});
