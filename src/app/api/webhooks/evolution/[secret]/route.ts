/**
 * Evolution Go v0.7.2 webhook receiver.
 *
 * Tenant attribution uses the URL secret + provider_instance_id mapping.
 * account_id / tenant_id / instanceToken in the JSON body are ignored.
 *
 * Evolution Go webhook_producer.go does not sign payloads; the
 * high-entropy URL secret is the authentication mechanism.
 */

import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getAdminClient } from '@/lib/db/server';
import { persistNormalizedInboundMessage } from '@/app/api/webhooks/inbound-persistence';
import { resolveEvolutionGoTenant } from '@/app/api/webhooks/inbound-tenant-resolver';
import {
  beginProviderEvent,
  completeProviderEvent,
  failProviderEvent,
  type ProviderEventContext,
} from '@/app/api/webhooks/provider-event-log';
import {
  EvolutionGoProvider,
  isEvolutionConnectionEvent,
  isEvolutionReceiptEvent,
  redactEvolutionWebhookPayload,
} from '@/core/providers/whatsapp/evolution-go-provider';
import { phoneFromWhatsAppJid } from '@/core/whatsapp/canonical-config';
import {
  extractWhatsAppGroupJid,
  extractWhatsAppPushName,
  formatGroupInboundText,
  inboundWhatsAppContactName,
  isEvolutionGroupEvent,
  isPlaceholderContactName,
  whatsappChatKind,
} from '@/core/whatsapp/group-identity';
import {
  applyEvolutionGroupNameEvent,
  resolveEvolutionGroupName,
  scheduleEvolutionGroupNameRefresh,
} from '@/core/whatsapp/evolution-group-names';
import { triggerAiResponse } from '@/lib/whatsapp/ai';

const MAX_BODY_BYTES = 1_000_000;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function eventIdFor(
  event: { externalMessageId?: string; eventId?: string },
  index: number
): string {
  return String(
    event.externalMessageId || event.eventId || `evolution-event-${index}`
  );
}

function payloadDeliveryId(prefix: string, rawBody: string): string {
  const digest = crypto.createHash('sha256').update(rawBody).digest('hex');
  return `${prefix}:${digest}`;
}

async function touchLastWebhook(accountId: string): Promise<void> {
  try {
    await getAdminClient()
      .from('whatsapp_configs')
      .update({
        last_webhook_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', accountId)
      .eq('provider', 'evolution');
  } catch {
    // Observability only.
  }
}

async function applyConnectionEvent(
  accountId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const event = asString(payload.event).toLowerCase();
  const data = asRecord(payload.data);
  const now = new Date().toISOString();
  const jid = asString(data.jid || data.Jid || asRecord(data.Info).Chat);
  const phone = phoneFromWhatsAppJid(jid);
  const connected =
    event === 'connected' ||
    event === 'pairsuccess' ||
    event === 'pair_success';
  const patch: Record<string, unknown> = {
    last_webhook_at: now,
    last_health_check_at: now,
    updated_at: now,
  };
  if (connected) {
    patch.status = 'connected';
    patch.connection_status = 'connected';
    patch.connected_at = now;
    patch.disconnected_at = null;
    patch.connection_error = null;
    if (phone) {
      patch.display_phone_number = phone;
      patch.phone_number = phone;
    }
  } else if (event === 'loggedout' || event === 'logged_out') {
    patch.status = 'needs_reconnect';
    patch.connection_status = 'reconnect_required';
    patch.disconnected_at = now;
  } else if (event === 'disconnected') {
    patch.status = 'needs_reconnect';
    patch.connection_status = 'reconnect_required';
    patch.disconnected_at = now;
  }
  await getAdminClient()
    .from('whatsapp_configs')
    .update(patch)
    .eq('account_id', accountId)
    .eq('provider', 'evolution');
}

async function applyReceiptEvent(
  accountId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const data = asRecord(payload.data);
  const info = asRecord(data.Info || data.info);
  const messageIds = [
    asString(data.id),
    asString(asRecord(data.key).id),
    asString(info.ID),
    ...(Array.isArray(data.MessageIDs)
      ? data.MessageIDs.map((id) => asString(id))
      : []),
    ...(Array.isArray(data.messageIDs)
      ? data.messageIDs.map((id) => asString(id))
      : []),
  ].filter(Boolean);
  const type = asString(data.type || data.Type || info.Type).toLowerCase();
  const status = type.includes('read')
    ? 'read'
    : type.includes('deliver')
      ? 'delivered'
      : '';
  if (!status || messageIds.length === 0) return;
  const db = getAdminClient();
  for (const messageId of messageIds) {
    await db
      .from('messages')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('account_id', accountId)
      .eq('provider_message_id', messageId);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ secret: string }> }
) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  let rawBody = '';
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  const { secret: rawSecret } = await context.params;
  const secret = decodeURIComponent(rawSecret || '').trim();
  const tenant = await resolveEvolutionGoTenant(secret);
  if (!tenant) {
    return NextResponse.json({ error: 'Unknown account' }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody || '{}') as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  // Ignore spoofed tenant fields. Mapping is server-side only.
  delete payload.account_id;
  delete payload.accountId;
  delete payload.tenant_id;
  delete payload.tenantId;
  delete payload.clinicId;

  const safePayload = redactEvolutionWebhookPayload(payload);
  await touchLastWebhook(tenant.accountId);

  if (isEvolutionConnectionEvent(payload)) {
    const context: ProviderEventContext = {
      accountId: tenant.accountId,
      provider: 'evolution',
      externalEventId: payloadDeliveryId('connection', rawBody),
      eventType: asString(payload.event) || 'connection',
      rawBody,
      payload: safePayload,
    };
    const begun = await beginProviderEvent(context);
    if (begun.duplicate) {
      return NextResponse.json({
        success: true,
        ignored: false,
        type: 'connection',
        duplicate: true,
      });
    }
    try {
      await applyConnectionEvent(tenant.accountId, payload);
      await completeProviderEvent(context);
    } catch (error) {
      await failProviderEvent(context, error);
      console.error('[evolution webhook] connection event failed', {
        accountId: tenant.accountId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
    return NextResponse.json({
      success: true,
      ignored: false,
      type: 'connection',
    });
  }

  if (isEvolutionGroupEvent(payload)) {
    const context: ProviderEventContext = {
      accountId: tenant.accountId,
      provider: 'evolution',
      externalEventId: payloadDeliveryId('group', rawBody),
      eventType: asString(payload.event) || 'group',
      rawBody,
      payload: safePayload,
    };
    const begun = await beginProviderEvent(context);
    if (begun.duplicate) {
      return NextResponse.json({
        success: true,
        ignored: false,
        type: 'group',
        duplicate: true,
      });
    }
    try {
      await applyEvolutionGroupNameEvent(tenant.accountId, payload);
      await completeProviderEvent(context);
    } catch (error) {
      await failProviderEvent(context, error);
      console.error('[evolution webhook] group event failed', {
        accountId: tenant.accountId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
    return NextResponse.json({
      success: true,
      ignored: false,
      type: 'group',
    });
  }

  if (isEvolutionReceiptEvent(payload)) {
    const context: ProviderEventContext = {
      accountId: tenant.accountId,
      provider: 'evolution',
      externalEventId: payloadDeliveryId('receipt', rawBody),
      eventType: asString(payload.event) || 'receipt',
      rawBody,
      payload: safePayload,
    };
    const begun = await beginProviderEvent(context);
    if (begun.duplicate) {
      return NextResponse.json({
        success: true,
        ignored: false,
        type: 'receipt',
        duplicate: true,
      });
    }
    try {
      await applyReceiptEvent(tenant.accountId, payload);
      await completeProviderEvent(context);
    } catch (error) {
      await failProviderEvent(context, error);
      console.error('[evolution webhook] receipt event failed', {
        accountId: tenant.accountId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
    return NextResponse.json({
      success: true,
      ignored: false,
      type: 'receipt',
    });
  }

  const provider = new EvolutionGoProvider({
    accountId: tenant.accountId,
    instanceToken: '',
  });
  const events = await provider.normalizeWebhook(payload);
  let persisted = 0;
  let duplicates = 0;
  let failed = 0;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.direction !== 'inbound') continue;
    event.clinicId = tenant.accountId;

    const externalEventId = eventIdFor(event, index);
    const context: ProviderEventContext = {
      accountId: tenant.accountId,
      provider: 'evolution',
      externalEventId,
      eventType: asString(payload.event) || 'Message',
      rawBody,
      payload: safePayload,
    };
    const begun = await beginProviderEvent(context);
    if (begun.duplicate) {
      duplicates += 1;
      continue;
    }
    try {
      const address = event.patientAddress || event.senderPhone || '';
      const payloadData = asRecord(payload.data ?? payload.Data);
      const remoteJid = extractWhatsAppGroupJid(payloadData);
      const chatKind = whatsappChatKind(remoteJid || address);
      const isGroup = chatKind === 'group';
      if (isGroup) {
        const labeled = formatGroupInboundText(
          extractWhatsAppPushName(payloadData),
          event.content || event.text || '',
          event.contentType
        );
        event.content = labeled;
        event.text = labeled;
      }
      let contactName = inboundWhatsAppContactName(payload, address);
      if (isPlaceholderContactName(contactName, address)) {
        const fetched = await resolveEvolutionGroupName(
          tenant.accountId,
          remoteJid || address
        );
        if (fetched) contactName = fetched;
        else if (isGroup) {
          scheduleEvolutionGroupNameRefresh(tenant.accountId, address);
        }
      }
      const result = await persistNormalizedInboundMessage(event, {
        accountId: tenant.accountId,
        userId: tenant.userId,
        contactName,
        correlationId: externalEventId,
        chatKind,
        chatJid: remoteJid || undefined,
      });
      if (result.duplicate) duplicates += 1;
      else {
        persisted += 1;
        if (result.conversationId && result.contactId) {
          void triggerAiResponse({
            accountId: tenant.accountId,
            userId: tenant.userId,
            conversationId: result.conversationId,
            contactId: result.contactId,
            inboundMessageId: result.messageId,
          }).catch((error: unknown) => {
            console.error('[evolution webhook] AI trigger failed', {
              accountId: tenant.accountId,
              error: error instanceof Error ? error.message : 'unknown',
            });
          });
        }
      }
      await completeProviderEvent(context);
    } catch (error) {
      failed += 1;
      await failProviderEvent(context, error);
      console.error('[evolution webhook] inbound persistence failed', {
        accountId: tenant.accountId,
        externalEventId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  if (failed > 0) {
    return NextResponse.json(
      { success: false, persisted, duplicates, failed },
      { status: 500 }
    );
  }
  return NextResponse.json({
    success: true,
    count: events.length,
    persisted,
    duplicates,
  });
}
