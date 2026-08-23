/**
 * Inbound webhook idempotency ledger.
 *
 * Meta delivers webhooks at-least-once: any non-2xx response (or timeout)
 * is retried with the *same* message id. This ledger records each provider
 * event id so a retry is recognised and not re-delivered into the inbox.
 *
 * DESIGN RULE — the ledger is bookkeeping, never a gate.
 * Every function here is failure-tolerant and NEVER throws. A customer's
 * reply must not be dropped because an auxiliary audit table is
 * unavailable. The original defect in this pipeline was exactly that
 * inversion: a missing ledger table made `beginInboundEvent`'s insert fail,
 * the caller treated it as fatal, and every inbound reply was rejected with
 * a 500 before it was ever persisted.
 *
 * Duplicate suppression is therefore defence-in-depth, not the only
 * safeguard: `messages.message_id` / `messages.provider_message_id` carry
 * unique indexes, and the insert path treats a unique violation as an
 * already-processed success.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/observability/logger';

const TABLE = 'inbound_webhook_events';

export type InboundEventDecision = 'process' | 'skip_duplicate';

interface InboundEventRow {
  status?: string | null;
  retry_count?: number | null;
}

export interface BeginInboundEventArgs {
  db: SupabaseClient;
  eventId: string;
  accountId: string;
  entryId?: string;
  field?: string;
  payload: unknown;
  correlationId?: string;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === '23505' ||
    candidate.message?.toLowerCase().includes('duplicate key') === true
  );
}

/** SQLSTATE 42P01 — relation does not exist. */
function isMissingTable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; message?: string };
  const message = candidate.message?.toLowerCase() ?? '';
  return (
    candidate.code === '42P01' ||
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('schema cache')
  );
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  return (error as { code?: string }).code;
}

/**
 * Register an inbound event before processing it.
 *
 * @returns `'skip_duplicate'` only when we are *confident* this exact event
 *          was already processed to completion. Everything else — including
 *          any ledger failure — returns `'process'`, because delivering a
 *          message twice is recoverable (the unique index on
 *          `messages.message_id` catches it) while dropping one is not.
 */
export async function beginInboundEvent({
  db,
  eventId,
  accountId,
  entryId,
  field,
  payload,
  correlationId,
}: BeginInboundEventArgs): Promise<InboundEventDecision> {
  const nowIso = new Date().toISOString();

  try {
    const { error: insertError } = await db.from(TABLE).insert({
      event_id: eventId,
      account_id: accountId,
      entry_id: entryId ?? null,
      field: field ?? 'messages',
      payload,
      status: 'processing',
      retry_count: 0,
      created_at: nowIso,
      updated_at: nowIso,
    });

    if (!insertError) return 'process';

    if (isMissingTable(insertError)) {
      // Ledger not provisioned. Degrade to the DB-level unique indexes on
      // `messages` rather than refusing the message.
      logger.error(
        'Inbound idempotency ledger unavailable; continuing without it',
        {
          correlationId,
          accountId,
          messageId: eventId,
          table: TABLE,
          code: errorCode(insertError),
          hint: 'Apply migration 20260823130000_fix_inbound_message_pipeline.sql',
        }
      );
      return 'process';
    }

    if (!isUniqueViolation(insertError)) {
      logger.error('Inbound event registration failed; processing anyway', {
        correlationId,
        accountId,
        messageId: eventId,
        code: errorCode(insertError),
      });
      return 'process';
    }

    // Unique violation => this event id was seen before.
    const { data: existing, error: readError } = await db
      .from(TABLE)
      .select('status, retry_count')
      .eq('event_id', eventId)
      .maybeSingle();

    if (readError) {
      logger.warn('Could not inspect duplicate inbound event; processing', {
        correlationId,
        accountId,
        messageId: eventId,
        code: errorCode(readError),
      });
      return 'process';
    }

    const previous = existing as InboundEventRow | null;
    if (previous?.status === 'completed') {
      logger.info('Duplicate inbound delivery skipped', {
        correlationId,
        accountId,
        messageId: eventId,
      });
      return 'skip_duplicate';
    }

    // A prior attempt exists but never completed (crash, transient failure,
    // or a Meta retry overlapping an in-flight attempt). Retry it — the
    // message insert is idempotent on `message_id`.
    const { error: retryError } = await db
      .from(TABLE)
      .update({
        status: 'processing',
        retry_count: (previous?.retry_count ?? 0) + 1,
        error_log: null,
        updated_at: nowIso,
      })
      .eq('event_id', eventId);

    if (retryError) {
      logger.warn('Could not mark inbound event as retrying; processing', {
        correlationId,
        accountId,
        messageId: eventId,
        code: errorCode(retryError),
      });
    }

    logger.info('Reprocessing incomplete inbound event', {
      correlationId,
      accountId,
      messageId: eventId,
      previousStatus: previous?.status ?? 'unknown',
      retryCount: (previous?.retry_count ?? 0) + 1,
    });
    return 'process';
  } catch (err) {
    logger.error('Inbound event registration threw; processing anyway', {
      correlationId,
      accountId,
      messageId: eventId,
      error: err instanceof Error ? err.message : 'unknown',
    });
    return 'process';
  }
}

/** Mark an event as successfully applied to the inbox. Best effort. */
export async function completeInboundEvent(
  db: SupabaseClient,
  eventId: string,
  correlationId?: string
): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    const { error } = await db
      .from(TABLE)
      .update({
        status: 'completed',
        processed_at: nowIso,
        error_log: null,
        updated_at: nowIso,
      })
      .eq('event_id', eventId);

    if (error && !isMissingTable(error)) {
      logger.warn('Could not mark inbound event completed', {
        correlationId,
        messageId: eventId,
        code: errorCode(error),
      });
    }
  } catch {
    // Never let bookkeeping fail a message that was already persisted.
  }
}

/**
 * Record that an event could not be applied, so it can be replayed or
 * alerted on. Best effort — the caller has already decided the HTTP outcome.
 */
export async function failInboundEvent(
  db: SupabaseClient,
  eventId: string,
  reason: string,
  correlationId?: string
): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    const { error } = await db
      .from(TABLE)
      .update({
        status: 'failed',
        error_log: reason.slice(0, 2000),
        updated_at: nowIso,
      })
      .eq('event_id', eventId);

    if (error && !isMissingTable(error)) {
      logger.warn('Could not mark inbound event failed', {
        correlationId,
        messageId: eventId,
        code: errorCode(error),
      });
    }
  } catch {
    // Swallow — see module contract.
  }
}
