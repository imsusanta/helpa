import { NextResponse } from 'next/server';
import { WahaWhatsAppProvider } from '@/core/providers/whatsapp/waha-provider';
import { resolveWahaTenant } from '@/app/api/webhooks/inbound-tenant-resolver';
import { persistNormalizedInboundMessage } from '@/app/api/webhooks/inbound-persistence';
import {
  beginProviderEvent,
  completeProviderEvent,
  failProviderEvent,
  type ProviderEventContext,
} from '@/app/api/webhooks/provider-event-log';

function eventIdFor(
  event: { externalMessageId?: string; eventId?: string },
  index: number
): string {
  return String(
    event.externalMessageId || event.eventId || `waha-event-${index}`
  );
}

/**
 * WAHA webhook receiver. account_id in the payload is only a routing hint;
 * tenant attribution is verified against server-side provider configuration.
 */
export async function POST(request: Request) {
  const provider = new WahaWhatsAppProvider();
  let rawBody = '';
  try {
    rawBody = await request.text();
    const isValid = await provider.verifyWebhook(request, rawBody);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid or missing webhook signature' },
        { status: 401 }
      );
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody || '{}') as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const tenant = await resolveWahaTenant(payload);
    if (!tenant) {
      console.warn('[WAHA Webhook] No unique server-side tenant mapping');
      return NextResponse.json(
        { success: false, error: 'Unknown account' },
        { status: 403 }
      );
    }

    // The provider normalizer intentionally preserves its old account_id
    // guard. Inject the verified server-side account for payloads where WAHA
    // omitted it, then overwrite clinicId with the trusted value below.
    const normalizedPayload = { ...payload, account_id: tenant.accountId };
    const events = await provider.normalizeWebhook(normalizedPayload);
    let persisted = 0;
    let duplicates = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      // Outbound events are already persisted by the send path.
      if (event.direction !== 'inbound') continue;
      event.clinicId = tenant.accountId;

      const externalEventId = eventIdFor(event, index);
      const context: ProviderEventContext = {
        accountId: tenant.accountId,
        provider: 'waha',
        externalEventId,
        eventType: String(payload.event || 'waha_message'),
        rawBody,
        payload,
      };
      await beginProviderEvent(context);

      try {
        const result = await persistNormalizedInboundMessage(event, {
          accountId: tenant.accountId,
          userId: tenant.userId,
          correlationId: externalEventId,
        });
        if (result.duplicate) duplicates += 1;
        else persisted += 1;
        await completeProviderEvent(context);
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${externalEventId}: ${message}`);
        await failProviderEvent(context, error);
        console.error('[WAHA Webhook] Inbound persistence failed', {
          accountId: tenant.accountId,
          externalEventId,
          error: message,
        });
      }
    }

    if (failed > 0) {
      return NextResponse.json(
        { success: false, persisted, duplicates, failed, errors },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      count: events.length,
      persisted,
      duplicates,
    });
  } catch (error: unknown) {
    console.error('[POST /api/webhooks/waha] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Inbound webhook processing failed' },
      { status: 500 }
    );
  }
}
