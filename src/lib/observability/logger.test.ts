import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeString, sanitizeObject, logger } from './logger';

describe('Observability: Structured Logger & Sensitive Redaction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('redacts bearer tokens, secrets, and query parameters in message strings', () => {
    const rawMessage =
      'Inbound webhook received with Bearer eyJhbGciOiJIUzI1Ni... and key=sk_live_12345';
    const sanitized = sanitizeString(rawMessage);

    expect(sanitized).not.toContain('eyJhbGciOiJIUzI1Ni');
    expect(sanitized).not.toContain('sk_live_12345');
    expect(sanitized).toContain('[REDACTED_SECRET]');
  });

  it('redacts email addresses and phone numbers in raw strings', () => {
    const raw = 'Patient dr.sharma@apollo.com called from +919876543210';
    const sanitized = sanitizeString(raw);

    expect(sanitized).not.toContain('dr.sharma@apollo.com');
    expect(sanitized).toContain('[REDACTED_EMAIL]');
    expect(sanitized).not.toContain('987654');
    expect(sanitized).toContain('3210');
  });

  it('recursively redacts sensitive keys in nested objects and arrays', () => {
    const context = {
      accountId: 'acc-123',
      patientData: {
        patient_name: 'Rahul Sharma',
        medical_notes: 'Diagnosed with Type 2 Diabetes',
        notes: 'Follow up in 2 weeks',
        contactPhone: '+919876543210',
      },
      auth: {
        access_token: 'meta_wa_token_secret_value',
        password: 'SuperSecretPassword!',
      },
      tags: ['opd', 'followup'],
    };

    const sanitized = sanitizeObject(context) as Record<string, unknown>;
    const patientData = sanitized.patientData as Record<string, unknown>;
    const authData = sanitized.auth as Record<string, unknown>;

    expect(sanitized.accountId).toBe('acc-123');
    expect(sanitized.tags).toEqual(['opd', 'followup']);
    expect(patientData.patient_name).toBe('[REDACTED_SENSITIVE_DATA]');
    expect(patientData.medical_notes).toBe('[REDACTED_SENSITIVE_DATA]');
    expect(patientData.notes).toBe('[REDACTED_SENSITIVE_DATA]');
    expect(authData.access_token).toBe('[REDACTED_SENSITIVE_DATA]');
    expect(authData.password).toBe('[REDACTED_SENSITIVE_DATA]');
  });

  it('handles Error objects and circular references safely without crashing', () => {
    const error = new Error(
      'Database connection failed with key=secret_key_123'
    );
    const circularObj: Record<string, unknown> = { name: 'Test' };
    circularObj.self = circularObj;

    const sanitizedError = sanitizeObject(error) as Record<string, unknown>;
    expect(sanitizedError.name).toBe('Error');
    expect(String(sanitizedError.message)).not.toContain('secret_key_123');
    expect(String(sanitizedError.message)).toContain('[REDACTED_SECRET]');

    const sanitizedCircular = sanitizeObject(circularObj) as Record<
      string,
      unknown
    >;
    expect(sanitizedCircular.name).toBe('Test');
    expect(sanitizedCircular.self).toBe('[CIRCULAR_REFERENCE]');
  });

  it('emits structured JSON to console without unredacted data', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('User login successful', { token: 'secret-jwt-token' });

    expect(spy).toHaveBeenCalled();
    const loggedJson = spy.mock.calls[0][0];
    expect(loggedJson).not.toContain('secret-jwt-token');
    expect(loggedJson).toContain('[REDACTED_SENSITIVE_DATA]');
  });
});
