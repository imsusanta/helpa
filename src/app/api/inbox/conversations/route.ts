import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentAccount,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import type { Conversation, Contact, ConversationStatus } from '@/types';
import {
  isHiddenWhatsAppInboxChat,
  isWhatsAppCollectiveAddress,
  whatsappContactDisplayName,
} from '@/core/whatsapp/group-identity';
import {
  overlayInboxWhatsAppIdentity,
  syncEvolutionGroupNamesForInbox,
} from '@/core/whatsapp/evolution-group-names';

const CACHE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
} as const;

function normalizeContact(doc: Record<string, unknown>): Contact {
  return {
    id: (doc.$id || doc.id) as string,
    account_id: (doc.accountId || doc.account_id) as string,
    user_id: ((doc.userId || doc.user_id) as string) || '',
    name:
      whatsappContactDisplayName(doc.name as string, doc.phone as string, '') ||
      (isWhatsAppCollectiveAddress(doc.phone as string)
        ? ''
        : (doc.name as string) || 'Unknown Contact'),
    phone: (doc.phone as string) || '',
    email: (doc.email as string) || undefined,
    avatar_url:
      typeof doc.avatar_url === 'string' && doc.avatar_url
        ? doc.avatar_url
        : typeof doc.avatarUrl === 'string' && doc.avatarUrl
          ? doc.avatarUrl
          : undefined,
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
    const fetchLimit = Math.min(Math.max(limit * 2, limit + 10), 100);

    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from('conversations')
      .select('*, contact:contacts(*)')
      .eq('account_id', accountId)
      .order('updated_at', { ascending: false })
      .limit(fetchLimit);

    if (
      statusParam &&
      ['open', 'pending', 'closed'].includes(statusParam.toLowerCase())
    ) {
      query = query.eq('status', statusParam.toLowerCase());
    }

    const { data: convs, error: convErr } = await query;

    if (convErr) {
      console.error('[inbox/conversations] Query error:', convErr);
      return NextResponse.json(
        { conversations: [], total: 0 },
        { status: 200, headers: CACHE_HEADERS }
      );
    }

    if (!convs || convs.length === 0) {
      return NextResponse.json(
        { conversations: [], total: 0 },
        { status: 200, headers: CACHE_HEADERS }
      );
    }

    const missingContactIds = Array.from(
      new Set(
        convs
          .filter((c) => !c.contact)
          .map((c) => (c.contact_id || c.contactId) as string)
          .filter(Boolean)
      )
    );

    const contactsMap = new Map<string, Contact>();
    if (missingContactIds.length > 0) {
      const { data: contactsData } = await supabase
        .from('contacts')
        .select('*')
        .eq('account_id', accountId)
        .in('id', missingContactIds);

      if (contactsData) {
        for (const contact of contactsData) {
          contactsMap.set(contact.id, normalizeContact(contact));
        }
      }
    }

    const hasGroupContacts = convs.some((c) => {
      const contactObj = (c.contact ||
        (c.contact_id
          ? contactsMap.get(c.contact_id as string)
          : null)) as Record<string, unknown> | null;
      const phone = (contactObj?.phone || c.phone) as string | undefined;
      return phone && isWhatsAppCollectiveAddress(phone);
    });

    let identity = {
      names: new Map<string, string>(),
      avatars: new Map<string, string>(),
    };
    if (hasGroupContacts) {
      const groupContacts = convs
        .map(
          (c) =>
            (c.contact ||
              (c.contact_id
                ? contactsMap.get(c.contact_id as string)
                : null)) as Record<string, unknown> | null
        )
        .filter(Boolean);
      identity = await syncEvolutionGroupNamesForInbox(
        accountId,
        groupContacts as Parameters<typeof syncEvolutionGroupNamesForInbox>[1]
      );
    }

    const normalized = convs
      .map((c) => {
        const cId = (c.contact_id || c.contactId) as string;
        const rawContact = (c.contact ||
          (cId ? contactsMap.get(cId) : null)) as Record<
          string,
          unknown
        > | null;
        let contact: Contact | undefined;
        if (rawContact) {
          if (hasGroupContacts)
            overlayInboxWhatsAppIdentity(rawContact, identity);
          contact = normalizeContact(rawContact);
        } else {
          contact = {
            id: cId || '',
            account_id: accountId,
            user_id: '',
            name: whatsappContactDisplayName(
              (c.contact_name as string) || (c.patient_name as string),
              c.phone as string,
              'Contact'
            ),
            phone: (c.phone as string) || '',
            created_at: (c.created_at as string) || new Date().toISOString(),
            updated_at: (c.updated_at as string) || new Date().toISOString(),
          };
        }
        return normalizeConversation(c, contact);
      })
      .filter(
        (conversation) =>
          !isHiddenWhatsAppInboxChat(
            conversation.contact?.phone,
            conversation.contact?.metadata
          )
      )
      .slice(0, limit);

    return NextResponse.json(
      { conversations: normalized, total: normalized.length },
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
