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
  itinerary: [] as Array<Record<string, unknown>>,
  departures: [] as Array<Record<string, unknown>>,
}));

class MockAiDbQueryBuilder {
  private table: string;
  private filters: Array<(r: Record<string, unknown>) => boolean> = [];
  private limitCount?: number;

  constructor(table: string) {
    this.table = table;
  }

  select(_cols = '*') {
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }

  neq(col: string, val: unknown) {
    this.filters.push((r) => r[col] !== val);
    return this;
  }

  gte(col: string, val: string) {
    this.filters.push((r) => !r[col] || String(r[col]) >= val);
    return this;
  }

  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }

  or(expr: string) {
    const parts = expr.split(',');
    this.filters.push((row) => {
      return parts.some((p) => {
        if (p.includes('.is.null')) {
          const col = p.split('.')[0];
          return row[col] === null || row[col] === undefined;
        }
        if (p.includes('.gte.')) {
          const [col, , val] = p.split('.');
          return row[col] ? String(row[col]) >= val : true;
        }
        if (p.includes('.ilike.%')) {
          const [col, , term] = p.split('.');
          const clean = term.replace(/%/g, '').toLowerCase();
          return String(row[col] || '')
            .toLowerCase()
            .includes(clean);
        }
        return false;
      });
    });
    return this;
  }

  order(_col: string, _opts?: { ascending?: boolean }) {
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  async single() {
    if (this.table === 'accounts') {
      return { data: mockDbState.account, error: null };
    }
    return { data: null, error: new Error('Not found') };
  }

  async then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    let source: Array<Record<string, unknown>> = [];
    if (this.table === 'accounts') source = [mockDbState.account];
    else if (this.table === 'knowledge_base')
      source = mockDbState.knowledgeBase;
    else if (this.table === 'travel_packages') source = mockDbState.packages;
    else if (this.table === 'tour_package_itinerary_days')
      source = mockDbState.itinerary;
    else if (this.table === 'tour_package_departures')
      source = mockDbState.departures;

    let filtered = source.filter((r) => this.filters.every((f) => f(r)));
    if (this.limitCount !== undefined) {
      filtered = filtered.slice(0, this.limitCount);
    }
    return Promise.resolve({ data: filtered, error: null }).then(
      onfulfilled,
      onrejected
    );
  }
}

const mockDbClient = {
  from: (table: string) => new MockAiDbQueryBuilder(table),
};

vi.mock('@/lib/db/server', () => ({
  getAdminClient: vi.fn(() => mockDbClient),
}));

vi.mock('@/lib/supabase/server', () => ({
  getAdminClient: vi.fn(() => mockDbClient),
}));

vi.mock('./memory', () => ({
  getConversationMemory: vi.fn(async () => ({
    messages: mockDbState.messages,
    contactName: 'John Doe',
    contactMobile: '+919876543210',
  })),
}));

describe('AI Context Builder — Real Tour Packages Catalog Retrieval Integration', () => {
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
    mockDbState.itinerary = [];
    mockDbState.departures = [];
  });

  it('includes matched tour package from structured database in system prompt for travel workspace', async () => {
    mockDbState.packages = [
      {
        id: 'pkg-darj-101',
        account_id: 'test-account-1',
        name: 'Darjeeling Delight',
        destination: 'Darjeeling',
        summary: 'Scenic Himalayan tea gardens tour',
        duration_days: 4,
        duration_nights: 3,
        base_price: 15000,
        currency: 'INR',
        price_basis: 'per_person',
        status: 'published',
        valid_from: null,
        valid_until: null,
        inclusions: ['Hotel', 'Sightseeing'],
        exclusions: ['Airfare'],
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
  });

  it('does NOT include Darjeeling package when query specifically asks for Maldives packages', async () => {
    mockDbState.packages = [
      {
        id: 'pkg-darj-101',
        account_id: 'test-account-1',
        name: 'Darjeeling Delight',
        destination: 'Darjeeling',
        summary: 'Scenic Himalayan tea gardens tour',
        duration_days: 4,
        duration_nights: 3,
        base_price: 15000,
        currency: 'INR',
        price_basis: 'per_person',
        status: 'published',
        valid_from: null,
        valid_until: null,
        inclusions: ['Hotel', 'Sightseeing'],
        exclusions: ['Airfare'],
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

    // Real production classification must recognize 'Maldives' token and NOT return Darjeeling!
    expect(bundle.systemPrompt).not.toContain('Darjeeling Delight');
    expect(bundle.systemPrompt).not.toContain('[internal_id:pkg-darj-101]');
  });

  it('includes packages when query asks general catalog question', async () => {
    mockDbState.packages = [
      {
        id: 'pkg-darj-101',
        account_id: 'test-account-1',
        name: 'Darjeeling Delight',
        destination: 'Darjeeling',
        summary: 'Scenic Himalayan tea gardens tour',
        duration_days: 4,
        duration_nights: 3,
        base_price: 15000,
        currency: 'INR',
        price_basis: 'per_person',
        status: 'published',
        valid_from: null,
        valid_until: null,
        inclusions: ['Hotel', 'Sightseeing'],
        exclusions: ['Airfare'],
      },
    ];

    mockDbState.messages = [
      { role: 'user', content: 'What packages do you have?' },
    ];

    const bundle = await buildAiContextBundle({
      accountId: 'test-account-1',
      conversationId: 'conv-1',
      contactId: 'contact-1',
    });

    expect(bundle.systemPrompt).toContain('Darjeeling Delight');
    expect(bundle.systemPrompt).toContain('[internal_id:pkg-darj-101]');
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
