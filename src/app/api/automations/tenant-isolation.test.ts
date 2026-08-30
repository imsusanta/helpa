import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  accountId: 'account-a',
  userId: 'user-a',
  tables: {
    accounts: [] as Array<Record<string, unknown>>,
    automations: [] as Array<Record<string, unknown>>,
    automation_steps: [] as Array<Record<string, unknown>>,
    automation_logs: [] as Array<Record<string, unknown>>,
  },
}));

class Query {
  private filters: Array<(row: Record<string, unknown>) => boolean> = [];
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload:
    Record<string, unknown> | Array<Record<string, unknown>> | null = null;
  private rowLimit: number | null = null;

  constructor(private table: keyof typeof state.tables) {}

  select() {
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }
  order() {
    return this;
  }
  limit(value: number) {
    this.rowLimit = value;
    return this;
  }
  insert(payload: Record<string, unknown> | Array<Record<string, unknown>>) {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }
  update(payload: Record<string, unknown>) {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }
  delete() {
    this.operation = 'delete';
    return this;
  }
  async maybeSingle() {
    const result = this.execute();
    return { data: result.data[0] ?? null, error: result.error };
  }
  async single() {
    const result = this.execute();
    return { data: result.data[0] ?? null, error: result.error };
  }
  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
  private execute() {
    const table = state.tables[this.table];
    const matches = (row: Record<string, unknown>) =>
      this.filters.every((filter) => filter(row));
    if (this.operation === 'insert') {
      const rows = (
        Array.isArray(this.payload) ? this.payload : [this.payload]
      ).map((row, index) => ({
        id: `${this.table}-${table.length + index + 1}`,
        ...row,
      }));
      table.push(...rows);
      return { data: rows, error: null };
    }
    if (this.operation === 'update') {
      const rows = table.filter(matches);
      rows.forEach((row) => Object.assign(row, this.payload));
      return { data: rows, error: null };
    }
    if (this.operation === 'delete') {
      const rows = table.filter(matches);
      state.tables[this.table] = table.filter((row) => !matches(row)) as never;
      return { data: rows, error: null };
    }
    const rows = table.filter(matches);
    return {
      data: this.rowLimit === null ? rows : rows.slice(0, this.rowLimit),
      error: null,
    };
  }
}

const database = {
  from(table: keyof typeof state.tables) {
    return new Query(table);
  },
};

vi.mock('@/lib/auth/account', () => ({
  ForbiddenError: class ForbiddenError extends Error {},
  UnauthorizedError: class UnauthorizedError extends Error {},
  requireRole: vi.fn(async () => ({
    accountId: state.accountId,
    userId: state.userId,
    role: 'owner',
    account: { id: state.accountId, name: 'Test' },
    appwrite: database,
  })),
  toErrorResponse: (error: Error) =>
    Response.json({ error: error.message }, { status: 401 }),
}));
vi.mock('@/lib/db/server', () => ({
  getAdminClient: () => database,
  createClient: async () => database,
}));
vi.mock('@/lib/supabase/server', () => ({ getAdminClient: () => database }));
vi.mock('@/lib/saas/subscription', () => ({
  checkPlanLimits: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('@/lib/automations/travel-seeds', () => ({
  ensureTravelWorkflowsSeeded: vi.fn(async () => 0),
}));
vi.mock('@/lib/automations/steps-tree', () => ({
  insertSteps: vi.fn(async () => null),
  loadStepsTree: vi.fn(async () => []),
  replaceSteps: vi.fn(async () => null),
}));
vi.mock('@/lib/automations/validate', () => ({
  validateStepsForActivation: () => [],
  validateTriggerForActivation: () => [],
}));

import { POST as createAutomation } from './route';
import { DELETE, GET, PATCH } from './[id]/route';
import { POST as duplicateAutomation } from './[id]/duplicate/route';
import { GET as getLogs } from './[id]/logs/route';

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (method: string, body?: Record<string, unknown>) =>
  new Request('https://helpa.test/api/automations', {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

describe('automation route tenant and industry isolation', () => {
  beforeEach(() => {
    state.accountId = 'account-a';
    state.userId = 'user-a';
    state.tables.accounts = [
      { id: 'account-a', industry: 'travel' },
      { id: 'account-b', industry: 'hospital_clinic' },
    ];
    state.tables.automations = [
      {
        id: 'automation-b',
        account_id: 'account-b',
        user_id: 'user-b',
        name: 'Clinic only',
        description: null,
        trigger_type: 'new_message_received',
        trigger_config: {},
        is_active: false,
      },
      {
        id: 'automation-a',
        account_id: 'account-a',
        user_id: 'user-a',
        name: 'Travel automation',
        description: null,
        trigger_type: 'new_message_received',
        trigger_config: {},
        is_active: false,
      },
    ];
    state.tables.automation_steps = [];
    state.tables.automation_logs = [
      { id: 'log-b', automation_id: 'automation-b', account_id: 'account-b' },
    ];
  });
  it('rejects a clinic template for a travel account', async () => {
    const response = await createAutomation(
      request('POST', { template: 'doctor_booking_enquiry' })
    );
    expect(response.status).toBe(403);
  });
  it('allows a clinic template for a clinic account', async () => {
    state.accountId = 'account-b';
    state.userId = 'user-b';
    const response = await createAutomation(
      request('POST', { template: 'doctor_booking_enquiry' })
    );
    expect(response.status).toBe(201);
    expect(state.tables.automations.at(-1)?.account_id).toBe('account-b');
  });
  it.each([
    ['read', () => GET(request('GET'), params('automation-b'))],
    [
      'patch',
      () =>
        PATCH(request('PATCH', { is_active: true }), params('automation-b')),
    ],
    [
      'deactivate',
      () =>
        PATCH(request('PATCH', { is_active: false }), params('automation-b')),
    ],
    ['delete', () => DELETE(request('DELETE'), params('automation-b'))],
    [
      'duplicate',
      () => duplicateAutomation(request('POST'), params('automation-b')),
    ],
    ['logs', () => getLogs(request('GET'), params('automation-b'))],
  ])(
    'returns 404 when Account A tries to %s Account B automation',
    async (_name, call) => {
      expect((await call()).status).toBe(404);
    }
  );
  it('duplicates an owned automation into the authenticated account', async () => {
    const response = await duplicateAutomation(
      request('POST'),
      params('automation-a')
    );
    expect(response.status).toBe(201);
    expect(state.tables.automations.at(-1)).toEqual(
      expect.objectContaining({
        account_id: 'account-a',
        created_by: 'user-a',
      })
    );
  });
});
