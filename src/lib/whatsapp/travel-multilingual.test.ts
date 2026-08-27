import { describe, expect, it, vi } from 'vitest';
import { travelModule } from '@/modules/travel';
import { TRAVEL_AI_SYSTEM_PROMPT } from '@/modules/travel/system-prompt';
import { aiToolRegistry } from '@/core/ai/tools';
import { buildAiContextBundle } from '@/core/ai/context-builder';

// Mock getAdminClient & appwriteAdmin for context-builder testing
const mockDb = {
  from: vi.fn((table: string) => {
    if (table === 'accounts') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'acc-travel-123',
            name: 'Himalayan Holidays',
            industry: 'travel',
            ai_system_prompt: 'Always offer tea when booking.',
            openrouter_model: 'openai/gpt-4o-mini',
          },
        }),
      };
    }
    if (table === 'travel_packages') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'pkg-1',
              name: 'Darjeeling Delight',
              destination: 'Darjeeling',
              duration_days: 4,
              price: 12500,
              description:
                'Toy train ride, Tiger Hill sunrise, 3-star hotel with breakfast',
            },
            {
              id: 'pkg-2',
              name: 'Kashmir Paradise',
              destination: 'Srinagar & Gulmarg',
              duration_days: 6,
              price: 24999,
              description:
                'Shikara ride on Dal Lake, Gondola pass, houseboat stay',
            },
          ],
        }),
      };
    }
    if (table === 'knowledge_base') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              question_title: 'Payment policy',
              answer_content: '50% advance to confirm, balance upon arrival.',
              category: 'payments',
            },
          ],
        }),
      };
    }
    if (table === 'conversations') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'conv-123',
            account_id: 'acc-travel-123',
            contact_id: 'ct-123',
          },
        }),
      };
    }
    if (table === 'contacts') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'ct-123', name: 'Amit Roy', phone: '+919876543210' },
        }),
      };
    }
    if (table === 'messages') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              sender_type: 'user',
              content_type: 'text',
              content_text: 'Darjeeling package price koto? Ami 2 jon jabo.',
              created_at: new Date().toISOString(),
            },
          ],
        }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [] }),
    };
  }),
};

vi.mock('@/lib/appwrite-server-compat', () => {
  return {
    getAdminClient: vi.fn(() => mockDb),
    appwriteAdmin: vi.fn(() => mockDb),
  };
});

describe('Travel Module & AI Receptionist', () => {
  it('has ACTIVE status and AI Travel Receptionist role configured', () => {
    expect(travelModule.status).toBe('ACTIVE');
    expect(travelModule.aiRole).toBe('AI Travel Receptionist');
    expect(travelModule.allowedRoutes).toContain('/packages');
    expect(travelModule.allowedRoutes).toContain('/bookings');
    expect(travelModule.terminology?.booking).toBe('Tour Booking');
    expect(travelModule.terminology?.service).toBe('Tour Package');
  });

  it('contains travel protocols and intake form in system prompt', () => {
    expect(TRAVEL_AI_SYSTEM_PROMPT).toContain('AI Travel Receptionist');
    expect(TRAVEL_AI_SYSTEM_PROMPT).toContain(
      'TOUR PACKAGE INQUIRY / BOOKING FORM'
    );
    expect(TRAVEL_AI_SYSTEM_PROMPT).toContain('MULTILINGUAL');
    expect(TRAVEL_AI_SYSTEM_PROMPT).toContain('Bengali');
    expect(TRAVEL_AI_SYSTEM_PROMPT).toContain('Hindi');
  });

  it('registers travel tools in AI tool registry', () => {
    const travelTools = aiToolRegistry.getToolsForIndustry('travel');
    const toolNames = travelTools.map((t) => t.name);

    expect(toolNames).toContain('searchTravelPackages');
    expect(toolNames).toContain('bookTravelPackage');
  });

  it('buildAiContextBundle injects travel packages catalog and Bengali language directive', async () => {
    const bundle = await buildAiContextBundle({
      accountId: 'acc-travel-123',
      conversationId: 'conv-123',
      contactId: 'ct-123',
    });

    expect(bundle.role).toBe('AI Travel Receptionist');
    expect(bundle.industry).toBe('travel');
    expect(bundle.businessName).toBe('Himalayan Holidays');

    // Check that database package records are injected into the system prompt
    expect(bundle.systemPrompt).toContain(
      'AVAILABLE TRAVEL & TOUR PACKAGES (DATABASE RECORDS):'
    );
    expect(bundle.systemPrompt).toContain('Darjeeling Delight');
    expect(bundle.systemPrompt).toContain('₹12500');
    expect(bundle.systemPrompt).toContain('Kashmir Paradise');
    expect(bundle.systemPrompt).toContain('₹24999');

    // Check that multilingual directive matched customer language
    expect(bundle.systemPrompt).toContain(
      'CRITICAL MANDATORY MULTILINGUAL DIRECTIVE:'
    );
    expect(bundle.systemPrompt).toContain(
      'Darjeeling package price koto? Ami 2 jon jabo.'
    );
    expect(bundle.systemPrompt).toContain('Bengali');
  });
});
