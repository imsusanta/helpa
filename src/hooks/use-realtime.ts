'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { getAppwriteClient } from '@/infrastructure/appwrite/client';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client';
import type {
  Message,
  Conversation,
  SenderType,
  ContentType,
  MessageStatus,
  ConversationStatus,
} from '@/types';

interface RealtimeEvent<T> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: Partial<T>;
}

interface UseRealtimeOptions {
  channelName: string;
  onMessageEvent?: (event: RealtimeEvent<Message>) => void;
  onConversationEvent?: (event: RealtimeEvent<Conversation>) => void;
  enabled?: boolean;
}

function normalizeMessagePayload(doc: Record<string, unknown>): Message {
  return {
    id: (doc.$id || doc.id) as string,
    conversation_id: (doc.conversationId ||
      doc.conversation_id ||
      doc.conversationId) as string,
    sender_type: (doc.senderType ||
      doc.sender_type ||
      'customer') as SenderType,
    sender_id: (doc.senderId || doc.sender_id) as string | undefined,
    content_type: (doc.contentType ||
      doc.content_type ||
      doc.type ||
      'text') as ContentType,
    content_text:
      ((doc.contentText || doc.content_text || doc.content) as string) || '',
    media_url: (doc.mediaUrl || doc.media_url) as string | undefined,
    template_name: (doc.templateName || doc.template_name) as
      string | undefined,
    message_id: (doc.messageId || doc.message_id) as string | undefined,
    status: (doc.status ||
      doc.deliveryStatus ||
      doc.delivery_status ||
      'sent') as MessageStatus,
    created_at:
      ((doc.createdAt || doc.$createdAt) as string) || new Date().toISOString(),
    reply_to_message_id: (doc.replyToMessageId || doc.reply_to_message_id) as
      string | undefined,
    interactive_reply_id: (doc.interactiveReplyId ||
      doc.interactive_reply_id) as string | undefined,
  };
}

function normalizeConversationPayload(
  doc: Record<string, unknown>
): Conversation {
  return {
    id: (doc.$id || doc.id) as string,
    user_id: ((doc.userId || doc.user_id) as string) || '',
    contact_id: ((doc.contactId || doc.contact_id) as string) || '',
    status: ((doc.status as string) || 'open') as ConversationStatus,
    assigned_agent_id: (doc.assignedAgentId || doc.assigned_agent_id) as
      string | undefined,
    last_message_text:
      ((doc.lastMessageText || doc.last_message_text) as string) || '',
    last_message_at:
      ((doc.lastMessageAt ||
        doc.last_message_at ||
        doc.$updatedAt ||
        doc.updatedAt) as string) || undefined,
    unread_count: Number(doc.unreadCount || doc.unread_count || 0),
    ai_chat_enabled: Boolean(doc.aiChatEnabled ?? doc.ai_chat_enabled ?? false),
    ai_intent: ((doc.aiIntent || doc.ai_intent) as string | null) || null,
    ai_lead_score:
      ((doc.aiLeadScore || doc.ai_lead_score) as string | null) || null,
    ai_summary: ((doc.aiSummary || doc.ai_summary) as string | null) || null,
    ai_sentiment:
      ((doc.aiSentiment || doc.ai_sentiment) as string | null) || null,
    ai_handoff_required: Boolean(
      doc.aiHandoffRequired ?? doc.ai_handoff_required ?? false
    ),
    ai_resolved: Boolean(doc.aiResolved ?? doc.ai_resolved ?? false),
    ai_faq_category:
      ((doc.aiFaqCategory || doc.ai_faq_category) as string | null) || null,
    created_at:
      ((doc.createdAt || doc.$createdAt) as string) || new Date().toISOString(),
    updated_at:
      ((doc.updatedAt || doc.$updatedAt) as string) || new Date().toISOString(),
  };
}

export function useRealtime({
  channelName: _channelName,
  onMessageEvent,
  onConversationEvent,
  enabled = true,
}: UseRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const onMessageRef = useRef(onMessageEvent);
  const onConversationRef = useRef(onConversationEvent);
  useEffect(() => {
    onMessageRef.current = onMessageEvent;
    onConversationRef.current = onConversationEvent;
  });

  useEffect(() => {
    if (!enabled) return;

    // 1. Try Supabase Realtime first
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      try {
        const supabase = createSupabaseBrowserClient();
        const channel = supabase
          .channel('inbox-realtime-global')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'messages' },
            (payload) => {
              const row = (payload.new || {}) as Record<string, unknown>;
              const normalizedMessage = normalizeMessagePayload(row);
              onMessageRef.current?.({
                eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
                new: normalizedMessage,
                old: payload.old as Partial<Message>,
              });
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'conversations' },
            (payload) => {
              const row = (payload.new || {}) as Record<string, unknown>;
              const normalizedConv = normalizeConversationPayload(row);
              onConversationRef.current?.({
                eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
                new: normalizedConv,
                old: payload.old as Partial<Conversation>,
              });
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              setIsConnected(true);
            }
          });

        unsubscribeRef.current = () => {
          supabase.removeChannel(channel);
        };
        return;
      } catch {
        // Fallback to Appwrite
      }
    }

    // 2. Fallback: Appwrite Realtime
    try {
      const { client } = getAppwriteClient();
      const messagesChannel = `databases.${APPWRITE_CONFIG.databaseId}.collections.${APPWRITE_CONFIG.collections.messages}.documents`;
      const conversationsChannel = `databases.${APPWRITE_CONFIG.databaseId}.collections.${APPWRITE_CONFIG.collections.conversations}.documents`;

      const unsubscribe = client.subscribe(
        [messagesChannel, conversationsChannel],
        (response) => {
          const events = response.events || [];
          const isInsert = events.some((e) => e.endsWith('.create'));
          const isDelete = events.some((e) => e.endsWith('.delete'));
          const eventType = isInsert
            ? 'INSERT'
            : isDelete
              ? 'DELETE'
              : 'UPDATE';

          if (response.channels.includes(messagesChannel)) {
            const raw = response.payload as Record<string, unknown>;
            const normalized = normalizeMessagePayload(raw);
            onMessageRef.current?.({
              eventType,
              new: normalized,
              old: {},
            });
          } else if (response.channels.includes(conversationsChannel)) {
            const raw = response.payload as Record<string, unknown>;
            const normalized = normalizeConversationPayload(raw);
            onConversationRef.current?.({
              eventType,
              new: normalized,
              old: {},
            });
          }
        }
      );

      unsubscribeRef.current = unsubscribe;
      Promise.resolve().then(() => setIsConnected(true));
    } catch {
      Promise.resolve().then(() => setIsConnected(false));
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      setIsConnected(false);
    };
  }, [enabled]);

  const unsubscribe = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
      setIsConnected(false);
    }
  }, []);

  return { isConnected, unsubscribe };
}
