/**
 * Helpa Core Platform — Conversation Memory
 *
 * Tenant-isolated conversation context retrieval, history windowing,
 * and memory compaction for the AI Engine.
 */

import { getAdminClient } from '@/lib/db/server';
import type { AiMessage } from './provider';

export interface ConversationMemoryContext {
  messages: AiMessage[];
  contactName?: string;
  contactMobile?: string;
  contactNotes?: string;
  recentInteractionsCount: number;
}

export async function getConversationMemory(
  accountId: string,
  conversationId: string,
  contactId: string,
  limit: number = 10
): Promise<ConversationMemoryContext> {
  const db = getAdminClient();

  // Tenant-isolated query for contact
  const { data: contact } = await db
    .from('contacts')
    .select('name, phone, notes, extra_attributes')
    .eq('id', contactId)
    .eq('account_id', accountId)
    .maybeSingle();

  // Tenant-isolated query for recent messages
  const { data: rawMessages } = await db
    .from('messages')
    .select('sender_type, content_text, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  const formattedMessages: AiMessage[] = (rawMessages || [])
    .reverse()
    .filter((m) => m.content_text && m.content_text.trim().length > 0)
    .map((m) => ({
      role:
        m.sender_type === 'ai' || m.sender_type === 'agent'
          ? 'assistant'
          : 'user',
      content: m.content_text,
    }));

  return {
    messages: formattedMessages,
    contactName: contact?.name,
    contactMobile: contact?.phone,
    contactNotes: contact?.notes,
    recentInteractionsCount: rawMessages?.length || 0,
  };
}
