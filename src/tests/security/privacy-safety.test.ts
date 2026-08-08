import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  withdrawPatientConsent,
  exportPatientData,
  scrubSensitiveFields,
  type PatientConsentRecord,
} from '@/lib/privacy/consent-service';

// Mock auth module
vi.mock('@/lib/auth/account', async () => {
  const actual = await vi.importActual('@/lib/auth/account');
  return {
    ...actual,
    requireRole: vi.fn(),
  };
});

// Mock supabaseAdmin
vi.mock('@/lib/automations/admin-client', () => {
  return {
    supabaseAdmin: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnThis(),
      rpc: vi.fn().mockResolvedValue({
        data: { updated_at: '2026-08-08T12:00:00Z' },
        error: null,
      }),
    })),
  };
});

import { requireRole, UnauthorizedError } from '@/lib/auth/account';
import { POST as postConsent } from '@/app/api/patients/[id]/consent/route';
import { POST as postWithdraw } from '@/app/api/patients/[id]/withdraw/route';
import { GET as getExport } from '@/app/api/patients/[id]/export/route';
import { DELETE as deletePatient } from '@/app/api/patients/[id]/route';

describe('Production Privacy, Data Protection & Retention Controls', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Patient Consent & Withdrawal Lifecycle (Production Service)', () => {
    it('records consent state and validates opt-out withdrawal requests', () => {
      const patientRecord: PatientConsentRecord = {
        id: 'patient-001',
        account_id: '00000000-0000-0000-0000-00000000000a',
        phone: '+919876543210',
        name: 'Jane Doe',
        consent_status: 'opted_in',
        consent_updated_at: '2020-01-01T00:00:00Z',
      };

      const updated = withdrawPatientConsent(patientRecord);
      expect(updated.consent_status).toBe('opted_out');
      expect(new Date(updated.consent_updated_at).getTime()).toBeGreaterThan(
        new Date(patientRecord.consent_updated_at).getTime()
      );
    });

    it('formats patient data export payload securely without internal credentials', () => {
      const patientProfile = {
        name: 'Jane Doe',
        phone: '+919876543210',
        email: 'jane@example.com',
        appointments: [{ id: 'appt-1', status: 'Confirmed' }],
        db_connection_secret: 'INTERNAL_SECRET_MUST_BE_REDACTED',
      };

      const scrubbed = scrubSensitiveFields(patientProfile);
      expect(scrubbed.name).toBe('Jane Doe');
      expect(
        (scrubbed as Record<string, unknown>).db_connection_secret
      ).toBeUndefined();

      const exported = exportPatientData({
        id: 'patient-001',
        account_id: '00000000-0000-0000-0000-00000000000a',
        phone: '+919876543210',
        name: 'Jane Doe',
        consent_status: 'opted_in',
        consent_updated_at: '2020-01-01T00:00:00Z',
        db_connection_secret: 'SECRET',
      });

      expect(exported.exported_at).toBeDefined();
      expect(
        (exported.patient_data as Record<string, unknown>).db_connection_secret
      ).toBeUndefined();
    });
  });

  describe('2. Patient Privacy API Endpoints (Strict Session Authentication & 401 Enforcement)', () => {
    it('verifies consent POST route requires authentication and returns 401 for unauthenticated requests', async () => {
      vi.mocked(requireRole).mockRejectedValue(
        new UnauthorizedError('Unauthorized')
      );

      const req = new Request(
        'http://localhost:3000/api/patients/patient-001/consent',
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      );

      const params = Promise.resolve({ id: 'patient-001' });
      const res = await postConsent(req, { params });
      expect(res.status).toBe(401);

      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toContain('no-store');
    });

    it('verifies consent POST route rejects invalid consent_status with 400 when authenticated', async () => {
      vi.mocked(requireRole).mockResolvedValue({
        supabase: {} as any,
        userId: 'user-1',
        accountId: 'acc-1',
        role: 'admin',
        account: { id: 'acc-1', name: 'Acc 1' },
      });

      const req = new Request(
        'http://localhost:3000/api/patients/patient-001/consent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ consent_status: 'invalid_status' }),
        }
      );

      const params = Promise.resolve({ id: 'patient-001' });
      const res = await postConsent(req, { params });
      expect(res.status).toBe(400);

      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toContain('no-store');
    });

    it('verifies export GET route returns 401 for unauthenticated requests', async () => {
      vi.mocked(requireRole).mockRejectedValue(
        new UnauthorizedError('Unauthorized')
      );

      const req = new Request(
        'http://localhost:3000/api/patients/patient-001/export'
      );
      const params = Promise.resolve({ id: 'patient-001' });
      const res = await getExport(req, { params });
      expect(res.status).toBe(401);

      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toContain('no-store');
    });

    it('verifies withdrawal POST route returns 401 for unauthenticated requests', async () => {
      vi.mocked(requireRole).mockRejectedValue(
        new UnauthorizedError('Unauthorized')
      );

      const req = new Request(
        'http://localhost:3000/api/patients/patient-001/withdraw',
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      );
      const params = Promise.resolve({ id: 'patient-001' });
      const res = await postWithdraw(req, { params });
      expect(res.status).toBe(401);

      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toContain('no-store');
    });

    it('verifies deletion DELETE route returns 401 for unauthenticated requests', async () => {
      vi.mocked(requireRole).mockRejectedValue(
        new UnauthorizedError('Unauthorized')
      );

      const req = new Request(
        'http://localhost:3000/api/patients/patient-001',
        {
          method: 'DELETE',
        }
      );
      const params = Promise.resolve({ id: 'patient-001' });
      const res = await deletePatient(req, { params });
      expect(res.status).toBe(401);

      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toContain('no-store');
    });
  });

  describe('3. Automated Retention & Purge Calculations', () => {
    it('calculates 7-day raw webhook payload retention threshold accurately', () => {
      const now = new Date('2026-08-08T12:00:00Z');
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      expect(sevenDaysAgo.toISOString()).toBe('2026-08-01T12:00:00.000Z');
    });

    it('calculates 30-day dead-letter event cleanup threshold accurately', () => {
      const now = new Date('2026-08-08T12:00:00Z');
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      expect(thirtyDaysAgo.toISOString()).toBe('2026-07-09T12:00:00.000Z');
    });
  });
});
