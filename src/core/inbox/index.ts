/**
 * Helpa Core Platform — Inbox Engine
 *
 * Core conversation and message management with AI/Human handoff,
 * status tracking, tags, and tenant isolation.
 */

import { getAdminClient } from '@/lib/db/server';
import { coreEvents } from '@/core/events';

export interface CoreConversation {
  id: string;
  account_id: string;
  contact_id: string;
  channel: string;
  status: 'open' | 'closed' | 'archived';
  is_ai_active: boolean;
  assigned_to?: string | null;
  unread_count?: number;
  last_message_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CoreMessage {
  id: string;
  conversation_id: string;
  sender_type: 'user' | 'agent' | 'ai' | 'system';
  content_type: 'text' | 'image' | 'document' | 'audio' | 'button' | 'template';
  content_text: string;
  media_url?: string | null;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  created_at?: string;
}

export async function findOrCreateConversation(
  accountId: string,
  contactId: string,
  channel: string = 'whatsapp'
): Promise<CoreConversation> {
  const db = getAdminClient();

  const { data: existing } = await db
    .from('conversations')
    .select('*')
    .eq('account_id', accountId)
    .eq('contact_id', contactId)
    .eq('channel', channel)
    .maybeSingle();

  if (existing) {
    return existing as CoreConversation;
  }

  const { data: created, error } = await db
    .from('conversations')
    .insert({
      account_id: accountId,
      contact_id: contactId,
      channel,
      status: 'open',
      is_ai_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !created) {
    throw new Error(`Failed to create conversation: ${error?.message}`);
  }

  await coreEvents.emit('conversation.created', accountId, {
    conversationId: created.id,
    contactId,
    channel,
  });

  return created as CoreConversation;
}

export async function recordMessage(
  accountId: string,
  conversationId: string,
  message: {
    senderType: 'user' | 'agent' | 'ai' | 'system';
    contentType?:
      'text' | 'image' | 'document' | 'audio' | 'button' | 'template';
    contentText: string;
    mediaUrl?: string;
  }
): Promise<CoreMessage> {
  const db = getAdminClient();

  const { data: created, error } = await db
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: message.senderType,
      content_type: message.contentType || 'text',
      content_text: message.contentText,
      media_url: message.mediaUrl || null,
      status: 'sent',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !created) {
    throw new Error(`Failed to record message: ${error?.message}`);
  }

  // Update conversation last_message_at
  await db
    .from('conversations')
    .update({
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .eq('account_id', accountId);

  await coreEvents.emit(
    message.senderType === 'user' ? 'message.received' : 'message.sent',
    accountId,
    {
      conversationId,
      messageId: created.id,
      senderType: message.senderType,
      text: message.contentText,
    }
  );

  return created as CoreMessage;
}

export async function handoffToHuman(
  accountId: string,
  conversationId: string,
  assignedUserId?: string
): Promise<void> {
  const db = getAdminClient();

  const updates: Record<string, unknown> = {
    is_ai_active: false,
    updated_at: new Date().toISOString(),
  };
  if (assignedUserId) {
    updates.assigned_to = assignedUserId;
  }

  await db
    .from('conversations')
    .update(updates)
    .eq('id', conversationId)
    .eq('account_id', accountId);
}
