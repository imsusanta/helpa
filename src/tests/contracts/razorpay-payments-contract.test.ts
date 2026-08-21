import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createRazorpayOrder,
  verifyRazorpayWebhookSignature,
  verifyRazorpayPaymentSignature,
} from '@/lib/billing/razorpay';
import crypto from 'crypto';

describe('Razorpay Payment Provider Boundary Contract Tests', () => {
  let fetchSpy: any;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch') as any;
    process.env.RAZORPAY_KEY_ID = 'rzp_live_test123';
    process.env.RAZORPAY_KEY_SECRET = 'secret_test_456';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook_secret_789';
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    process.env = { ...originalEnv };
  });

  it('adheres to Razorpay Order Creation API contract with Basic Auth', async () => {
    const mockOrderResponse = {
      id: 'order_EKwxwAgItmmXdp',
      entity: 'order',
      amount: 499900,
      amount_paid: 0,
      amount_due: 499900,
      currency: 'INR',
      receipt: 'rcpt_plan_growth_123',
      status: 'created',
      attempts: 0,
      notes: { account_id: 'acc_abc123', plan_id: 'growth' },
      created_at: 1724234567,
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockOrderResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await createRazorpayOrder({
      amountInPaise: 499900,
      receipt: 'rcpt_plan_growth_123',
      notes: { account_id: 'acc_abc123', plan_id: 'growth' },
    });

    expect(result.id).toBe('order_EKwxwAgItmmXdp');
    expect(result.status).toBe('created');
    expect(result.amount).toBe(499900);
    expect(result.currency).toBe('INR');

    // Verify basic auth header
    const expectedBasic = Buffer.from(
      'rzp_live_test123:secret_test_456'
    ).toString('base64');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.razorpay.com/v1/orders',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Basic ${expectedBasic}`,
        }),
      })
    );
  });

  it('adheres to Razorpay Webhook HMAC-SHA256 signature verification contract', () => {
    const rawBody = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_29QQoUBcxrhErF',
            order_id: 'order_EKwxwAgItmmXdp',
            amount: 499900,
            status: 'captured',
          },
        },
      },
    });

    const validSignature = crypto
      .createHmac('sha256', 'webhook_secret_789')
      .update(rawBody)
      .digest('hex');

    const isValid = verifyRazorpayWebhookSignature(rawBody, validSignature);
    expect(isValid).toBe(true);

    const isTampered = verifyRazorpayWebhookSignature(
      rawBody,
      'invalid_hex_signature'
    );
    expect(isTampered).toBe(false);
  });

  it('adheres to Razorpay Checkout Redirect client signature contract', () => {
    const orderId = 'order_EKwxwAgItmmXdp';
    const paymentId = 'pay_29QQoUBcxrhErF';
    const validSignature = crypto
      .createHmac('sha256', 'secret_test_456')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const isValid = verifyRazorpayPaymentSignature({
      orderId,
      paymentId,
      signature: validSignature,
    });
    expect(isValid).toBe(true);

    const isInvalid = verifyRazorpayPaymentSignature({
      orderId,
      paymentId,
      signature: 'bad_signature_123',
    });
    expect(isInvalid).toBe(false);
  });
});
