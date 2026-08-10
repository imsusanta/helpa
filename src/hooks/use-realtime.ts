'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { getAppwriteClient } from '@/infrastructure/appwrite/client';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import type { Message, Conversation } from '@/types';

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
            onMessageRef.current?.({
              eventType,
              new: response.payload as unknown as Message,
              old: {},
            });
          } else if (response.channels.includes(conversationsChannel)) {
            onConversationRef.current?.({
              eventType,
              new: response.payload as unknown as Conversation,
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
