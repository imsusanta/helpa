import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.fn();
const appointmentFilters: Record<string, unknown>[] = [];

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

vi.mock('@/lib/db/server', () => ({
  getAdminClient: () => ({
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      const chain = (): Record<string, unknown> => ({
        select: () => chain(),
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return chain();
        },
        maybeSingle: vi.fn(async () => {
          if (table === 'appointments') appointmentFilters.push({ ...filters });
          return { data: null, error: { message: 'not found' } };
        }),
        single: vi.fn(async () => ({ data: null, error: { message: 'not found' } })),
        insert: () => chain(),
        update: () => chain(),
      });
      return chain();
    },
    storage: {
      from: () => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn().mockReturnValue({ data: null }),
      }),
    },
  }),
}));

vi.mock('@/lib/automations/meta-send', () => ({
  engineSendText: vi.fn(),
  engineSendDocument: vi.fn(),
}));

import { POST } from '@/app/api/appointments/[id]/confirm/route';

describe('POST /api/appointments/[id]/confirm', () => {
  beforeEach(() => {
    requireRole.mockReset();
    appointmentFilters.length = 0;
  });

  it('requires the agent role', async () => {
    requireRole.mockResolvedValue({
      accountId: 'tenant-a',
      userId: 'user-a',
      role: 'agent',
    });

    const req = new Request('http://localhost/api/appointments/appt-1/confirm', {
      method: 'POST',
    }) as unknown as Parameters<typeof POST>[0];

    await POST(req, { params: Promise.resolve({ id: 'appt-1' }) });

    expect(requireRole).toHaveBeenCalledWith('agent');
  });

  it('scopes the appointment lookup to the caller tenant', async () => {
    requireRole.mockResolvedValue({
      accountId: 'tenant-a',
      userId: 'user-a',
      role: 'agent',
    });

    const req = new Request('http://localhost/api/appointments/appt-other/confirm', {
      method: 'POST',
    }) as unknown as Parameters<typeof POST>[0];

    const res = await POST(req, {
      params: Promise.resolve({ id: 'appt-other' }),
    });

    expect(res.status).toBe(404);
    expect(appointmentFilters).toHaveLength(1);
    expect(appointmentFilters[0]).toMatchObject({
      id: 'appt-other',
      account_id: 'tenant-a',
    });
  });
});
