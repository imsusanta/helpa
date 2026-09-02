import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { requireRole, requireTravelWorkplace, mockFrom } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  requireTravelWorkplace: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/auth/account', () => ({
  requireRole: (...args: unknown[]) => requireRole(...args),
  toErrorResponse: (err: { status?: number; message?: string }) =>
    new Response(JSON.stringify({ error: err.message || 'error' }), {
      status: err.status || 500,
    }),
  UnauthorizedError: class UnauthorizedError extends Error {
    status = 401 as const;
  },
  ForbiddenError: class ForbiddenError extends Error {
    status = 403 as const;
  },
}));

vi.mock('@/lib/travel/access', () => ({
  requireTravelWorkplace: (...args: unknown[]) =>
    requireTravelWorkplace(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  getAdminClient: () => ({ from: mockFrom }),
}));

vi.mock('@/lib/automations/engine', () => ({
  runAutomationsForTrigger: vi.fn(),
}));
vi.mock('@/lib/automations/appointment-triggers', () => ({
  scheduleAppointmentReminders: vi.fn(),
}));
vi.mock('@/lib/booking-form/config', () => ({
  getBookingIndustry: () => 'health',
}));
vi.mock('@/lib/travel/staff-booking', () => ({
  insertTravelBookingRow: vi.fn(),
  parseTravelBookingNotes: () => ({}),
  resolveTravelBookingPackageId: vi.fn(),
}));
vi.mock('@/lib/metrics/safe-record', () => ({
  safeRecordOutcomeEvent: vi.fn(),
}));

import { POST as postInvoice } from '@/app/api/invoices/route';
import { POST as postQuotation } from '@/app/api/quotations/route';
import { POST as postAppointment } from '@/app/api/appointments/route';

describe('tenant-scoped contact writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({
      accountId: 'tenant-a',
      userId: 'user-1',
      role: 'agent',
    });
    requireTravelWorkplace.mockResolvedValue({
      accountId: 'tenant-a',
      userId: 'user-1',
      role: 'agent',
    });
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));
  });

  it('rejects an invoice for a contact outside the tenant', async () => {
    const res = await postInvoice(
      new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          contact_id: 'foreign-contact',
          items: [{ description: 'Consult', quantity: 1, unit_price: 100 }],
        }),
      })
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('CONTACT_NOT_FOUND');
  });

  it('rejects a quotation for a contact outside the tenant', async () => {
    const res = await postQuotation(
      new NextRequest('http://localhost/api/quotations', {
        method: 'POST',
        body: JSON.stringify({
          contact_id: 'foreign-contact',
          items: [{ description: 'Tour', quantity: 1, unit_price: 100 }],
        }),
      })
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('CONTACT_NOT_FOUND');
  });

  it('rejects an appointment for a patient outside the tenant', async () => {
    const res = await postAppointment(
      new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: 'foreign-contact',
          appointment_date: '2026-09-10',
          appointment_time: '10:00',
        }),
      })
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/Patient not found/i);
  });
});
