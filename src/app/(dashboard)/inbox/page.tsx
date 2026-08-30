'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Conversation, Message, Contact } from '@/types';
import { useRealtime } from '@/hooks/use-realtime';
import { useAuth } from '@/hooks/use-auth';
import { ConversationList } from '@/components/inbox/conversation-list';
import { MessageThread } from '@/components/inbox/message-thread';
import { ContactSidebar } from '@/components/inbox/contact-sidebar';
import { ReceptionistCopilotPanel } from '@/components/inbox/receptionist-copilot-panel';
import { SendOutboundModal } from '@/components/contacts/send-outbound-modal';
import type { InsertedComposerReply } from '@/components/inbox/message-composer';
import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/hooks/use-workspace';
import {
  applyMessageToConversation,
  mergeConversationEvent,
  mergeMessages,
} from '@/lib/inbox/merge';
import { isHiddenWhatsAppInboxChat } from '@/core/whatsapp/group-identity';

// Remembers the agent's show/hide choice for the desktop contact panel
// across reloads and sessions (device-scoped, like the theme prefs).
const CONTACT_PANEL_STORAGE_KEY = 'wacrm:inbox:contact-panel-open';

function withoutHiddenInboxChats(items: Conversation[]): Conversation[] {
  return items.filter(
    (conversation) =>
      !isHiddenWhatsAppInboxChat(
        conversation.contact?.phone,
        conversation.contact?.metadata
      )
  );
}

export default function InboxPage() {
  const router = useRouter();
  const { accountId } = useAuth();
  const { terminology, currentIndustry } = useWorkspace();
  const contactLabelSingular = terminology.person;

  const [rightTab, setRightTab] = useState<'copilot' | 'crm'>('crm');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [insertedReply, setInsertedReply] =
    useState<InsertedComposerReply | null>(null);
  const [whatsappConnected, setWhatsappConnected] = useState<boolean | null>(
    null
  );
  const [startConversationOpen, setStartConversationOpen] = useState(false);
  /**
   * Bumped whenever we want children (ConversationList, MessageThread)
   * to refetch from the DB — used as a safety net against missed
   * realtime events. Bumped on WS reconnect and on tab visibility →
   * visible. The initial mount fetches don't depend on this; they fire
   * once on conversationId-change as usual.
   */
  const [resyncToken, setResyncToken] = useState(0);

  /**
   * Whether the desktop contact sidebar (tags / deals / notes) is shown.
   * Defaults to `true` (the historical behaviour) and is restored from
   * localStorage after mount. We deliberately do NOT read localStorage in
   * the initializer: the server renders with `true`, so reading a stored
   * `false` synchronously would produce a hydration mismatch. The effect
   * below reconciles to the stored value right after mount instead.
   */
  const [contactPanelOpen, setContactPanelOpen] = useState(true);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONTACT_PANEL_STORAGE_KEY);
      if (stored !== null) setContactPanelOpen(stored === 'true');
    } catch {
      // localStorage can throw in private-browsing / sandboxed contexts.
    }
  }, []);

  const handleToggleContactPanel = useCallback(() => {
    setContactPanelOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(CONTACT_PANEL_STORAGE_KEY, String(next));
      } catch {
        // Persistence is best-effort; ignore storage failures.
      }
      return next;
    });
  }, []);

  // Tracks conversations whose hydrate fetch is currently in flight. The
  // conv-INSERT and the first-message-INSERT events both call into
  // hydrateConversation; the dedupe here keeps it at one refetch per
  // new conversation even when both events arrive within milliseconds.
  const hydratingConvIdsRef = useRef<Set<string>>(new Set());

  // Read by async hydration/event callbacks without capturing an old active
  // conversation when the user switches threads while a request is pending.
  const activeConversationIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeConversationIdRef.current = activeConversation?.id ?? null;
  }, [activeConversation?.id]);

  // Realtime callbacks and API snapshots can complete in either order. This
  // ref lets event handlers de-duplicate INSERT notifications before the
  // corresponding React state update has rendered.
  const seenRealtimeMessageIdsRef = useRef<Set<string>>(new Set());
  const pendingConversationIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Do not retain live rows from a previously selected workspace when the
    // authenticated account changes underneath this client page.
    seenRealtimeMessageIdsRef.current.clear();
    pendingConversationIdsRef.current.clear();
  }, [accountId]);

  /**
   * Synchronous mirror of the conversation ids currently in `conversations`
   * state. Event handlers need to know "do we already have this conv?"
   * without waiting for a setState updater to run — updaters fire during
   * reconciliation, *after* the synchronous handler code returns, so a
   * `let foundInList = false; setState(p => { foundInList = ...; return ... })`
   * flag reads as `false` in the same tick (this exact bug shipped in #105
   * and caused #106: every incoming message and every status flip fired a
   * redundant DB hydrate, swamping the appwrite client and starving the
   * realtime channel). The ref is kept in sync via the effect below.
   */
  const knownConvIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const next = new Set<string>();
    for (const c of conversations) next.add(c.id);
    knownConvIdsRef.current = next;
  }, [conversations]);

  // Pull the conversation row with its `contact` joined and merge it
  // into state. Needed because appwrite Realtime payloads only carry the
  // row's own columns — a brand-new conversation arrives without a
  // contact, which surfaced as "Unknown" names, empty avatars, and
  // (when the conv-INSERT event was delayed past the message-INSERT)
  // conversations stuck on "No messages yet" until the user reloaded.
  // Also self-heals if a realtime event was missed: callers can invoke
  // this whenever they reference a conversation id they don't recognise.
  const hydrateConversation = useCallback(async (convId: string) => {
    if (hydratingConvIdsRef.current.has(convId)) return;
    hydratingConvIdsRef.current.add(convId);
    try {
      const res = await fetch(
        `/api/inbox/conversations/${encodeURIComponent(convId)}`,
        {
          credentials: 'include',
          cache: 'no-store',
        }
      );
      if (!res.ok) {
        console.error('Failed to hydrate conversation: HTTP', res.status);
        return;
      }
      const json = await res.json();
      const fetched = (json.conversation || json) as Conversation;
      if (!fetched?.id) return;
      if (
        isHiddenWhatsAppInboxChat(
          fetched.contact?.phone,
          fetched.contact?.metadata
        )
      ) {
        return;
      }
      if (!knownConvIdsRef.current.has(fetched.id)) {
        pendingConversationIdsRef.current.add(fetched.id);
      }
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === fetched.id);
        const merged = mergeConversationEvent(existing, fetched);
        if (activeConversationIdRef.current === fetched.id) {
          merged.unread_count = 0;
        }
        if (existing) {
          return prev.map((c) => (c.id === fetched.id ? merged : c));
        }
        return [merged, ...prev];
      });
      knownConvIdsRef.current.add(fetched.id);
      setActiveConversation((prev) => {
        if (!prev || prev.id !== fetched.id) return prev;
        return mergeConversationEvent(prev, fetched);
      });
    } catch (e) {
      console.error('Failed to hydrate conversation:', e);
    } finally {
      hydratingConvIdsRef.current.delete(convId);
    }
  }, []);

  // Check WhatsApp connection status on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch('/api/whatsapp/config', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          setWhatsappConnected(
            data?.connected === true ||
              data?.status === 'connected' ||
              data?.config?.status === 'connected' ||
              data?.configured === true
          );
        } else {
          setWhatsappConnected(false);
        }
      } catch {
        setWhatsappConnected(false);
      }
    };

    checkConnection();
  }, []);

  // Handle realtime message events
  const handleMessageEvent = useCallback(
    (event: { eventType: string; new: Message; old: Partial<Message> }) => {
      const newMsg = event.new;
      if (!newMsg.id) return;

      if (event.eventType === 'DELETE') {
        setMessages((prev) =>
          prev.filter((message) => message.id !== newMsg.id)
        );
        return;
      }

      if (!newMsg.conversation_id) return;

      if (event.eventType === 'INSERT') {
        const isFirstRealtimeInsert = !seenRealtimeMessageIdsRef.current.has(
          newMsg.id
        );
        seenRealtimeMessageIdsRef.current.add(newMsg.id);

        // Add to messages if it belongs to active conversation
        if (
          activeConversation &&
          newMsg.conversation_id === activeConversation.id
        ) {
          setMessages((prev) => mergeMessages(prev, [newMsg]));
        }

        // Update conversation list preview. We need to know *synchronously*
        // whether the conv is already in state to decide between patching
        // the preview and triggering a hydrate — see the comment on
        // knownConvIdsRef for why a closure flag inside the updater would
        // always read false here.
        if (knownConvIdsRef.current.has(newMsg.conversation_id)) {
          const isActive = activeConversation?.id === newMsg.conversation_id;
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== newMsg.conversation_id) return c;
              return applyMessageToConversation(c, newMsg, {
                active: isActive,
                firstRealtimeInsert: isFirstRealtimeInsert,
              });
            })
          );
          setActiveConversation((prev) => {
            if (!prev || prev.id !== newMsg.conversation_id) return prev;
            return applyMessageToConversation(prev, newMsg, {
              // Keep a positive count on the active-conversation object so
              // MessageThread's reset effect PATCHes the database. Only the
              // list copy is forced to zero to avoid a visible badge flicker.
              active: false,
              firstRealtimeInsert: isFirstRealtimeInsert,
            });
          });
        } else {
          // First time we're seeing this conv: the conv-INSERT event
          // hasn't landed yet, or was missed. Hydrate from the DB so
          // the row surfaces with its `contact` joined; the conv-UPDATE
          // event the webhook emits right after the message INSERT will
          // converge state when it arrives.
          pendingConversationIdsRef.current.add(newMsg.conversation_id);
          hydrateConversation(newMsg.conversation_id);
        }
      }

      if (event.eventType === 'UPDATE') {
        // Update message status
        setMessages((prev) =>
          prev.map((m) => (m.id === newMsg.id ? { ...m, ...newMsg } : m))
        );
      }
    },
    [activeConversation, hydrateConversation]
  );

  // Handle realtime conversation events
  const handleConversationEvent = useCallback(
    (event: {
      eventType: string;
      new: Conversation;
      old: Partial<Conversation>;
    }) => {
      const conv = event.new;
      if (!conv?.id) return;

      if (event.eventType === 'DELETE') {
        knownConvIdsRef.current.delete(conv.id);
        setConversations((prev) => prev.filter((c) => c.id !== conv.id));
        setActiveConversation((prev) => (prev?.id === conv.id ? null : prev));
        setActiveContact((prev) =>
          activeConversation?.id === conv.id ? null : prev
        );
        if (activeConversation?.id === conv.id) {
          setMessages([]);
          setInsertedReply(null);
        }
        return;
      }

      const hadConversation = knownConvIdsRef.current.has(conv.id);
      knownConvIdsRef.current.add(conv.id);
      if (!hadConversation) pendingConversationIdsRef.current.add(conv.id);

      // Always merge the payload, even when the row is already present. A
      // conversation UPDATE may arrive while its hydration request is still
      // in flight; gating on known ids used to silently discard that update.
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === conv.id);
        const merged = mergeConversationEvent(existing, conv);
        if (activeConversation?.id === conv.id) merged.unread_count = 0;
        if (existing) {
          return withoutHiddenInboxChats(
            prev.map((c) => (c.id === conv.id ? merged : c))
          );
        }
        return withoutHiddenInboxChats([merged, ...prev]);
      });

      if (activeConversation?.id === conv.id) {
        setActiveConversation((prev) =>
          prev ? mergeConversationEvent(prev, conv) : prev
        );
      }

      if (event.eventType === 'INSERT') {
        // Prepend immediately for snappy UX so the new conv shows in the
        // list right away, then hydrate to fill in the `contact` join
        // (realtime payloads never include joins). Skip both if we
        // already have the row — that shouldn't happen normally, but
        // out-of-order delivery would have us prepending a duplicate.
        hydrateConversation(conv.id);
      }

      if (event.eventType === 'UPDATE') {
        if (!hadConversation) {
          // UPDATE arrived before the INSERT (or after a missed INSERT)
          // — fetch the row so it surfaces with its contact joined. The
          // patch contained in `conv` will already be reflected in what
          // the hydrate fetch returns.
          hydrateConversation(conv.id);
        }
      }
    },
    [activeConversation, hydrateConversation]
  );

  // Subscribe to realtime. The `isConnected` flag below feeds the
  // reconnect resync: realtime is best-effort and events sent while the
  // WS was disconnected (laptop sleep, network blip, background-tab
  // throttle) are simply lost. We need a way to catch up.
  const { isConnected } = useRealtime({
    channelName: 'inbox-realtime',
    onMessageEvent: handleMessageEvent,
    onConversationEvent: handleConversationEvent,
    enabled: !!accountId,
  });

  /**
   * Bump `resyncToken` whenever the realtime channel transitions from
   * disconnected → connected *after* the initial connect. The initial
   * connect is covered by the children's on-mount fetches; only later
   * reconnects need a manual refetch to fill the gap.
   *
   * Tracked via a `was-connected` ref rather than a count so that React
   * strict-mode's dev-only effect double-fire doesn't read as a
   * reconnect.
   */
  const wasConnectedRef = useRef(false);
  const initialConnectDoneRef = useRef(false);
  useEffect(() => {
    if (isConnected && !wasConnectedRef.current) {
      // false → true transition
      if (initialConnectDoneRef.current) {
        setResyncToken((value) => value + 1);
      } else {
        initialConnectDoneRef.current = true;
      }
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected]);

  // Refresh data after the browser tab becomes visible again.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setResyncToken((value) => value + 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Keep the active contact in sync with the selected conversation.
  useEffect(() => {
    setActiveContact(activeConversation?.contact ?? null);
  }, [activeConversation]);

  const handleConversationsLoaded = useCallback((items: Conversation[]) => {
    setConversations(withoutHiddenInboxChats(items));
  }, []);

  const handleSelectConversation = useCallback((conversation: Conversation) => {
    setActiveConversation(conversation);
    setMessages([]);
  }, []);

  const handleSelectById = useCallback(
    (convId: string) => {
      router.replace(`/inbox?c=${convId}`, { scroll: false });
      hydrateConversation(convId);
    },
    [router, hydrateConversation]
  );

  const handleCloseConversation = useCallback(() => {
    setActiveConversation(null);
    setActiveContact(null);
    setMessages([]);
    setInsertedReply(null);
    router.replace('/inbox', { scroll: false });
  }, [router]);

  const handleMessagesLoaded = useCallback((loaded: Message[]) => {
    setMessages((prev) => mergeMessages(prev, loaded));
  }, []);

  const handleNewMessage = useCallback((msg: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    if (!msg.conversation_id) return;
    const isActive = activeConversationIdRef.current === msg.conversation_id;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === msg.conversation_id
          ? applyMessageToConversation(c, msg, {
              active: isActive,
              firstRealtimeInsert: true,
            })
          : c
      )
    );
    setActiveConversation((prev) =>
      prev && prev.id === msg.conversation_id
        ? applyMessageToConversation(prev, msg, {
            active: true,
            firstRealtimeInsert: true,
          })
        : prev
    );
  }, []);

  const handleUpdateMessage = useCallback(
    (id: string, updates: Partial<Message>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
      );
    },
    []
  );

  const handleStatusChange = useCallback(
    (conversationId: string, status: Conversation['status']) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, status } : c))
      );
      if (activeConversation?.id === conversationId) {
        setActiveConversation((prev) => (prev ? { ...prev, status } : prev));
      }
    },
    [activeConversation]
  );

  const handleAssignChange = useCallback(
    (conversationId: string, assignedAgentId: string | null) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, assigned_agent_id: assignedAgentId ?? undefined }
            : c
        )
      );
      if (activeConversation?.id === conversationId) {
        setActiveConversation((prev) =>
          prev
            ? { ...prev, assigned_agent_id: assignedAgentId ?? undefined }
            : prev
        );
      }
    },
    [activeConversation]
  );

  const handleConversationUpdate = useCallback(
    (conversationId: string, updates: Partial<Conversation>) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, ...updates } : c))
      );
      if (activeConversation?.id === conversationId) {
        setActiveConversation((prev) =>
          prev ? { ...prev, ...updates } : prev
        );
      }
    },
    [activeConversation]
  );

  const handleInsertCopilotReply = useCallback(
    (reply: string) => {
      if (!activeConversation) return;
      setInsertedReply({
        id: Date.now(),
        conversationId: activeConversation.id,
        text: reply,
      });
    },
    [activeConversation]
  );

  const handleOpenStartConversation = useCallback(() => {
    setStartConversationOpen(true);
  }, []);

  const handleManualRefresh = useCallback(() => {
    setResyncToken((prev) => prev + 1);
  }, []);

  const handleConversationCreated = useCallback(
    (newConvId?: string) => {
      setStartConversationOpen(false);
      setResyncToken((prev) => prev + 1);
      if (newConvId) {
        router.replace(`/inbox?c=${newConvId}`, { scroll: false });
        hydrateConversation(newConvId);
      }
    },
    [router, hydrateConversation]
  );

  const hasActiveConv = !!activeConversation;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      {whatsappConnected === false && (
        <div className="flex shrink-0 items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2">
          <WifiOff className="h-4 w-4 text-amber-400" />
          <p className="text-xs text-amber-400">
            WhatsApp® is not connected. Go to Settings to connect your account.
          </p>
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            'flex h-full min-h-0 flex-1 lg:flex-none',
            hasActiveConv ? 'hidden lg:flex' : 'flex'
          )}
        >
          <ConversationList
            activeConversationId={activeConversation?.id ?? null}
            onSelect={handleSelectConversation}
            conversations={conversations}
            onConversationsLoaded={handleConversationsLoaded}
            resyncToken={resyncToken}
            onStartConversation={handleOpenStartConversation}
            onSelectById={handleSelectById}
          />
        </div>

        <div
          className={cn(
            'flex h-full min-h-0 min-w-0 flex-1 lg:flex',
            hasActiveConv ? 'flex' : 'hidden lg:flex'
          )}
        >
          <MessageThread
            conversation={activeConversation}
            contact={activeContact}
            messages={messages}
            onMessagesLoaded={handleMessagesLoaded}
            onNewMessage={handleNewMessage}
            onUpdateMessage={handleUpdateMessage}
            onStatusChange={handleStatusChange}
            onAssignChange={handleAssignChange}
            onConversationUpdate={handleConversationUpdate}
            onBack={handleCloseConversation}
            resyncToken={resyncToken}
            onRefresh={handleManualRefresh}
            contactPanelOpen={contactPanelOpen}
            onToggleContactPanel={handleToggleContactPanel}
            insertedReply={insertedReply}
            onStartConversation={handleOpenStartConversation}
          />
        </div>

        {contactPanelOpen && (
          <aside className="border-border bg-card hidden h-full min-h-0 w-80 shrink-0 flex-col border-l lg:flex">
            <div className="border-border bg-muted/20 flex shrink-0 border-b p-1">
              <button
                type="button"
                onClick={() => setRightTab('crm')}
                className={cn(
                  'flex-1 cursor-pointer rounded-md py-1.5 text-center text-xs font-bold transition-all',
                  rightTab === 'crm'
                    ? 'bg-background border-border/50 border text-emerald-700 shadow-sm dark:text-emerald-400'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                👤 {contactLabelSingular} Details
              </button>
              <button
                type="button"
                onClick={() => setRightTab('copilot')}
                className={cn(
                  'flex-1 cursor-pointer rounded-md py-1.5 text-center text-xs font-bold transition-all',
                  rightTab === 'copilot'
                    ? 'bg-background text-foreground border-border/50 border shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                🤖 AI Copilot
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              {rightTab === 'copilot' &&
              currentIndustry === 'hospital_clinic' ? (
                <ReceptionistCopilotPanel
                  conversation={activeConversation}
                  contact={activeContact}
                  messages={messages}
                  onInsertReply={handleInsertCopilotReply}
                  isEmbedded={true}
                />
              ) : (
                <ContactSidebar
                  contact={activeContact}
                  conversation={activeConversation}
                  isEmbedded={true}
                />
              )}
            </div>
          </aside>
        )}
      </div>

      <SendOutboundModal
        open={startConversationOpen}
        onOpenChange={setStartConversationOpen}
        onSuccess={handleConversationCreated}
      />
    </div>
  );
}
