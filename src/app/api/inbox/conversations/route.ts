import { NextRequest, NextResponse } from 'next/server';
import { Query } from 'node-appwrite';
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

/**
 * GET /api/inbox/conversations
 *
 * Secure server-side endpoint to fetch conversations scoped strictly to
 * the authenticated user's accountId. Never trusts client-supplied accountId.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getCurrentAccount();
    const accountId = ctx.accountId;

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account not resolved' },
        { status: 403, headers: CACHE_HEADERS }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const limit = Math.min(
      Math.max(Number(searchParams.get('limit')) || 50, 1),
      100
    );

    // 1. Try Supabase first
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      try {
        const supabase = getSupabaseAdminClient();
        let query = supabase
          .from('conversations')
          .select('*, contact:contacts(*)')
          .eq('account_id', accountId)
          .order('updated_at', { ascending: false })
          .limit(limit);

        if (
          statusParam &&
          ['open', 'pending', 'closed'].includes(statusParam.toLowerCase())
        ) {
          query = query.eq('status', statusParam.toLowerCase());
        }

        const { data: convs, error } = await query;
        if (!error && Array.isArray(convs) && convs.length > 0) {
          const normalized = convs.map((c) =>
            normalizeConversation(
              c,
              c.contact ? normalizeContact(c.contact) : undefined
            )
          );
          return NextResponse.json(
            { conversations: normalized, total: normalized.length },
            { status: 200, headers: CACHE_HEADERS }
          );
        }
      } catch {
        // Fallback to Appwrite
      }
    }

    // 2. Fallback to Appwrite
    const admin = getAppwriteAdminClient();
    const queries = [
      Query.equal('accountId', accountId),
      Query.orderDesc('lastMessageAt'),
      Query.limit(limit),
    ];

    if (
      statusParam &&
      ['open', 'pending', 'closed'].includes(statusParam.toLowerCase())
    ) {
      queries.push(Query.equal('status', statusParam.toLowerCase()));
    }

    const convsRes = await admin.databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.conversations,
      queries
    );

    const rawConvs = convsRes.documents as unknown as Array<
      Record<string, unknown>
    >;
    if (rawConvs.length === 0) {
      return NextResponse.json(
        { conversations: [], total: 0 },
        { status: 200, headers: CACHE_HEADERS }
      );
    }

    // Collect contact IDs for this tenant
    const contactIds = Array.from(
      new Set(
        rawConvs
          .map((c) => (c.contactId || c.contact_id) as string | undefined)
          .filter((id): id is string => Boolean(id))
      )
    );

    const contactsMap = new Map<string, Contact>();

    if (contactIds.length > 0) {
      try {
        const contactsRes = await admin.databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.contacts,
          [
            Query.equal('accountId', accountId),
            Query.equal('$id', contactIds.slice(0, 100)),
            Query.limit(100),
          ]
        );

        for (const doc of contactsRes.documents as unknown as Array<
          Record<string, unknown>
        >) {
          contactsMap.set(doc.$id as string, normalizeContact(doc));
        }
      } catch (e) {
        console.warn('Failed to batch load contacts for conversations:', e);
      }
    }

    const conversations: Conversation[] = rawConvs.map((doc) => {
      const cId = (doc.contactId || doc.contact_id) as string | undefined;
      const contact = cId ? contactsMap.get(cId) : undefined;
      return normalizeConversation(doc, contact);
    });

    return NextResponse.json(
      { conversations, total: convsRes.total ?? conversations.length },
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

    console.error('Error fetching inbox conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}
