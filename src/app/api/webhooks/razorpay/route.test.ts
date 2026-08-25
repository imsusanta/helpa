import { afterEach, describe, expect, it } from 'vitest';

const ORIGINAL_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
  else process.env.RAZORPAY_WEBHOOK_SECRET = ORIGINAL_SECRET;
});

describe('POST /api/webhooks/razorpay', () => {
  it('fails closed with 503 when RAZORPAY_WEBHOOK_SECRET is unset', async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const { POST } = await import('@/app/api/webhooks/razorpay/route');

    const res = await POST(
      new Request('http://localhost/api/webhooks/razorpay', {
        method: 'POST',
        headers: { 'x-razorpay-signature': 'anything' },
        body: JSON.stringify({ event: 'payment.captured' }),
      }) as never
    );

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toMatch(/secret/i);
  });

  it('rejects an invalid signature when the secret is configured', async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';
    const { POST } = await import('@/app/api/webhooks/razorpay/route');

    const res = await POST(
      new Request('http://localhost/api/webhooks/razorpay', {
        method: 'POST',
        headers: { 'x-razorpay-signature': 'not-a-valid-hmac' },
        body: JSON.stringify({ event: 'payment.captured' }),
      }) as never
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/signature/i);
  });
});
