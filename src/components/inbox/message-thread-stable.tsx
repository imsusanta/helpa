'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import type { Message } from '@/types';
import { mergeMessageSnapshots } from '@/lib/inbox/client-cache';
import { MessageThread as BaseMessageThread } from './message-thread';

type MessageThreadProps = ComponentProps<typeof BaseMessageThread>;

/**
 * Prevents tab-focus resyncs from blanking the open thread. Realtime and the
 * thread's background poll still refresh data, while a user-initiated refresh
 * gets its own token. Server snapshots are merged with optimistic bubbles so
 * a just-sent message cannot disappear until the database insert arrives.
 */
export function MessageThread(props: MessageThreadProps) {
  const messagesRef = useRef(props.messages);
  const [manualRefreshToken, setManualRefreshToken] = useState(
    props.resyncToken ?? 0
  );

  useEffect(() => {
    messagesRef.current = props.messages;
  }, [props.messages]);

  const handleMessagesLoaded = useCallback(
    (serverMessages: Message[]) => {
      props.onMessagesLoaded(
        mergeMessageSnapshots(serverMessages, messagesRef.current)
      );
    },
    [props.onMessagesLoaded]
  );

  const handleManualRefresh = useCallback(() => {
    setManualRefreshToken((token) => token + 1);
    props.onRefresh?.();
  }, [props.onRefresh]);

  return (
    <BaseMessageThread
      {...props}
      onMessagesLoaded={handleMessagesLoaded}
      resyncToken={manualRefreshToken}
      onRefresh={props.onRefresh ? handleManualRefresh : undefined}
    />
  );
}
