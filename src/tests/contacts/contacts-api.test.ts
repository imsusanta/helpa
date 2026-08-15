import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { requireRole, mockSupabaseFrom } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  mockSupabaseFrom: vi.fn(),
}));

vi.mock('@/lib/auth/account', () => ({
  requireRole,
  UnauthorizedError: class UnauthorizedError extends Error {},
  ForbiddenError: class ForbiddenError extends Error {},
}));

vi.mock('@/lib/supabase/server', () => ({
  getAdminClient: () => ({
    from: mockSupabaseFrom,
  }),
}));

import { GET } from '@/app/api/contacts/route';
import { ForbiddenError, UnauthorizedError } from '@/lib/auth/account';

function request(url = 'http://localhost/api/contacts'): NextRequest {
  return new NextRequest(url, { headers: { 'x-request-id': 'req-contacts' } });
}

describe('GET /api/contacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ accountId: 'tenant-a', role: 'viewer' });
  });

  it('lists only the account derived from server authorization', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'contact-a',
            account_id: 'tenant-a',
            name: 'Patient A',
            phone: '+15555550100',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
        count: 1,
        error: null,
      }),
    };
    mockSupabaseFrom.mockReturnValue(
      mockQuery as unknown as Record<string, unknown>
    );

    const response = await GET(
      request(
        'http://localhost/api/contacts?accountId=tenant-b&limit=10&offset=0'
      )
    );
    expect(response.status).toBe(200);
    expect(mockQuery.eq).toHaveBeenCalledWith('account_id', 'tenant-a');
    expect(mockQuery.range).toHaveBeenCalledWith(0, 9);
    expect((await response.json()).data[0].account_id).toBe('tenant-a');
  });

  it('returns a genuine empty page without creating records', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [],
        count: 0,
        error: null,
      }),
    };
    mockSupabaseFrom.mockReturnValue(
      mockQuery as unknown as Record<string, unknown>
    );

    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: [], total: 0 });
  });

  it('returns AUTH_REQUIRED for missing or expired sessions', async () => {
    requireRole.mockRejectedValue(new UnauthorizedError());
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: 'AUTH_REQUIRED' });
  });

  it('returns ACCOUNT_MEMBERSHIP_REQUIRED for a non-member', async () => {
    requireRole.mockRejectedValue(new ForbiddenError());
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: 'ACCOUNT_MEMBERSHIP_REQUIRED',
    });
  });

  it('handles database error gracefully', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: null,
        count: null,
        error: { message: 'Database error' },
      }),
    };
    mockSupabaseFrom.mockReturnValue(
      mockQuery as unknown as Record<string, unknown>
    );

    const response = await GET(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: 'CONTACTS_QUERY_FAILED',
    });
  });

  it('keeps search and pagination tenant-scoped', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [],
        count: 0,
        error: null,
      }),
    };
    mockSupabaseFrom.mockReturnValue(
      mockQuery as unknown as Record<string, unknown>
    );

    await GET(
      request('http://localhost/api/contacts?search=Ana&limit=25&offset=50')
    );
    expect(mockQuery.eq).toHaveBeenCalledWith('account_id', 'tenant-a');
    expect(mockQuery.range).toHaveBeenCalledWith(50, 74);
    expect(mockQuery.or).toHaveBeenCalledWith(
      'name.ilike.%Ana%,phone.ilike.%Ana%,email.ilike.%Ana%'
    );
  });
});
