import { describe, it, expect } from 'vitest';
import { generatePdfToken, verifyPdfToken } from '@/lib/pdf-signing';

describe('Security: Cryptographic Document Token Verification', () => {
  const APPOINTMENT_ID = 'appt-12345';
  const ACCOUNT_ID = 'account-67890';
  const FUTURE_EXPIRES = Math.floor(Date.now() / 1000) + 3600; // 1 hour ahead
  const PAST_EXPIRES = Math.floor(Date.now() / 1000) - 300; // 5 min ago

  it('successfully verifies a valid, non-expired signature token', () => {
    const token = generatePdfToken({
      appointmentId: APPOINTMENT_ID,
      accountId: ACCOUNT_ID,
      expiresAt: FUTURE_EXPIRES,
    });

    const result = verifyPdfToken(token, APPOINTMENT_ID);
    expect(result.valid).toBe(true);
    expect(result.accountId).toBe(ACCOUNT_ID);
  });

  it('rejects an expired token', () => {
    const token = generatePdfToken({
      appointmentId: APPOINTMENT_ID,
      accountId: ACCOUNT_ID,
      expiresAt: PAST_EXPIRES,
    });

    const result = verifyPdfToken(token, APPOINTMENT_ID);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Token expired');
  });

  it('rejects a token when used for a different appointment (resource isolation)', () => {
    const token = generatePdfToken({
      appointmentId: APPOINTMENT_ID,
      accountId: ACCOUNT_ID,
      expiresAt: FUTURE_EXPIRES,
    });

    const result = verifyPdfToken(token, 'different-appointment-id');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Token appointment mismatch');
  });

  it('rejects a tampered signature token', () => {
    const token = generatePdfToken({
      appointmentId: APPOINTMENT_ID,
      accountId: ACCOUNT_ID,
      expiresAt: FUTURE_EXPIRES,
    });

    // Tamper with payload
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const tamperedDecoded = decoded.replace(ACCOUNT_ID, 'malicious-account');
    const tamperedToken = Buffer.from(tamperedDecoded).toString('base64url');

    const result = verifyPdfToken(tamperedToken, APPOINTMENT_ID);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid signature');
  });
});
