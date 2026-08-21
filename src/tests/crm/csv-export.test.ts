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

import { GET } from '@/app/api/contacts/export/route';
import { sanitizeCsvValue } from '@/lib/csv-utils';

describe('CSV Export & Formula Injection Sanitization', () => {
  it('neutralizes spreadsheet formula injection payloads', () => {
    expect(sanitizeCsvValue('=cmd|"/C calc"!A0')).toBe(
      '"\'=cmd|""/C calc""!A0"'
    );
    expect(sanitizeCsvValue('+12345')).toBe('"\'+12345"');
    expect(sanitizeCsvValue('-100')).toBe('"\'-100"');
    expect(sanitizeCsvValue('@SUM(A1:A10)')).toBe('"\'@SUM(A1:A10)"');
    expect(sanitizeCsvValue('Normal Name')).toBe('"Normal Name"');
    expect(sanitizeCsvValue(null)).toBe('""');
    expect(sanitizeCsvValue(undefined)).toBe('""');
  });

  describe('GET /api/contacts/export', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      requireRole.mockResolvedValue({ accountId: 'tenant-a', role: 'viewer' });
    });

    it('returns CSV file strictly scoped to account_id', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'c-1',
              name: 'Dr. John Doe',
              phone: '+919876543210',
              email: 'john@example.com',
              company: 'City Hospital',
              address: '123 Health Ave',
              notes: 'Regular checkup',
              created_at: '2026-08-01T00:00:00Z',
              assigned_user_id: null,
            },
          ],
          error: null,
        }),
      };

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'contacts') return mockQuery;
        if (table === 'contact_tags') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ contact_id: 'c-1', tags: { name: 'VIP' } }],
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const req = new NextRequest('http://localhost/api/contacts/export');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      expect(res.headers.get('content-disposition')).toContain(
        'attachment; filename='
      );

      const text = await res.text();
      expect(text).toContain(
        '"Name","Phone","Email","Company","Address","Tags","Notes","Created At"'
      );
      expect(text).toContain(
        '"Dr. John Doe","\'+919876543210","john@example.com","City Hospital"'
      );
      expect(text).toContain('"VIP"');

      // Verify that query was filtered by tenant-a
      expect(mockQuery.eq).toHaveBeenCalledWith('account_id', 'tenant-a');
    });
  });
});
