'use client';

import { useCallback, useState } from 'react';
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
export function MessageThread({
  messages,
  onMessagesLoaded,
  onRefresh,
  resyncToken: _resyncToken,
  ...props
}: MessageThreadProps) {
  const [manualRefreshToken, setManualRefreshToken] = useState(0);

  const handleMessagesLoaded = useCallback(
    (serverMessages: Message[]) => {
      onMessagesLoaded(mergeMessageSnapshots(serverMessages, messages));
    },
    [messages, onMessagesLoaded]
  );

  const handleManualRefresh = useCallback(() => {
    setManualRefreshToken((token) => token + 1);
    onRefresh?.();
  }, [onRefresh]);

  return (
    <BaseMessageThread
      {...props}
      messages={messages}
      onMessagesLoaded={handleMessagesLoaded}
      resyncToken={manualRefreshToken}
      onRefresh={onRefresh ? handleManualRefresh : undefined}
    />
  );
}
