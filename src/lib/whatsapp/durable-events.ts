import { getAdminClient } from '@/lib/supabase/typed-admin';
import type { Json } from '@/types/database';

export interface WebhookEventRecord {
  eventId: string;
  accountId?: string;
  eventType: string;
  payload: Json;
}

export interface DeadLetterRecord {
  eventId: string;
  accountId?: string;
  payload: Json;
  errorMessage: string;
  stackTrace?: string;
}

/**
 * Checks whether an event has already been recorded / processed (idempotency).
 * Returns true if the event was already received.
 */
export async function checkOrRecordEvent(
  event: WebhookEventRecord
): Promise<{ isDuplicate: boolean; recordId?: string }> {
  const db = getAdminClient();

  // 1. Check existing event
  const { data: existing, error: checkError } = await db
    .from('webhook_events')
    .select('id, status')
    .eq('event_id', event.eventId)
    .maybeSingle();

  if (checkError) {
    console.error(
      '[Durable Events] Failed to check event idempotency:',
      checkError.message
    );
  }

  if (existing) {
    return { isDuplicate: true, recordId: existing.id };
  }

  // 2. Insert new event as 'received'
  const { data: inserted, error: insertError } = await db
    .from('webhook_events')
    .insert({
      event_id: event.eventId,
      account_id: event.accountId || null,
      event_type: event.eventType,
      status: 'received',
      payload: event.payload,
      retry_count: 0,
    })
    .select('id')
    .single();

  if (insertError) {
    // Unique violation on event_id indicates a concurrent race; treat as duplicate
    if (insertError.code === '23505') {
      return { isDuplicate: true };
    }
    console.error(
      '[Durable Events] Failed to insert webhook event:',
      insertError.message
    );
  }

  return { isDuplicate: false, recordId: inserted?.id };
}

/**
 * Marks an event as successfully processed.
 */
export async function markEventProcessed(eventId: string): Promise<void> {
  const db = getAdminClient();
  const { error } = await db
    .from('webhook_events')
    .update({
      status: 'processed',
      processed_at: new Date().toISOString(),
    })
    .eq('event_id', eventId);

  if (error) {
    console.error(
      '[Durable Events] Failed to mark event processed:',
      error.message
    );
  }
}

/**
 * Sends a failing event to the Dead Letter Queue for operator triage.
 */
export async function sendToDeadLetterQueue(
  record: DeadLetterRecord
): Promise<void> {
  const db = getAdminClient();

  const { error: dlqError } = await db.from('webhook_dead_letter').insert({
    event_id: record.eventId,
    account_id: record.accountId || null,
    payload: record.payload,
    error_message: record.errorMessage,
    stack_trace: record.stackTrace || null,
    resolved: false,
  });

  if (dlqError) {
    console.error(
      '[Durable Events] Failed to write to Dead Letter Queue:',
      dlqError.message
    );
  }

  // Also update status in webhook_events table
  await db
    .from('webhook_events')
    .update({
      status: 'dead_letter',
      error_message: record.errorMessage,
    })
    .eq('event_id', record.eventId);
}
