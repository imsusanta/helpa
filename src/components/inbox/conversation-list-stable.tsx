'use client';

import type { ComponentProps } from 'react';
import { ConversationList as BaseConversationList } from './conversation-list';

export type InboxFilter = import('./conversation-list').InboxFilter;
type ConversationListProps = ComponentProps<typeof BaseConversationList>;

/**
 * Keeps focus/visibility resyncs stale-while-revalidate. The underlying list
 * already polls in background and receives realtime parent updates; allowing
 * every visibility token to restart its fetch effect converted those silent
 * checks into a blocking loader and recreated the polling interval.
 */
export function ConversationList({
  resyncToken: _resyncToken,
  ...props
}: ConversationListProps) {
  return <BaseConversationList {...props} resyncToken={0} />;
}
