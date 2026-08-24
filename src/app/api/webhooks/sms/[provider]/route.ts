import { NextResponse } from 'next/server';
import { TwilioSmsProvider } from '@/core/providers/sms/twilio-provider';
import { getAdminClient } from '@/lib/supabase/server';
import { resolveTwilioTenant } from '@/app/api/webhooks/inbound-tenant-resolver';
import { persistNormalizedInboundMessage } from '@/app/api/webhooks/inbound-persistence';
import {
  beginProviderEvent,
  completeProviderEvent,
  failProviderEvent,
  type ProviderEventContext,
} from '@/app/api/webhooks/provider-event-log';

function stringValue(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : value == null
      ? ''
      : String(value).trim();
}

function isInboundMessagePayload(payload: Record<string, unknown>): boolean {
  const from = stringValue(payload.From ?? payload.from);
  return Boolean(
    from && ('Body' in payload || 'body' in payload || 'NumMedia' in payload)
  );
}

function normalizeTwilioStatus(status: string): string | null {
  switch (status.toLowerCase()) {
    case 'queued':
    case 'accepted':
    case 'sending':
      return 'pending';
    case 'sent':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'read':
      return 'read';
    case 'failed':
    case 'undelivered':
    case 'canceled':
      return 'failed';
    default:
      return null;
  }
}

async function applyTwilioStatus(
  accountId: string,
  externalMessageId: string,
  providerStatus: string
): Promise<void> {
  const status = normalizeTwilioStatus(providerStatus);
  if (!status) return;
  const db = getAdminClient();
  let result = await db
    .from('messages')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('account_id', accountId)
    .eq('provider_message_id', externalMessageId);
  if (result.error) {
    result = await db
      .from('messages')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('account_id', accountId)
      .eq('message_id', externalMessageId);
  }
  if (result.error) {
    console.warn('[Twilio Webhook] Could not update outbound status', {
      accountId,
      externalMessageId,
      status,
      error: result.error.message,
    });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerName } = await params;
  if (!['twilio', 'exotel'].includes(providerName)) {
    return NextResponse.json(
      { error: 'Unsupported SMS provider' },
      { status: 400 }
    );
  }

  // Exotel remains explicitly unavailable until its official signature and
  // tenant mapping are configured. A false-success response would lose SMS.
  if (providerName === 'exotel') {
    return NextResponse.json(
      { error: 'SMS provider is not configured' },
      { status: 501 }
    );
  }

  const smsProvider = new TwilioSmsProvider();
  let rawBody = '';
  let payload: Record<string, unknown> = {};
  let context: ProviderEventContext | null = null;
  try {
    rawBody = await request.text();
    const isValid = await smsProvider.verifyWebhook(request, rawBody);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid or missing webhook signature' },
        { status: 401 }
      );
    }

    if (
      request.headers
        .get('content-type')
        ?.toLowerCase()
        .includes('application/x-www-form-urlencoded')
    ) {
      payload = Object.fromEntries(new URLSearchParams(rawBody).entries());
    } else {
      try {
        payload = JSON.parse(rawBody || '{}') as Record<string, unknown>;
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid JSON payload' },
          { status: 400 }
        );
      }
    }

    const tenant = await resolveTwilioTenant(payload);
    if (!tenant) {
      console.warn('[Twilio Webhook] No unique server-side tenant mapping', {
        to: payload.To,
        messagingServiceSid: payload.MessagingServiceSid,
      });
      return NextResponse.json(
        { success: false, error: 'Unknown or ambiguous account' },
        { status: 403 }
      );
    }

    // Twilio also calls this endpoint for outbound delivery callbacks. They
    // must update the existing message status, not create a customer reply.
    if (!isInboundMessagePayload(payload)) {
      const externalMessageId = stringValue(
        payload.MessageSid ??
          payload.SmsSid ??
          payload.message_sid ??
          payload.sms_sid
      );
      const providerStatus = stringValue(
        payload.MessageStatus ??
          payload.message_status ??
          payload.Status ??
          payload.status
      );
      if (!externalMessageId) {
        return NextResponse.json({ success: true, ignored: true });
      }
      context = {
        accountId: tenant.accountId,
        provider: 'twilio',
        externalEventId: `${externalMessageId}:status:${providerStatus || 'unknown'}`,
        eventType: 'sms_status',
        rawBody,
        payload,
      };
      await beginProviderEvent(context);
      await applyTwilioStatus(
        tenant.accountId,
        externalMessageId,
        providerStatus
      );
      await completeProviderEvent(context);
      return NextResponse.json({
        success: true,
        status: 'updated',
        messageId: externalMessageId,
      });
    }

    const event = await smsProvider.normalizeWebhook(payload);
    event.clinicId = tenant.accountId;
    context = {
      accountId: tenant.accountId,
      provider: 'twilio',
      externalEventId: event.externalMessageId,
      eventType: 'sms_received',
      rawBody,
      payload,
    };
    await beginProviderEvent(context);

    const result = await persistNormalizedInboundMessage(event, {
      accountId: tenant.accountId,
      userId: tenant.userId,
      correlationId: event.externalMessageId,
    });

    // Persist first so STOP remains visible in the inbox even if opt-out
    // processing has a provider/configuration problem.
    const textContent = event.content || event.text || '';
    const phone = event.senderPhone || event.patientAddress || '';
    if (
      ['STOP', 'CANCEL', 'UNSUBSCRIBE'].includes(
        textContent.trim().toUpperCase()
      ) &&
      phone
    ) {
      await smsProvider.processOptOut(tenant.accountId, phone);
    }

    await completeProviderEvent(context);
    return NextResponse.json({
      success: true,
      messageId: event.externalMessageId,
      duplicate: result.duplicate,
    });
  } catch (error: unknown) {
    if (context) await failProviderEvent(context, error);
    console.error('[POST /api/webhooks/sms] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Inbound SMS processing failed' },
      { status: 500 }
    );
  }
}
