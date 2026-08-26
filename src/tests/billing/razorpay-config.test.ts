import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import {
  assertValidOrderAmountPaise,
  createRazorpayOrder,
  InvalidOrderAmountError,
  MAX_ORDER_AMOUNT_PAISE,
  RazorpayConfigurationError,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from '@/lib/billing/razorpay';

const ORDER = {
  amountInPaise: 499_900,
  currency: 'INR',
  receipt: 'rcpt_test',
};

beforeEach(() => {
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createRazorpayOrder configuration policy', () => {
  it('throws in production when the key id is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.RAZORPAY_KEY_SECRET = 'secret-present';
    await expect(createRazorpayOrder(ORDER)).rejects.toBeInstanceOf(
      RazorpayConfigurationError
    );
  });

  it('throws in production when the key secret is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.RAZORPAY_KEY_ID = 'rzp_live_key';
    await expect(createRazorpayOrder(ORDER)).rejects.toBeInstanceOf(
      RazorpayConfigurationError
    );
  });

  it('never creates a mock order in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(createRazorpayOrder(ORDER)).rejects.toThrow(
      /must be configured in production/
    );
  });

  it('creates a mock order outside production when keys are missing', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const order = await createRazorpayOrder(ORDER);
    expect(order.id).toMatch(/^order_mock_/);
    expect(order.amount).toBe(499_900);
    expect(order.status).toBe('created');
  });
});

describe('order amount validation', () => {
  it.each([0, -100, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2])(
    'rejects invalid amount %s',
    (amount) => {
      expect(() => assertValidOrderAmountPaise(amount as number)).toThrow(
        InvalidOrderAmountError
      );
    }
  );

  it('rejects amounts above the hard ceiling', () => {
    expect(() =>
      assertValidOrderAmountPaise(MAX_ORDER_AMOUNT_PAISE + 1)
    ).toThrow(InvalidOrderAmountError);
  });

  it('accepts a valid integer paise amount', () => {
    expect(assertValidOrderAmountPaise(1_699_800)).toBe(1_699_800);
  });

  it('rejects invalid amounts before creating any order', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    await expect(
      createRazorpayOrder({ ...ORDER, amountInPaise: -1 })
    ).rejects.toBeInstanceOf(InvalidOrderAmountError);
  });
});

describe('signature verification', () => {
  const secret = 'webhook_secret_test';
  const body = JSON.stringify({ event: 'payment.captured' });
  const validSig = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  it('accepts a valid webhook signature', () => {
    expect(verifyRazorpayWebhookSignature(body, validSig, secret)).toBe(true);
  });

  it('rejects an invalid webhook signature', () => {
    expect(verifyRazorpayWebhookSignature(body, 'f'.repeat(64), secret)).toBe(
      false
    );
  });

  it('safely rejects signatures of unequal length', () => {
    expect(verifyRazorpayWebhookSignature(body, 'short', secret)).toBe(false);
    expect(verifyRazorpayWebhookSignature(body, validSig + 'ff', secret)).toBe(
      false
    );
  });

  it('verifies and rejects checkout payment signatures', () => {
    const keySecret = 'rzp_key_secret';
    const good = crypto
      .createHmac('sha256', keySecret)
      .update('order_1|pay_1')
      .digest('hex');
    expect(
      verifyRazorpayPaymentSignature({
        orderId: 'order_1',
        paymentId: 'pay_1',
        signature: good,
        secret: keySecret,
      })
    ).toBe(true);
    expect(
      verifyRazorpayPaymentSignature({
        orderId: 'order_1',
        paymentId: 'pay_1',
        signature: 'bad',
        secret: keySecret,
      })
    ).toBe(false);
  });
});
