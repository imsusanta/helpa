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

import { POST } from '@/app/api/contacts/bulk/route';

describe('POST /api/contacts/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({
      accountId: 'tenant-a',
      userId: 'user-1',
      role: 'agent',
    });
  });

  it('rejects invalid action', async () => {
    const req = new NextRequest('http://localhost:3000/api/contacts/bulk', {
      method: 'POST',
      body: JSON.stringify({
        action: 'invalid_action',
        contact_ids: ['c-1'],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('INVALID_ACTION');
  });

  it('rejects empty contact_ids array', async () => {
    const req = new NextRequest('http://localhost:3000/api/contacts/bulk', {
      method: 'POST',
      body: JSON.stringify({
        action: 'add_tag',
        contact_ids: [],
        payload: { tag_id: 'tag-1' },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('INVALID_PAYLOAD');
  });

  it('blocks bulk operations if no contact belongs to workspace', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'contacts') {
        const query: Record<string, unknown> = {};
        query.select = vi.fn().mockReturnValue(query);
        query.eq = vi.fn().mockReturnValue(query);
        query.in = vi.fn().mockResolvedValue({
          data: [],
          error: null,
        });
        return query;
      }
      return {};
    });

    const req = new NextRequest('http://localhost:3000/api/contacts/bulk', {
      method: 'POST',
      body: JSON.stringify({
        action: 'add_tag',
        contact_ids: ['c-cross-tenant-1'],
        payload: { tag_id: 'tag-1' },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('NO_MATCHING_CONTACTS');
  });

  it('handles bulk assign and verifies teammate membership', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'contacts') {
        const query: Record<string, unknown> = {};
        query.select = vi.fn().mockReturnValue(query);
        query.eq = vi.fn().mockReturnValue(query);
        query.in = vi.fn().mockResolvedValue({
          data: [{ id: 'c-1' }, { id: 'c-2' }],
          error: null,
        });
        query.update = vi.fn().mockReturnValue(query);
        return query;
      }
      if (table === 'account_members') {
        const query: Record<string, unknown> = {};
        query.select = vi.fn().mockReturnValue(query);
        query.eq = vi.fn().mockReturnValue(query);
        query.maybeSingle = vi.fn().mockResolvedValue({
          data: { user_id: 'teammate-1', account_id: 'tenant-a' },
          error: null,
        });
        return query;
      }
      return {};
    });

    const req = new NextRequest('http://localhost:3000/api/contacts/bulk', {
      method: 'POST',
      body: JSON.stringify({
        action: 'assign',
        contact_ids: ['c-1', 'c-2'],
        payload: { assigned_user_id: 'teammate-1' },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.count).toBe(2);
  });

  it('handles bulk add_tag with upsert', async () => {
    const upsertSpy = vi.fn().mockResolvedValue({ error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'contacts') {
        const query: Record<string, unknown> = {};
        query.select = vi.fn().mockReturnValue(query);
        query.eq = vi.fn().mockReturnValue(query);
        query.in = vi.fn().mockResolvedValue({
          data: [{ id: 'c-1' }, { id: 'c-2' }],
          error: null,
        });
        return query;
      }
      if (table === 'tags') {
        const query: Record<string, unknown> = {};
        query.select = vi.fn().mockReturnValue(query);
        query.eq = vi.fn().mockReturnValue(query);
        query.maybeSingle = vi.fn().mockResolvedValue({
          data: { id: 'vip-tag', account_id: 'tenant-a' },
          error: null,
        });
        return query;
      }
      if (table === 'contact_tags') {
        return {
          upsert: upsertSpy,
        };
      }
      return {};
    });

    const req = new NextRequest('http://localhost:3000/api/contacts/bulk', {
      method: 'POST',
      body: JSON.stringify({
        action: 'add_tag',
        contact_ids: ['c-1', 'c-2'],
        payload: { tag_id: 'vip-tag' },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(upsertSpy).toHaveBeenCalledWith(
      [
        { account_id: 'tenant-a', contact_id: 'c-1', tag_id: 'vip-tag' },
        { account_id: 'tenant-a', contact_id: 'c-2', tag_id: 'vip-tag' },
      ],
      { onConflict: 'contact_id,tag_id' }
    );
  });

  it('handles bulk create_followup batch inserting tasks', async () => {
    const insertSpy = vi.fn().mockResolvedValue({ error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'contacts') {
        const query: Record<string, unknown> = {};
        query.select = vi.fn().mockReturnValue(query);
        query.eq = vi.fn().mockReturnValue(query);
        query.in = vi.fn().mockResolvedValue({
          data: [{ id: 'c-1' }, { id: 'c-2' }],
          error: null,
        });
        return query;
      }
      if (table === 'hospital_followups') {
        return {
          insert: insertSpy,
        };
      }
      return {};
    });

    const req = new NextRequest('http://localhost:3000/api/contacts/bulk', {
      method: 'POST',
      body: JSON.stringify({
        action: 'create_followup',
        contact_ids: ['c-1', 'c-2'],
        payload: {
          followup_type: 'Quarterly Check-in',
          due_date: '2026-09-01',
          notes: 'Call patient regarding renewal',
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(insertSpy).toHaveBeenCalled();
  });
});
