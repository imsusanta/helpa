import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentAccount,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/auth/account';
import { getAppwriteAdminClient } from '@/infrastructure/appwrite/server';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import type { Conversation, Contact, ConversationStatus } from '@/types';

const CACHE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
} as const;

function normalizeContact(doc: Record<string, unknown>): Contact {
  return {
    id: (doc.$id || doc.id) as string,
    account_id: (doc.accountId || doc.account_id) as string,
    user_id: ((doc.userId || doc.user_id) as string) || '',
    name: (doc.name as string) || 'Unknown Contact',
    phone: (doc.phone as string) || '',
    email: (doc.email as string) || undefined,
    metadata: (doc.metadata as Record<string, unknown>) || undefined,
    created_at:
      ((doc.createdAt || doc.$createdAt) as string) || new Date().toISOString(),
    updated_at:
      ((doc.updatedAt || doc.$updatedAt) as string) || new Date().toISOString(),
  };
}

function normalizeConversation(
  doc: Record<string, unknown>,
  contact?: Contact
): Conversation {
  return {
    id: (doc.$id || doc.id) as string,
    user_id: ((doc.userId || doc.user_id) as string) || '',
    contact_id: ((doc.contactId || doc.contact_id) as string) || '',
    status: (doc.status as ConversationStatus) || 'open',
    assigned_agent_id: (doc.assignedAgentId || doc.assigned_agent_id) as
      string | undefined,
    last_message_text:
      ((doc.lastMessageText || doc.last_message_text) as string) || '',
    last_message_at:
      ((doc.lastMessageAt ||
        doc.last_message_at ||
        doc.$updatedAt ||
        doc.updatedAt) as string) || undefined,
    unread_count: Number(doc.unreadCount || doc.unread_count || 0),
    ai_chat_enabled: Boolean(doc.aiChatEnabled ?? doc.ai_chat_enabled ?? false),
    ai_intent: ((doc.aiIntent || doc.ai_intent) as string | null) || null,
    ai_lead_score:
      ((doc.aiLeadScore || doc.ai_lead_score) as string | null) || null,
    ai_summary: ((doc.aiSummary || doc.ai_summary) as string | null) || null,
    ai_sentiment:
      ((doc.aiSentiment || doc.ai_sentiment) as string | null) || null,
    ai_handoff_required: Boolean(
      doc.aiHandoffRequired ?? doc.ai_handoff_required ?? false
    ),
    ai_resolved: Boolean(doc.aiResolved ?? doc.ai_resolved ?? false),
    ai_faq_category:
      ((doc.aiFaqCategory || doc.ai_faq_category) as string | null) || null,
    created_at:
      ((doc.createdAt || doc.$createdAt) as string) || new Date().toISOString(),
    updated_at:
      ((doc.updatedAt || doc.$updatedAt) as string) || new Date().toISOString(),
    contact,
  };
}

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/inbox/conversations/[id]
 *
 * Fetches a single conversation, verifying that it belongs to the authenticated tenant.
 */
export async function GET(_request: NextRequest, { params }: Params) {
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

    // 1. Try Supabase first
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      try {
        const supabase = getSupabaseAdminClient();
        const { data: conv } = await supabase
          .from('conversations')
          .select('*, contact:contacts(*)')
          .eq('id', conversationId)
          .eq('account_id', accountId)
          .maybeSingle();

        if (conv) {
          const normalized = normalizeConversation(
            conv,
            conv.contact ? normalizeContact(conv.contact) : undefined
          );
          return NextResponse.json(
            { conversation: normalized },
            { status: 200, headers: CACHE_HEADERS }
          );
        }
      } catch {
        // Fallback to Appwrite
      }
    }

    // 2. Fallback to Appwrite
    const admin = getAppwriteAdminClient();
    let doc: Record<string, unknown> | null = null;

    try {
      doc = (await admin.databases.getDocument(
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

    // Verify tenant ownership
    if (doc.accountId !== accountId) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404, headers: CACHE_HEADERS }
      );
    }

    let contact: Contact | undefined;
    const cId = (doc.contactId || doc.contact_id) as string | undefined;
    if (cId) {
      try {
        const contactDoc = (await admin.databases.getDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.contacts,
          cId
        )) as unknown as Record<string, unknown>;
        if (contactDoc.accountId === accountId) {
          contact = normalizeContact(contactDoc);
        }
      } catch {
        // Contact might have been deleted or missing
      }
    }

    const conversation = normalizeConversation(doc, contact);
    return NextResponse.json(
      { conversation },
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

    console.error('Error fetching conversation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}

/**
 * PATCH /api/inbox/conversations/[id]
 *
 * Updates conversation attributes (status, unreadCount, aiChatEnabled, etc.)
 * verifying tenant ownership before mutating.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
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

    const admin = getAppwriteAdminClient();
    let doc: Record<string, unknown> | null = null;

    try {
      doc = (await admin.databases.getDocument(
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

    // Strict tenant isolation
    if (doc.accountId !== accountId) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404, headers: CACHE_HEADERS }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (
      typeof body.status === 'string' &&
      ['open', 'pending', 'closed'].includes(body.status)
    ) {
      updatePayload.status = body.status;
    }
    if (body.unread_count !== undefined || body.unreadCount !== undefined) {
      const count = Number(body.unread_count ?? body.unreadCount);
      if (!isNaN(count) && count >= 0) {
        updatePayload.unreadCount = count;
      }
    }
    if (
      body.ai_chat_enabled !== undefined ||
      body.aiChatEnabled !== undefined
    ) {
      updatePayload.aiChatEnabled = Boolean(
        body.ai_chat_enabled ?? body.aiChatEnabled
      );
    }
    if (
      body.assigned_agent_id !== undefined ||
      body.assignedAgentId !== undefined
    ) {
      updatePayload.assignedAgentId = (body.assigned_agent_id ??
        body.assignedAgentId ??
        null) as string | null;
    }

    const updatedDoc = (await admin.databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.conversations,
      conversationId,
      updatePayload
    )) as unknown as Record<string, unknown>;

    return NextResponse.json(
      { conversation: normalizeConversation(updatedDoc) },
      { status: 200, headers: CACHE_HEADERS }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403, headers: CACHE_HEADERS }
      );
    }

    console.error('Error updating conversation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}
