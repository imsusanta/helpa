import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Covers the four engine behaviours hardened alongside the appointment
 * triggers: trigger_config filtering, round-robin assignment, the
 * expanded token set, and send_webhook egress rules.
 *
 * The service-role client is faked with the same shape as engine.test.ts
 * (a chainable builder resolved from a hoisted state bag) so both files
 * can run side by side without sharing a mock.
 */
const h = vi.hoisted(() => ({
  state: {
    contact: null as Record<string, unknown> | null,
    automations: [] as Record<string, unknown>[],
    steps: [] as Record<string, unknown>[],
    profiles: [] as Record<string, unknown>[],
    conversations: [] as Record<string, unknown>[],
    conversationUpdates: [] as Record<string, unknown>[],
    logUpdates: [] as Record<string, unknown>[],
  },
}));

vi.mock('@/lib/appwrite-server-compat', () => {
  const { state } = h;

  function resolve(ops: {
    table: string;
    type: string;
    payload?: unknown;
    filters: [string, string, unknown][];
  }) {
    const { table, type } = ops;
    if (table === 'contacts') return { data: state.contact, error: null };
    if (table === 'automations')
      return { data: state.automations, error: null };
    if (table === 'automation_steps')
      return { data: state.steps, error: null };
    if (table === 'profiles') return { data: state.profiles, error: null };
    if (table === 'conversations') {
      if (type === 'update') {
        state.conversationUpdates.push(
          ops.payload as Record<string, unknown>
        );
        return { data: null, error: null };
      }
      return { data: state.conversations, error: null };
    }
    if (table === 'automation_logs') {
      if (type === 'insert') return { data: { id: 'log1' }, error: null };
      if (type === 'update') {
        state.logUpdates.push(ops.payload as Record<string, unknown>);
        return { data: null, error: null };
      }
      return { data: { steps_executed: [], status: 'success' }, error: null };
    }
    return { data: null, error: null };
  }

  function builder(table: string) {
    const ops = {
      table,
      type: 'select',
      payload: undefined as unknown,
      filters: [] as [string, string, unknown][],
    };
    const b: Record<string, unknown> = {
      select: () => b,
      insert: (p: unknown) => ((ops.type = 'insert'), (ops.payload = p), b),
      update: (p: unknown) => ((ops.type = 'update'), (ops.payload = p), b),
      delete: () => ((ops.type = 'delete'), b),
      upsert: (p: unknown) => ((ops.type = 'upsert'), (ops.payload = p), b),
      eq: (k: string, v: unknown) => (ops.filters.push(['eq', k, v]), b),
      gte: () => b,
      is: () => b,
      order: () => b,
      limit: () => b,
      single: () => Promise.resolve(resolve(ops)),
      maybeSingle: () => Promise.resolve(resolve(ops)),
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve(resolve(ops)).then(onF, onR),
    };
    return b;
  }

  return {
    appwriteAdmin: () => ({
      from: (t: string) => builder(t),
      rpc: () => Promise.resolve({ error: null }),
    }),
  };
});

const sendText = vi.fn(async () => ({ whatsapp_message_id: 'm1' }));

vi.mock('./meta-send', () => ({
  engineSendText: (...a: unknown[]) =>
    (sendText as unknown as (...x: unknown[]) => unknown)(...a),
  engineSendTemplate: vi.fn(async () => ({ whatsapp_message_id: 'm1' })),
}));

import { runAutomationsForTrigger } from './engine';

const ACCOUNT = 'acct-1';

function automation(over: Record<string, unknown>) {
  return {
    id: 'a1',
    account_id: ACCOUNT,
    user_id: 'u1',
    trigger_config: {},
    is_active: true,
    ...over,
  };
}

function step(step_type: string, step_config: Record<string, unknown>) {
  return {
    id: 's1',
    automation_id: 'a1',
    step_type,
    step_config,
    position: 0,
    parent_step_id: null,
  };
}

beforeEach(() => {
  h.state.contact = {
    id: 'c1',
    name: 'Riya Sen',
    phone: '+919812345678',
    email: null,
    company: null,
  };
  h.state.automations = [];
  h.state.steps = [];
  h.state.profiles = [];
  h.state.conversations = [];
  h.state.conversationUpdates = [];
  h.state.logUpdates = [];
  sendText.mockClear();
  process.env.AUTOMATION_WEBHOOK_RETRY_BASE_MS = '0';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.AUTOMATION_WEBHOOK_RETRY_BASE_MS;
});

describe('triggerMatches — tag_added', () => {
  beforeEach(() => {
    h.state.automations = [
      automation({
        trigger_type: 'tag_added',
        trigger_config: { tag_id: 'tag-vip' },
      }),
    ];
    h.state.steps = [step('send_message', { text: 'VIP spotted' })];
  });

  it('does not fire for a different tag', async () => {
    const res = await runAutomationsForTrigger({
      accountId: ACCOUNT,
      triggerType: 'tag_added',
      contactId: 'c1',
      context: { tag_id: 'tag-other', conversation_id: 'conv1' },
    });
    expect(res.executedCount).toBe(0);
    expect(sendText).not.toHaveBeenCalled();
  });

  it('fires for the configured tag', async () => {
    const res = await runAutomationsForTrigger({
      accountId: ACCOUNT,
      triggerType: 'tag_added',
      contactId: 'c1',
      context: { tag_id: 'tag-vip', conversation_id: 'conv1' },
    });
    expect(res.executedCount).toBe(1);
    expect(sendText).toHaveBeenCalledTimes(1);
  });

  it('stays silent when no tag is configured', async () => {
    h.state.automations = [
      automation({ trigger_type: 'tag_added', trigger_config: {} }),
    ];
    const res = await runAutomationsForTrigger({
      accountId: ACCOUNT,
      triggerType: 'tag_added',
      contactId: 'c1',
      context: { tag_id: 'tag-vip', conversation_id: 'conv1' },
    });
    expect(res.executedCount).toBe(0);
  });
});

describe('triggerMatches — conversation_assigned', () => {
  it('only fires for the configured agent', async () => {
    h.state.automations = [
      automation({
        trigger_type: 'conversation_assigned',
        trigger_config: { agent_id: 'u2' },
      }),
    ];
    h.state.steps = [step('send_message', { text: 'yours now' })];

    const miss = await runAutomationsForTrigger({
      accountId: ACCOUNT,
      triggerType: 'conversation_assigned',
      contactId: 'c1',
      context: { agent_id: 'u3', conversation_id: 'conv1' },
    });
    expect(miss.executedCount).toBe(0);

    const hit = await runAutomationsForTrigger({
      accountId: ACCOUNT,
      triggerType: 'conversation_assigned',
      contactId: 'c1',
      context: { agent_id: 'u2', conversation_id: 'conv1' },
    });
    expect(hit.executedCount).toBe(1);
  });

  it('matches any agent when unconfigured', async () => {
    h.state.automations = [
      automation({
        trigger_type: 'conversation_assigned',
        trigger_config: {},
      }),
    ];
    h.state.steps = [step('send_message', { text: 'yours now' })];

    const res = await runAutomationsForTrigger({
      accountId: ACCOUNT,
      triggerType: 'conversation_assigned',
      contactId: 'c1',
      context: { agent_id: 'anyone', conversation_id: 'conv1' },
    });
    expect(res.executedCount).toBe(1);
  });
});

describe('assign_conversation — round robin', () => {
  it('picks the assignable member with the fewest open conversations', async () => {
    h.state.automations = [automation({ trigger_type: 'new_message_received' })];
    h.state.steps = [step('assign_conversation', { mode: 'round_robin' })];
    h.state.profiles = [
      { user_id: 'u1', account_role: 'owner' },
      { user_id: 'u2', account_role: 'agent' },
      { user_id: 'u3', account_role: 'viewer' },
    ];
    h.state.conversations = [
      { assigned_agent_id: 'u1', status: 'open', updated_at: null },
      { assigned_agent_id: 'u1', status: 'pending', updated_at: null },
      { assigned_agent_id: 'u2', status: 'closed', updated_at: null },
    ];

    await runAutomationsForTrigger({
      accountId: ACCOUNT,
      triggerType: 'new_message_received',
      contactId: 'c1',
      context: {},
    });

    expect(h.state.conversationUpdates).toContainEqual({
      assigned_agent_id: 'u2',
    });
  });

  it('never assigns to a viewer', async () => {
    h.state.automations = [automation({ trigger_type: 'new_message_received' })];
    h.state.steps = [step('assign_conversation', { mode: 'round_robin' })];
    h.state.profiles = [
      { user_id: 'u1', account_role: 'agent' },
      { user_id: 'u0', account_role: 'viewer' },
    ];
    h.state.conversations = [];

    await runAutomationsForTrigger({
      accountId: ACCOUNT,
      triggerType: 'new_message_received',
      contactId: 'c1',
      context: {},
    });

    expect(h.state.conversationUpdates).toContainEqual({
      assigned_agent_id: 'u1',
    });
  });
});

describe('interpolate — contact and appointment tokens', () => {
  it('renders the contact first name and a human appointment date/time', async () => {
    h.state.automations = [automation({ trigger_type: 'appointment_reminder' })];
    h.state.steps = [
      step('send_message', {
        text: 'Hi {{ contact.first_name }}, reminder: {{ appointment.date }} at {{ appointment.time }}. Ref {{ appointment.booking_id }}.',
      }),
    ];

    await runAutomationsForTrigger({
      accountId: ACCOUNT,
      triggerType: 'appointment_reminder',
      contactId: 'c1',
      context: {
        conversation_id: 'conv1',
        vars: {
          appointment_date: '2026-08-25',
          appointment_time: '14:30',
          booking_id: 'BK-9001',
        },
      },
    });

    expect(sendText).toHaveBeenCalledTimes(1);
    const arg = sendText.mock.calls[0][0] as unknown as { text: string };
    expect(arg.text).toBe(
      'Hi Riya, reminder: 25 Aug 2026 at 2:30 PM. Ref BK-9001.'
    );
  });

  it('leaves unknown tokens blank rather than printing them', async () => {
    h.state.automations = [automation({ trigger_type: 'new_message_received' })];
    h.state.steps = [
      step('send_message', { text: 'Hello{{ contact.nmae }} there' }),
    ];

    await runAutomationsForTrigger({
      accountId: ACCOUNT,
      triggerType: 'new_message_received',
      contactId: 'c1',
      context: { conversation_id: 'conv1' },
    });

    const arg = sendText.mock.calls[0][0] as unknown as { text: string };
    expect(arg.text).toBe('Hello there');
  });
});

describe('send_webhook — egress rules', () => {
  function lastLogStatus() {
    const withSteps = h.state.logUpdates.filter((u) => u.steps_executed);
    const last = withSteps[withSteps.length - 1] as
      | { steps_executed: { status: string; detail?: string }[] }
      | undefined;
    return last?.steps_executed?.[0];
  }

  it('refuses the cloud metadata address without making a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    h.state.automations = [automation({ trigger_type: 'new_message_received' })];
    h.state.steps = [
      step('send_webhook', { url: 'http://169.254.169.254/latest/meta-data/' }),
    ];

    await runAutomationsForTrigger({
      accountId: ACCOUNT,
      triggerType: 'new_message_received',
      contactId: 'c1',
      context: {},
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(lastLogStatus()?.status).toBe('failed');
  });

  it('refuses loopback and non-http schemes', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    h.state.automations = [automation({ trigger_type: 'new_message_received' })];

    for (const url of ['http://127.0.0.1:5432/hook', 'file:///etc/passwd']) {
      h.state.logUpdates = [];
      h.state.steps = [step('send_webhook', { url })];
      await runAutomationsForTrigger({
        accountId: ACCOUNT,
        triggerType: 'new_message_received',
        contactId: 'c1',
        context: {},
      });
      expect(lastLogStatus()?.status).toBe('failed');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries a 500 and succeeds on the next attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    h.state.automations = [automation({ trigger_type: 'new_message_received' })];
    h.state.steps = [
      step('send_webhook', { url: 'https://hooks.example.com/inbound' }),
    ];

    await runAutomationsForTrigger({
      accountId: ACCOUNT,
      triggerType: 'new_message_received',
      contactId: 'c1',
      context: {},
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const result = lastLogStatus();
    expect(result?.status).toBe('success');
    expect(result?.detail).toContain('2 attempts');
  });

  it('does not retry a 400 and does not follow redirects', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400 });
    vi.stubGlobal('fetch', fetchMock);
    h.state.automations = [automation({ trigger_type: 'new_message_received' })];
    h.state.steps = [
      step('send_webhook', { url: 'https://hooks.example.com/inbound' }),
    ];

    await runAutomationsForTrigger({
      accountId: ACCOUNT,
      triggerType: 'new_message_received',
      contactId: 'c1',
      context: {},
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
    expect(lastLogStatus()?.status).toBe('failed');
  });
});
