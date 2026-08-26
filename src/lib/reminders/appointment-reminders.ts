import { getAdminClient } from '@/lib/db/server';

export interface AppointmentReminderJobData {
  accountId: string;
  appointmentId: string;
  reminderType: '24h' | '2h';
}

export type EnqueueReminderResult =
  | {
      ok: true;
      status: 'created' | 'already_exists';
      outboxId: string;
      idempotencyKey: string;
    }
  | {
      ok: false;
      code:
        | 'REMINDER_OUTBOX_PERSISTENCE_FAILED'
        | 'REMINDER_IDEMPOTENCY_CONFLICT'
        | 'REMINDER_SCHEMA_MISMATCH';
      message: string;
      retryable: boolean;
    };

/** Persists an idempotent appointment reminder in the Supabase outbox. */
export async function enqueueAppointmentReminder(
  data: AppointmentReminderJobData
): Promise<EnqueueReminderResult> {
  const db = getAdminClient();
  const now = new Date().toISOString();
  const idempotencyKey = `rem_${data.appointmentId}_${data.reminderType}`;
  const requestHash = `reminder:${data.appointmentId}:${data.reminderType}`;

  try {
    // Insert using the canonical snake_case outbound_outbox columns
    // (account_id, idempotency_key, payload, …) — the same shape
    // OutboxService writes. The previous camelCase insert never matched
    // the Supabase schema, so reminder enqueue failed on every cron run.
    const { data: outboxItem, error } = await db
      .from('outbound_outbox')
      .insert({
        account_id: data.accountId,
        idempotency_key: idempotencyKey,
        message_type: 'text',
        payload: {
          requestHash,
          channel: 'whatsapp',
          appointmentId: data.appointmentId,
          reminderType: data.reminderType,
        },
        status: 'pending',
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (error) {
      const isConflict =
        String(error.code) === '409' ||
        String(error.code) === '23505' ||
        /duplicate|conflict|unique/i.test(error.message || '');

      if (isConflict) {
        const { data: existing, error: fetchErr } = await db
          .from('outbound_outbox')
          .select('*')
          .eq('account_id', data.accountId)
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();

        if (existing) {
          const existingHash = String(
            (existing.payload as Record<string, unknown> | null)?.requestHash ||
              existing.requestHash ||
              existing.request_hash ||
              ''
          );
          if (existingHash && existingHash !== requestHash) {
            return {
              ok: false,
              code: 'REMINDER_IDEMPOTENCY_CONFLICT',
              message:
                'Reminder idempotency key already exists with conflicting payload',
              retryable: false,
            };
          }
          return {
            ok: true,
            status: 'already_exists',
            outboxId: String(existing.id),
            idempotencyKey,
          };
        }

        if (fetchErr) {
          return {
            ok: false,
            code: 'REMINDER_OUTBOX_PERSISTENCE_FAILED',
            message: `Failed to verify existing reminder outbox: ${fetchErr.message}`,
            retryable: true,
          };
        }
      }

      const isSchema = /collection|attribute|index.*not found/i.test(
        error.message || ''
      );
      return {
        ok: false,
        code: isSchema
          ? 'REMINDER_SCHEMA_MISMATCH'
          : 'REMINDER_OUTBOX_PERSISTENCE_FAILED',
        message: error.message || 'Outbox insert failed',
        retryable: !isSchema,
      };
    }

    if (!outboxItem?.id) {
      return {
        ok: false,
        code: 'REMINDER_OUTBOX_PERSISTENCE_FAILED',
        message: 'No document ID returned from outbox insert',
        retryable: true,
      };
    }

    return {
      ok: true,
      status: 'created',
      outboxId: String(outboxItem.id),
      idempotencyKey,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      code: 'REMINDER_OUTBOX_PERSISTENCE_FAILED',
      message: `Unexpected reminder enqueue error: ${message}`,
      retryable: true,
    };
  }
}
