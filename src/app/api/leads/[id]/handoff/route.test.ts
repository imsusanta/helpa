import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.fn();
const constructed: Array<{ accountId: string; actorId: string }> = [];
const handoffToHuman = vi.fn();

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

import { POST } from '@/app/api/leads/[id]/handoff/route';

describe('POST /api/leads/[id]/handoff', () => {
  beforeEach(() => {
    requireRole.mockReset();
    constructed.length = 0;
    handoffToHuman.mockReset();
    handoffToHuman.mockResolvedValue({ success: true, data: { aiEnabled: false } });
  });

  it('ignores a client-supplied accountId and uses the session tenant', async () => {
    requireRole.mockResolvedValue({
      accountId: 'session-tenant',
      userId: 'user-1',
      role: 'agent',
    });

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
});
