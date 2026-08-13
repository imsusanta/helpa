'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/appwrite-compat';
import { cn } from '@/lib/utils';
import type { Conversation, ConversationStatus } from '@/types';
import { Search, ChevronDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ConversationListProps {
  activeConversationId: string | null;
  onSelect: (conversation: Conversation) => void;
  conversations: Conversation[];
  onConversationsLoaded: (conversations: Conversation[]) => void;
  /**
   * Increment to force the fetch effect below to refire. The parent
   * bumps this on realtime reconnect / tab visibility → visible so the
   * list catches up on any events sent while the WS was disconnected
   * or the tab was throttled. Optional so existing callers keep working.
   */
  resyncToken?: number;
}

const STATUS_COLORS: Record<ConversationStatus, string> = {
  open: '',
  pending: 'bg-amber-500',
  closed: 'bg-muted-foreground',
};

type InboxFilter = ConversationStatus | 'all' | 'unread';

const FILTER_OPTIONS: { label: string; value: InboxFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'unread' },
  { label: 'Open', value: 'open' },
  { label: 'Pending', value: 'pending' },
  { label: 'Closed', value: 'closed' },
];

export function ConversationList({
  activeConversationId,
  onSelect,
  conversations,
  onConversationsLoaded,
  resyncToken = 0,
}: ConversationListProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [loading, setLoading] = useState(true);

  // Keep the latest callback in a ref so the fetch effect below can
  // have a stable, empty-dep identity. Previously the fetch useCallback
  // depended on `onConversationsLoaded`, which depends on the parent's
  // `deepLinkConvId` — so every URL change (including one the parent
  // triggered via router.replace after a click) caused a fresh
  // conversations fetch. That extra refetch was the trigger for the
  // deep-link auto-select running a second time and wiping the active
  // thread's messages.
  // Mutation lives in an effect (not render) per React 19's refs rule;
  // the fetch runs once on mount so it's fine to read the slightly
  // older value — the very next render updates the ref for any
  // subsequent async completion.
  const onConversationsLoadedRef = useRef(onConversationsLoaded);
  useEffect(() => {
    onConversationsLoadedRef.current = onConversationsLoaded;
  });

  useEffect(() => {
    const appwrite = createClient();
    let cancelled = false;

    (async () => {
      const { data, error } = await appwrite
        .from('conversations')
        .select('*, contact:contacts(*)')
        .order('last_message_at', { ascending: false });

      if (cancelled) return;

      if (error) {
        // appwrite errors have non-enumerable properties — log fields explicitly
        console.error('Failed to fetch conversations:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        setLoading(false);
        return;
      }

      const convs = (data ?? []) as Conversation[];

      // Hydrate contacts if unpopulated
      const missingIds = Array.from(
        new Set(
          convs
            .filter(
              (c) => Boolean(c.contact_id) && (!c.contact || !c.contact.name)
            )
            .map((c) => c.contact_id as string)
        )
      );

      if (missingIds.length > 0) {
        try {
          const { data: contactsData } = await appwrite
            .from('contacts')
            .select('*')
            .in('id', missingIds);

          if (contactsData && Array.isArray(contactsData)) {
            const contactsMap = new Map(contactsData.map((c) => [c.id, c]));
            convs.forEach((c) => {
              if (c.contact_id && contactsMap.has(c.contact_id)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                c.contact = contactsMap.get(c.contact_id) as any;
              }
            });
          }
        } catch {
          // ignore contact hydration errors
        }
      }

      onConversationsLoadedRef.current(convs);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // `resyncToken` is included so the parent can force a refetch when
    // the realtime channel reconnects or the tab regains focus — catches
    // up on any events sent while the WS was disconnected or throttled.
  }, [resyncToken]);

  const filtered = useMemo(() => {
    let result = conversations;

    if (filter === 'unread') {
      result = result.filter((c) => c.unread_count > 0);
    } else if (filter !== 'all') {
      result = result.filter((c) => c.status === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => {
        const name = c.contact?.name?.toLowerCase() ?? '';
        const phone = c.contact?.phone?.toLowerCase() ?? '';
        const lastMsg = c.last_message_text?.toLowerCase() ?? '';
        return name.includes(q) || phone.includes(q) || lastMsg.includes(q);
      });
    }

    // Sort by last_message_at descending
    return [...result].sort((a, b) => {
      const timeA = a.last_message_at
        ? new Date(a.last_message_at).getTime()
        : 0;
      const timeB = b.last_message_at
        ? new Date(b.last_message_at).getTime()
        : 0;
      return timeB - timeA;
    });
  }, [conversations, filter, search]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
    },
    []
  );

  const handleSelect = useCallback(
    (conv: Conversation) => {
      onSelect(conv);
    },
    [onSelect]
  );

  const activeFilter = FILTER_OPTIONS.find((o) => o.value === filter);

  return (
    // w-full on mobile so the list occupies the whole viewport when it's
    // the single pane showing; fixed 320px on desktop where it shares the
    // row with the thread + contact sidebar.
    <div className="border-border bg-card flex h-full w-full flex-col border-r lg:w-80">
      {/* Search + Filter */}
      <div className="border-border space-y-2 border-b p-3">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={handleSearchChange}
            placeholder="Search conversations..."
            className="border-border bg-muted text-foreground placeholder-muted-foreground focus:border-primary/50 pl-9 text-sm"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs">
            {activeFilter?.label ?? 'All'}
            <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="border-border bg-popover"
          >
            {FILTER_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={cn(
                  'text-sm',
                  filter === opt.value
                    ? 'text-primary'
                    : 'text-popover-foreground'
                )}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Conversation Items.
          `min-h-0` is load-bearing: a flex child defaults to
          min-height:auto, so without it this ScrollArea grows to fit
          every conversation instead of shrinking to the remaining
          space — the list then overflows and gets clipped by the
          parent's overflow-hidden with no scrollbar (issue #229). */}
      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-muted-foreground text-sm">
              No conversations found
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (conversation: Conversation) => void;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
}: ConversationItemProps) {
  const contact = conversation.contact;
  const displayName = contact?.name || contact?.phone || 'Unknown';
  const initials = displayName.charAt(0).toUpperCase();

  const handleClick = useCallback(() => {
    onSelect(conversation);
  }, [onSelect, conversation]);

  const timeAgo = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), {
        addSuffix: false,
      })
    : '';

  const isUnread = (conversation.unread_count ?? 0) > 0 && !isActive;

  return (
    <button
      onClick={handleClick}
      className={cn(
        'hover:bg-muted/50 flex w-full items-start gap-3 px-3 py-3 text-left transition-colors',
        isActive && 'border-primary bg-muted/70 border-l-2'
      )}
    >
      {/* Avatar */}
      <div className="bg-muted text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium">
        {contact?.avatar_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={contact.avatar_url}
            alt={displayName}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'truncate text-sm',
              isUnread
                ? 'text-foreground font-bold'
                : 'text-foreground font-medium'
            )}
          >
            {displayName}
          </span>
          <span
            className={cn(
              'shrink-0 text-[10px]',
              isUnread
                ? 'font-bold text-emerald-600 dark:text-emerald-400'
                : 'text-muted-foreground'
            )}
          >
            {timeAgo}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={cn(
              'truncate text-xs',
              isUnread
                ? 'text-foreground font-semibold'
                : 'text-muted-foreground'
            )}
          >
            {conversation.last_message_text || 'No messages yet'}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {isUnread && (
              <span
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-full bg-emerald-500 font-bold text-white shadow-sm',
                  (conversation.unread_count ?? 0) > 1
                    ? 'h-4 min-w-4 px-1 text-[10px]'
                    : 'h-2.5 w-2.5'
                )}
                title={`${conversation.unread_count} unread message${conversation.unread_count === 1 ? '' : 's'}`}
              >
                {(conversation.unread_count ?? 0) > 1
                  ? conversation.unread_count
                  : null}
              </span>
            )}
            {conversation.status !== 'open' &&
              STATUS_COLORS[conversation.status] && (
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    STATUS_COLORS[conversation.status]
                  )}
                  title={`Status: ${conversation.status}`}
                />
              )}
          </div>
        </div>
      </div>
    </button>
  );
}
