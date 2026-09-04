import { describe, expect, it } from 'vitest';
import { classifyOutboxError } from './whatsapp-outbox.service';

describe('WhatsApp Outbox Error Classification', () => {
  describe('Permanent Non-Retryable Errors', () => {
    it('classifies invalid recipient / not allowed errors as terminal', () => {
      const err1 = new Error(
        'Meta API error (#131030): Recipient phone number is not in your Meta allowed test list.'
      );
      const res1 = classifyOutboxError(err1);
      expect(res1.isRetryable).toBe(false);
      expect(res1.errorCode).toBe('131030');

      const err2 = new Error('Not a valid WhatsApp user');
      const res2 = classifyOutboxError(err2);
      expect(res2.isRetryable).toBe(false);
      expect(res2.errorCode).toBe('INVALID_RECIPIENT');

      const err3 = {
        code: '131026',
        message: 'Message undeliverable to this phone number',
      };
      const res3 = classifyOutboxError(err3);
      expect(res3.isRetryable).toBe(false);
      expect(res3.errorCode).toBe('131026');
    });

    it('classifies template not found or parameter mismatch as terminal', () => {
      const err1 = new Error('template does not exist in en_US language');
      const res1 = classifyOutboxError(err1);
      expect(res1.isRetryable).toBe(false);
      expect(res1.errorCode).toBe('INVALID_TEMPLATE');

      const err2 = { code: '132000', message: 'Template not found' };
      const res2 = classifyOutboxError(err2);
      expect(res2.isRetryable).toBe(false);
      expect(res2.errorCode).toBe('132000');
    });

    it('classifies expired token or auth failure as terminal', () => {
      const err1 = new Error('Session has expired or access token was revoked');
      const res1 = classifyOutboxError(err1);
      expect(res1.isRetryable).toBe(false);
      expect(res1.errorCode).toBe('AUTH_FAILURE');

      const err2 = { code: '190', message: 'Invalid OAuth access token' };
      const res2 = classifyOutboxError(err2);
      expect(res2.isRetryable).toBe(false);
      expect(res2.errorCode).toBe('190');
    });
  });

  describe('Retryable Errors', () => {
    it('classifies rate limit errors (429, 130429, 131056) as retryable', () => {
      const err1 = new Error(
        'Too many requests: User request limit reached (#130429)'
      );
      const res1 = classifyOutboxError(err1);
      expect(res1.isRetryable).toBe(true);
      expect(res1.errorCode).toBe('130429');

      const err2 = { code: '429', message: 'Rate limit exceeded' };
      const res2 = classifyOutboxError(err2);
      expect(res2.isRetryable).toBe(true);
      expect(res2.errorCode).toBe('429');
    });

    it('classifies network timeouts, socket resets, and 5xx errors as retryable', () => {
      const err1 = new Error('ETIMEDOUT: Connection timed out to Graph API');
      const res1 = classifyOutboxError(err1);
      expect(res1.isRetryable).toBe(true);
      expect(res1.errorCode).toBe('NETWORK_RETRYABLE');

      const err2 = new Error('ECONNRESET: socket hang up');
      const res2 = classifyOutboxError(err2);
      expect(res2.isRetryable).toBe(true);
      expect(res2.errorCode).toBe('NETWORK_RETRYABLE');

      const err3 = new Error('Meta API error: 502 Bad Gateway');
      const res3 = classifyOutboxError(err3);
      expect(res3.isRetryable).toBe(true);
      expect(res3.errorCode).toBe('NETWORK_RETRYABLE');

      const err4 = { code: '503', message: 'Service Unavailable' };
      const res4 = classifyOutboxError(err4);
      expect(res4.isRetryable).toBe(true);
      expect(res4.errorCode).toBe('503');
    });
  });

  describe('Unclassified & Edge Cases', () => {
    it('handles null, undefined, or empty errors safely', () => {
      expect(classifyOutboxError(null).isRetryable).toBe(false);
      expect(classifyOutboxError(undefined).isRetryable).toBe(false);
      expect(classifyOutboxError('').isRetryable).toBe(false);
    });

    it('treats unknown arbitrary errors as non-retryable to prevent poison-pill loops', () => {
      const res = classifyOutboxError(new Error('SyntaxError in JSON payload'));
      expect(res.isRetryable).toBe(false);
      expect(res.errorCode).toBe('UNCLASSIFIED_ERROR');
    });
  });
});
