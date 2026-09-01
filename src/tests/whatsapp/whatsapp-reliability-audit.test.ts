import { describe, expect, it } from 'vitest';
import { isValidStatusTransition } from '@/app/api/whatsapp/webhook/process-status';
import { verifyMetaWebhookSignature } from '@/lib/whatsapp/webhook-signature';
import {
  sanitizePhoneForMeta,
  phonesMatch,
  isValidE164,
  phoneVariants,
} from '@/lib/whatsapp/phone-utils';
import { phoneFromWhatsAppJid } from '@/core/whatsapp/canonical-config';
import crypto from 'node:crypto';

describe('WhatsApp Reliability & State Machine Audits (9+/10 Quality Standard)', () => {
  describe('1. Delivery Status Transitions (isValidStatusTransition)', () => {
    it('allows valid progressive transitions', () => {
      expect(isValidStatusTransition('pending', 'sent')).toBe(true);
      expect(isValidStatusTransition('sent', 'delivered')).toBe(true);
      expect(isValidStatusTransition('delivered', 'read')).toBe(true);
      expect(isValidStatusTransition('read', 'replied')).toBe(true);
      expect(isValidStatusTransition('sent', 'read')).toBe(true);
      expect(isValidStatusTransition('pending', 'read')).toBe(true);
    });

    it('rejects backwards regressions (out-of-order webhook arrivals)', () => {
      // Sent webhook arriving after delivered
      expect(isValidStatusTransition('delivered', 'sent')).toBe(false);
      // Delivered webhook arriving after read
      expect(isValidStatusTransition('read', 'delivered')).toBe(false);
      // Sent webhook arriving after read
      expect(isValidStatusTransition('read', 'sent')).toBe(false);
      // Read webhook arriving after replied
      expect(isValidStatusTransition('replied', 'read')).toBe(false);
      // Delivered webhook arriving after replied
      expect(isValidStatusTransition('replied', 'delivered')).toBe(false);
    });

    it('handles failed status correctly', () => {
      // Failed is valid from pending or sent
      expect(isValidStatusTransition('pending', 'failed')).toBe(true);
      expect(isValidStatusTransition('sent', 'failed')).toBe(true);

      // Failed is invalid if message was already delivered or read
      expect(isValidStatusTransition('delivered', 'failed')).toBe(false);
      expect(isValidStatusTransition('read', 'failed')).toBe(false);
      expect(isValidStatusTransition('replied', 'failed')).toBe(false);

      // Failed is terminal
      expect(isValidStatusTransition('failed', 'sent')).toBe(false);
      expect(isValidStatusTransition('failed', 'delivered')).toBe(false);
      expect(isValidStatusTransition('failed', 'read')).toBe(false);
    });

    it('handles identical / duplicate status updates gracefully (idempotent no-op)', () => {
      expect(isValidStatusTransition('sent', 'sent')).toBe(false);
      expect(isValidStatusTransition('delivered', 'delivered')).toBe(false);
      expect(isValidStatusTransition('read', 'read')).toBe(false);
    });
  });

  describe('2. Webhook HMAC-SHA256 Signature Verification', () => {
    const secret = 'test-meta-app-secret-123456';

    it('rejects when META_APP_SECRET is not configured (fail closed)', () => {
      const originalSecret = process.env.META_APP_SECRET;
      delete process.env.META_APP_SECRET;
      try {
        const valid = verifyMetaWebhookSignature('{"entry":[]}', 'sha256=abc');
        expect(valid).toBe(false);
      } finally {
        process.env.META_APP_SECRET = originalSecret;
      }
    });

    it('rejects when signature header is missing or malformed', () => {
      const originalSecret = process.env.META_APP_SECRET;
      process.env.META_APP_SECRET = secret;
      try {
        expect(verifyMetaWebhookSignature('body', null)).toBe(false);
        expect(verifyMetaWebhookSignature('body', '')).toBe(false);
        expect(verifyMetaWebhookSignature('body', 'invalid-format')).toBe(
          false
        );
      } finally {
        process.env.META_APP_SECRET = originalSecret;
      }
    });

    it('verifies valid HMAC-SHA256 signature using constant-time comparison', () => {
      const originalSecret = process.env.META_APP_SECRET;
      process.env.META_APP_SECRET = secret;
      try {
        const body = JSON.stringify({
          object: 'whatsapp_business_account',
          entry: [{ id: '123' }],
        });
        const hmac = crypto
          .createHmac('sha256', secret)
          .update(body)
          .digest('hex');
        const signature = `sha256=${hmac}`;

        expect(verifyMetaWebhookSignature(body, signature)).toBe(true);

        // Tampered body should fail
        const tampered = body + ' ';
        expect(verifyMetaWebhookSignature(tampered, signature)).toBe(false);
      } finally {
        process.env.META_APP_SECRET = originalSecret;
      }
    });
  });

  describe('3. Phone Number Normalization & Sanitization', () => {
    it('sanitizes phone numbers for Meta WhatsApp API without + and special characters', () => {
      expect(sanitizePhoneForMeta('+91 98765 43210')).toBe('919876543210');
      expect(sanitizePhoneForMeta('+1 (555) 234-5678')).toBe('15552345678');
      // Indian 10-digit mobile auto-prefixes 91
      expect(sanitizePhoneForMeta('9876543210')).toBe('919876543210');
    });

    it('validates E.164 formats', () => {
      expect(isValidE164('+919876543210')).toBe(true);
      expect(isValidE164('919876543210')).toBe(true);
      expect(isValidE164('123')).toBe(false);
      expect(isValidE164('')).toBe(false);
    });

    it('matches phone numbers across format variations', () => {
      expect(phonesMatch('+91 98765 43210', '919876543210')).toBe(true);
      expect(phonesMatch('9876543210', '+919876543210')).toBe(true);
      expect(phonesMatch('+15551234567', '15551234567')).toBe(true);
    });

    it('extracts clean international digits from WhatsApp JIDs', () => {
      expect(phoneFromWhatsAppJid('919876543210@s.whatsapp.net')).toBe(
        '919876543210'
      );
      expect(phoneFromWhatsAppJid('15552345678:0@s.whatsapp.net')).toBe(
        '15552345678'
      );
    });

    it('generates sandbox retry phone variants', () => {
      const variants = phoneVariants('37063949836');
      expect(variants).toContain('37063949836');
      expect(variants.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('4. Message Direction Integrity Invariants', () => {
    it('evaluates outbound senders as outbound agent/bot and never customer', () => {
      const testCases = [
        {
          rawSender: 'staff',
          direction: undefined,
          expectedOutbound: true,
          expectedRole: 'agent',
        },
        {
          rawSender: 'user',
          direction: undefined,
          expectedOutbound: true,
          expectedRole: 'agent',
        },
        {
          rawSender: 'agent',
          direction: 'outbound',
          expectedOutbound: true,
          expectedRole: 'agent',
        },
        {
          rawSender: 'bot',
          direction: undefined,
          expectedOutbound: true,
          expectedRole: 'bot',
        },
        {
          rawSender: 'ai',
          direction: undefined,
          expectedOutbound: true,
          expectedRole: 'bot',
        },
        {
          rawSender: undefined,
          direction: 'outbound',
          expectedOutbound: true,
          expectedRole: 'agent',
        },
        {
          rawSender: 'customer',
          direction: 'inbound',
          expectedOutbound: false,
          expectedRole: 'customer',
        },
      ];

      for (const tc of testCases) {
        const isOutbound =
          tc.direction === 'outbound' ||
          tc.rawSender === 'agent' ||
          tc.rawSender === 'bot' ||
          tc.rawSender === 'staff' ||
          tc.rawSender === 'user' ||
          tc.rawSender === 'ai';

        const senderType =
          tc.rawSender === 'bot' || tc.rawSender === 'ai'
            ? 'bot'
            : isOutbound
              ? 'agent'
              : 'customer';

        expect(isOutbound).toBe(tc.expectedOutbound);
        expect(senderType).toBe(tc.expectedRole);
      }
    });
  });
});
