import { describe, expect, it, vi } from 'vitest';
import {
  buildDealTitle,
  pickNewLeadStage,
  syncDealPipeline,
  updateConversationInsights,
} from './ai-crm-sync';
import { extractStructuredInsights } from './ai-pipeline';
import type { AdminClient } from '@/lib/db/server';

const INSIGHTS = extractStructuredInsights({
  intent: 'sales',
  lead_score: 'hot',
  sentiment: 'positive',
  summary: 'Wants a demo',
  sales_signal: true,
  extracted_lead_info: { interested_service: 'Implants' },
});

describe('pickNewLeadStage', () => {
  it('prefers a stage named "New Inquiry" or "New Lead"', () => {
    expect(
      pickNewLeadStage([{ name: 'Won' }, { name: 'New Inquiry' }])?.name
    ).toBe('New Inquiry');
    expect(
      pickNewLeadStage([{ name: 'Won' }, { name: 'new lead' }])?.name
    ).toBe('new lead');
  });

  it('falls back to the first stage', () => {
    expect(pickNewLeadStage([{ name: 'Contacted' }])?.name).toBe('Contacted');
    expect(pickNewLeadStage([])).toBeUndefined();
  });
});

describe('buildDealTitle', () => {
  it('uses name and interested service when present', () => {
    expect(buildDealTitle({ name: 'Ravi' }, 'Implants')).toBe(
      'Ravi - Implants'
    );
  });

  it('falls back to phone then a generic label', () => {
    expect(buildDealTitle({ phone: '+91987' }, null)).toBe(
      '+91987 - WhatsApp Lead'
    );
    expect(buildDealTitle(null, null)).toBe('Unknown Client - WhatsApp Lead');
  });
});

interface CapturedUpdate {
  table: string;
  payload: Record<string, unknown>;
  filters: Record<string, unknown>;
}

function stubDb(options: {
  existingDeal?: Record<string, unknown> | null;
  pipelines?: Array<{ id: string }>;
  stages?: Array<{ id: string; name: string }>;
}) {
  const updates: CapturedUpdate[] = [];
  const inserts: Array<{ table: string; payload: Record<string, unknown> }> =
    [];

  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    let updatePayload: Record<string, unknown> | null = null;

    const listResult = () => {
      if (table === 'pipelines')
        return { data: options.pipelines ?? [], error: null };
      if (table === 'pipeline_stages')
        return { data: options.stages ?? [], error: null };
      return { data: [], error: null };
    };

    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        if (updatePayload) {
          updates.push({ table, payload: updatePayload, filters });
          updatePayload = null;
          return Promise.resolve({ data: null, error: null });
        }
        return chain;
      },
      order: () => chain,
      update: (payload: Record<string, unknown>) => {
        updatePayload = payload;
        return chain;
      },
      insert: (payload: Record<string, unknown>) => {
        inserts.push({ table, payload });
        return Promise.resolve({ data: null, error: null });
      },
      maybeSingle: async () => ({
        data: table === 'deals' ? (options.existingDeal ?? null) : null,
        error: null,
      }),
      then: (
        resolve: (v: { data: unknown; error: null }) => unknown,
        reject?: (e: unknown) => unknown
      ) => Promise.resolve(listResult()).then(resolve, reject),
    };
    return chain;
  };

  return { db: { from } as unknown as AdminClient, updates, inserts };
}

const ARGS = {
  accountId: 'acc-1',
  userId: 'user-1',
  conversationId: 'conv-1',
  contactId: 'cnt-1',
  contact: { name: 'Ravi', phone: '+91987' },
  insights: INSIGHTS,
};

describe('updateConversationInsights', () => {
  it('writes the AI insight columns onto the conversation row', async () => {
    const { db, updates } = stubDb({});
    await updateConversationInsights(db, {
      conversationId: 'conv-1',
      insights: INSIGHTS,
    });
    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe('conversations');
    expect(updates[0].payload.ai_intent).toBe('sales');
    expect(updates[0].payload.ai_lead_score).toBe('hot');
    expect(updates[0].filters.id).toBe('conv-1');
  });

  it('retries without metadata columns when the migration is not applied', async () => {
    let attempts = 0;
    const updates: Array<Record<string, unknown>> = [];
    const db = {
      from: () => {
        const chain: Record<string, unknown> = {
          update: (payload: Record<string, unknown>) => {
            attempts += 1;
            updates.push(payload);
            return chain;
          },
          eq: () => {
            if (attempts === 1) {
              return Promise.resolve({
                data: null,
                error: {
                  code: '42703',
                  message: 'column "ai_answer_source" does not exist',
                },
              });
            }
            return Promise.resolve({ data: null, error: null });
          },
        };
        return chain;
      },
    } as unknown as AdminClient;

    await updateConversationInsights(db, {
      conversationId: 'conv-1',
      insights: INSIGHTS,
    });
    expect(attempts).toBe(2);
    expect(updates[1]).not.toHaveProperty('ai_answer_source');
    expect(updates[1].ai_handoff_required).toBe(false);
  });
});

describe('syncDealPipeline', () => {
  it('enriches an existing deal instead of creating a new one', async () => {
    const { db, updates, inserts } = stubDb({
      existingDeal: { id: 'deal-1', ai_budget: '₹10k' },
    });
    await syncDealPipeline(db, ARGS);
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(1);
    expect(updates[0].payload.ai_buying_intent).toBe('sales');
    // Existing value is preserved when the model produced nothing new.
    expect(updates[0].payload.ai_budget).toBe('₹10k');
  });

  it('creates a deal in the new-lead stage on a sales signal', async () => {
    const { db, inserts } = stubDb({
      existingDeal: null,
      pipelines: [{ id: 'pipe-1' }],
      stages: [
        { id: 'stage-won', name: 'Won' },
        { id: 'stage-new', name: 'New Inquiry' },
      ],
    });
    await syncDealPipeline(db, ARGS);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].table).toBe('deals');
    expect(inserts[0].payload.stage_id).toBe('stage-new');
    expect(inserts[0].payload.title).toBe('Ravi - Implants');
    expect(inserts[0].payload.account_id).toBe('acc-1');
  });

  it('does nothing without a sales signal or existing deal', async () => {
    const { db, inserts, updates } = stubDb({
      existingDeal: null,
      pipelines: [{ id: 'pipe-1' }],
      stages: [{ id: 's1', name: 'New Lead' }],
    });
    await syncDealPipeline(db, {
      ...ARGS,
      insights: extractStructuredInsights({ intent: 'support' }),
    });
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it('never throws when the database fails', async () => {
    const db = {
      from: vi.fn(() => {
        throw new Error('db down');
      }),
    } as unknown as AdminClient;
    await expect(syncDealPipeline(db, ARGS)).resolves.toBeUndefined();
  });
});

describe('updateConversationInsights', () => {
  it('disables AI autopilot and sets ai_handoff_required when handoff is required', async () => {
    const { db, updates } = stubDb({});
    const handoffInsights = extractStructuredInsights({
      intent: 'support',
      handoff_required: true,
      summary: 'Customer requested human agent',
    });

    await updateConversationInsights(db, {
      conversationId: 'conv-123',
      insights: handoffInsights,
    });

    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe('conversations');
    expect(updates[0].payload.ai_handoff_required).toBe(true);
    expect(updates[0].payload.ai_chat_enabled).toBe(false);
    expect(updates[0].filters.id).toBe('conv-123');
  });
});
