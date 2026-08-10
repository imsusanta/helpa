import { providerEventsRepository } from '@/infrastructure/appwrite/repositories/provider_events.repository';

export interface WebhookEventRecord {
  eventId: string;
  accountId?: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface DeadLetterRecord {
  eventId: string;
  accountId?: string;
  payload: Record<string, unknown>;
  errorMessage: string;
  stackTrace?: string;
}

export async function checkOrRecordEvent(
  event: WebhookEventRecord
): Promise<{ isDuplicate: boolean; recordId?: string }> {
  const isDuplicate = await providerEventsRepository.isDuplicateEvent(
    'webhook',
    event.eventId
  );

  if (isDuplicate) {
    return { isDuplicate: true };
  }

  const recorded = await providerEventsRepository.recordEvent(
    'webhook',
    event.eventType,
    event.eventId,
    event.payload,
    event.accountId
  );

  return { isDuplicate: false, recordId: recorded.$id };
}

export async function markEventProcessed(_eventId: string): Promise<void> {
  // no-op
}

export async function sendToDeadLetterQueue(
  _record: DeadLetterRecord
): Promise<void> {
  // no-op
}
