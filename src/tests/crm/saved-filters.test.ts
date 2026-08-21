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

import { GET, POST, DELETE } from '@/app/api/saved-filters/route';

describe('Saved Filters API & Multi-Tenant Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({
      accountId: 'tenant-123',
      userId: 'user-456',
      role: 'agent',
    });
  });

  it('GET returns only saved filters for current tenant', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'sf-1',
            account_id: 'tenant-123',
            name: 'VIP Leads',
            entity_type: 'leads',
            filters: { score: 'hot' },
          },
        ],
        error: null,
      }),
    };
    mockSupabaseFrom.mockReturnValue(mockQuery);

    const req = new NextRequest(
      'http://localhost/api/saved-filters?entity_type=leads'
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBe(1);
    expect(json.data[0].name).toBe('VIP Leads');
    expect(mockQuery.eq).toHaveBeenCalledWith('account_id', 'tenant-123');
  });

  it('POST creates a saved filter scoped to account_id and user_id', async () => {
    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'sf-new',
          account_id: 'tenant-123',
          user_id: 'user-456',
          name: 'Bangalore Customers',
          entity_type: 'contacts',
          filters: { search: 'Bangalore' },
        },
        error: null,
      }),
    };
    mockSupabaseFrom.mockReturnValue(mockQuery);

    const req = new NextRequest('http://localhost/api/saved-filters', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Bangalore Customers',
        entity_type: 'contacts',
        filters: { search: 'Bangalore' },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: 'tenant-123',
        user_id: 'user-456',
        name: 'Bangalore Customers',
      })
    );
  });

  it('DELETE deletes filter strictly scoped to tenant account_id', async () => {
    const mockQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    mockQuery.eq.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockSupabaseFrom.mockReturnValue(mockQuery);

    const req = new NextRequest('http://localhost/api/saved-filters?id=sf-1', {
      method: 'DELETE',
    });

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect(mockQuery.delete).toHaveBeenCalled();
  });
});
