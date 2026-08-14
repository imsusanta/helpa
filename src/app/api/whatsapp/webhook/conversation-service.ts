import { getAdminClient } from '@/lib/appwrite-server-compat';

/**
 * Finds an existing conversation or creates one for the account and contact.
 */
export async function findOrCreateConversation(
  accountId: string,
  configOwnerUserId: string,
  contactId: string
) {
  const db = getAdminClient();
  const { data: matches } = await db
    .from('conversations')
    .select('*')
    .eq('accountId', accountId)
    .eq('contactId', contactId)
    .limit(1)
    .catch(() => ({ data: null }));

  if (matches && matches.length > 0 && matches[0]) {
    return matches[0];
  }

  const now = new Date().toISOString();
  const { data: newConv, error: createError } = await db
    .from('conversations')
    .insert({
      accountId,
      contactId,
      status: 'open',
      lastMessageText: '',
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (createError) {
    const { data: retryMatches } = await db
      .from('conversations')
      .select('*')
      .eq('accountId', accountId)
      .eq('contactId', contactId)
      .limit(1)
      .catch(() => ({ data: null }));

    if (retryMatches && retryMatches.length > 0 && retryMatches[0]) {
      return retryMatches[0];
    }

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
