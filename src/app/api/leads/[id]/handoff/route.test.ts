import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.fn();
const constructed: Array<{ accountId: string; actorId: string }> = [];
const handoffToHuman = vi.fn();
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/auth/account', () => ({
  requireRole: (...args: unknown[]) => requireRole(...args),
  toErrorResponse: (err: { status?: number; message?: string }) =>
    new Response(JSON.stringify({ error: err.message || 'Unauthorized' }), {
      status: err.status || 401,
      headers: { 'Content-Type': 'application/json' },
    }),
  UnauthorizedError: class UnauthorizedError extends Error {
    status = 401 as const;
  },
  ForbiddenError: class ForbiddenError extends Error {
    status = 403 as const;
  },
}));

vi.mock('@/core/actions/action-executor', () => ({
  TrustedActionExecutor: class {
    constructor(ctx: { accountId: string; actorId: string }) {
      constructed.push({ accountId: ctx.accountId, actorId: ctx.actorId });
    }
    handoffToHuman = handoffToHuman;
  },
}));

vi.mock('@/lib/db/server', () => ({
  getAdminClient: () => ({
    from: mockFrom,
  }),
}));

import { POST } from '@/app/api/leads/[id]/handoff/route';

function chainable(result: unknown) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.update = self;
  chain.eq = self;
  chain.order = self;
  chain.limit = self;
  chain.in = () => Promise.resolve({ data: [], error: null });
  chain.maybeSingle = async () => ({ data: result, error: null });
  return chain;
}

describe('POST /api/leads/[id]/handoff', () => {
  beforeEach(() => {
    requireRole.mockReset();
    constructed.length = 0;
    handoffToHuman.mockReset();
    handoffToHuman.mockResolvedValue({
      success: true,
      data: { aiEnabled: false },
    });
    mockFrom.mockReset();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'leads') {
        return chainable({
          id: 'lead-1',
          contact_id: 'contact-1',
          conversation_id: 'conv-from-lead',
        });
      }
      if (table === 'conversations') {
        return chainable({ id: 'conv-1' });
      }
      return chainable(null);
    });
    requireRole.mockResolvedValue({
      accountId: 'session-tenant',
      userId: 'user-1',
      role: 'agent',
    });
  });

  it('ignores a client-supplied accountId and uses the session tenant', async () => {
    const req = new Request('http://localhost/api/leads/lead-1/handoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'attacker-tenant',
        actorId: 'spoofed-actor',
        conversationId: 'conv-1',
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'lead-1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(requireRole).toHaveBeenCalledWith('agent');
    expect(constructed).toEqual([
      { accountId: 'session-tenant', actorId: 'user-1' },
    ]);
    expect(handoffToHuman).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        leadId: 'lead-1',
      })
    );
  });

  it('resolves conversation from the lead row instead of using the lead id', async () => {
    const req = new Request('http://localhost/api/leads/lead-1/handoff', {
      method: 'POST',
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'lead-1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(handoffToHuman).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-from-lead',
        leadId: 'lead-1',
      })
    );
  });

  it('returns 404 when the lead has no conversation', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'leads') {
        return chainable({
          id: 'lead-1',
          contact_id: 'contact-1',
          conversation_id: null,
        });
      }
      return chainable(null);
    });

    const req = new Request('http://localhost/api/leads/lead-1/handoff', {
      method: 'POST',
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'lead-1' }) });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
    expect(handoffToHuman).not.toHaveBeenCalled();
  });
});
