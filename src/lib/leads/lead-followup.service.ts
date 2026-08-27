/**
 * Schedule, cancel, and send the single allowed smart reminder.
 * Uses the existing WhatsApp sender (`engineSendText`).
 */
import type { AdminClient } from '@/lib/db/server';
import { engineSendText } from '@/lib/automations/meta-send';
import { evaluateDelayedOutboundGuard } from '@/lib/leads/followup-guard.service';
import {
  canScheduleReminder,
  parseFollowupPolicy,
  reminderDueAt,
} from '@/lib/leads/followup-policy.service';
import { logLeadEvent } from '@/lib/leads/lead-events';
import { LEAD_LAYER_EVENTS } from '@/lib/leads/types';
import { DEFAULT_FOLLOWUP_POLICY } from '@/lib/leads/types';

async function loadPolicy(db: AdminClient, accountId: string) {
  const { data } = await db
    .from('followup_policies')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();
  return parseFollowupPolicy(data);
}

function idempotencyKey(leadId: string, attempt: number): string {
  return `lead-reminder:${leadId}:${attempt}`;
}

export async function scheduleLeadReminder(
  db: AdminClient,
  input: {
    accountId: string;
    leadId: string;
    conversationId: string;
    contactId: string;
    userId?: string;
    correlationId?: string;
    now?: Date;
  }
): Promise<{ scheduled: boolean; reason?: string }> {
  try {
    const policy = await loadPolicy(db, input.accountId);
    const { data: lead } = await db
      .from('leads')
      .select(
        'id, reminder_count, followup_status, stage, ai_product_service, service'
      )
      .eq('id', input.leadId)
      .eq('account_id', input.accountId)
      .maybeSingle();
    if (!lead) return { scheduled: false, reason: 'lead_missing' };

    const { data: existing } = await db
      .from('lead_followups')
      .select('id, status')
      .eq('account_id', input.accountId)
      .eq('lead_id', input.leadId)
      .eq('followup_type', 'reminder')
      .in('status', ['scheduled', 'sent']);

    const hasScheduled = (existing || []).some(
      (row) => row.status === 'scheduled'
    );
    const gate = canScheduleReminder({
      policy,
      reminderCount: Number(lead.reminder_count || 0),
      hasScheduled,
      followupStatus: lead.followup_status as string | null,
    });
    if (!gate.allowed) return { scheduled: false, reason: gate.reason };

    const attempt = Number(lead.reminder_count || 0) + 1;
    const scheduledAt = reminderDueAt(input.now || new Date(), policy);
    const { error } = await db.from('lead_followups').insert({
      account_id: input.accountId,
      lead_id: input.leadId,
      conversation_id: input.conversationId,
      contact_id: input.contactId,
      followup_type: 'reminder',
      scheduled_at: scheduledAt.toISOString(),
      status: 'scheduled',
      attempt_number: attempt,
      idempotency_key: idempotencyKey(input.leadId, attempt),
      metadata: { user_id: input.userId || null },
    });

    if (error) {
      const duplicate =
        String((error as { code?: string }).code) === '23505' ||
        String((error as { message?: string }).message || '')
          .toLowerCase()
          .includes('duplicate');
      if (duplicate) return { scheduled: false, reason: 'already_sent' };
      console.error('[lead-followup] schedule failed', error);
      return { scheduled: false, reason: 'failed' };
    }

    await db
      .from('leads')
      .update({
        followup_status: 'scheduled',
        next_follow_up_at: scheduledAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.leadId)
      .eq('account_id', input.accountId);

    logLeadEvent(LEAD_LAYER_EVENTS.FOLLOWUP_SCHEDULED, {
      accountId: input.accountId,
      leadId: input.leadId,
      conversationId: input.conversationId,
      contactId: input.contactId,
      correlationId: input.correlationId,
    });
    return { scheduled: true };
  } catch (err) {
    console.error('[lead-followup] schedule threw', err);
    return { scheduled: false, reason: 'failed' };
  }
}

export async function cancelScheduledFollowups(
  db: AdminClient,
  input: {
    accountId: string;
    conversationId?: string | null;
    contactId?: string | null;
    leadId?: string | null;
    reason: string;
    correlationId?: string;
  }
): Promise<number> {
  try {
    let query = db
      .from('lead_followups')
      .select('id, lead_id, conversation_id, contact_id')
      .eq('account_id', input.accountId)
      .eq('status', 'scheduled');
    if (input.leadId) query = query.eq('lead_id', input.leadId);
    else if (input.conversationId)
      query = query.eq('conversation_id', input.conversationId);
    else if (input.contactId) query = query.eq('contact_id', input.contactId);
    else return 0;

    const { data: rows } = await query;
    if (!rows || rows.length === 0) return 0;

    const ids = rows.map((r) => r.id as string);
    const nowIso = new Date().toISOString();
    await db
      .from('lead_followups')
      .update({
        status: 'cancelled',
        cancelled_reason: input.reason,
        updated_at: nowIso,
      })
      .eq('account_id', input.accountId)
      .in('id', ids);

    const leadIds = Array.from(
      new Set(rows.map((r) => r.lead_id as string).filter(Boolean))
    );
    const followupStatus =
      input.reason === 'human_handoff' ? 'human_takeover' : 'waiting_for_reply';
    for (const leadId of leadIds) {
      const statusUpdate: Record<string, unknown> = {
        followup_status: followupStatus,
        next_follow_up_at: null,
        updated_at: nowIso,
      };
      if (
        input.reason === 'stop_keyword' ||
        input.reason === 'negative_intent' ||
        input.reason === 'lead_lost' ||
        input.reason === 'lead_converted' ||
        input.reason === 'conversation_closed'
      ) {
        statusUpdate.followup_status = 'stopped';
        statusUpdate.followup_stopped_reason = input.reason;
      }
      if (input.reason === 'human_handoff') {
        statusUpdate.followup_status = 'human_takeover';
        statusUpdate.followup_stopped_reason = 'human_handoff';
      }
      if (input.reason === 'customer_replied') {
        statusUpdate.followup_status = 'waiting_for_reply';
        statusUpdate.last_customer_reply_at = nowIso;
      }
      await db
        .from('leads')
        .update(statusUpdate)
        .eq('id', leadId)
        .eq('account_id', input.accountId);
      logLeadEvent(LEAD_LAYER_EVENTS.FOLLOWUP_CANCELLED, {
        accountId: input.accountId,
        leadId,
        conversationId: input.conversationId,
        contactId: input.contactId,
        correlationId: input.correlationId,
        reason: input.reason,
      });
    }
    return ids.length;
  } catch (err) {
    console.error('[lead-followup] cancel failed', err);
    return 0;
  }
}

export async function stopFollowupsForLead(
  db: AdminClient,
  input: {
    accountId: string;
    leadId: string;
    reason: string;
    correlationId?: string;
  }
): Promise<void> {
  await cancelScheduledFollowups(db, {
    accountId: input.accountId,
    leadId: input.leadId,
    reason: input.reason,
    correlationId: input.correlationId,
  });
  await db
    .from('leads')
    .update({
      followup_status: 'stopped',
      followup_stopped_reason: input.reason,
      next_follow_up_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.leadId)
    .eq('account_id', input.accountId);
  logLeadEvent(LEAD_LAYER_EVENTS.FOLLOWUP_STOPPED, {
    accountId: input.accountId,
    leadId: input.leadId,
    reason: input.reason,
    correlationId: input.correlationId,
  });
}

export async function pauseFollowupsForConversation(
  db: AdminClient,
  input: {
    accountId: string;
    conversationId: string;
    leadId?: string | null;
    correlationId?: string;
  }
): Promise<void> {
  await cancelScheduledFollowups(db, {
    accountId: input.accountId,
    conversationId: input.conversationId,
    leadId: input.leadId,
    reason: 'human_handoff',
    correlationId: input.correlationId,
  });
  logLeadEvent(LEAD_LAYER_EVENTS.HUMAN_HANDOFF, {
    accountId: input.accountId,
    conversationId: input.conversationId,
    leadId: input.leadId,
    correlationId: input.correlationId,
  });
}

function reminderCopy(service?: string | null): string {
  const offering = service?.trim();
  return offering
    ? `Just checking in — still happy to help with ${offering} if you have any questions.`
    : 'Just checking in — still happy to help if you have any questions.';
}

export async function processDueLeadFollowups(
  db: AdminClient,
  options: { limit?: number } = {}
): Promise<{ processed: number; sent: number; skipped: number }> {
  const limit = options.limit ?? 25;
  const { data: due, error } = await db
    .from('lead_followups')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (error || !due || due.length === 0) {
    return { processed: 0, sent: 0, skipped: 0 };
  }

  let sent = 0;
  let skipped = 0;
  for (const row of due as Array<Record<string, unknown>>) {
    const id = String(row.id);
    const accountId = String(row.account_id);
    const leadId = String(row.lead_id);
    const conversationId = (row.conversation_id as string | null) ?? null;
    const contactId = (row.contact_id as string | null) ?? null;
    const scheduledAt = String(row.scheduled_at);

    const { data: claimed } = await db
      .from('lead_followups')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('account_id', accountId)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    const guard = await evaluateDelayedOutboundGuard(db, {
      accountId,
      conversationId,
      contactId,
      leadId,
      scheduledAt,
      isReminder: true,
    });

    if (!guard.allow) {
      await db
        .from('lead_followups')
        .update({
          status: guard.reason === 'already_sent' ? 'skipped' : 'cancelled',
          cancelled_reason: guard.reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('account_id', accountId);
      if (
        guard.reason === 'stop_keyword' ||
        guard.reason === 'negative_intent' ||
        guard.reason === 'lead_lost' ||
        guard.reason === 'lead_converted' ||
        guard.reason === 'conversation_closed' ||
        guard.reason === 'max_reminders'
      ) {
        await stopFollowupsForLead(db, {
          accountId,
          leadId,
          reason: guard.reason,
        });
      }
      logLeadEvent(LEAD_LAYER_EVENTS.FOLLOWUP_SKIPPED, {
        accountId,
        leadId,
        conversationId,
        contactId,
        reason: guard.reason,
      });
      skipped++;
      continue;
    }

    const { data: lead } = await db
      .from('leads')
      .select('ai_product_service, service, metadata')
      .eq('id', leadId)
      .eq('account_id', accountId)
      .maybeSingle();

    const userId =
      ((row.metadata as { user_id?: string } | null)?.user_id as
        string | undefined) || undefined;
    if (!conversationId || !contactId) {
      skipped++;
      continue;
    }

    try {
      await engineSendText({
        accountId,
        userId,
        conversationId,
        contactId,
        text: reminderCopy(
          (lead?.ai_product_service as string | null) ||
            (lead?.service as string | null)
        ),
      });
      const nowIso = new Date().toISOString();
      await db
        .from('lead_followups')
        .update({
          status: 'sent',
          sent_at: nowIso,
          cancelled_reason: null,
          updated_at: nowIso,
        })
        .eq('id', id)
        .eq('account_id', accountId);
      await db
        .from('leads')
        .update({
          followup_status: 'reminder_sent',
          reminder_count: 1,
          last_automated_message_at: nowIso,
          next_follow_up_at: null,
          updated_at: nowIso,
        })
        .eq('id', leadId)
        .eq('account_id', accountId);
      logLeadEvent(LEAD_LAYER_EVENTS.FOLLOWUP_SENT, {
        accountId,
        leadId,
        conversationId,
        contactId,
      });
      sent++;
    } catch (err) {
      console.error('[lead-followup] send failed', err);
      await db
        .from('lead_followups')
        .update({
          status: 'failed',
          cancelled_reason: 'send_failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('account_id', accountId);
      skipped++;
    }
  }

  return { processed: due.length, sent, skipped };
}

export { DEFAULT_FOLLOWUP_POLICY };
