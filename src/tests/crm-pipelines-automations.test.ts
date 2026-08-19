import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hasPermission, assertPermission } from '@/core/permissions';
import { dispatchCrmEvent, coreEvents, type CoreEvent } from '@/core/events';

describe('CRM, Permissions & Event Bus Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RBAC & Granular Permission Matrix', () => {
    it('grants full access across CRM, flows, and settings to owner', () => {
      expect(hasPermission('owner', 'deals.read')).toBe(true);
      expect(hasPermission('owner', 'deals.write')).toBe(true);
      expect(hasPermission('owner', 'deals.delete')).toBe(true);
      expect(hasPermission('owner', 'pipelines.manage')).toBe(true);
      expect(hasPermission('owner', 'flows.create')).toBe(true);
      expect(hasPermission('owner', 'team.manage')).toBe(true);
      expect(hasPermission('owner', 'settings.manage')).toBe(true);
      expect(hasPermission('owner', 'billing.manage')).toBe(true);
    });

    it('grants administrative access to admin but restricts billing', () => {
      expect(hasPermission('admin', 'deals.read')).toBe(true);
      expect(hasPermission('admin', 'deals.write')).toBe(true);
      expect(hasPermission('admin', 'deals.delete')).toBe(true);
      expect(hasPermission('admin', 'pipelines.manage')).toBe(true);
      expect(hasPermission('admin', 'flows.create')).toBe(true);
      expect(hasPermission('admin', 'team.manage')).toBe(true);
      expect(hasPermission('admin', 'billing.manage')).toBe(false);
    });

    it('allows agents to read and write deals and contacts but not delete or manage pipelines', () => {
      expect(hasPermission('agent', 'contacts.read')).toBe(true);
      expect(hasPermission('agent', 'contacts.write')).toBe(true);
      expect(hasPermission('agent', 'deals.read')).toBe(true);
      expect(hasPermission('agent', 'deals.write')).toBe(true);
      expect(hasPermission('agent', 'deals.delete')).toBe(false);
      expect(hasPermission('agent', 'pipelines.manage')).toBe(false);
      expect(hasPermission('agent', 'team.manage')).toBe(false);
    });

    it('allows viewers read-only access to deals and contacts', () => {
      expect(hasPermission('viewer', 'contacts.read')).toBe(true);
      expect(hasPermission('viewer', 'deals.read')).toBe(true);
      expect(hasPermission('viewer', 'contacts.write')).toBe(false);
      expect(hasPermission('viewer', 'deals.write')).toBe(false);
      expect(hasPermission('viewer', 'deals.delete')).toBe(false);
    });

    it('assertPermission throws an error on forbidden actions', () => {
      expect(() => assertPermission('viewer', 'deals.write')).toThrow(
        /Permission denied/
      );
      expect(() => assertPermission('agent', 'deals.write')).not.toThrow();
    });
  });

  describe('Central CRM Event Dispatching', () => {
    it('emits deal.created and notifies subscribers', async () => {
      const received: CoreEvent[] = [];
      const unsubscribe = coreEvents.subscribe('deal.created', (event) => {
        received.push(event);
      });

      await dispatchCrmEvent({
        accountId: 'acc_tenant_1',
        eventType: 'deal.created',
        dealId: 'deal_123',
        contactId: 'contact_456',
        payload: { name: 'VIP Consultation', value: 500 },
      });

      expect(received.length).toBe(1);
      expect(received[0].accountId).toBe('acc_tenant_1');
      expect(received[0].type).toBe('deal.created');
      const payload = received[0].payload as Record<string, unknown>;
      expect(payload.dealId).toBe('deal_123');
      expect(payload.name).toBe('VIP Consultation');
      expect(payload.value).toBe(500);

      unsubscribe();
    });

    it('emits deal.stage_changed and deal.won transitions', async () => {
      const stageEvents: CoreEvent[] = [];
      const wonEvents: CoreEvent[] = [];

      const unsub1 = coreEvents.subscribe('deal.stage_changed', (evt) => {
        stageEvents.push(evt);
      });
      const unsub2 = coreEvents.subscribe('deal.won', (evt) => {
        wonEvents.push(evt);
      });

      await dispatchCrmEvent({
        accountId: 'acc_tenant_2',
        eventType: 'deal.stage_changed',
        dealId: 'deal_789',
        payload: { fromStage: 'stage_1', toStage: 'stage_2' },
      });

      await dispatchCrmEvent({
        accountId: 'acc_tenant_2',
        eventType: 'deal.won',
        dealId: 'deal_789',
        payload: { value: 1200 },
      });

      expect(stageEvents.length).toBe(1);
      expect(wonEvents.length).toBe(1);

      unsub1();
      unsub2();
    });
  });
});
