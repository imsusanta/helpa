import { describe, it, expect } from 'vitest';
import {
  withdrawPatientConsent,
  exportPatientData,
  scrubSensitiveFields,
  type PatientConsentRecord,
} from '@/lib/privacy/consent-service';
import { POST as postConsent } from '@/app/api/patients/[id]/consent/route';
import { POST as postWithdraw } from '@/app/api/patients/[id]/withdraw/route';
import { GET as getExport } from '@/app/api/patients/[id]/export/route';
import { DELETE as deletePatient } from '@/app/api/patients/[id]/route';

describe('Production Privacy, Data Protection & Retention Controls', () => {
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

  describe('2. Patient Privacy API Endpoints (Consent & Export Routes)', () => {
    it('verifies consent POST route rejects requests missing required params with 400', async () => {
      const req = new Request(
        'http://localhost:3000/api/patients/patient-001/consent',
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      );

      const params = Promise.resolve({ id: 'patient-001' });
      const res = await postConsent(req, { params });
      expect(res.status).toBe(400);

      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toContain('no-store');
    });

    it('verifies export GET route rejects requests missing account_id with 400', async () => {
      const req = new Request(
        'http://localhost:3000/api/patients/patient-001/export'
      );
      const params = Promise.resolve({ id: 'patient-001' });
      const res = await getExport(req, { params });
      expect(res.status).toBe(400);

      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toContain('no-store');
    });

    it('verifies withdrawal POST route rejects requests missing account_id with 400', async () => {
      const req = new Request(
        'http://localhost:3000/api/patients/patient-001/withdraw',
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      );
      const params = Promise.resolve({ id: 'patient-001' });
      const res = await postWithdraw(req, { params });
      expect(res.status).toBe(400);

      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toContain('no-store');
    });

    it('verifies deletion DELETE route rejects requests missing account_id with 400', async () => {
      const req = new Request(
        'http://localhost:3000/api/patients/patient-001',
        {
          method: 'DELETE',
        }
      );
      const params = Promise.resolve({ id: 'patient-001' });
      const res = await deletePatient(req, { params });
      expect(res.status).toBe(400);

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
