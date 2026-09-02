import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { requireHealthWorkplace, mockFrom } = vi.hoisted(() => ({
  requireHealthWorkplace: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/auth/industry', () => ({
  requireHealthWorkplace: (...args: unknown[]) =>
    requireHealthWorkplace(...args),
}));

vi.mock('@/lib/auth/account', () => ({
  toErrorResponse: (err: { status?: number; message?: string }) =>
    new Response(JSON.stringify({ error: err.message || 'error' }), {
      status: err.status || 500,
    }),
}));

vi.mock('@/lib/supabase/server', () => ({
  getAdminClient: () => ({ from: mockFrom }),
}));

import { GET, POST } from '@/app/api/lab-reports/route';

describe('/api/lab-reports tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireHealthWorkplace.mockResolvedValue({
      accountId: 'tenant-a',
      userId: 'user-1',
      role: 'agent',
    });
  });

  it('scopes contact fallback lookups to the session tenant', async () => {
    const contactEq = vi.fn().mockReturnThis();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'hospital_lab_reports') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{ id: 'r1', patient_id: 'contact-b', patient: null }],
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: contactEq,
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    const res = await GET(new NextRequest('http://localhost/api/lab-reports'));
    expect(res.status).toBe(200);
    expect(contactEq).toHaveBeenCalledWith('account_id', 'tenant-a');
  });

  it('rejects creating a report for a patient outside the tenant', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'contacts') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        insert: vi.fn(),
      };
    });

    const res = await POST(
      new NextRequest('http://localhost/api/lab-reports', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: 'foreign-contact',
          test_name: 'CBC',
        }),
      })
    );
    const json = await res.json();
    expect(res.status).toBe(404);
    expect(json.error).toMatch(/Patient not found/i);
  });
});
