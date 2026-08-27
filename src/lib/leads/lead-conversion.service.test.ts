import { describe, expect, it, vi } from 'vitest';
import { upsertLeadFromDetection } from './lead-conversion.service';
import { validateLeadDetection } from './lead-detection.service';
import type { AdminClient } from '@/lib/db/server';

vi.mock('@/lib/automations/engine', () => ({
  runAutomationsForTrigger: vi.fn(async () => ({
    replied: false,
    executedCount: 0,
  })),
}));

vi.mock('@/lib/leads/lead-events', () => ({
  logLeadEvent: vi.fn(),
  LEAD_LAYER_EVENTS: {
    AI_LEAD_DETECTED: 'AI_LEAD_DETECTED',
    AI_LEAD_NOT_DETECTED: 'AI_LEAD_NOT_DETECTED',
    LEAD_CREATED: 'LEAD_CREATED',
    LEAD_UPDATED: 'LEAD_UPDATED',
    AI_QUALIFIED: 'AI_QUALIFIED',
  },
}));

interface Captured {
  inserts: Array<{ table: string; payload: Record<string, unknown> }>;
  updates: Array<{ table: string; payload: Record<string, unknown> }>;
}

function stubDb(options: {
  existingLead?: Record<string, unknown> | null;
  existingByMessage?: Record<string, unknown> | null;
}): { db: AdminClient; captured: Captured } {
  const captured: Captured = { inserts: [], updates: [] };
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        return chain;
      },
      not: () => chain,
      order: () => chain,
      limit: () => chain,
      update: (payload: Record<string, unknown>) => {
        captured.updates.push({ table, payload });
        return chain;
      },
      insert: (payload: Record<string, unknown>) => {
        captured.inserts.push({ table, payload });
        const inserted = {
          select: () => inserted,
          maybeSingle: async () => ({
            data: table === 'leads' ? { id: 'lead-new' } : null,
            error: null,
          }),
        };
        return inserted;
      },
      maybeSingle: async () => {
        if (table === 'leads' && filters.source_message_id) {
          return { data: options.existingByMessage ?? null, error: null };
        }
        if (table === 'leads') {
          return { data: options.existingLead ?? null, error: null };
        }
        return { data: null, error: null };
      },
    };
    return chain;
  };
  return { db: { from } as unknown as AdminClient, captured };
}

const BASE = {
  accountId: 'acc-1',
  userId: 'user-1',
  conversationId: 'conv-1',
  contactId: 'cnt-1',
  contactName: 'Ravi',
  contactPhone: '+919876543210',
  messageId: 'wamid.1',
  messageText: 'Goa package price?',
  industry: 'travel',
};

describe('upsertLeadFromDetection', () => {
  it('skips greetings', async () => {
    const { db, captured } = stubDb({});
    const result = await upsertLeadFromDetection(db, {
      ...BASE,
      messageText: 'Hi',
      detection: validateLeadDetection(null, 'Hi'),
    });
    expect(result.skipped).toBe(true);
    expect(captured.inserts.filter((i) => i.table === 'leads')).toHaveLength(0);
  });

  it('creates a WhatsApp lead for a genuine enquiry', async () => {
    const { db, captured } = stubDb({ existingLead: null });
    const result = await upsertLeadFromDetection(db, {
      ...BASE,
      detection: validateLeadDetection(
        {
          is_business_enquiry: true,
          sales_signal: true,
          lead_confidence: 0.92,
          intent: 'high',
          service: 'Goa tour package',
          summary: 'Customer wants a Goa tour package',
        },
        BASE.messageText
      ),
    });
    expect(result.skipped).toBe(false);
    const leadInsert = captured.inserts.find((i) => i.table === 'leads');
    expect(leadInsert).toBeDefined();
    expect(leadInsert?.payload.source).toBe('whatsapp');
    expect(leadInsert?.payload.channel).toBe('whatsapp');
    expect(leadInsert?.payload.account_id).toBe('acc-1');
    expect(leadInsert?.payload.contact_id).toBe('cnt-1');
    expect(leadInsert?.payload.ai_product_service).toBe('Goa tour package');
  });

  it('updates an existing active lead instead of duplicating', async () => {
    const { db, captured } = stubDb({
      existingLead: {
        id: 'lead-1',
        stage: 'NEW',
        source: 'campaign',
        channel: 'whatsapp',
        service: null,
        metadata: {},
      },
    });
    const result = await upsertLeadFromDetection(db, {
      ...BASE,
      detection: validateLeadDetection(
        {
          is_business_enquiry: true,
          sales_signal: true,
          lead_confidence: 0.9,
          intent: 'medium',
          service: 'Goa tour package',
        },
        BASE.messageText
      ),
    });
    expect(result.updated).toBe(true);
    expect(captured.inserts.filter((i) => i.table === 'leads')).toHaveLength(0);
    const update = captured.updates.find((u) => u.table === 'leads');
    expect(update?.payload.source).toBe('campaign');
    expect(update?.payload.service).toBe('Goa tour package');
  });

  it('is idempotent for a duplicate webhook message id', async () => {
    const { db, captured } = stubDb({
      existingByMessage: { id: 'lead-1', stage: 'NEW' },
    });
    const result = await upsertLeadFromDetection(db, {
      ...BASE,
      detection: validateLeadDetection(
        {
          is_business_enquiry: true,
          sales_signal: true,
          lead_confidence: 0.9,
        },
        BASE.messageText
      ),
    });
    expect(result.skipped).toBe(true);
    expect(result.leadId).toBe('lead-1');
    expect(captured.inserts.filter((i) => i.table === 'leads')).toHaveLength(0);
  });
});
