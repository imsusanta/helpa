import crypto from 'crypto';

/**
 * PDF Signing Module
 *
 * Generates and verifies short-lived HMAC signatures for public/Meta access
 * to appointment OPD PDFs without requiring staff authentication.
 *
 * Binds: appointmentId, accountId, expiresAt
 * Uses timing-safe comparisons and a dedicated signing key.
 */

function getPdfSigningKey(): string {
  const key = process.env.PDF_SIGNING_KEY?.trim();
  if (!key) {
    throw new Error('PDF_SIGNING_KEY is not configured');
  }
  return key;
}

export interface PdfSignaturePayload {
  appointmentId: string;
  accountId: string;
  expiresAt: number; // Unix timestamp in seconds
}

export function generatePdfToken(payload: PdfSignaturePayload): string {
  const { appointmentId, accountId, expiresAt } = payload;
  const secret = getPdfSigningKey();
  const dataToSign = `pdf:${appointmentId}:${accountId}:${expiresAt}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest('hex');

  // Return base64url payload token
  const payloadStr = `${appointmentId}|${accountId}|${expiresAt}|${signature}`;
  return Buffer.from(payloadStr).toString('base64url');
}

export function verifyPdfToken(
  token: string,
  targetAppointmentId: string
): { valid: boolean; accountId?: string; error?: string } {
  if (!token) {
    return { valid: false, error: 'Missing token' };
  }

  let decoded = '';
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return { valid: false, error: 'Malformed token format' };
  }

  const parts = decoded.split('|');
  if (parts.length !== 4) {
    return { valid: false, error: 'Invalid token structure' };
  }

  const [appointmentId, accountId, expiresAtStr, signature] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);

  if (isNaN(expiresAt)) {
    return { valid: false, error: 'Invalid expiration timestamp' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec > expiresAt) {
    return { valid: false, error: 'Token expired' };
  }

  if (appointmentId !== targetAppointmentId) {
    return { valid: false, error: 'Token appointment mismatch' };
  }

  let expectedSignature: string;
  try {
    const secret = getPdfSigningKey();
    const dataToSign = `pdf:${appointmentId}:${accountId}:${expiresAt}`;
    expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(dataToSign)
      .digest('hex');
  } catch {
    return { valid: false, error: 'PDF signing key is not configured' };
  }

  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, error: 'Invalid signature' };
  }

  return { valid: true, accountId };
}
