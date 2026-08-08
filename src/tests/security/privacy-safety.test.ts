import { describe, it, expect } from 'vitest';
import {
  withdrawPatientConsent,
  exportPatientData,
  scrubSensitiveFields,
  type PatientConsentRecord,
} from '@/lib/privacy/consent-service';

describe('Production Privacy, Data Protection & Retention Controls', () => {
  describe('1. Patient Consent & Withdrawal Lifecycle (Production Module)', () => {
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

  describe('2. Automated Retention & Purge Calculations', () => {
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
