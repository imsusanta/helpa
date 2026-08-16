import { describe, expect, it } from 'vitest';
import {
  coreEvents,
  hasPermission,
  assertPermission,
  OpenRouterAiProvider,
  getAiProvider,
  formatKnowledgeForAi,
  assertTenantMatch,
  validateTenantPayload,
} from '@/core';

describe('Phase 3: Core Platform Architecture', () => {
  describe('1. Core Event Bus', () => {
    it('allows subscribing to and emitting core events', async () => {
      let received = false;
      let eventText: string | undefined;

      const unsubscribe = coreEvents.subscribe('message.received', (event) => {
        received = true;
        eventText = (event.payload as { text?: string })?.text;
      });

      await coreEvents.emit('message.received', 'acc_123', {
        text: 'Hello, world!',
      });

      expect(received).toBe(true);
      expect(eventText).toBe('Hello, world!');

      unsubscribe();
    });
  });

  describe('2. Core Permissions & Roles', () => {
    it('grants owner all operational and admin permissions', () => {
      expect(hasPermission('owner', 'contacts.read')).toBe(true);
      expect(hasPermission('owner', 'contacts.delete')).toBe(true);
      expect(hasPermission('owner', 'billing.manage')).toBe(true);
      expect(hasPermission('owner', 'settings.manage')).toBe(true);
    });

    it('limits staff permissions appropriately', () => {
      expect(hasPermission('staff', 'contacts.read')).toBe(true);
      expect(hasPermission('staff', 'inbox.reply')).toBe(true);
      expect(hasPermission('staff', 'billing.manage')).toBe(false);
      expect(hasPermission('staff', 'settings.manage')).toBe(false);
    });

    it('throws on assertPermission failure', () => {
      expect(() => {
        assertPermission('viewer', 'billing.manage');
      }).toThrowError(/Permission denied/);
    });
  });

  describe('3. Core AI Provider & OpenRouter', () => {
    it('instantiates default OpenRouter provider', () => {
      const provider = getAiProvider();
      expect(provider.name).toBe('openrouter');
      expect(provider).toBeInstanceOf(OpenRouterAiProvider);
    });
  });

  describe('4. Core Knowledge Base Context Formatting', () => {
    it('formats knowledge articles into clear structured AI prompt text', () => {
      const items = [
        {
          category: 'pricing',
          question_title: 'Standard Consultation Fee',
          answer_content: 'Fee is $50 per session.',
        },
        {
          category: 'policy',
          question_title: 'Cancellation Window',
          answer_content: '24 hours advance notice required.',
        },
      ];

      const formatted = formatKnowledgeForAi(items);
      expect(formatted).toContain(
        '[Article 1] (PRICING): Standard Consultation Fee'
      );
      expect(formatted).toContain('Fee is $50 per session.');
      expect(formatted).toContain('[Article 2] (POLICY): Cancellation Window');
    });
  });

  describe('5. Core Multi-Tenant Isolation', () => {
    it('asserts tenant match correctly', () => {
      expect(() => {
        assertTenantMatch('acc_1', 'acc_1', 'Patient');
      }).not.toThrow();

      expect(() => {
        assertTenantMatch('acc_1', 'acc_2', 'Patient');
      }).toThrowError(/Tenant Isolation Violation/);
    });

    it('injects authenticated tenant ID into payloads safely', () => {
      const payload: { name: string; role: string; account_id?: string } = {
        name: 'Susanta',
        role: 'admin',
      };
      const secured = validateTenantPayload(payload, 'acc_test_999');
      expect(secured.account_id).toBe('acc_test_999');
      expect(secured.name).toBe('Susanta');
    });
  });
});
