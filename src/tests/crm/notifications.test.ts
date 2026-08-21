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

import { GET, PATCH } from '@/app/api/notifications/route';

describe('In-App Notifications API & Scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({
      accountId: 'tenant-abc',
      userId: 'user-xyz',
      role: 'viewer',
    });
  });

  it('GET returns notifications for current tenant and calculates unread count', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'notif-1',
            title: 'New Lead Captured',
            body: 'Rahul on WhatsApp',
            is_read: false,
            type: 'whatsapp',
          },
          {
            id: 'notif-2',
            title: 'Task Due Today',
            body: 'Follow-up with Dr. Sen',
            is_read: true,
            type: 'task',
          },
        ],
        error: null,
      }),
    };
    mockSupabaseFrom.mockReturnValue(mockQuery);

    const req = new NextRequest('http://localhost/api/notifications');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBe(2);
    expect(json.unreadCount).toBe(1);
    expect(mockQuery.eq).toHaveBeenCalledWith('account_id', 'tenant-abc');
  });

  it('PATCH marks all notifications as read for current user and tenant', async () => {
    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ error: null }),
    };
    mockSupabaseFrom.mockReturnValue(mockQuery);

    const req = new NextRequest('http://localhost/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ markAllRead: true }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(mockQuery.update).toHaveBeenCalledWith({ is_read: true });
    expect(mockQuery.eq).toHaveBeenCalledWith('account_id', 'tenant-abc');
  });
});
