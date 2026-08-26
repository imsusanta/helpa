import crypto from 'crypto';

export interface RazorpayOrderOptions {
  amountInPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
}

export class RazorpayConfigurationError extends Error {
  readonly code = 'RAZORPAY_NOT_CONFIGURED';

  constructor(message = 'Razorpay credentials are not configured') {
    super(message);
    this.name = 'RazorpayConfigurationError';
  }
}

export class InvalidOrderAmountError extends Error {
  readonly code = 'INVALID_ORDER_AMOUNT';

  constructor(message = 'Invalid payment amount') {
    super(message);
    this.name = 'InvalidOrderAmountError';
  }
}

/**
 * Hard ceiling for a single subscription order: ₹10,00,000 in paise.
 * The most expensive legitimate order today (Pro setup + first month)
 * is ₹27,998, so this only exists to reject absurd or corrupted values.
 */
export const MAX_ORDER_AMOUNT_PAISE = 100_000_000;

/**
 * Validates an order amount in integer paise. Rejects zero, negative,
 * fractional, NaN/unsafe, and absurdly large values. Returns the amount
 * so call sites can use it inline.
 */
export function assertValidOrderAmountPaise(amountInPaise: number): number {
  if (
    typeof amountInPaise !== 'number' ||
    !Number.isSafeInteger(amountInPaise) ||
    amountInPaise <= 0 ||
    amountInPaise > MAX_ORDER_AMOUNT_PAISE
  ) {
    throw new InvalidOrderAmountError(
      'Order amount must be a positive integer number of paise within the allowed range'
    );
  }
  return amountInPaise;
}

/**
 * Get Razorpay credentials from runtime environment.
 *
 * `keySecret` and `webhookSecret` are server-only and must never be
 * returned to clients; checkout responses expose only `keyId`.
 */
export function getRazorpayCredentials(): {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
} {
  const keyId =
    process.env.RAZORPAY_KEY_ID ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
    '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

  return { keyId, keySecret, webhookSecret };
}

/**
 * Create a new Razorpay Order via REST API.
 *
 * Fail-closed configuration policy:
 * - In production, missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET throws a
 *   RazorpayConfigurationError. A mock order is never created in production.
 * - Outside production (development/test), missing credentials produce a
 *   deterministic mock order so local flows work without live keys.
 */
export async function createRazorpayOrder(
  options: RazorpayOrderOptions
): Promise<RazorpayOrderResponse> {
  assertValidOrderAmountPaise(options.amountInPaise);

  const { keyId, keySecret } = getRazorpayCredentials();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!keyId || !keySecret) {
    if (isProduction) {
      throw new RazorpayConfigurationError(
        'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured in production'
      );
    }
    return {
      id: `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      entity: 'order',
      amount: options.amountInPaise,
      amount_paid: 0,
      amount_due: options.amountInPaise,
      currency: options.currency || 'INR',
      receipt: options.receipt,
      status: 'created',
      attempts: 0,
      notes: options.notes || {},
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${authHeader}`,
    },
    body: JSON.stringify({
      amount: options.amountInPaise,
      currency: options.currency || 'INR',
      receipt: options.receipt,
      notes: options.notes || {},
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const message =
      errData?.error?.description ||
      `Razorpay order creation failed (${response.status})`;
    throw new Error(message);
  }

  return response.json();
}

/** Constant-time hex comparison that tolerates unequal lengths safely. */
function timingSafeHexEqual(expectedHex: string, providedHex: string): boolean {
  const expected = Buffer.from(expectedHex, 'utf8');
  const provided = Buffer.from(providedHex, 'utf8');
  // Length itself is not secret (HMAC-SHA256 hex is always 64 chars), so a
  // length mismatch may short-circuit without enabling a timing oracle.
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(expected, provided);
}

/**
 * Verify Razorpay Webhook Signature using HMAC-SHA256.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  secret?: string
): boolean {
  const webhookSecret = secret || getRazorpayCredentials().webhookSecret;
  if (!webhookSecret || !signature || !rawBody) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    return timingSafeHexEqual(expectedSignature, signature);
  } catch {
    return false;
  }
}

/**
 * Verify Razorpay Checkout Payment Signature on client redirect (optional secondary check).
 */
export function verifyRazorpayPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret?: string;
}): boolean {
  const keySecret = params.secret || getRazorpayCredentials().keySecret;
  if (!keySecret || !params.signature) return false;

  try {
    const payload = `${params.orderId}|${params.paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(payload)
      .digest('hex');

    return timingSafeHexEqual(expectedSignature, params.signature);
  } catch {
    return false;
  }
}
