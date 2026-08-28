import crypto from 'node:crypto';
import { getAdminClient } from '@/lib/supabase/server';

export interface ProviderEventContext {
  accountId: string;
  provider: 'waha' | 'twilio' | 'evolution';
  externalEventId: string;
  eventType: string;
  rawBody: string;
  payload: Record<string, unknown>;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: string }).code === '23505';
}

export async function beginProviderEvent(
  context: ProviderEventContext
): Promise<{ duplicate: boolean }> {
  try {
    const result = await getAdminClient()
      .from('provider_events')
      .insert({
        account_id: context.accountId,
        provider: context.provider,
        external_event_id: context.externalEventId,
        event_type: context.eventType,
        payload_hash: crypto
          .createHash('sha256')
          .update(context.rawBody)
          .digest('hex'),
        payload: context.payload,
        status: 'processing',
        attempt_count: 1,
        received_at: new Date().toISOString(),
      });
    if (result.error) {
      if (isUniqueViolation(result.error)) {
        return { duplicate: true };
      }
      console.warn('[inbound] provider event ledger unavailable', {
        provider: context.provider,
        externalEventId: context.externalEventId,
        error: result.error.message,
      });
    }
    return { duplicate: false };
  } catch (error) {
    console.warn('[inbound] provider event ledger threw', {
      provider: context.provider,
      externalEventId: context.externalEventId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { duplicate: false };
  }
}

export async function completeProviderEvent(
  context: ProviderEventContext
): Promise<void> {
  try {
    const result = await getAdminClient()
      .from('provider_events')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('account_id', context.accountId)
      .eq('provider', context.provider)
      .eq('external_event_id', context.externalEventId);
    if (result.error) {
      console.warn('[inbound] could not mark provider event processed', {
        provider: context.provider,
        externalEventId: context.externalEventId,
        error: result.error.message,
      });
    }
  } catch (error) {
    console.warn('[inbound] provider completion logging threw', {
      provider: context.provider,
      externalEventId: context.externalEventId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function failProviderEvent(
  context: ProviderEventContext,
  error: unknown
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  try {
    const result = await getAdminClient()
      .from('provider_events')
      .update({ status: 'failed', last_error: message.slice(0, 2000) })
      .eq('account_id', context.accountId)
      .eq('provider', context.provider)
      .eq('external_event_id', context.externalEventId);
    if (result.error) {
      console.error('[inbound] could not record provider event failure', {
        provider: context.provider,
        externalEventId: context.externalEventId,
        error: result.error.message,
        processingError: message,
      });
    }
  } catch (loggingError) {
    console.error('[inbound] provider failure logging threw', {
      provider: context.provider,
      externalEventId: context.externalEventId,
      error:
        loggingError instanceof Error
          ? loggingError.message
          : String(loggingError),
      processingError: message,
    });
  }
}
