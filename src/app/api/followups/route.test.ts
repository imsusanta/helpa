import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireRole, mockFrom } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/auth/account', () => ({
  requireRole: (...args: unknown[]) => requireRole(...args),
}));

vi.mock('@/lib/db/server', () => ({
  getAdminClient: () => ({ from: mockFrom }),
}));

import { POST } from '@/app/api/followups/route';

describe('POST /api/followups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({
      accountId: 'tenant-a',
      userId: 'user-1',
      role: 'agent',
    });
  });

  it('rejects a patient_id that does not belong to the session tenant', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));

    const res = await POST(
      new Request('http://localhost/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: 'foreign-contact',
          due_date: '2026-09-10',
        }),
      })
    );
    const json = await res.json();
    expect(res.status).toBe(404);
    expect(json.error).toMatch(/Contact not found/i);
  });
});
