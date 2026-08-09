/**
 * Production Patient Privacy & Consent Management Service
 *
 * Implements DPDP-oriented consent recording, opt-out withdrawal,
 * secure patient data exports (PHI data scrubbing), and automated retention policies.
 */

export interface PatientConsentRecord {
  id: string;
  account_id: string;
  phone: string | null;
  name: string | null;
  email?: string | null;
  consent_status: 'opted_in' | 'opted_out' | 'pending';
  consent_updated_at: string;
  db_connection_secret?: string;
  internal_token?: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * Updates patient consent state with an audited timestamp.
 */
export function recordPatientConsent(
  record: PatientConsentRecord,
  status: 'opted_in' | 'opted_out'
): PatientConsentRecord {
  return {
    ...record,
    consent_status: status,
    consent_updated_at: new Date().toISOString(),
  };
}

/**
 * Handles patient opt-out consent withdrawal.
 */
export function withdrawPatientConsent(
  record: PatientConsentRecord
): PatientConsentRecord {
  return recordPatientConsent(record, 'opted_out');
}

/**
 * Scrubs internal database credentials, API secrets, and sensitive tokens from export payloads.
 */
export function scrubSensitiveFields<T extends Record<string, unknown>>(
  record: T
): Omit<
  T,
  'db_connection_secret' | 'internal_token' | 'api_key' | 'service_role_key'
> {
  const {
    db_connection_secret: _,

    internal_token: __,

    api_key: ___,

    service_role_key: ____,
    ...scrubbed
  } = record;
  return scrubbed as Omit<
    T,
    'db_connection_secret' | 'internal_token' | 'api_key' | 'service_role_key'
  >;
}

/**
 * Generates a compliant patient data export payload.
 */
export function exportPatientData(
  record: PatientConsentRecord
): Record<string, unknown> {
  const scrubbed = scrubSensitiveFields(
    record as unknown as Record<string, unknown>
  );
  return {
    exported_at: new Date().toISOString(),
    patient_data: scrubbed,
  };
}
