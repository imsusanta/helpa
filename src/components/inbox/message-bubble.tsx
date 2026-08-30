'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { Message, MessageReaction } from '@/types';
import {
  Clock,
  Check,
  CheckCheck,
  XCircle,
  FileText,
  MapPin,
  LayoutTemplate,
  ImageOff,
  CornerDownLeft,
} from 'lucide-react';
import { format } from 'date-fns';
import { ReplyQuote } from './reply-quote';
import { MessageReactions } from './message-reactions';
import {
  parseWhatsAppSenderPreview,
  type WhatsAppChatKind,
} from '@/core/whatsapp/group-identity';

interface MessageBubbleProps {
  message: Message;
  chatKind?: WhatsAppChatKind;
  /** Pre-computed quote info for messages that reply to another. */
  reply?: { authorLabel: string; preview: string } | null;
  reactions?: MessageReaction[];
  currentUserId?: string;
  onToggleReaction?: (emoji: string) => void;
}

const SENDER_COLORS = [
  'text-sky-600 dark:text-sky-400',
  'text-emerald-600 dark:text-emerald-400',
  'text-violet-600 dark:text-violet-400',
  'text-amber-600 dark:text-amber-400',
  'text-rose-600 dark:text-rose-400',
  'text-teal-600 dark:text-teal-400',
  'text-orange-600 dark:text-orange-400',
] as const;

function senderColorClass(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
}

function StatusIcon({ status }: { status: Message['status'] }) {
  switch (status) {
    case 'sending':
      return <Clock className="text-muted-foreground h-3 w-3" />;
    case 'sent':
      return <Check className="text-muted-foreground h-3 w-3" />;
    case 'delivered':
      return <CheckCheck className="text-muted-foreground h-3 w-3" />;
    case 'read':
      return <CheckCheck className="h-3 w-3 text-blue-400" />;
    case 'failed':
      return <XCircle className="h-3 w-3 text-red-400" />;
    default:
      return null;
  }
}

function MediaUnavailable({ label }: { label: string }) {
  return (
    <div className="bg-muted/40 text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-xs">
      <ImageOff className="text-muted-foreground h-4 w-4 shrink-0" />
      <span>{label} unavailable</span>
    </div>
  );
}

function MediaImage({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  // Track the created blob URL in a ref so cleanup revokes the actual
  // URL. The previous cleanup closed over `src` from effect setup time
  // (always null), so blob URLs were never revoked — a memory leak while
  // scrolling image-heavy threads.
  const blobUrlRef = useRef<string | null>(null);

  const loadImage = useCallback(async () => {
    if (!url) return;

    // Proxy URLs need auth fetch to create blob URL
    if (url.startsWith('/api/whatsapp/media/')) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load media');
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        setSrc(blobUrl);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    } else {
      setSrc(url);
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    loadImage();
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [loadImage]);

  if (error) {
    return (
      <div className="bg-muted flex h-40 w-60 items-center justify-center rounded-lg">
        <ImageOff className="text-muted-foreground h-8 w-8" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-muted flex h-40 w-60 items-center justify-center rounded-lg">
        <div className="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src ?? ''}
      alt={alt}
      className="max-h-64 max-w-60 rounded-lg object-cover"
      onError={() => setError(true)}
    />
  );
}

function MessageContent({
  message,
  displayText,
}: {
  message: Message;
  displayText?: string;
}) {
  const text = displayText ?? message.content_text;
  switch (message.content_type) {
    case 'text':
      return <p className="text-sm break-words whitespace-pre-wrap">{text}</p>;

    case 'image':
      return (
        <div>
          {message.media_url ? (
            <MediaImage url={message.media_url} alt="Shared image" />
          ) : (
            <MediaUnavailable label="Image" />
          )}
          {text && (
            <p className="mt-1 text-sm break-words whitespace-pre-wrap">
              {text}
            </p>
          )}
        </div>
      );

    case 'video':
      return (
        <div>
          {message.media_url ? (
            <video
              src={message.media_url}
              controls
              className="max-h-64 max-w-60 rounded-lg"
            />
          ) : (
            <MediaUnavailable label="Video" />
          )}
          {text && (
            <p className="mt-1 text-sm break-words whitespace-pre-wrap">
              {text}
            </p>
          )}
        </div>
      );

    case 'audio':
      return (
        <div>
          {message.media_url ? (
            <audio src={message.media_url} controls className="max-w-60" />
          ) : (
            <MediaUnavailable label="Audio" />
          )}
        </div>
      );

    case 'document':
      if (!message.media_url) {
        return <MediaUnavailable label={text || 'Document'} />;
      }
      return (
        <a
          href={message.media_url}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-muted/50 hover:bg-muted flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <FileText className="text-muted-foreground h-5 w-5 shrink-0" />
          <span className="truncate">{text || 'Document'}</span>
        </a>
      );

    case 'template':
      return (
        <div>
          <span className="bg-primary/20 text-primary mb-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium">
            <LayoutTemplate className="h-3 w-3" />
            Template
          </span>
          {text && (
            <p className="mt-1 text-sm break-words whitespace-pre-wrap">
              {text}
            </p>
          )}
        </div>
      );

    case 'location':
      return (
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="text-muted-foreground h-4 w-4 shrink-0" />
          <span>{text || 'Location shared'}</span>
        </div>
      );

    case 'interactive': {
      // Customer tapped a reply button or list row on a message the bot
      // sent. We show the tapped option's title (already in content_text,
      // set by parseMessageContent in the webhook) with a small affordance
      // so agents reading the inbox can tell at a glance that this is a
      // tap rather than the customer typing the same words.
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground inline-flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase">
            <CornerDownLeft className="h-3 w-3" />
            Button reply
          </span>
          <p className="text-sm break-words whitespace-pre-wrap">
            {text || '[Interactive reply]'}
          </p>
        </div>
      );
    }

    default:
      return (
        <p className="text-sm break-words whitespace-pre-wrap">
          {text || '[Unsupported message type]'}
        </p>
      );
  }
}

export function MessageBubble({
  message,
  chatKind = 'direct',
  reply,
  reactions,
  currentUserId,
  onToggleReaction,
}: MessageBubbleProps) {
  const isAgent =
    message.sender_type === 'agent' || message.sender_type === 'bot';
  const collective = chatKind === 'group' || chatKind === 'channel';
  const senderPreview =
    !isAgent && collective
      ? parseWhatsAppSenderPreview(message.content_text)
      : { sender: '', body: message.content_text || '' };
  const displayText = senderPreview.sender
    ? senderPreview.body
    : message.content_text;
  let time = '';
  try {
    const d = new Date(message.created_at);
    time = isNaN(d.getTime()) ? '' : format(d, 'HH:mm');
  } catch {
    time = '';
  }

  // Row alignment + width cap are owned by <MessageActions> so its hover
  // group matches the bubble's content area, not the full row.
  return (
    <div className={cn('flex flex-col', isAgent ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'relative rounded-2xl px-3 py-2',
          isAgent
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted text-foreground rounded-bl-md'
        )}
      >
        {senderPreview.sender ? (
          <p
            className={cn(
              'mb-0.5 text-xs font-semibold',
              senderColorClass(senderPreview.sender)
            )}
          >
            {senderPreview.sender}
          </p>
        ) : null}
        {reply && (
          <ReplyQuote
            authorLabel={reply.authorLabel}
            preview={reply.preview}
            onPrimary={isAgent}
          />
        )}
        <MessageContent message={message} displayText={displayText} />
        <div
          className={cn(
            'mt-1 flex items-center gap-1',
            isAgent ? 'justify-end' : 'justify-start'
          )}
        >
          <span
            className={cn(
              'text-[10px]',
              // Outbound bubbles sit on the primary fill, so the
              // timestamp must read against that (not the neutral
              // foreground) — otherwise it goes low-contrast in light
              // mode. Inbound bubbles use the muted surface.
              isAgent ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}
          >
            {time}
          </span>
          {isAgent && <StatusIcon status={message.status} />}
        </div>
      </div>
      {reactions && reactions.length > 0 && onToggleReaction && (
        <MessageReactions
          reactions={reactions}
          currentUserId={currentUserId}
          onToggle={onToggleReaction}
        />
      )}
    </div>
  );
}
