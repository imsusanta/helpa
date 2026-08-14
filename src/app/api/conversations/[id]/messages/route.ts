import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import type { Message, ContentType, SenderType } from '@/types';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

/**
 * GET /api/conversations/[id]/messages
 *
 * Fetches messages for a conversation strictly scoped to caller's accountId.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const accountCtx = await getCurrentAccount().catch(() => null);
    if (!accountCtx?.accountId) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401, headers: PRIVATE_HEADERS }
      );
    }

    const { id: convId } = await context.params;
    const accountId = accountCtx.accountId;
    const dbAdmin = appwriteAdmin();

    // Verify conversation belongs to caller's account
    const { data: convDoc, error: convError } = await dbAdmin
      .from(APPWRITE_CONFIG.collections.conversations)
      .select('id')
      .eq('id', convId)
      .eq('accountId', accountId)
      .maybeSingle();

    if (convError || !convDoc) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Conversation not found' },
        { status: 404, headers: PRIVATE_HEADERS }
      );
    }

    const { data: msgDocs, error: msgError } = await dbAdmin
      .from(APPWRITE_CONFIG.collections.messages)
      .select('*')
      .eq('conversationId', convId)
      .order('createdAt', { ascending: true })
      .limit(200);

    if (msgError) {
      console.error(
        '[GET /api/conversations/[id]/messages] DB Query Error:',
        msgError
      );
      return NextResponse.json(
        { error: 'DATABASE_ERROR', message: 'Failed to load messages' },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }

    const rawMsgs = (msgDocs || []) as Record<string, unknown>[];
    const messages: Message[] = rawMsgs.map((doc) => {
      const id = String(doc.$id || doc.id || '');
      const conversationId = String(
        doc.conversationId || doc.conversation_id || convId
      );
      const senderType = (doc.senderType ||
        doc.sender_type ||
        'customer') as SenderType;
      const contentType = (doc.contentType ||
        doc.content_type ||
        'text') as ContentType;
      const contentText = doc.contentText
        ? String(doc.contentText)
        : doc.content_text
          ? String(doc.content_text)
          : undefined;
      const mediaUrl = doc.mediaUrl
        ? String(doc.mediaUrl)
        : doc.media_url
          ? String(doc.media_url)
          : undefined;

      return {
        id,
        conversation_id: conversationId,
        sender_type: senderType,
        content_type: contentType,
        content_text: contentText,
        media_url: mediaUrl,
        message_id: doc.messageId ? String(doc.messageId) : undefined,
        status: (doc.status as Message['status']) || 'sent',
        reply_to_message_id: doc.replyToMessageId
          ? String(doc.replyToMessageId)
          : undefined,
        created_at: String(doc.createdAt || doc.$createdAt || ''),
      };
    });

    return NextResponse.json(
      { success: true, data: messages },
      { headers: PRIVATE_HEADERS }
    );
  } catch (err) {
    console.error(
      '[GET /api/conversations/[id]/messages] Internal Error:',
      err
    );
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Internal server error' },
      { status: 500, headers: PRIVATE_HEADERS }
    );
  }
}
