import { getAdminClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import type { WhatsAppStatusUpdate } from './types';

type MessageStatus = Database['public']['Tables']['messages']['Row']['status'];

const RECIPIENT_STATUS_LADDER = [
  'pending',
  'sent',
  'delivered',
  'read',
  'replied',
] as const;

function ladderLevel(s: string): number {
  const idx = (RECIPIENT_STATUS_LADDER as readonly string[]).indexOf(s);
  return idx < 0 ? -1 : idx;
}

export function isValidStatusTransition(
  current: string,
  incoming: string
): boolean {
  if (incoming === 'failed') {
    return current === 'pending' || current === 'sent';
  }
  if (current === 'failed') {
    return false; // failed is terminal
  }
  const ci = ladderLevel(current);
  const ii = ladderLevel(incoming);
  if (ii < 0) return false;
  if (ci < 0) return true;
  return ii > ci;
}

export async function handleStatusUpdate(
  status: WhatsAppStatusUpdate,
  accountId?: string | null
) {
  const db = getAdminClient();
  const patch = { status: status.status as MessageStatus };

  // 1) Mirror onto messages. Tenant scope is required when the webhook
  // resolved an account — unscoped updates can collide on Evolution IDs.
  const applyMessageStatus = async (
    idColumn: string,
    accountColumn?: string
  ) => {
    let query = db.from('messages').update(patch).eq(idColumn, status.id);
    if (accountId && accountColumn) {
      query = query.eq(accountColumn, accountId);
    }
    return query;
  };

  const { error: msgErr } = await applyMessageStatus(
    'provider_message_id',
    accountId ? 'account_id' : undefined
  );

  if (msgErr) {
    await applyMessageStatus('messageId', accountId ? 'accountId' : undefined);
  }

  // 2) Mirror onto broadcast_recipients via whatsapp_message_id
  const tsIso = new Date(parseInt(status.timestamp) * 1000).toISOString();

  const { data: recipient, error: recFetchErr } = await db
    .from('broadcast_recipients')
    .select('id, status, broadcast_id')
    .eq('whatsapp_message_id', status.id)
    .maybeSingle();

  if (recFetchErr) {
    console.error('Error fetching broadcast recipient:', recFetchErr);
    return;
  }
  if (!recipient) return;

  if (accountId && recipient.broadcast_id) {
    const { data: broadcast } = await db
      .from('broadcasts')
      .select('id')
      .eq('id', recipient.broadcast_id)
      .eq('account_id', accountId)
      .maybeSingle();
    if (!broadcast) return;
  }

  if (!isValidStatusTransition(recipient.status, status.status)) return;

  const update: Database['public']['Tables']['broadcast_recipients']['Update'] =
    { status: status.status };
  if (status.status === 'sent' && !('sent_at' in update))
    update.sent_at = tsIso;
  if (status.status === 'delivered') update.delivered_at = tsIso;
  if (status.status === 'read') update.read_at = tsIso;

  const { error: recUpdateErr } = await db
    .from('broadcast_recipients')
    .update(update)
    .eq('id', recipient.id);

  if (recUpdateErr) {
    console.error('Error updating broadcast recipient status:', recUpdateErr);
  }
}
