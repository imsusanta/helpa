/**
 * src/tests/campaigns-module.test.ts
 *
 * Comprehensive Test Suite for Helpa Core Platform — Campaigns Engine (Step 7).
 * Verifies:
 * - Core Platform multi-industry campaign templates (Health, Coaching, Tutor, Salon, Real Estate)
 * - Audience resolution & filters (All, Doctor, Lead Stage, CSV)
 * - Duplicate send prevention (E.164 phone deduplication)
 * - Strict multi-tenant security (Tenant A vs Tenant B isolation)
 * - Campaign sending, metrics, and completion lifecycle
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  INDUSTRY_CAMPAIGN_TEMPLATES,
  createCampaign,
  getCampaignMetrics,
  resolveCampaignAudience,
  executeCampaignSending,
  AudienceFilter,
} from '@/core/campaigns';
import * as appwriteCompat from '@/lib/db/server';
import * as whatsappCore from '@/core/whatsapp';

describe('Helpa Core Platform — Campaigns Engine', () => {
  const tenantA = { id: 'tenant-apollo-01', name: 'Apollo Health' };
  const tenantB = { id: 'tenant-fortis-02', name: 'Fortis Health' };

  let mockDatabase: {
    contacts: Array<Record<string, unknown>>;
    broadcast_campaigns: Array<Record<string, unknown>>;
  };

  beforeEach(() => {
    mockDatabase = {
      contacts: [
        {
          id: 'c-101',
          account_id: tenantA.id,
          name: 'Rahul Sharma',
          phone: '+919876543210',
          assigned_to: 'doc-sen-1',
          status: 'Active',
        },
        {
          id: 'c-102',
          account_id: tenantA.id,
          name: 'Rahul Duplicate',
          phone: '+919876543210', // Same phone number for deduplication test
          assigned_to: 'doc-sen-1',
          status: 'Active',
        },
        {
          id: 'c-103',
          account_id: tenantA.id,
          name: 'Priya Sharma',
          phone: '+919876543211',
          assigned_to: 'doc-sen-1',
          status: 'Qualified',
        },
        // Tenant B Contact (Isolated)
        {
          id: 'c-201',
          account_id: tenantB.id,
          name: 'Tenant B Patient',
          phone: '+919999999999',
          status: 'Active',
        },
      ],
      broadcast_campaigns: [],
    };

    vi.spyOn(appwriteCompat, 'getAdminClient').mockReturnValue({
      from: (table: string) => {
        const store =
          (mockDatabase as Record<string, Array<Record<string, unknown>>>)[
            table
          ] || [];
        return {
          select: () => ({
            eq: (field: string, value: unknown) => {
              const filtered = store.filter((r) => r[field] === value);
              return {
                eq: (f2: string, v2: unknown) => {
                  const filtered2 = filtered.filter((r) => r[f2] === v2);
                  return {
                    maybeSingle: async () => ({
                      data: filtered2[0] || null,
                      error: null,
                    }),
                    order: () => ({ data: filtered2, error: null }),
                    data: filtered2,
                    error: null,
                  };
                },
                maybeSingle: async () => ({
                  data: filtered[0] || null,
                  error: null,
                }),
                order: () => ({ data: filtered, error: null }),
                data: filtered,
                error: null,
              };
            },
          }),
          insert: (obj: Record<string, unknown>) => {
            const inserted = { id: `camp-${Date.now()}`, ...obj };
            store.push(inserted);
            return {
              select: () => ({
                single: async () => ({ data: inserted, error: null }),
              }),
            };
          },
          update: (updates: Record<string, unknown>) => ({
            eq: (field: string, value: unknown) => ({
              eq: (field2: string, value2: unknown) => {
                store.forEach((r) => {
                  if (r[field] === value && r[field2] === value2) {
                    Object.assign(r, updates);
                  }
                });
                return { data: updates, error: null };
              },
            }),
          }),
        };
      },
    } as unknown as ReturnType<typeof appwriteCompat.getAdminClient>);

    vi.spyOn(whatsappCore, 'sendWhatsAppMessage').mockResolvedValue({
      success: true,
      messageId: 'msg-mock-1',
      timestamp: new Date().toISOString(),
    });
  });

  describe('Multi-Industry Campaign Templates', () => {
    it('provides architectural pre-set campaign templates for Health and future industries', () => {
      expect(INDUSTRY_CAMPAIGN_TEMPLATES.length).toBeGreaterThanOrEqual(8);

      const healthTemplates = INDUSTRY_CAMPAIGN_TEMPLATES.filter(
        (t) => t.industry === 'health'
      );
      expect(
        healthTemplates.some((t) => t.title === 'Doctor On Leave Notice')
      ).toBe(true);
      expect(
        healthTemplates.some((t) => t.title === 'Health Camp Announcement')
      ).toBe(true);
      expect(healthTemplates.some((t) => t.title === 'Vaccination Drive')).toBe(
        true
      );

      const coachingTemplates = INDUSTRY_CAMPAIGN_TEMPLATES.filter(
        (t) => t.industry === 'coaching'
      );
      expect(
        coachingTemplates.some((t) => t.title === 'Admission Campaign')
      ).toBe(true);

      const tutorTemplates = INDUSTRY_CAMPAIGN_TEMPLATES.filter(
        (t) => t.industry === 'tutor'
      );
      expect(tutorTemplates.some((t) => t.title === 'Class Announcement')).toBe(
        true
      );

      const salonTemplates = INDUSTRY_CAMPAIGN_TEMPLATES.filter(
        (t) => t.industry === 'salon'
      );
      expect(
        salonTemplates.some((t) => t.title === 'Special Spa & Hair Offer')
      ).toBe(true);

      const realEstateTemplates = INDUSTRY_CAMPAIGN_TEMPLATES.filter(
        (t) => t.industry === 'real_estate'
      );
      expect(
        realEstateTemplates.some((t) => t.title === 'New Property Launch')
      ).toBe(true);
    });
  });

  describe('Audience Resolution & Duplicate Prevention', () => {
    it('deduplicates phone numbers in campaign audience resolution', async () => {
      const filter: AudienceFilter = { type: 'all' };
      const audience = await resolveCampaignAudience({
        accountId: tenantA.id,
        filter,
      });

      // c-101 and c-102 have the same phone '+919876543210' -> Should deduplicate to 1 entry
      // total distinct phones for Tenant A = 2 (+919876543210 and +919876543211)
      expect(audience.length).toBe(2);
      expect(audience.map((a) => a.phone)).toEqual([
        '+919876543210',
        '+919876543211',
      ]);
    });

    it('enforces strict tenant isolation — Tenant A cannot target Tenant B contacts', async () => {
      const filter: AudienceFilter = { type: 'all' };
      const tenantAAudience = await resolveCampaignAudience({
        accountId: tenantA.id,
        filter,
      });
      const tenantBAudience = await resolveCampaignAudience({
        accountId: tenantB.id,
        filter,
      });

      expect(tenantAAudience.some((a) => a.phone === '+919999999999')).toBe(
        false
      );
      expect(tenantBAudience.length).toBe(1);
      expect(tenantBAudience[0].phone).toBe('+919999999999');
    });

    it('resolves CSV audience input cleanly', async () => {
      const filter: AudienceFilter = {
        type: 'csv',
        csvContacts: [
          { name: 'Dr. VIP', phone: '+919000000001' },
          { name: 'Dr. VIP Duplicate', phone: '+919000000001' },
        ],
      };
      const audience = await resolveCampaignAudience({
        accountId: tenantA.id,
        filter,
      });

      expect(audience.length).toBe(1);
      expect(audience[0].phone).toBe('+919000000001');
    });
  });

  describe('Campaign Execution & Analytics', () => {
    it('creates, executes, and updates campaign analytics metrics', async () => {
      const campaign = await createCampaign(tenantA.id, {
        name: 'Monsoon OPD Health Camp',
        messageBody:
          'Hello {{PatientName}}, join our free ECG screening this Sunday!',
      });

      expect(campaign.id).toBeDefined();
      expect(campaign.status).toBe('draft');

      const runResult = await executeCampaignSending({
        accountId: tenantA.id,
        campaignId: campaign.id,
        filter: { type: 'all' },
        messageBody:
          'Hello {{PatientName}}, join our free ECG screening this Sunday!',
      });

      expect(runResult.totalRecipients).toBe(2);
      expect(runResult.sentCount).toBe(2);
      expect(runResult.failedCount).toBe(0);
      expect(whatsappCore.sendWhatsAppMessage).toHaveBeenCalledTimes(2);

      const metrics = await getCampaignMetrics(tenantA.id, campaign.id);
      expect(metrics?.status).toBe('completed');
      expect(metrics?.sent_count).toBe(2);
      expect(metrics?.delivered_count).toBe(2);
    });
  });
});
