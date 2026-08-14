import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import type { Conversation, Contact } from '@/types';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

/**
 * GET /api/conversations
 *
 * Tenant-scoped conversation list with contact hydration.
 * Resolves accountId strictly from verified server session.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const accountCtx = await getCurrentAccount().catch(() => null);
    if (!accountCtx?.accountId) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401, headers: PRIVATE_HEADERS }
      );
    }

    const accountId = accountCtx.accountId;
    const dbAdmin = appwriteAdmin();

    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = limitParam
      ? Math.min(parseInt(limitParam, 10) || 50, 100)
      : 50;

    const { data: convDocs, error: convError } = await dbAdmin
      .from(APPWRITE_CONFIG.collections.conversations)
      .select('*')
      .eq('accountId', accountId)
      .order('lastMessageAt', { ascending: false })
      .limit(limit);

    if (convError) {
      console.error('[GET /api/conversations] DB Query Error:', convError);
      return NextResponse.json(
        { error: 'DATABASE_ERROR', message: 'Failed to load conversations' },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }

    const rawConvs = (convDocs || []) as Record<string, unknown>[];

    // Collect contact IDs to hydrate in a single batch
    const contactIds = Array.from(
      new Set(
        rawConvs
          .map((c) => String(c.contactId || c.contact_id || ''))
          .filter(Boolean)
      )
    );

    const contactsMap = new Map<string, Contact>();
    if (contactIds.length > 0) {
      try {
        const { data: contactDocs } = await dbAdmin
          .from(APPWRITE_CONFIG.collections.contacts)
          .select('*')
          .eq('accountId', accountId)
          .in('id', contactIds);

        if (contactDocs && Array.isArray(contactDocs)) {
          for (const doc of contactDocs as Record<string, unknown>[]) {
            const cid = String(doc.$id || doc.id || '');
            contactsMap.set(cid, {
              id: cid,
              user_id: String(doc.userId || doc.user_id || ''),
              account_id: String(doc.accountId || doc.account_id || ''),
              phone: String(doc.phone || ''),
              name: String(doc.name || doc.full_name || ''),
              email: doc.email ? String(doc.email) : undefined,
              created_at: String(doc.createdAt || doc.$createdAt || ''),
              updated_at: String(doc.updatedAt || doc.$updatedAt || ''),
            });
          }
        }
      } catch (err) {
        console.warn('[GET /api/conversations] Contact hydration error:', err);
      }
    }

    const conversations: Conversation[] = rawConvs.map((doc) => {
      const id = String(doc.$id || doc.id || '');
      const contactId = String(doc.contactId || doc.contact_id || '');
      const contact = contactsMap.get(contactId);

      return {
        id,
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
    });

    return NextResponse.json(
      { success: true, data: conversations },
      { headers: PRIVATE_HEADERS }
    );
  } catch (err) {
    console.error('[GET /api/conversations] Internal Error:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Internal server error' },
      { status: 500, headers: PRIVATE_HEADERS }
    );
  }
}
