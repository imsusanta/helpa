/**
 * src/tests/core-ai.test.ts
 *
 * Comprehensive Test Suite for Helpa Core AI Engine (Phase 5).
 * Verifies:
 * - OpenRouter & AI Provider abstraction
 * - Dynamic Industry AI Role Resolution (Health, Coaching, Tutor, Salon, Real Estate)
 * - Layered Context Builder (Core + Industry + KB + Memory)
 * - Tool Registry (READ vs WRITE tools & industry scoping)
 * - Emergency safety screening & Human Handoff
 * - Strict Multi-Tenant Isolation (zero cross-tenant KB/memory leaks)
 * - Copilot Suggestions & Conversation Summary
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OpenRouterAiProvider,
  setAiProvider,
  buildAiContextBundle,
  aiToolRegistry,
  executeAiPipeline,
  generateCopilotSuggestions,
} from '@/core/ai';
import * as appwriteCompat from '@/lib/db/server';
import { coreEvents } from '@/core/events';

describe('Helpa Core AI Engine', () => {
  const tenantHealth = {
    id: 'acc-health-101',
    name: 'City Care Clinic',
    industry: 'health',
  };

  const tenantCoaching = {
    id: 'acc-coaching-202',
    name: 'Apex JEE Academy',
    industry: 'coaching',
  };

  const tenantTutor = {
    id: 'acc-tutor-303',
    name: 'Ananya Math Academy',
    industry: 'solo_teacher',
  };

  const tenantSalon = {
    id: 'acc-salon-404',
    name: 'Glow Studio Spa',
    industry: 'salon',
  };

  const tenantRealEstate = {
    id: 'acc-realestate-505',
    name: 'Skyline Luxury Realty',
    industry: 'real_estate',
  };

  let mockDatabase: {
    accounts: Array<Record<string, unknown>>;
    contacts: Array<Record<string, unknown>>;
    conversations: Array<Record<string, unknown>>;
    messages: Array<Record<string, unknown>>;
    knowledge_base: Array<Record<string, unknown>>;
    appointments: Array<Record<string, unknown>>;
  };

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    process.env.ORCAROUTER_API_KEY = 'test-orcarouter-key';
    process.env.CLOUDFLARE_API_TOKEN = 'test-cloudflare-token';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-cloudflare-account';

    mockDatabase = {
      accounts: [
        {
          id: tenantHealth.id,
          name: tenantHealth.name,
          industry: tenantHealth.industry,
        },
        {
          id: tenantCoaching.id,
          name: tenantCoaching.name,
          industry: tenantCoaching.industry,
        },
        {
          id: tenantTutor.id,
          name: tenantTutor.name,
          industry: tenantTutor.industry,
        },
        {
          id: tenantSalon.id,
          name: tenantSalon.name,
          industry: tenantSalon.industry,
        },
        {
          id: tenantRealEstate.id,
          name: tenantRealEstate.name,
          industry: tenantRealEstate.industry,
        },
      ],
      contacts: [
        {
          id: 'contact-h1',
          account_id: tenantHealth.id,
          name: 'Amit Paul',
          phone: '+919876543210',
          notes: 'Frequent cardiac patient',
        },
        {
          id: 'contact-c1',
          account_id: tenantCoaching.id,
          name: 'Pooja Sen',
          phone: '+919123456780',
          notes: 'Interested in Class 11 Foundation',
        },
      ],
      conversations: [
        {
          id: 'conv-h1',
          account_id: tenantHealth.id,
          contact_id: 'contact-h1',
          ai_chat_enabled: true,
          needs_human: false,
        },
        {
          id: 'conv-c1',
          account_id: tenantCoaching.id,
          contact_id: 'contact-c1',
          ai_chat_enabled: true,
          needs_human: false,
        },
      ],
      messages: [
        {
          id: 'msg-h1',
          conversation_id: 'conv-h1',
          sender_type: 'user',
          content_text: 'What time is Dr. Sen available?',
          created_at: '2026-08-16T10:00:00.000Z',
        },
        {
          id: 'msg-c1',
          conversation_id: 'conv-c1',
          sender_type: 'user',
          content_text: 'What is the fee for NEET batch?',
          created_at: '2026-08-16T10:00:00.000Z',
        },
      ],
      knowledge_base: [
        {
          id: 'kb-h1',
          account_id: tenantHealth.id,
          question_title: 'Doctor consultation timing',
          answer_content: 'Dr. Sen is available Mon-Fri from 4 PM to 7 PM.',
          category: 'Doctors',
        },
        {
          id: 'kb-c1',
          account_id: tenantCoaching.id,
          question_title: 'NEET Foundation Fees',
          answer_content:
            'NEET 1-year course fee is ₹45,000 payable in 3 installments.',
          category: 'Admissions',
        },
      ],
      appointments: [],
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

  describe('Dynamic Industry AI Role Resolution', () => {
    it('resolves Health to AI Receptionist', async () => {
      const bundle = await buildAiContextBundle({
        accountId: tenantHealth.id,
        conversationId: 'conv-h1',
        contactId: 'contact-h1',
      });
      expect(bundle.role).toMatch(/AI (Hospital )?Receptionist/);
      expect(bundle.industry).toBe('health');
      expect(bundle.systemPrompt).toMatch(/ROLE: AI (Hospital )?Receptionist/);
    });

    it('resolves Coaching to AI Admission Assistant', async () => {
      const bundle = await buildAiContextBundle({
        accountId: tenantCoaching.id,
        conversationId: 'conv-c1',
        contactId: 'contact-c1',
      });
      expect(bundle.role).toBe('AI Admission Assistant');
      expect(bundle.industry).toBe('coaching');
      expect(bundle.systemPrompt).toContain('ROLE: AI Admission Assistant');
    });

    it('resolves Solo Tutor to AI Teaching Assistant', async () => {
      const bundle = await buildAiContextBundle({
        accountId: tenantTutor.id,
        conversationId: 'conv-t1',
        contactId: 'contact-t1',
      });
      expect(bundle.role).toBe('AI Teaching Assistant');
      expect(bundle.industry).toBe('solo_teacher');
    });

    it('resolves Salon to AI Receptionist', async () => {
      const bundle = await buildAiContextBundle({
        accountId: tenantSalon.id,
        conversationId: 'conv-s1',
        contactId: 'contact-s1',
      });
      expect(bundle.role).toMatch(/AI (Salon )?Receptionist/);
      expect(bundle.industry).toBe('salon');
    });

    it('resolves Real Estate to AI Property Assistant', async () => {
      const bundle = await buildAiContextBundle({
        accountId: tenantRealEstate.id,
        conversationId: 'conv-r1',
        contactId: 'contact-r1',
      });
      expect(bundle.role).toBe('AI Property Assistant');
      expect(bundle.industry).toBe('real_estate');
    });
  });

  describe('Strict Multi-Tenant Isolation', () => {
    it('prevents Health AI from retrieving Coaching Knowledge Base', async () => {
      const healthBundle = await buildAiContextBundle({
        accountId: tenantHealth.id,
        conversationId: 'conv-h1',
        contactId: 'contact-h1',
      });

      expect(healthBundle.knowledgeSnippets.length).toBe(1);
      expect(healthBundle.knowledgeSnippets[0]).toContain('Dr. Sen');
      expect(healthBundle.knowledgeSnippets[0]).not.toContain(
        'NEET 1-year course fee'
      );
    });

    it('prevents Coaching AI from retrieving Health Knowledge Base', async () => {
      const coachingBundle = await buildAiContextBundle({
        accountId: tenantCoaching.id,
        conversationId: 'conv-c1',
        contactId: 'contact-c1',
      });

      expect(coachingBundle.knowledgeSnippets.length).toBe(1);
      expect(coachingBundle.knowledgeSnippets[0]).toContain(
        'NEET 1-year course fee'
      );
      expect(coachingBundle.knowledgeSnippets[0]).not.toContain('Dr. Sen');
    });
  });

  describe('AI Tool Registry & Scoping', () => {
    it('scopes searchProperties tool exclusively to Real Estate', () => {
      const realEstateTools = aiToolRegistry.getToolsForIndustry('real_estate');
      const healthTools = aiToolRegistry.getToolsForIndustry('health');

      expect(realEstateTools.some((t) => t.name === 'searchProperties')).toBe(
        true
      );
      expect(healthTools.some((t) => t.name === 'searchProperties')).toBe(
        false
      );
    });

    it('executes createAppointment WRITE tool cleanly with validated parameters', async () => {
      const tool = aiToolRegistry.get('createAppointment');
      expect(tool).toBeDefined();

      const result = await tool!.execute(
        {
          appointmentDate: '2026-08-20',
          appointmentTime: '11:00 AM',
          doctorOrServiceName: 'Dr. Sen Cardiac Checkup',
        },
        {
          accountId: tenantHealth.id,
          userId: 'user-1',
          conversationId: 'conv-h1',
          contactId: 'contact-h1',
        }
      );

      expect(result.success).toBe(true);
      expect(mockDatabase.appointments.length).toBe(1);
      expect(mockDatabase.appointments[0].appointment_date).toBe('2026-08-20');
      expect(mockDatabase.appointments[0].notes).toContain(
        'Dr. Sen Cardiac Checkup'
      );
    });
  });

  describe('Emergency Safety Pre-screening & Human Handoff', () => {
    it('immediately escalates medical emergency queries to emergency care and pauses AI', async () => {
      const result = await executeAiPipeline({
        context: {
          accountId: tenantHealth.id,
          userId: 'user-1',
          conversationId: 'conv-h1',
          contactId: 'contact-h1',
        },
        userMessage: 'Patient is having severe chest pain and cannot breathe!',
      });

      expect(result.needsHumanHandoff).toBe(true);
      expect(result.replyText).toContain('medical emergency');
      expect(result.replyText).toContain('108 or 112');

      // Verify conversation marked for human takeover
      const conv = mockDatabase.conversations.find((c) => c.id === 'conv-h1');
      expect(conv?.needs_human).toBe(true);
      expect(conv?.ai_chat_enabled).toBe(false);
    });
  });

  describe('AI Pipeline Execution & Provider Completion', () => {
    it('executes pipeline with custom mock provider and emits ai.replied event', async () => {
      class MockProvider {
        name = 'mock-provider';
        async generateCompletion() {
          return {
            content:
              'Dr. Sen is available Mon-Fri 4 PM - 7 PM. Would you like me to book a slot?',
            model: 'mock-llama-3',
            promptTokens: 120,
            completionTokens: 30,
            totalTokens: 150,
          };
        }
      }

      setAiProvider(new MockProvider() as unknown as OpenRouterAiProvider);

      const eventSpy = vi.fn();
      coreEvents.on('ai.replied', eventSpy);

      const result = await executeAiPipeline({
        context: {
          accountId: tenantHealth.id,
          userId: 'user-1',
          conversationId: 'conv-h1',
          contactId: 'contact-h1',
        },
        userMessage: 'What time can I meet Dr. Sen?',
      });

      expect(result.replyText).toContain('Dr. Sen is available Mon-Fri');
      expect(result.role).toMatch(/AI (Hospital )?Receptionist/);
      expect(result.tokensUsed?.totalTokens).toBe(150);

      // Verify event was emitted
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: tenantHealth.id,
          type: 'ai.replied',
          payload: expect.objectContaining({
            role: result.role,
            model: 'mock-llama-3',
          }),
        })
      );
    });
  });

  describe('Conversation Summary & Copilot Suggestions', () => {
    it('generates structured Copilot suggestions for human staff', async () => {
      class MockCopilotProvider {
        name = 'mock-copilot';
        async generateCompletion() {
          return {
            content: JSON.stringify({
              summary: 'Customer inquiring about Dr. Sen consultation timings.',
              intent: 'Booking Enquiry',
              suggestedReply:
                'Dr. Sen is available today at 4:00 PM. Shall I book an appointment?',
              suggestedAction: {
                label: 'Book Appointment',
                actionType: 'create_appointment',
              },
            }),
            model: 'mock-llama-3',
          };
        }
      }

      setAiProvider(
        new MockCopilotProvider() as unknown as OpenRouterAiProvider
      );

      const copilot = await generateCopilotSuggestions({
        context: {
          accountId: tenantHealth.id,
          userId: 'user-1',
          conversationId: 'conv-h1',
          contactId: 'contact-h1',
        },
      });

      expect(copilot.intent).toBe('Booking Enquiry');
      expect(copilot.suggestedReply).toContain(
        'Dr. Sen is available today at 4:00 PM'
      );
      expect(copilot.suggestedAction?.label).toBe('Book Appointment');
    });
  });

  describe('Health AI Tools & Follow-Up Execution', () => {
    it('executes checkDoctorAvailability tool and returns slots', async () => {
      const tool = aiToolRegistry.get('checkDoctorAvailability');
      expect(tool).toBeDefined();

      const result = await tool!.execute(
        { doctorName: 'Dr. Sen', date: '2026-08-20' },
        {
          accountId: tenantHealth.id,
          userId: 'user-1',
          conversationId: 'conv-h1',
          contactId: 'contact-h1',
        }
      );

      expect(result.success).toBe(true);
      const data = result.data as { doctor: string; availableSlots: string[] };
      expect(data.doctor).toBe('Dr. Sen');
      expect(data.availableSlots.length).toBeGreaterThan(0);
    });

    it('executes createFollowUp tool and records staff reminder note', async () => {
      const tool = aiToolRegistry.get('createFollowUp');
      expect(tool).toBeDefined();

      const result = await tool!.execute(
        {
          followUpDate: '2026-08-22',
          note: 'Confirm blood test report with patient',
        },
        {
          accountId: tenantHealth.id,
          userId: 'user-1',
          conversationId: 'conv-h1',
          contactId: 'contact-h1',
        }
      );

      expect(result.success).toBe(true);
      const data = result.data as { status: string; followUpDate: string };
      expect(data.status).toBe('Scheduled');
      expect(data.followUpDate).toBe('2026-08-22');
    });

    it('executes handoffToHuman tool and pauses AI automation for the thread', async () => {
      const tool = aiToolRegistry.get('handoffToHuman');
      expect(tool).toBeDefined();

      const result = await tool!.execute(
        { reason: 'Patient requested human doctor' },
        {
          accountId: tenantHealth.id,
          userId: 'user-1',
          conversationId: 'conv-h1',
          contactId: 'contact-h1',
        }
      );

      expect(result.success).toBe(true);
      const conv = mockDatabase.conversations.find((c) => c.id === 'conv-h1');
      expect(conv?.needs_human).toBe(true);
      expect(conv?.ai_chat_enabled).toBe(false);
    });
  });
});
