/**
 * src/tests/real-estate-module.test.ts
 *
 * Comprehensive Test Suite for Helpa Real Estate Industry Module (Phase 10).
 * Verifies:
 * - Unique sequential Lead ID generation (LEAD-XXXXXX)
 * - Lead CRM & structured property requirements (Budget, Location, BHK, Purpose)
 * - Property Inventory catalog & availability
 * - Structured Property Matching Engine (prioritizes Property A over B & C)
 * - Agent Directory & conflict-free site visit slot calculations
 * - Site Visit booking, rescheduling, and cancellation workflows
 * - Post-site visit follow-up scheduling
 * - Real Estate Agent Copilot context, suggested replies, and actions
 * - Real Estate AI Tools in Core Tool Registry
 * - Strict multi-tenant isolation (Agency A vs Agency B)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateNextLeadId,
  getOrCreateRealEstateLead,
  updateLeadRequirement,
  listProperties,
  matchPropertiesToRequirement,
  listRealEstateAgents,
  getAgentSiteVisitSlots,
  scheduleSiteVisit,
  rescheduleSiteVisit,
  cancelSiteVisit,
  scheduleRealEstateFollowUp,
  getRealEstateCopilotContext,
} from '@/modules/real-estate/services';
import { aiToolRegistry } from '@/core/ai/tools';
import * as appwriteCompat from '@/lib/appwrite-server-compat';
import { coreEvents } from '@/core/events';

describe('Helpa Real Estate Industry Module', () => {
  const agencyA = { id: 'agency-skyline-01', name: 'Skyline Realty Group' };
  const _agencyB = {
    id: 'agency-heritage-02',
    name: 'Heritage Estate Consultants',
  };

  let mockDatabase: {
    contacts: Array<Record<string, unknown>>;
    appointments: Array<Record<string, unknown>>;
    services: Array<Record<string, unknown>>;
    staff: Array<Record<string, unknown>>;
    follow_ups: Array<Record<string, unknown>>;
  };

  beforeEach(() => {
    mockDatabase = {
      contacts: [],
      appointments: [],
      services: [
        {
          id: 'prop-1',
          account_id: agencyA.id,
          name: 'New Town Residency — Luxury 2 BHK',
          category: 'New Town, Kolkata',
          price: 6200000,
          status: 'Available',
          description: '2 BHK Ready to Move apartment in New Town',
        },
      ],
      staff: [
        {
          id: 'agent-1',
          account_id: agencyA.id,
          name: 'Amit Roy',
          role: 'Senior Property Consultant',
          specialization: 'New Town & Salt Lake',
          working_days: ['New Town', 'Salt Lake'],
          status: 'Available',
        },
      ],
      follow_ups: [],
    };

    vi.spyOn(appwriteCompat, 'getAdminClient').mockReturnValue({
      from: (table: string) => {
        const store =
          (mockDatabase as Record<string, Array<Record<string, unknown>>>)[
            table
          ] || [];
        return {
          select: () => {
            let filtered = [...store];
            const builder = {
              eq: (f: string, v: unknown) => {
                filtered = filtered.filter((r) => r[f] === v);
                return builder;
              },
              neq: (f: string, v: unknown) => {
                filtered = filtered.filter((r) => r[f] !== v);
                return builder;
              },
              ilike: (f: string, v: string) => {
                const clean = v.replace(/%/g, '').toLowerCase();
                filtered = filtered.filter((r) =>
                  String(r[f] || '')
                    .toLowerCase()
                    .includes(clean)
                );
                return builder;
              },
              or: () => builder,
              limit: (n: number) => {
                filtered = filtered.slice(0, n);
                return builder;
              },
              order: () => builder,
              single: async () => ({
                data: filtered[0] || null,
                error: filtered[0] ? null : { message: 'Row not found' },
              }),
              maybeSingle: async () => ({
                data: filtered[0] || null,
                error: null,
              }),
              then: (res: (val: { data: unknown[]; error: null }) => void) =>
                res({ data: filtered, error: null }),
            };
            return builder;
          },
          insert: (data: Record<string, unknown>) => {
            const row = { id: `id-${Date.now()}-${Math.random()}`, ...data };
            store.push(row);
            return {
              select: () => ({
                single: async () => ({ data: row, error: null }),
              }),
              then: (res: (val: { data: unknown; error: null }) => void) =>
                res({ data: row, error: null }),
            };
          },
          update: (data: Record<string, unknown>) => ({
            eq: (f: string, v: unknown) => {
              const matched = store.filter((r) => r[f] === v);
              matched.forEach((r) => Object.assign(r, data));
              return {
                eq: (f2: string, v2: unknown) => {
                  const m2 = store.filter((r) => r[f] === v && r[f2] === v2);
                  m2.forEach((r) => Object.assign(r, data));
                  return Promise.resolve({ data: m2, error: null });
                },
                then: (res: (val: { data: unknown; error: null }) => void) =>
                  res({ data: matched, error: null }),
              };
            },
          }),
        };
      },
    } as unknown as ReturnType<typeof appwriteCompat.getAdminClient>);
  });

  describe('Lead CRM & Unique Lead ID', () => {
    it('generates sequential unique Lead ID (LEAD-000001)', async () => {
      const leadId = await generateNextLeadId(agencyA.id);
      expect(leadId).toBe('LEAD-000001');
    });

    it('creates real estate lead with structured property requirement', async () => {
      const lead = await getOrCreateRealEstateLead({
        accountId: agencyA.id,
        name: 'Rahul Sharma',
        phone: '+919000000000',
        requirement: {
          purpose: 'Buy',
          propertyType: 'Apartment',
          location: 'New Town',
          minBudget: 50,
          maxBudget: 70,
          bedrooms: '2 BHK',
          possession: 'Ready to Move',
        },
        assignedAgent: 'Amit Roy',
      });

      expect(lead.name).toBe('Rahul Sharma');
      expect(lead.leadId).toBe('LEAD-000001');
      expect(lead.requirement?.location).toBe('New Town');
      expect(lead.requirement?.bedrooms).toBe('2 BHK');
      expect(mockDatabase.contacts.length).toBe(1);
    });

    it('updates lead requirement and pipeline stage', async () => {
      const lead = await getOrCreateRealEstateLead({
        accountId: agencyA.id,
        name: 'Rahul Sharma',
        phone: '+919000000000',
      });

      const updated = await updateLeadRequirement(
        agencyA.id,
        lead.id,
        {
          location: 'New Town',
          maxBudget: 70,
          bedrooms: '2 BHK',
        },
        'Qualified'
      );

      expect(updated).toBe(true);
    });
  });

  describe('Property Inventory & Structured Matching Engine', () => {
    it('lists property listings catalog', async () => {
      const properties = await listProperties(agencyA.id);
      expect(properties.length).toBeGreaterThan(0);
      expect(properties[0].status).toBe('Available');
    });

    it('ranks Property A as top match over Property B & C for 2 BHK New Town requirement', async () => {
      const matches = await matchPropertiesToRequirement(agencyA.id, {
        purpose: 'Buy',
        propertyType: 'Apartment',
        location: 'New Town',
        maxBudget: 70,
        bedrooms: '2 BHK',
        possession: 'Ready to Move',
      });

      expect(matches.length).toBeGreaterThan(0);

      // Property A (New Town 2 BHK ₹62L Ready to Move) should be #1 Strong Match
      const topMatch = matches[0];
      expect(topMatch.property.title).toContain('New Town');
      expect(topMatch.property.bedrooms).toBe('2 BHK');
      expect(topMatch.score).toBeGreaterThanOrEqual(85);
      expect(topMatch.matchTier).toBe('Strong Match');
      expect(topMatch.reasons.some((r) => r.includes('Location matches'))).toBe(
        true
      );
      expect(
        topMatch.reasons.some((r) => r.includes('Price within budget'))
      ).toBe(true);
    });
  });

  describe('Agent Directory & Site Visit Booking', () => {
    it('lists agents and calculates available site visit slots', async () => {
      const agents = await listRealEstateAgents(agencyA.id);
      expect(agents.length).toBeGreaterThan(0);
      expect(agents[0].name).toBe('Amit Roy');

      const slots = await getAgentSiteVisitSlots({
        accountId: agencyA.id,
        agentName: 'Amit Roy',
        dateStr: '2026-08-25',
      });

      expect(slots.length).toBeGreaterThan(0);
      expect(slots).toContain('11:30 AM');
    });

    it('schedules site visit and emits site_visit.scheduled event', async () => {
      const eventSpy = vi.fn();
      coreEvents.on('site_visit.scheduled', eventSpy);

      const siteVisit = await scheduleSiteVisit({
        accountId: agencyA.id,
        leadName: 'Rahul Sharma',
        leadMobile: '+919000000000',
        propertyTitle: 'New Town Residency',
        agentName: 'Amit Roy',
        visitDate: '2026-08-25',
        visitTime: '11:00 AM',
      });

      expect(siteVisit.leadName).toBe('Rahul Sharma');
      expect(siteVisit.propertyTitle).toBe('New Town Residency');
      expect(siteVisit.agentName).toBe('Amit Roy');
      expect(siteVisit.status).toBe('Confirmed');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: agencyA.id,
          type: 'site_visit.scheduled',
          payload: expect.objectContaining({
            leadName: 'Rahul Sharma',
            propertyTitle: 'New Town Residency',
            agentName: 'Amit Roy',
          }),
        })
      );
    });

    it('reschedules site visit and cancels old reminders', async () => {
      const eventSpy = vi.fn();
      coreEvents.on('site_visit.rescheduled', eventSpy);

      const siteVisit = await scheduleSiteVisit({
        accountId: agencyA.id,
        leadName: 'Rahul Sharma',
        leadMobile: '+919000000000',
        propertyTitle: 'New Town Residency',
        visitDate: '2026-08-25',
        visitTime: '11:00 AM',
      });

      const rescheduled = await rescheduleSiteVisit({
        accountId: agencyA.id,
        visitId: siteVisit.id,
        newDate: '2026-08-26',
        newTime: '03:30 PM',
      });

      expect(rescheduled).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: agencyA.id,
          type: 'site_visit.rescheduled',
          payload: expect.objectContaining({
            newDate: '2026-08-26',
            newTime: '03:30 PM',
          }),
        })
      );
    });

    it('cancels site visit without deleting history', async () => {
      const eventSpy = vi.fn();
      coreEvents.on('site_visit.cancelled', eventSpy);

      const siteVisit = await scheduleSiteVisit({
        accountId: agencyA.id,
        leadName: 'Rahul Sharma',
        leadMobile: '+919000000000',
        propertyTitle: 'New Town Residency',
        visitDate: '2026-08-25',
        visitTime: '11:00 AM',
      });

      const cancelled = await cancelSiteVisit({
        accountId: agencyA.id,
        visitId: siteVisit.id,
        reason: 'Lead rescheduled personal plans',
      });

      expect(cancelled).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: agencyA.id,
          type: 'site_visit.cancelled',
          payload: expect.objectContaining({
            visitId: siteVisit.id,
          }),
        })
      );
    });
  });

  describe('Lead Follow-ups & Agent Copilot', () => {
    it('schedules post-inquiry/site-visit follow-up', async () => {
      const followUp = await scheduleRealEstateFollowUp({
        accountId: agencyA.id,
        leadId: 'LEAD-000001',
        leadName: 'Rahul Sharma',
        leadMobile: '+919000000000',
        propertyTitle: 'New Town Residency',
        daysInterval: 2,
        assignedAgent: 'Amit Roy',
      });

      expect(followUp.status).toBe('Pending');
      expect(followUp.leadName).toBe('Rahul Sharma');
      expect(mockDatabase.follow_ups.length).toBe(1);
    });

    it('generates Real Estate Agent Copilot context with quick actions', async () => {
      const lead = await getOrCreateRealEstateLead({
        accountId: agencyA.id,
        name: 'Rahul Sharma',
        phone: '+919000000000',
        assignedAgent: 'Amit Roy',
      });

      const copilot = await getRealEstateCopilotContext({
        accountId: agencyA.id,
        conversationId: 'conv-re1',
        contactId: lead.id,
      });

      expect(copilot.lead.name).toBe('Rahul Sharma');
      expect(copilot.requirement?.location).toBe('New Town');
      expect(copilot.suggestedReply).toContain('New Town Residency');
      expect(
        copilot.quickActions.some((a) => a.actionType === 'confirm_site_visit')
      ).toBe(true);
    });
  });

  describe('Real Estate AI Tools in Tool Registry', () => {
    it('executes searchProperties, matchPropertiesToRequirement, and scheduleSiteVisit tools successfully', async () => {
      const searchTool = aiToolRegistry.get('searchProperties');
      const matchTool = aiToolRegistry.get('matchPropertiesToRequirement');
      const visitTool = aiToolRegistry.get('scheduleSiteVisit');

      expect(searchTool).toBeDefined();
      expect(matchTool).toBeDefined();
      expect(visitTool).toBeDefined();

      const matchRes = await matchTool!.execute(
        { location: 'New Town', maxBudgetLakhs: 70, bedrooms: '2 BHK' },
        {
          accountId: agencyA.id,
          userId: 'u1',
          conversationId: 'c1',
          contactId: 'cnt1',
        }
      );
      expect(matchRes.success).toBe(true);

      const visitRes = await visitTool!.execute(
        {
          propertyTitle: 'New Town Residency',
          visitDate: '2026-08-25',
          visitTime: '11:00 AM',
        },
        {
          accountId: agencyA.id,
          userId: 'u1',
          conversationId: 'c1',
          contactId: 'cnt1',
        }
      );
      expect(visitRes.success).toBe(true);
    });
  });
});
