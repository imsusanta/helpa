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

import { GET } from '@/app/api/contacts/[id]/activities/route';

describe('GET /api/contacts/[id]/activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({
      accountId: 'tenant-a',
      userId: 'user-1',
      role: 'viewer',
    });
  });

  it('aggregates events from notes, appointments, follow-ups, and messages with tenant isolation', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'contacts') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'contact-1',
              name: 'John Doe',
              phone: '+1234567890',
              account_id: 'tenant-a',
            },
            error: null,
          }),
        };
      }
      if (table === 'conversations') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (cb: (val: unknown) => unknown) =>
            Promise.resolve({
              data: [
                {
                  id: 'conv-1',
                  channel: 'whatsapp',
                  status: 'open',
                  created_at: '2026-08-01T10:00:00Z',
                },
              ],
            }).then(cb),
        };
      }
      if (table === 'contact_notes') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'note-1',
                note_text: 'Spoke regarding pricing',
                created_at: '2026-08-01T12:00:00Z',
                user_id: 'user-1',
              },
            ],
            error: null,
          }),
        };
      }
      if (table === 'appointments') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'appt-1',
                appointment_date: '2026-08-02',
                appointment_time: '10:00',
                status: 'confirmed',
                notes: 'General Checkup',
                created_at: '2026-08-01T11:00:00Z',
              },
            ],
            error: null,
          }),
        };
      }
      if (table === 'deals') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (cb: (val: unknown) => unknown) =>
            Promise.resolve({ data: [] }).then(cb),
        };
      }
      if (table === 'hospital_followups') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'fu-1',
                followup_type: 'Call Review',
                due_date: '2026-08-05',
                status: 'scheduled',
                notes: null,
                created_at: '2026-08-01T13:00:00Z',
              },
            ],
            error: null,
          }),
        };
      }
      if (table === 'messages') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'msg-1',
                conversation_id: 'conv-1',
                sender_type: 'contact',
                content_text: 'Hello there',
                created_at: '2026-08-01T10:05:00Z',
                status: 'delivered',
              },
            ],
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    const req = new NextRequest(
      'http://localhost/api/contacts/contact-1/activities'
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: 'contact-1' }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(4);

    // Verify sorted in descending order
    const timestamps = json.data.map((a: { created_at: string }) =>
      new Date(a.created_at).getTime()
    );
    for (let i = 0; i < timestamps.length - 1; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
    }
  });

  it('returns 404 if contact belongs to another tenant (Tenant Isolation)', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'contacts') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null, // Not found in tenant-a
            error: null,
          }),
        };
      }
      return { select: vi.fn().mockReturnThis() };
    });

    const req = new NextRequest(
      'http://localhost/api/contacts/contact-tenant-b/activities'
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: 'contact-tenant-b' }),
    });
    expect(res.status).toBe(404);
  });
});
