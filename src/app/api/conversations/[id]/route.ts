import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import type { Conversation, Contact } from '@/types';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

/**
 * GET /api/conversations/[id]
 *
 * Fetches a single conversation strictly scoped to caller's accountId.
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

    const { data: convDoc, error: convError } = await dbAdmin
      .from(APPWRITE_CONFIG.collections.conversations)
      .select('*')
      .eq('id', convId)
      .eq('accountId', accountId)
      .maybeSingle();

    if (convError || !convDoc) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Conversation not found' },
        { status: 404, headers: PRIVATE_HEADERS }
      );
    }

    const doc = convDoc as Record<string, unknown>;
    const contactId = String(doc.contactId || doc.contact_id || '');

    let contact: Contact | undefined;
    if (contactId) {
      const { data: cDoc } = await dbAdmin
        .from(APPWRITE_CONFIG.collections.contacts)
        .select('*')
        .eq('id', contactId)
        .eq('accountId', accountId)
        .maybeSingle();

      if (cDoc) {
        const contactRecord = cDoc as Record<string, unknown>;
        contact = {
          id: String(contactRecord.$id || contactRecord.id || ''),
          user_id: String(contactRecord.userId || contactRecord.user_id || ''),
          account_id: String(
            contactRecord.accountId || contactRecord.account_id || ''
          ),
          phone: String(contactRecord.phone || ''),
          name: String(contactRecord.name || contactRecord.full_name || ''),
          email: contactRecord.email ? String(contactRecord.email) : undefined,
          created_at: String(
            contactRecord.createdAt || contactRecord.$createdAt || ''
          ),
          updated_at: String(
            contactRecord.updatedAt || contactRecord.$updatedAt || ''
          ),
        };
      }
    }

    const conversation: Conversation = {
      id: String(doc.$id || doc.id || ''),
      user_id: String(doc.userId || doc.user_id || ''),
      contact_id: contactId,
      status: (doc.status as Conversation['status']) || 'open',
      last_message_text: doc.lastMessageText
        ? String(doc.lastMessageText)
        : doc.last_message_text
          ? String(doc.last_message_text)
          : undefined,
      last_message_at: doc.lastMessageAt
        ? String(doc.lastMessageAt)
        : doc.last_message_at
          ? String(doc.last_message_at)
          : undefined,
      unread_count: Number(doc.unreadCount || doc.unread_count || 0),
      created_at: String(doc.createdAt || doc.$createdAt || ''),
      updated_at: String(doc.updatedAt || doc.$updatedAt || ''),
      contact,
    };

    return NextResponse.json(
      { success: true, data: conversation },
      { headers: PRIVATE_HEADERS }
    );
  } catch (err) {
    console.error('[GET /api/conversations/[id]] Internal Error:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Internal server error' },
      { status: 500, headers: PRIVATE_HEADERS }
    );
  }
}

/**
 * PATCH /api/conversations/[id]
 *
 * Updates a conversation strictly scoped to caller's accountId.
 */
export async function PATCH(
  request: NextRequest,
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
    const body = await request.json().catch(() => ({}));
    const dbAdmin = appwriteAdmin();

    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.status !== undefined) {
      updatePayload.status = body.status;
    }
    if (body.unread_count !== undefined || body.unreadCount !== undefined) {
      updatePayload.unreadCount = Number(body.unread_count ?? body.unreadCount);
    }

    const { error: updateError } = await dbAdmin
      .from(APPWRITE_CONFIG.collections.conversations)
      .update(updatePayload)
      .eq('id', convId)
      .eq('accountId', accountId);

    if (updateError) {
      return NextResponse.json(
        { error: 'DATABASE_ERROR', message: updateError.message },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }

    return NextResponse.json({ success: true }, { headers: PRIVATE_HEADERS });
  } catch (err) {
    console.error('[PATCH /api/conversations/[id]] Internal Error:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Internal server error' },
      { status: 500, headers: PRIVATE_HEADERS }
    );
  }
}
