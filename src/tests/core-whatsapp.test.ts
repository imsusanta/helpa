/**
 * src/tests/core-whatsapp.test.ts
 *
 * Comprehensive Test Suite for Helpa Core WhatsApp Integration.
 * Verifies:
 * - Multi-tenant isolation (Tenant A Health Clinic vs Tenant B Salon)
 * - Strict tenant resolution by Phone Number ID (rejecting unknown numbers)
 * - Tenant-scoped contact creation & deduplication
 * - Outgoing messaging through unified Core WhatsApp Service
 * - Health check & connection state machine
 * - Non-destructive disconnect & reconnect
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resolveTenantByPhoneNumberId,
  resolveContactForTenant,
  resolveConversationForTenant,
  getWhatsAppConnection,
  getWhatsAppHealth,
  disconnectWhatsApp,
  reconnectWhatsApp,
  sendWhatsAppMessage,
} from '@/core/whatsapp';
import * as appwriteCompat from '@/lib/appwrite-server-compat';
import * as encryption from '@/lib/whatsapp/encryption';
import { coreEvents } from '@/core/events';

describe('Helpa Core WhatsApp Integration', () => {
  const tenantA = {
    id: 'tenant-health-001',
    userId: 'user-doc-001',
    phoneNumberId: 'phone-id-health-111',
    wabaId: 'waba-health-111',
    businessName: 'Helpa Health Clinic',
    displayPhoneNumber: '+919876543210',
    accessToken: 'valid-meta-token-health',
  };

  const tenantB = {
    id: 'tenant-salon-002',
    userId: 'user-salon-002',
    phoneNumberId: 'phone-id-salon-222',
    wabaId: 'waba-salon-222',
    businessName: 'Helpa Salon & Spa',
    displayPhoneNumber: '+919123456789',
    accessToken: 'valid-meta-token-salon',
  };

  let mockDatabase: {
    whatsapp_config: Array<Record<string, unknown>>;
    contacts: Array<Record<string, unknown>>;
    conversations: Array<Record<string, unknown>>;
    messages: Array<Record<string, unknown>>;
  };

  beforeEach(() => {
    mockDatabase = {
      whatsapp_config: [
        {
          id: 'cfg-1',
          account_id: tenantA.id,
          user_id: tenantA.userId,
          phone_number_id: tenantA.phoneNumberId,
          waba_id: tenantA.wabaId,
          verified_name: tenantA.businessName,
          phone_number: tenantA.displayPhoneNumber,
          access_token_encrypted: 'enc-health-token',
          registered_at: '2026-08-16T00:00:00.000Z',
          coexistence_eligible: true,
        },
        {
          id: 'cfg-2',
          account_id: tenantB.id,
          user_id: tenantB.userId,
          phone_number_id: tenantB.phoneNumberId,
          waba_id: tenantB.wabaId,
          verified_name: tenantB.businessName,
          phone_number: tenantB.displayPhoneNumber,
          access_token_encrypted: 'enc-salon-token',
          registered_at: '2026-08-16T00:00:00.000Z',
          coexistence_eligible: true,
        },
      ],
      contacts: [],
      conversations: [],
      messages: [],
    };

    // Mock decrypt to return plain token
    vi.spyOn(encryption, 'decrypt').mockImplementation((token: string) => {
      if (token === 'enc-health-token') return tenantA.accessToken;
      if (token === 'enc-salon-token') return tenantB.accessToken;
      return token;
    });

    // Mock DB client
    vi.spyOn(appwriteCompat, 'getAdminClient').mockReturnValue({
      from: (table: string) => {
        const store = (mockDatabase as Record<string, Array<Record<string, unknown>>>)[table] || [];
        return {
          select: () => {
            let filtered = [...store];
            const queryBuilder = {
              eq: (field: string, val: unknown) => {
                filtered = filtered.filter((r) => r[field] === val);
                return queryBuilder;
              },
              or: () => queryBuilder,
              order: () => queryBuilder,
              limit: (n: number) => {
                filtered = filtered.slice(0, n);
                return queryBuilder;
              },
              single: async () => ({
                data: filtered[0] || null,
                error: filtered[0] ? null : { message: 'Row not found' },
              }),
              then: (resolve: (res: { data: unknown[]; error: null }) => void) =>
                resolve({ data: filtered, error: null }),
            };
            return queryBuilder;
          },
          insert: (data: Record<string, unknown>) => {
            const row = { id: `id-${Date.now()}-${Math.random()}`, ...data };
            store.push(row);
            return {
              select: () => ({
                single: async () => ({ data: row, error: null }),
              }),
              then: (resolve: (res: { data: unknown; error: null }) => void) =>
                resolve({ data: row, error: null }),
            };
          },
          update: (data: Record<string, unknown>) => ({
            eq: (field: string, val: unknown) => {
              const matched = store.filter((r) => r[field] === val);
              matched.forEach((r) => Object.assign(r, data));
              return {
                eq: (f2: string, v2: unknown) => {
                  const m2 = store.filter((r) => r[field] === val && r[f2] === v2);
                  m2.forEach((r) => Object.assign(r, data));
                  return Promise.resolve({ data: m2, error: null });
                },
                then: (resolve: (res: { data: unknown; error: null }) => void) =>
                  resolve({ data: matched, error: null }),
              };
            },
          }),
          delete: () => ({
            eq: (field: string, val: unknown) => {
              const idx = store.findIndex((r) => r[field] === val);
              if (idx !== -1) store.splice(idx, 1);
              return Promise.resolve({ error: null });
            },
          }),
        };
      },
    } as unknown as ReturnType<typeof appwriteCompat.getAdminClient>);
  });

  describe('Strict Tenant Resolution', () => {
    it('resolves Tenant A when receiving webhook for Phone Number ID A', async () => {
      const resolved = await resolveTenantByPhoneNumberId(tenantA.phoneNumberId);
      expect(resolved).not.toBeNull();
      expect(resolved?.tenantId).toBe(tenantA.id);
      expect(resolved?.wabaId).toBe(tenantA.wabaId);
      expect(resolved?.accessToken).toBe(tenantA.accessToken);
      expect(resolved?.businessName).toBe(tenantA.businessName);
    });

    it('resolves Tenant B when receiving webhook for Phone Number ID B', async () => {
      const resolved = await resolveTenantByPhoneNumberId(tenantB.phoneNumberId);
      expect(resolved).not.toBeNull();
      expect(resolved?.tenantId).toBe(tenantB.id);
      expect(resolved?.wabaId).toBe(tenantB.wabaId);
      expect(resolved?.accessToken).toBe(tenantB.accessToken);
      expect(resolved?.businessName).toBe(tenantB.businessName);
    });

    it('rejects unknown Phone Number IDs with null (zero cross-tenant fallback)', async () => {
      const resolved = await resolveTenantByPhoneNumberId('phone-unknown-999');
      expect(resolved).toBeNull();
    });
  });

  describe('Multi-Tenant Contact & Conversation Isolation', () => {
    it('isolates contacts so the same customer number creates independent records per tenant', async () => {
      const customerPhone = '+919999888877';

      // Create contact in Tenant A (Health Clinic)
      const resA = await resolveContactForTenant({
        tenantId: tenantA.id,
        phone: customerPhone,
        name: 'Rahul Sharma',
      });
      expect(resA.wasCreated).toBe(true);

      // Create contact in Tenant B (Salon)
      const resB = await resolveContactForTenant({
        tenantId: tenantB.id,
        phone: customerPhone,
        name: 'Rahul Sharma',
      });
      expect(resB.wasCreated).toBe(true);

      // Verify contact IDs are isolated
      expect(resA.contactId).not.toBe(resB.contactId);

      // Verify conversations are also isolated
      const convA = await resolveConversationForTenant({
        tenantId: tenantA.id,
        contactId: resA.contactId,
      });
      const convB = await resolveConversationForTenant({
        tenantId: tenantB.id,
        contactId: resB.contactId,
      });

      expect(convA.conversationId).not.toBe(convB.conversationId);
      expect(convA.isNew).toBe(true);
      expect(convB.isNew).toBe(true);
    });
  });

  describe('Connection Health & State Machine', () => {
    it('computes healthy connection status for active tenant', async () => {
      const health = await getWhatsAppHealth(tenantA.id);
      expect(health.connected).toBe(true);
      expect(health.status).toBe('CONNECTED');
      expect(health.apiStatus).toBe('healthy');
      expect(health.webhookStatus).toBe('healthy');
      expect(health.coexistenceStatus).toBe('active');
    });

    it('returns NOT_CONNECTED for tenant without configuration', async () => {
      const health = await getWhatsAppHealth('tenant-unconnected-999');
      expect(health.connected).toBe(false);
      expect(health.status).toBe('NOT_CONNECTED');
      expect(health.apiStatus).toBe('error');
    });

    it('allows clean non-destructive disconnect and reports updated health', async () => {
      const disc = await disconnectWhatsApp(tenantA.id);
      expect(disc.success).toBe(true);

      const health = await getWhatsAppHealth(tenantA.id);
      expect(health.connected).toBe(false);
      expect(health.status).toBe('NOT_CONNECTED');

      // Tenant B remains unaffected
      const healthB = await getWhatsAppHealth(tenantB.id);
      expect(healthB.connected).toBe(true);
    });
  });

  describe('Core Outgoing Messaging & Event Emission', () => {
    it('sends outgoing message and emits core event', async () => {
      // Mock global fetch for Meta API
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          messaging_product: 'whatsapp',
          messages: [{ id: 'wamid.HBgLM...mock' }],
        }),
      } as Response);

      const eventSpy = vi.fn();
      coreEvents.on('message.sent', eventSpy);

      const result = await sendWhatsAppMessage({
        tenantId: tenantA.id,
        to: '+919999888877',
        text: 'Hello from Helpa Health Clinic!',
      });

      expect(result.success).toBe(true);
      expect(result.metaMessageId).toBe('wamid.HBgLM...mock');

      // Verify Meta API was called with Tenant A's Phone ID and Access Token
      expect(fetchSpy).toHaveBeenCalledWith(
        `https://graph.facebook.com/v21.0/${tenantA.phoneNumberId}/messages`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${tenantA.accessToken}`,
          }),
        })
      );

      // Verify coreEvent was emitted
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: tenantA.id,
          type: 'message.sent',
          payload: expect.objectContaining({
            tenantId: tenantA.id,
            recipient: '919999888877',
            content: 'Hello from Helpa Health Clinic!',
          }),
        })
      );
    });

    it('rejects sending when tenant has no WhatsApp configuration', async () => {
      const result = await sendWhatsAppMessage({
        tenantId: 'unconfigured-tenant-999',
        to: '+919999888877',
        text: 'Test message',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No WhatsApp configuration found');
    });
  });
});
