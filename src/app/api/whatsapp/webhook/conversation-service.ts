import { getAdminClient } from '@/lib/supabase/server';

/**
 * Finds an existing conversation or creates one for the account and contact.
 */
export async function findOrCreateConversation(
  accountId: string,
  configOwnerUserId: string,
  contactId: string,
  channel: 'whatsapp' | 'sms' = 'whatsapp'
) {
  const db = getAdminClient();
  let matches: Record<string, unknown>[] | null = null;

  try {
    const scoped = await db
      .from('conversations')
      .select('*')
      .eq('account_id', accountId)
      .eq('contact_id', contactId)
      .eq('channel', channel)
      .limit(1);
    if (!scoped.error && scoped.data && scoped.data.length > 0) {
      matches = scoped.data;
    } else if (scoped.error) {
      // Databases predating the channel column still need to route inbound
      // messages. In that legacy shape there is one conversation per contact.
      const legacyShape = await db
        .from('conversations')
        .select('*')
        .eq('account_id', accountId)
        .eq('contact_id', contactId)
        .limit(1);
      if (legacyShape.data && legacyShape.data.length > 0) {
        matches = legacyShape.data;
      }
    }
  } catch {
    try {
      const scoped = await db
        .from('conversations')
        .select('*')
        .eq('accountId', accountId)
        .eq('contactId', contactId)
        .eq('channel', channel)
        .limit(1);
      if (!scoped.error && scoped.data && scoped.data.length > 0) {
        matches = scoped.data;
      } else if (scoped.error) {
        const legacyShape = await db
          .from('conversations')
          .select('*')
          .eq('accountId', accountId)
          .eq('contactId', contactId)
          .limit(1);
        if (legacyShape.data && legacyShape.data.length > 0) {
          matches = legacyShape.data;
        }
      }
    } catch {
      // Ignore
    }
  }

  if (matches && matches.length > 0 && matches[0]) {
    return matches[0];
  }

  const now = new Date().toISOString();
  let newConv: Record<string, unknown> | null = null;
  let createError: unknown = null;

  // Attempt 1: Full schema (with channel column)
  try {
    const { data, error } = await db
      .from('conversations')
      .insert({
        account_id: accountId,
        user_id: configOwnerUserId || null,
        contact_id: contactId,
        channel,
        status: 'open',
        ai_chat_enabled: true,
        unread_count: 0,
        last_message_text: '',
        last_message_at: now,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();
    if (data) newConv = data;
    createError = error;
  } catch (err) {
    createError = err;
  }

  // Attempt 2: Minimal schema (live DB without channel column)
  if (!newConv) {
    try {
      const { data, error } = await db
        .from('conversations')
        .insert({
          account_id: accountId,
          user_id: configOwnerUserId || null,
          contact_id: contactId,
          status: 'open',
          ai_chat_enabled: true,
          unread_count: 0,
          last_message_text: '',
          last_message_at: now,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();
      if (data) {
        newConv = data;
        createError = null;
      } else {
        createError = error;
      }
    } catch (err) {
      createError = err;
    }
  }

  if (createError && !newConv) {
    console.error('Error creating conversation:', createError);
    return null;
  }

  return newConv;
}

/**
 * Resolve a Meta-side message_id into matching internal UUID.
 */
export async function lookupInternalIdByMetaId(
  metaId: string,
  conversationId: string
): Promise<string | null> {
  const { data, error } = await getAdminClient()
    .from('messages')
    .select('id')
    .eq('message_id', metaId)
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (error) {
    console.error('[webhook] lookupInternalIdByMetaId failed:', error.message);
    return null;
  }
  return data?.id ?? null;
}

/**
 * If an inbound message's sender is on a still-unreplied broadcast_recipients row,
 * flip it to replied so the count advances.
 */
export async function flagBroadcastReplyIfAny(
  accountId: string,
  contactId: string
) {
  try {
    const { data: recs, error } = await getAdminClient()
      .from('broadcast_recipients')
      .select('id, status, broadcast_id, broadcasts!inner(account_id)')
      .eq('contact_id', contactId)
      .eq('broadcasts.account_id', accountId)
      .in('status', ['sent', 'delivered', 'read'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !recs || recs.length === 0) return;

    const row = recs[0];
    const { error: updErr } = await getAdminClient()
      .from('broadcast_recipients')
      .update({ status: 'replied', replied_at: new Date().toISOString() })
      .eq('id', row.id);

    if (updErr) {
      console.error('Error marking broadcast recipient replied:', updErr);
    }
  } catch (err) {
    console.error('flagBroadcastReplyIfAny failed:', err);
  }
}
