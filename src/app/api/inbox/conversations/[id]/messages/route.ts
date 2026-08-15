import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentAccount,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import { getAppwriteAdminClient } from '@/infrastructure/appwrite/server';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import { Query } from 'node-appwrite';
import { getRuntimeConfig } from '@/lib/runtime-config';
import type { Message, ContentType, MessageStatus } from '@/types';

const CACHE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
} as const;

function normalizeMessage(doc: Record<string, unknown>): Message {
  const isOutbound =
    doc.direction === 'outbound' ||
    doc.sender_type === 'agent' ||
    doc.sender_type === 'bot' ||
    doc.senderType === 'agent' ||
    doc.senderType === 'bot';

  return {
    id: (doc.$id || doc.id) as string,
    conversation_id: (doc.conversationId || doc.conversation_id) as string,
    sender_type: isOutbound ? 'agent' : 'customer',
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
    message_id: (doc.provider_message_id || doc.messageId || doc.message_id) as
      string | undefined,
    status: (doc.status ||
      doc.deliveryStatus ||
      doc.delivery_status ||
      'sent') as MessageStatus,
    created_at:
      ((doc.createdAt || doc.$createdAt || doc.created_at) as string) ||
      new Date().toISOString(),
    reply_to_message_id: (doc.replyToMessageId || doc.reply_to_message_id) as
      string | undefined,
    interactive_reply_id: (doc.interactiveReplyId ||
      doc.interactive_reply_id) as string | undefined,
  };
}

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/inbox/conversations/[id]/messages
 *
 * Secure server-side endpoint to fetch messages for a conversation that
 * belongs strictly to the authenticated user's accountId.
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: conversationId } = await params;
    const ctx = await getCurrentAccount();
    const accountId = ctx.accountId;

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account not resolved' },
        { status: 403, headers: CACHE_HEADERS }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(Number(searchParams.get('limit')) || 100, 1),
      100
    );

    const runtime = getRuntimeConfig();

    if (runtime.databaseProvider === 'appwrite') {
      const admin = getAppwriteAdminClient();
      let convDoc: Record<string, unknown> | null = null;
      try {
        convDoc = (await admin.databases.getDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.conversations,
          conversationId
        )) as unknown as Record<string, unknown>;
      } catch {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404, headers: CACHE_HEADERS }
        );
      }

      const docAccountId = (convDoc.accountId || convDoc.account_id) as string;
      if (docAccountId !== accountId) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404, headers: CACHE_HEADERS }
        );
      }

      let messagesRes;
      try {
        messagesRes = await admin.databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.messages,
          [
            Query.equal('conversationId', conversationId),
            Query.orderAsc('createdAt'),
            Query.limit(limit),
          ]
        );
      } catch {
        messagesRes = await admin.databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.messages,
          [Query.equal('conversation_id', conversationId), Query.limit(limit)]
        );
      }

      const rawMsgs = messagesRes.documents as unknown as Array<
        Record<string, unknown>
      >;
      const messages: Message[] = rawMsgs.map((doc) => normalizeMessage(doc));

      return NextResponse.json(
        { messages, total: messagesRes.total ?? messages.length },
        { status: 200, headers: CACHE_HEADERS }
      );
    }

    const supabase = getSupabaseAdminClient();
    const { data: conv, error: cErr } = await supabase
      .from('conversations')
      .select('id, account_id')
      .eq('id', conversationId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (cErr || !conv) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404, headers: CACHE_HEADERS }
      );
    }

    const { data: msgs, error: mErr } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (mErr) {
      console.error('[inbox/conversations/[id]/messages] Query error:', mErr);
      return NextResponse.json(
        { messages: [], total: 0 },
        { status: 200, headers: CACHE_HEADERS }
      );
    }

    const rawMsgs = Array.isArray(msgs) ? msgs : [];
    const normalized = rawMsgs.map((m) => normalizeMessage(m));

    return NextResponse.json(
      { messages: normalized, total: normalized.length },
      { status: 200, headers: CACHE_HEADERS }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { error: 'FORBIDDEN' },
        { status: 403, headers: CACHE_HEADERS }
      );
    }

    console.error('Error fetching conversation messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}
