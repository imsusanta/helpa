import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  automations: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/db/server', () => ({
  getAdminClient: () => ({
    from: (table: string) => {
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      let op = 'select';
      let payload: Record<string, unknown> | null = null;
      const api: Record<string, unknown> = {
        select: () => api,
        eq: (field: string, value: unknown) => {
          filters.push((row) => row[field] === value);
          return api;
        },
        insert: (row: Record<string, unknown>) => {
          op = 'insert';
          payload = row;
          return api;
        },
        then: (onF: (value: unknown) => unknown) => {
          const rows = h.automations.filter((row) =>
            filters.every((filter) => filter(row))
          );
          return Promise.resolve({ data: rows, error: null }).then(onF);
        },
        single: async () => {
          if (op === 'insert' && payload) {
            const created = {
              id: `auto-${h.automations.length + 1}`,
              ...payload,
            };
            h.automations.push(created);
            return { data: created, error: null };
          }
          return { data: null, error: { message: 'not found' } };
        },
      };
      if (table !== 'automations') {
        return {
          select: () => api,
          eq: () => api,
          then: (onF: (value: unknown) => unknown) =>
            Promise.resolve({ data: [], error: null }).then(onF),
        };
      }
      return api;
    },
  }),
}));

vi.mock('@/lib/automations/steps-tree', () => ({
  insertSteps: vi.fn(async () => null),
}));

vi.mock('@/modules/travel/workflows', () => ({
  workflowsConfig: [
    {
      seedKey: 'travel_booking_confirm',
      name: 'Booking Confirm',
      description: 'Send confirm template',
      trigger_type: 'keyword_match',
      trigger_config: { keywords: ['booking confirm'] },
      is_active: true,
      steps: [{ step_type: 'send_message', step_config: { text: 'Confirm' } }],
    },
    {
      seedKey: 'traveler_intake_greeting',
      name: 'Traveler Intake Greeting',
      description: 'Welcome',
      trigger_type: 'first_inbound_message',
      trigger_config: {},
      is_active: true,
      steps: [{ step_type: 'send_message', step_config: { text: 'Hi' } }],
    },
  ],
}));

import { ensureTravelWorkflowsSeeded } from './travel-seeds';

describe('ensureTravelWorkflowsSeeded', () => {
  beforeEach(() => {
    h.automations = [];
  });

  it('inserts missing travel seeds for the current account only', async () => {
    const created = await ensureTravelWorkflowsSeeded({
      accountId: 'acct-travel',
      userId: 'user-1',
    });
    expect(created).toBe(2);
    expect(h.automations).toHaveLength(2);
    expect(h.automations.every((row) => row.account_id === 'acct-travel')).toBe(
      true
    );
    expect(h.automations.every((row) => row.created_by === 'user-1')).toBe(
      true
    );
    expect(h.automations.some((row) => 'user_id' in row)).toBe(false);
    expect(h.automations.map((row) => row.name)).toEqual([
      'Booking Confirm',
      'Traveler Intake Greeting',
    ]);
  });

  it('skips seeds that already exist by key or name', async () => {
    h.automations = [
      {
        id: 'existing',
        account_id: 'acct-travel',
        name: 'Booking Confirm',
        metadata: { workflow_seed_key: 'travel_booking_confirm' },
      },
    ];
    const created = await ensureTravelWorkflowsSeeded({
      accountId: 'acct-travel',
      userId: 'user-1',
    });
    expect(created).toBe(1);
    expect(h.automations).toHaveLength(2);
    expect(h.automations[1].name).toBe('Traveler Intake Greeting');
  });
});
