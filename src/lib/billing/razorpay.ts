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

/**
 * Get Razorpay credentials from runtime environment.
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
 */
export async function createRazorpayOrder(
  options: RazorpayOrderOptions
): Promise<RazorpayOrderResponse> {
  const { keyId, keySecret } = getRazorpayCredentials();

  if (!keyId || !keySecret) {
    // In local development or testing without live keys, generate a
    // deterministic mock order. Production must fail closed instead —
    // a mock order would silently mask a missing credential and hand
    // the client an order id Razorpay does not know about.
    if (process.env.NODE_ENV !== 'production') {
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
    throw new Error('RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured');
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

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
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

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf8'),
      Buffer.from(params.signature, 'utf8')
    );
  } catch {
    return false;
  }
}
