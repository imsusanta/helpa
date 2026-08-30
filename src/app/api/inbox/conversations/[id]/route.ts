import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentAccount,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import type { Conversation, Contact, ConversationStatus } from '@/types';
import { whatsappContactDisplayName } from '@/core/whatsapp/group-identity';

const CACHE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
} as const;

function normalizeContact(doc: Record<string, unknown>): Contact {
  return {
    id: (doc.$id || doc.id) as string,
    account_id: (doc.accountId || doc.account_id) as string,
    user_id: ((doc.userId || doc.user_id) as string) || '',
    name: whatsappContactDisplayName(
      doc.name as string,
      doc.phone as string,
      'Unknown Contact'
    ),
    phone: (doc.phone as string) || '',
    email: (doc.email as string) || undefined,
    metadata: (doc.metadata as Record<string, unknown>) || undefined,
    created_at:
      ((doc.createdAt || doc.$createdAt || doc.created_at) as string) ||
      new Date().toISOString(),
    updated_at:
      ((doc.updatedAt || doc.$updatedAt || doc.updated_at) as string) ||
      new Date().toISOString(),
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
        doc.updated_at ||
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
      ((doc.createdAt || doc.$createdAt || doc.created_at) as string) ||
      new Date().toISOString(),
    updated_at:
      ((doc.updatedAt || doc.$updatedAt || doc.updated_at) as string) ||
      new Date().toISOString(),
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

    const supabase = getSupabaseAdminClient();
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (convErr || !conv) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404, headers: CACHE_HEADERS }
      );
    }

    let contact: Contact | undefined;
    const cId = (conv.contact_id || conv.contactId) as string;
    if (cId) {
      const { data: cDoc } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', cId)
        .maybeSingle();
      if (cDoc) {
        contact = normalizeContact(cDoc);
      } else {
        contact = {
          id: cId,
          account_id: accountId,
          user_id: '',
          name: whatsappContactDisplayName(
            (conv.contact_name as string) || (conv.patient_name as string),
            conv.phone as string,
            'Contact'
          ),
          phone: (conv.phone as string) || '',
          created_at: (conv.created_at as string) || new Date().toISOString(),
          updated_at: (conv.updated_at as string) || new Date().toISOString(),
        };
      }
    }

    const normalized = normalizeConversation(conv, contact);
    return NextResponse.json(
      { conversation: normalized },
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

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const supabase = getSupabaseAdminClient();
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
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
        updatePayload.unread_count = count;
      }
    }
    if (
      body.ai_chat_enabled !== undefined ||
      body.aiChatEnabled !== undefined
    ) {
      updatePayload.ai_chat_enabled = Boolean(
        body.ai_chat_enabled ?? body.aiChatEnabled
      );
    }
    if (
      body.assigned_agent_id !== undefined ||
      body.assignedAgentId !== undefined
    ) {
      updatePayload.assigned_agent_id = (body.assigned_agent_id ??
        body.assignedAgentId ??
        null) as string | null;
    }

    const { data: updated, error } = await supabase
      .from('conversations')
      .update(updatePayload)
      .eq('id', conversationId)
      .eq('account_id', accountId)
      .select('*')
      .maybeSingle();

    if (error || !updated) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404, headers: CACHE_HEADERS }
      );
    }

    let contact: Contact | undefined;
    const cId = (updated.contact_id || updated.contactId) as string;
    if (cId) {
      const { data: cDoc } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', cId)
        .eq('account_id', accountId)
        .maybeSingle();
      if (cDoc) {
        contact = normalizeContact(cDoc);
      }
    }

    const normalized = normalizeConversation(updated, contact);
    return NextResponse.json(
      { conversation: normalized },
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
