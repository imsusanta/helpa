import { getAdminClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import type { WhatsAppStatusUpdate } from './types';
import { safeRecordOutcomeEvent } from '@/lib/metrics/safe-record';

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
  // Service-role updates must never run without a resolved tenant. An
  // unscoped provider-id write can flip another workspace's message.
  if (!accountId) {
    return;
  }

  const db = getAdminClient();
  const patch = { status: status.status as MessageStatus };

  const applyMessageStatus = async (
    idColumn: string,
    accountColumn: string
  ) => {
    return db
      .from('messages')
      .update(patch)
      .eq(idColumn, status.id)
      .eq(accountColumn, accountId);
  };

  const { error: msgErr } = await applyMessageStatus(
    'provider_message_id',
    'account_id'
  );

  if (msgErr) {
    await applyMessageStatus('messageId', 'accountId');
  }

  if (status.status === 'failed') {
    safeRecordOutcomeEvent({
      accountId,
      eventName: 'message_delivery_failed',
      sourceId: `delivery-fail:${accountId}:${status.id}`,
      attributes: { channel: 'whatsapp' },
    });
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
