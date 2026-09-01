import { createHash } from 'crypto';
import { getAdminClient } from '@/lib/supabase/server';

export type OutcomeEventName =
  | 'inbound_message_received'
  | 'first_response_sent'
  | 'outbound_message_sent'
  | 'booking_confirmed'
  | 'automation_eligible'
  | 'automation_completed'
  | 'staff_takeover'
  | 'automation_error'
  | 'appointment_completed'
  | 'patient_return_completed'
  | 'message_delivery_failed'
  | 'webhook_failed'
  | 'ai_failed'
  | 'worker_failed'
  | 'integration_failed';

export interface OutcomeEventInput {
  accountId: string;
  eventName: OutcomeEventName;
  eventVersion?: 1;
  occurredAt?: Date | string;
  sourceId: string;
  subjectHash?: string | null;
  isSynthetic?: boolean;
  isTestTenant?: boolean;
  attributes?: Record<string, unknown>;
}

const PROHIBITED_ATTRIBUTE_KEYS = [
  'name',
  'patient_name',
  'patient_id',
  'phone',
  'phone_number',
  'email',
  'message',
  'message_body',
  'text',
  'content',
  'address',
  'medical_record',
  'prescription',
];

/**
 * Creates a deterministic, one-way 64-character SHA-256 hash for cohort deduplication
 * without storing or exposing raw patient identifiers.
 */
export function createSubjectHash(
  accountId: string,
  rawIdentifier: string
): string {
  const pepper =
    process.env.OUTCOME_METRICS_PEPPER || process.env.META_APP_SECRET;
  if (!pepper) {
    // Fail closed in production: a public constant pepper would make the
    // one-way subject hashes vulnerable to offline dictionary attacks on
    // phone numbers / patient ids.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'OUTCOME_METRICS_PEPPER (or META_APP_SECRET) must be configured to hash outcome subjects'
      );
    }
  }
  return createHash('sha256')
    .update(`${accountId}:${pepper || 'helpa-dev-only-salt'}:${rawIdentifier}`)
    .digest('hex');
}

/**
 * Validates that an attributes object contains no direct patient identifiers or message content.
 */
export function sanitizeOutcomeAttributes(
  attributes?: Record<string, unknown>
): Record<string, unknown> {
  if (!attributes) return {};
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(attributes)) {
    const lowerKey = key.toLowerCase();
    const isProhibited = PROHIBITED_ATTRIBUTE_KEYS.some((prohibited) =>
      lowerKey.includes(prohibited)
    );
    if (!isProhibited && value !== undefined) {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

/**
 * Validates and ensures the source ID is an opaque string between 16 and 200 characters.
 */
export function normalizeSourceId(sourceId: string): string {
  if (!sourceId || sourceId.length < 16) {
    return createHash('sha256')
      .update(sourceId || 'opaque-source-id')
      .digest('hex')
      .slice(0, 32);
  }
  if (sourceId.length > 200) {
    return sourceId.slice(0, 200);
  }
  return sourceId;
}

/**
 * Ingests a privacy-safe product outcome event server-side with strict RLS and idempotency.
 */
export async function recordOutcomeEvent(
  input: OutcomeEventInput
): Promise<{ recorded: boolean; error?: string }> {
  try {
    if (!input.accountId || !input.eventName) {
      return { recorded: false, error: 'MISSING_REQUIRED_FIELDS' };
    }

    const sourceId = normalizeSourceId(input.sourceId);
    const sanitizedAttributes = sanitizeOutcomeAttributes(input.attributes);
    const occurredAt = input.occurredAt
      ? new Date(input.occurredAt).toISOString()
      : new Date().toISOString();

    const subjectHash = input.subjectHash
      ? /^[a-f0-9]{64}$/.test(input.subjectHash)
        ? input.subjectHash
        : createSubjectHash(input.accountId, input.subjectHash)
      : null;

    const supabase = getAdminClient();
    const { error } = await supabase.from('product_outcome_events').insert({
      account_id: input.accountId,
      event_name: input.eventName,
      event_version: 1,
      occurred_at: occurredAt,
      source_id: sourceId,
      subject_hash: subjectHash,
      is_synthetic: Boolean(input.isSynthetic),
      is_test_tenant: Boolean(input.isTestTenant),
      attributes: sanitizedAttributes,
    });

    if (error) {
      // 23505 = unique_violation (already recorded idempotently)
      if (error.code === '23505') {
        return { recorded: true };
      }
      return { recorded: false, error: error.message };
    }

    return { recorded: true };
  } catch (err) {
    return {
      recorded: false,
      error: err instanceof Error ? err.message : 'INTERNAL_RECORDING_ERROR',
    };
  }
}
