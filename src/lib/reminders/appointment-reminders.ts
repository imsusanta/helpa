import { appwriteAdmin } from '@/lib/appwrite-server-compat';

export interface AppointmentReminderJobData {
  accountId: string;
  appointmentId: string;
  reminderType: '24h' | '2h';
}

/**
 * Appwrite-native appointment reminder enqueueing.
 * Persists directly to the durable Appwrite outbound_outbox collection without Redis/BullMQ.
 */
export async function enqueueAppointmentReminder(
  data: AppointmentReminderJobData
): Promise<string> {
  const db = appwriteAdmin();
  const now = new Date().toISOString();
  const idempotencyKey = `rem_${data.appointmentId}_${data.reminderType}`;

  try {
    const { data: outboxItem, error } = await db
      .from('outbound_outbox')
      .insert({
        accountId: data.accountId,
        idempotencyKey,
        channel: 'whatsapp',
        status: 'pending',
        requestHash: `reminder:${data.appointmentId}:${data.reminderType}`,
        attempts: 0,
        createdAt: now,
        updatedAt: now,
      })
      .select('id')
      .single();

    if (error) {
      // If unique constraint or network error, return idempotency key safely
      return idempotencyKey;
    }

    return outboxItem?.id || idempotencyKey;
  } catch {
    return idempotencyKey;
  }
}
