import { getAdminClient } from '@/lib/supabase/server';
import { normalizePhone } from '@/lib/whatsapp/phone-utils';
import type { MessageEvent } from '@/core/types';
import { findOrCreateContact } from '@/app/api/whatsapp/webhook/contact-service';
import { findOrCreateConversation } from '@/app/api/whatsapp/webhook/conversation-service';
import {
  isWhatsAppGroupAddress,
  isValidIndividualPhone,
} from '@/core/whatsapp/group-identity';
import {
  persistOutboundMessage,
  touchConversationPreview,
  outboundPreviewText,
} from '@/lib/whatsapp/persist-outbound-message';
import { safeRecordOutcomeEvent } from '@/lib/metrics/safe-record';

type Row = Record<string, unknown>;

export interface PersistInboundOptions {
  /** The account resolved from a trusted provider configuration. */
  accountId: string;
  /** A workspace owner/agent used by legacy schemas; optional in canonical DBs. */
  userId?: string;
  contactName?: string;
  correlationId?: string;
  chatKind?: 'direct' | 'group' | 'channel';
  chatJid?: string;
}

export interface PersistInboundResult {
  duplicate: boolean;
  accountId: string;
  contactId: string;
  conversationId: string;
  messageId?: string;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === '23505' ||
    /duplicate key|already exists|unique constraint/i.test(
      candidate.message || ''
    )
  );
}

function value(row: Row | null | undefined, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null) return row[key];
  }
  return undefined;
}

function eventText(event: MessageEvent): string {
  return String(event.content ?? event.text ?? '').trim();
}

function eventDate(event: MessageEvent): Date {
  const raw = event.occurredAt || event.timestamp;
  const date = raw ? new Date(raw) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function findExistingMessage(
  accountId: string,
  externalId: string
): Promise<Row | null> {
  if (!externalId) return null;
  const db = getAdminClient();
  for (const column of ['provider_message_id', 'message_id']) {
    try {
      const result = await db
        .from('messages')
        .select('*')
        .eq('account_id', accountId)
        .eq(column, externalId)
        .limit(1);
      if (!result.error && result.data?.length) return result.data[0] as Row;
    } catch {
      // Older schemas may not expose account_id/provider_message_id.
    }
    try {
      const result = await db
        .from('messages')
        .select('*')
        .eq(
          column === 'provider_message_id' ? 'providerMessageId' : 'messageId',
          externalId
        )
        .limit(1);
      if (!result.error && result.data?.length) {
        const candidate = result.data[0] as Row;
        const conversationId = String(
          value(candidate, 'conversation_id', 'conversationId') || ''
        );
        if (!conversationId) continue;
        // Legacy message rows may not carry account_id. Verify the parent
        // conversation before treating a provider ID as a duplicate; this
        // prevents a same-ID delivery from another workspace being adopted.
        const conversation = await db
          .from('conversations')
          .select('id, account_id')
          .eq('id', conversationId)
          .eq('account_id', accountId)
          .maybeSingle();
        if (!conversation.error && conversation.data) return candidate;
        try {
          const legacyConversation = await db
            .from('conversations')
            .select('id, accountId')
            .eq('id', conversationId)
            .eq('accountId', accountId)
            .maybeSingle();
          if (!legacyConversation.error && legacyConversation.data)
            return candidate;
        } catch {
          // No legacy parent shape.
        }
      }
    } catch {
      // Keep trying the alternate legacy shape.
    }
  }
  return null;
}

async function repairConversationRollup(args: {
  conversationId: string;
  preview: string;
  messageAt: string;
  incrementUnread: boolean;
  accountId: string;
  externalId: string;
}): Promise<void> {
  const db = getAdminClient();
  const { conversationId, preview, messageAt, incrementUnread } = args;

  // The migration provides an atomic update for the normal path. A duplicate
  // delivery never calls this function with incrementUnread=true, so retries
  // cannot inflate the badge after the message is already present.
  if (incrementUnread) {
    try {
      const rpc = await db.rpc('apply_inbound_message_to_conversation', {
        p_conversation_id: conversationId,
        p_preview: preview,
        p_message_at: messageAt,
        p_message_key: args.externalId,
      });
      if (!rpc.error) return;
    } catch {
      // Migration not deployed; continue with the direct update fallback.
    }
  }

  let current: Row | null = null;
  try {
    const result = await db
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('account_id', args.accountId)
      .maybeSingle();
    if (!result.error) current = (result.data as Row | null) || null;
  } catch {
    // Continue to the update fallback.
  }

  const previousAt = value(current, 'last_message_at', 'lastMessageAt');
  const previousDate = previousAt ? new Date(String(previousAt)) : null;
  const incomingDate = new Date(messageAt);
  const advancePreview =
    !previousDate ||
    Number.isNaN(previousDate.getTime()) ||
    incomingDate >= previousDate;
  const unread = Number(value(current, 'unread_count', 'unreadCount') ?? 0);
  const status = String(value(current, 'status') ?? 'open');
  const update: Row = {
    updated_at: new Date().toISOString(),
  };
  if (advancePreview) {
    update.last_message_text = preview;
    update.last_message_at = messageAt;
  }
  if (incrementUnread) update.unread_count = unread + 1;
  if (status === 'closed') update.status = 'open';

  let result: { error?: unknown } | null = null;
  try {
    result = await db
      .from('conversations')
      .update(update)
      .eq('id', conversationId)
      .eq('account_id', args.accountId);
  } catch {
    result = null;
  }
  if (!result || result.error) {
    const legacy: Row = {
      updatedAt: update.updated_at,
      ...(advancePreview
        ? { lastMessageText: preview, lastMessageAt: messageAt }
        : {}),
      ...(incrementUnread ? { unreadCount: unread + 1 } : {}),
      ...(status === 'closed' ? { status: 'open' } : {}),
    };
    try {
      const legacyResult = await db
        .from('conversations')
        .update(legacy)
        .eq('id', conversationId);
      if (legacyResult.error) {
        throw legacyResult.error;
      }
    } catch (error) {
      console.error('[inbound] conversation rollup failed', {
        accountId: args.accountId,
        conversationId,
        externalId: args.externalId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Inbound conversation rollup failed');
    }
  }
}

/**
 * Persist a normalized inbound event for any supported messaging provider.
 * This is deliberately independent from provider webhook parsing, so retries
 * from WhatsApp, WAHA, and SMS share the same tenant-safe/idempotent path.
 */
export async function persistNormalizedInboundMessage(
  event: MessageEvent,
  options: PersistInboundOptions
): Promise<PersistInboundResult> {
  const accountId = options.accountId;
  if (!accountId) throw new Error('Inbound account is required');

  const senderPhone = normalizePhone(
    event.senderPhone || event.patientAddress || ''
  );
  if (!senderPhone) throw new Error('Inbound sender phone is missing');
  if (
    !isValidIndividualPhone(senderPhone) ||
    isWhatsAppGroupAddress(senderPhone)
  ) {
    return {
      duplicate: false,
      accountId,
      contactId: '',
      conversationId: '',
    };
  }

  const externalId = String(
    event.externalMessageId || event.messageId || ''
  ).trim();
  if (!externalId) throw new Error('Inbound provider message id is missing');
  const text = eventText(event);
  const messageAt = eventDate(event).toISOString();
  const db = getAdminClient();

  const existing = await findExistingMessage(accountId, externalId);
  if (existing) {
    const existingConversationId = String(
      value(existing, 'conversation_id', 'conversationId') || ''
    );
    if (existingConversationId) {
      // Repair a stale preview caused by a prior delivery that inserted the
      // row but failed while updating its conversation. No unread increment
      // occurs on a duplicate delivery.
      await repairConversationRollup({
        conversationId: existingConversationId,
        preview: text || `[${event.contentType || 'text'}]`,
        messageAt,
        incrementUnread: false,
        accountId,
        externalId,
      });
    }
    return {
      duplicate: true,
      accountId,
      contactId: String(value(existing, 'contact_id', 'contactId') || ''),
      conversationId: existingConversationId,
      messageId: String(existing.id || ''),
    };
  }

  const contactOutcome = await findOrCreateContact(
    accountId,
    options.userId || '',
    senderPhone,
    options.contactName || senderPhone
  );
  if (!contactOutcome) {
    return {
      duplicate: false,
      accountId,
      contactId: '',
      conversationId: '',
    };
  }

  if (options.chatKind && options.chatKind !== 'direct') {
    try {
      const latest = await db
        .from('contacts')
        .select('metadata')
        .eq('id', String(contactOutcome.contact.id))
        .eq('account_id', accountId)
        .limit(1);
      const latestRow = Array.isArray(latest.data)
        ? latest.data[0]
        : latest.data;
      const current = ((
        latestRow as { metadata?: Record<string, unknown> } | null
      )?.metadata ||
        contactOutcome.contact.metadata ||
        {}) as Record<string, unknown>;
      const nextJid = options.chatJid || current.whatsapp_jid;
      if (
        current.whatsapp_chat_kind !== options.chatKind ||
        (nextJid && current.whatsapp_jid !== nextJid)
      ) {
        await db
          .from('contacts')
          .update({
            metadata: {
              ...current,
              whatsapp_chat_kind: options.chatKind,
              ...(options.chatJid ? { whatsapp_jid: options.chatJid } : {}),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', String(contactOutcome.contact.id))
          .eq('account_id', accountId);
      }
    } catch {
      // Display still derives group/channel from the stored address.
    }
  }

  const conversation = await findOrCreateConversation(
    accountId,
    options.userId || '',
    String(contactOutcome.contact.id),
    event.channel
  );
  if (!conversation) throw new Error('Unable to resolve inbound conversation');
  const conversationId = String(conversation.id);

  const contentType = event.contentType || 'text';
  const payload: Row = {
    account_id: accountId,
    conversation_id: conversationId,
    direction: 'inbound',
    sender_type: 'customer',
    content_type: contentType,
    content_text: text || null,
    media_url: event.mediaUrl || null,
    message_id: externalId,
    provider_message_id: externalId,
    status: event.status || 'delivered',
    created_at: messageAt,
    updated_at: new Date().toISOString(),
  };

  let inserted: Row | null = null;
  let insertError: unknown = null;
  let hitUniqueConstraint = false;
  try {
    const result = await db.from('messages').insert(payload).select().single();
    if (!result.error) inserted = (result.data as Row) || payload;
    else insertError = result.error;
  } catch (error) {
    insertError = error;
  }

  if (!inserted && isUniqueViolation(insertError)) {
    hitUniqueConstraint = true;
    const raced = await findExistingMessage(accountId, externalId);
    if (raced) {
      await repairConversationRollup({
        conversationId,
        preview: text || `[${contentType}]`,
        messageAt,
        incrementUnread: false,
        accountId,
        externalId,
      });
      return {
        duplicate: true,
        accountId,
        contactId: String(contactOutcome.contact.id),
        conversationId,
        messageId: String(raced.id || ''),
      };
    }
  }

  // A unique violation without a readable raced row is still a duplicate,
  // not permission to retry through a less constrained legacy payload.
  if (!inserted && hitUniqueConstraint) {
    throw new Error('Inbound message already exists but could not be resolved');
  }

  // Older installations lack the tenant/direction/provider columns. Retry
  // with the canonical legacy names, but never silently acknowledge a write
  // failure: the webhook must return 5xx so the provider retries.
  if (!inserted) {
    const reduced: Row = {
      conversation_id: conversationId,
      sender_type: 'customer',
      content_type: contentType,
      content_text: text || null,
      media_url: event.mediaUrl || null,
      message_id: externalId,
      status: event.status || 'delivered',
      created_at: messageAt,
    };
    try {
      const result = await db
        .from('messages')
        .insert(reduced)
        .select()
        .single();
      if (!result.error) inserted = (result.data as Row) || reduced;
      else insertError = result.error;
    } catch (error) {
      insertError = error;
    }
  }
  if (!inserted) {
    console.error('[inbound] message persistence failed', {
      accountId,
      conversationId,
      externalId,
      error: insertError instanceof Error ? insertError.message : insertError,
    });
    safeRecordOutcomeEvent({
      accountId,
      eventName: 'webhook_failed',
      sourceId: `webhook-fail:${accountId}:${externalId}`,
      attributes: { reason: 'inbound_persist_failed' },
    });
    throw new Error('Unable to persist inbound message');
  }

  await repairConversationRollup({
    conversationId,
    preview: text || `[${contentType}]`,
    messageAt,
    incrementUnread: true,
    accountId,
    externalId,
  });

  safeRecordOutcomeEvent({
    accountId,
    eventName: 'inbound_message_received',
    sourceId: `inbound:${accountId}:${externalId}`,
    attributes: {
      channel: event.channel || 'whatsapp',
      conversation_id: conversationId,
    },
  });

  return {
    duplicate: false,
    accountId,
    contactId: String(contactOutcome.contact.id),
    conversationId,
    messageId: String(inserted.id || ''),
  };
}

/**
 * Persist a provider fromMe / outbound echo into the same conversation as
 * the customer. Helpa-originated sends already write this row; this path is
 * the backup for phone-sent messages and failed local persists. Duplicate
 * provider IDs are tenant-scoped no-ops and must not increment unread.
 */
export async function persistNormalizedOutboundMessage(
  event: MessageEvent,
  options: PersistInboundOptions
): Promise<PersistInboundResult> {
  const accountId = options.accountId;
  if (!accountId) throw new Error('Outbound account is required');

  const customerPhone = normalizePhone(
    event.patientAddress || event.recipientPhone || ''
  );
  if (!customerPhone) throw new Error('Outbound recipient phone is missing');
  if (
    !isValidIndividualPhone(customerPhone) ||
    isWhatsAppGroupAddress(customerPhone)
  ) {
    return {
      duplicate: false,
      accountId,
      contactId: '',
      conversationId: '',
    };
  }

  const externalId = String(
    event.externalMessageId || event.messageId || ''
  ).trim();
  if (!externalId) throw new Error('Outbound provider message id is missing');
  const text = eventText(event);
  const messageAt = eventDate(event).toISOString();

  const existing = await findExistingMessage(accountId, externalId);
  if (existing) {
    return {
      duplicate: true,
      accountId,
      contactId: String(value(existing, 'contact_id', 'contactId') || ''),
      conversationId: String(
        value(existing, 'conversation_id', 'conversationId') || ''
      ),
      messageId: String(existing.id || ''),
    };
  }

  const contactOutcome = await findOrCreateContact(
    accountId,
    options.userId || '',
    customerPhone,
    options.contactName || customerPhone
  );
  if (!contactOutcome) {
    return {
      duplicate: false,
      accountId,
      contactId: '',
      conversationId: '',
    };
  }

  const conversation = await findOrCreateConversation(
    accountId,
    options.userId || '',
    String(contactOutcome.contact.id),
    event.channel
  );
  if (!conversation) throw new Error('Unable to resolve outbound conversation');
  const conversationId = String(conversation.id);
  const contentType = event.contentType || 'text';

  const persistRes = await persistOutboundMessage({
    accountId,
    conversationId,
    senderType: 'agent',
    contentType,
    contentText: text || null,
    mediaUrl: event.mediaUrl || null,
    providerMessageId: externalId,
    createdAt: messageAt,
  });
  if (!persistRes.ok) {
    throw new Error(persistRes.error || 'Unable to persist outbound message');
  }

  await touchConversationPreview({
    accountId,
    conversationId,
    previewText: outboundPreviewText({
      contentText: text,
      contentType,
    }),
    messageAt,
  });

  return {
    duplicate: persistRes.duplicate,
    accountId,
    contactId: String(contactOutcome.contact.id),
    conversationId,
    messageId: persistRes.messageId,
  };
}
