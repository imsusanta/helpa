import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildAiContextBundle } from './context-builder';

const mockDbState = vi.hoisted(() => ({
  account: {
    id: 'test-account-1',
    name: 'Helpa Himalayan Tours',
    industry: 'travel',
    ai_system_prompt: '',
    openrouter_model: null,
  },
  knowledgeBase: [] as Array<Record<string, unknown>>,
  messages: [] as Array<{ role: string; content: string }>,
  packages: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/db/server', () => ({
  getAdminClient: vi.fn(() => ({
    from: (table: string) => ({
      select: (_cols?: string) => ({
        eq: (_col: string, _val: unknown) => ({
          single: async () => ({
            data: mockDbState.account,
            error: null,
          }),
          limit: async () => ({
            data: table === 'knowledge_base' ? mockDbState.knowledgeBase : [],
            error: null,
          }),
        }),
      }),
    }),
  })),
}));

vi.mock('./memory', () => ({
  getConversationMemory: vi.fn(async () => ({
    messages: mockDbState.messages,
    contactName: 'John Doe',
    contactMobile: '+919876543210',
  })),
}));

vi.mock('@/modules/travel/package-service', () => ({
  retrievePackagesForAi: vi.fn(async (_accountId: string, query?: string) => {
    if (!query) return mockDbState.packages;
    const lower = query.toLowerCase();
    return mockDbState.packages.filter(
      (p) =>
        lower.includes(String(p.destination || '').toLowerCase()) ||
        lower.includes(String(p.name || '').toLowerCase())
    );
  }),
  formatPackagesForAiContext: vi.fn(
    (packages: Array<Record<string, unknown>>) => {
      if (!packages || packages.length === 0)
        return { context: '', fallbackMessage: 'No package found' };
      const context = `=== STRUCTURED TOUR PACKAGE DATABASE (SOURCE OF TRUTH) ===\n${packages.map((p) => `--- PACKAGE [internal_id:${p.id}] ---\nName: ${p.name}\nDestination: ${p.destination}\nPrice: ${p.currency} ${p.base_price} (${p.price_basis || 'per_person'})\n`).join('\n')}`;
      return { context, fallbackMessage: null };
    }
  ),
}));

describe('AI Context Builder — Tour Packages Catalog Integration', () => {
  beforeEach(() => {
    mockDbState.account = {
      id: 'test-account-1',
      name: 'Helpa Himalayan Tours',
      industry: 'travel',
      ai_system_prompt: '',
      openrouter_model: null,
    };
    mockDbState.knowledgeBase = [];
    mockDbState.messages = [];
    mockDbState.packages = [];
  });

  it('includes matched tour package from structured database in system prompt for travel workspace', async () => {
    mockDbState.packages = [
      {
        id: 'pkg-darj-101',
        name: 'Darjeeling Delight',
        destination: 'Darjeeling',
        base_price: 15000,
        currency: 'INR',
        price_basis: 'per_person',
      },
    ];

    mockDbState.messages = [
      { role: 'user', content: 'Do you have a tour for Darjeeling?' },
    ];

    const bundle = await buildAiContextBundle({
      accountId: 'test-account-1',
      conversationId: 'conv-1',
      contactId: 'contact-1',
    });

    expect(bundle.systemPrompt).toContain(
      '=== STRUCTURED TOUR PACKAGE DATABASE (SOURCE OF TRUTH) ==='
    );
    expect(bundle.systemPrompt).toContain('Darjeeling Delight');
    expect(bundle.systemPrompt).toContain('[internal_id:pkg-darj-101]');
    expect(bundle.systemPrompt).not.toContain(
      'All standard sightseeing & transport included'
    );
  });

  it('does not include unrelated package when specific search query has no match', async () => {
    mockDbState.packages = [
      {
        id: 'pkg-darj-101',
        name: 'Darjeeling Delight',
        destination: 'Darjeeling',
        base_price: 15000,
        currency: 'INR',
      },
    ];

    mockDbState.messages = [
      { role: 'user', content: 'Do you have any Maldives packages?' },
    ];

    const bundle = await buildAiContextBundle({
      accountId: 'test-account-1',
      conversationId: 'conv-1',
      contactId: 'contact-1',
    });

    expect(bundle.systemPrompt).not.toContain('Darjeeling Delight');
    expect(bundle.systemPrompt).not.toContain('[internal_id:pkg-darj-101]');
  });

  it('does not include any travel catalog context for non-travel industries (e.g. healthcare/clinic)', async () => {
    mockDbState.account.industry = 'health';
    mockDbState.account.name = 'Apollo Health Clinic';

    mockDbState.messages = [
      { role: 'user', content: 'What packages do you have?' },
    ];

    const bundle = await buildAiContextBundle({
      accountId: 'test-account-1',
      conversationId: 'conv-1',
      contactId: 'contact-1',
    });

    expect(bundle.systemPrompt).not.toContain(
      '=== STRUCTURED TOUR PACKAGE DATABASE'
    );
    expect(bundle.systemPrompt).not.toContain(
      'STRUCTURED PRODUCT & SERVICE CATALOG'
    );
  });
});
