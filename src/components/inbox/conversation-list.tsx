'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { Conversation, ConversationStatus } from '@/types';
import {
  Search,
  ChevronDown,
  SquarePen,
  MessageSquarePlus,
  AlertCircle,
  RefreshCw,
  X,
  Filter,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SendOutboundModal } from '@/components/contacts/send-outbound-modal';

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
  onStartConversation?: () => void;
  onSelectById?: (conversationId: string) => void;
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
  onStartConversation,
  onSelectById,
}: ConversationListProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [retryCounter, setRetryCounter] = useState(0);

  // Keep the latest callback in a ref so the fetch effect below can
  // have a stable, empty-dep identity.
  const onConversationsLoadedRef = useRef(onConversationsLoaded);
  useEffect(() => {
    onConversationsLoadedRef.current = onConversationsLoaded;
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch('/api/conversations?limit=100', {
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (!res.ok || !json.success) {
          const errMsg =
            json.message || json.error || 'Failed to load conversations';
          console.error('Failed to fetch conversations:', errMsg);
          setFetchError(errMsg);
          setLoading(false);
          return;
        }

        const convs = (json.data ?? []) as Conversation[];
        onConversationsLoadedRef.current(convs);
        setFetchError(null);
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Unexpected error fetching conversations:', msg);
        setFetchError(msg);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resyncToken, retryCounter]);

  const filtered = useMemo(() => {
    let result = conversations;

    if (filter === 'unread') {
      result = result.filter((c) => (c.unread_count ?? 0) > 0);
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

  const handleClearSearch = useCallback(() => {
    setSearch('');
  }, []);

  const handleSelect = useCallback(
    (conv: Conversation) => {
      onSelect(conv);
    },
    [onSelect]
  );

  const handleOpenStartChat = useCallback(() => {
    if (onStartConversation) {
      onStartConversation();
    } else {
      setStartModalOpen(true);
    }
  }, [onStartConversation]);

  const handleConversationCreated = useCallback(
    (newConvId?: string) => {
      setStartModalOpen(false);
      setRetryCounter((c) => c + 1);
      if (newConvId && onSelectById) {
        onSelectById(newConvId);
      }
    },
    [onSelectById]
  );

  const activeFilter = FILTER_OPTIONS.find((o) => o.value === filter);

  return (
    <div className="border-border bg-card flex h-full w-full flex-col border-r lg:w-80">
      {/* Header with Title and New Chat button */}
      <div className="border-border flex items-center justify-between border-b px-3.5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-foreground text-sm font-semibold">Chats</h2>
          {conversations.length > 0 && (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
              {conversations.length}
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleOpenStartChat}
          className="h-7 gap-1.5 px-2.5 text-xs font-medium shadow-xs"
        >
          <SquarePen className="h-3.5 w-3.5" />
          <span>New Chat</span>
        </Button>
      </div>

      {/* Search + Filter */}
      <div className="border-border space-y-2 border-b p-3">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={handleSearchChange}
            placeholder="Search conversations..."
            className="border-border bg-muted text-foreground placeholder-muted-foreground focus:border-primary/50 pr-8 pl-9 text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 rounded-xs p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs">
            <Filter className="mr-0.5 h-3 w-3 opacity-70" />
            <span>Filter: {activeFilter?.label ?? 'All'}</span>
            <ChevronDown className="ml-0.5 h-3 w-3 opacity-70" />
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
                    ? 'text-primary font-medium'
                    : 'text-popover-foreground'
                )}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Conversation Items */}
      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2.5 py-16 text-center">
            <div className="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
            <p className="text-muted-foreground text-xs">
              Loading conversations...
            </p>
          </div>
        ) : fetchError ? (
          <div className="space-y-3 px-4 py-12 text-center">
            <div className="bg-destructive/10 text-destructive mx-auto flex h-10 w-10 items-center justify-center rounded-full">
              <AlertCircle className="h-5 w-5" />
            </div>
            <p className="text-foreground text-sm font-medium">
              Unable to load conversations
            </p>
            <p className="text-muted-foreground mx-auto max-w-[220px] text-xs leading-relaxed">
              {fetchError}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRetryCounter((c) => c + 1)}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="space-y-3 px-4 py-12 text-center">
            {search.trim() ? (
              <>
                <div className="bg-muted text-muted-foreground mx-auto flex h-10 w-10 items-center justify-center rounded-full">
                  <Search className="h-5 w-5" />
                </div>
                <p className="text-foreground text-sm font-medium">
                  No conversations found
                </p>
                <p className="text-muted-foreground text-xs">
                  No matches for &ldquo;{search}&rdquo;
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSearch}
                  className="text-xs"
                >
                  Clear search
                </Button>
              </>
            ) : filter !== 'all' ? (
              <>
                <div className="bg-muted text-muted-foreground mx-auto flex h-10 w-10 items-center justify-center rounded-full">
                  <Filter className="h-5 w-5" />
                </div>
                <p className="text-foreground text-sm font-medium">
                  No {filter} conversations
                </p>
                <p className="text-muted-foreground text-xs">
                  No conversations in this status.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilter('all')}
                  className="text-xs"
                >
                  View all conversations
                </Button>
              </>
            ) : (
              <>
                <div className="bg-primary/10 text-primary mx-auto flex h-12 w-12 items-center justify-center rounded-2xl">
                  <MessageSquarePlus className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-foreground text-sm font-semibold">
                    No conversations yet
                  </p>
                  <p className="text-muted-foreground mx-auto mt-1 max-w-[210px] text-xs leading-relaxed">
                    Start a new conversation with a contact, or incoming
                    WhatsApp messages will appear here.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleOpenStartChat}
                  className="gap-1.5 text-xs shadow-xs"
                >
                  <SquarePen className="h-3.5 w-3.5" />
                  Start Conversation
                </Button>
              </>
            )}
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

      {/* Standalone Start Conversation Modal if not triggered via parent */}
      <SendOutboundModal
        open={startModalOpen}
        onOpenChange={setStartModalOpen}
        onSuccess={handleConversationCreated}
      />
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
