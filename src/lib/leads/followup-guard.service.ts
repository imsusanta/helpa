/**
 * Server-side guards that run immediately before an automated outbound
 * WhatsApp send. Failures in lookup are returned as skip for lead
 * follow-ups; delayed automation resumes catch and continue.
 */
import type { AdminClient } from '@/lib/db/server';
import { detectStopIntent } from '@/lib/leads/stop-intent';
import {
  TERMINAL_LEAD_STAGES,
  type OutboundGuardDecision,
} from '@/lib/leads/types';

export interface GuardSnapshot {
  conversation?: {
    status?: string | null;
    assigned_agent_id?: string | null;
    ai_chat_enabled?: boolean | null;
    ai_autoreply_disabled?: boolean | null;
    last_customer_message_at?: string | null;
  } | null;
  lead?: {
    stage?: string | null;
    followup_status?: string | null;
    reminder_count?: number | null;
    last_customer_reply_at?: string | null;
    last_automated_message_at?: string | null;
  } | null;
  account?: { status?: string | null } | null;
  whatsappConnected?: boolean;
  optedOut?: boolean;
  pendingFollowup?: boolean;
  reminderAlreadySent?: boolean;
  customerRepliedSince?: boolean;
  latestCustomerText?: string | null;
}

export function evaluateGuardSnapshot(
  snapshot: GuardSnapshot,
  options: {
    scheduledAt?: string | null;
    isReminder?: boolean;
    ignoreCustomerReply?: boolean;
  } = {}
): OutboundGuardDecision {
  if (snapshot.account && snapshot.account.status) {
    const status = snapshot.account.status.toLowerCase();
    if (
      status === 'inactive' ||
      status === 'suspended' ||
      status === 'disabled'
    ) {
      return { allow: false, reason: 'account_inactive' };
    }
  }
  if (snapshot.whatsappConnected === false) {
    return { allow: false, reason: 'whatsapp_unavailable' };
  }
  if (snapshot.optedOut) {
    return { allow: false, reason: 'opted_out' };
  }

  const conv = snapshot.conversation;
  if (conv) {
    const status = String(conv.status || '').toLowerCase();
    if (status === 'closed' || status === 'archived') {
      return { allow: false, reason: 'conversation_closed' };
    }
    if (conv.assigned_agent_id) {
      return { allow: false, reason: 'human_handoff' };
    }
    if (conv.ai_chat_enabled === false || conv.ai_autoreply_disabled === true) {
      return { allow: false, reason: 'human_handoff' };
    }
  }

  const lead = snapshot.lead;
  if (lead) {
    const stage = String(lead.stage || '').toUpperCase();
    if (stage === 'LOST') return { allow: false, reason: 'lead_lost' };
    if (
      stage === 'CONVERTED' ||
      TERMINAL_LEAD_STAGES.includes(stage as 'CONVERTED')
    ) {
      return { allow: false, reason: 'lead_converted' };
    }
    if (lead.followup_status === 'stopped') {
      return { allow: false, reason: 'negative_intent' };
    }
    if (lead.followup_status === 'human_takeover') {
      return { allow: false, reason: 'human_handoff' };
    }
    if (options.isReminder && (lead.reminder_count || 0) >= 1) {
      return { allow: false, reason: 'max_reminders' };
    }
    if (options.isReminder && lead.followup_status === 'reminder_sent') {
      return { allow: false, reason: 'max_reminders' };
    }
  }

  if (snapshot.reminderAlreadySent && options.isReminder) {
    return { allow: false, reason: 'already_sent' };
  }

  if (snapshot.customerRepliedSince && !options.ignoreCustomerReply) {
    return { allow: false, reason: 'customer_replied' };
  }

  const stop = detectStopIntent(snapshot.latestCustomerText);
  if (stop === 'stop') return { allow: false, reason: 'stop_keyword' };
  if (stop === 'negative') return { allow: false, reason: 'negative_intent' };

  return { allow: true };
}

export async function loadGuardSnapshot(
  db: AdminClient,
  input: {
    accountId: string;
    conversationId?: string | null;
    contactId?: string | null;
    leadId?: string | null;
    scheduledAt?: string | null;
  }
): Promise<GuardSnapshot> {
  const snapshot: GuardSnapshot = {};

  const [accountRes, convRes, leadRes, waRes, patientRes] = await Promise.all([
    db
      .from('accounts')
      .select('status')
      .eq('id', input.accountId)
      .maybeSingle(),
    input.conversationId
      ? db
          .from('conversations')
          .select(
            'id, status, assigned_agent_id, ai_chat_enabled, ai_autoreply_disabled, last_message_at'
          )
          .eq('id', input.conversationId)
          .eq('account_id', input.accountId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    input.leadId
      ? db
          .from('leads')
          .select(
            'id, stage, followup_status, reminder_count, last_customer_reply_at, last_automated_message_at'
          )
          .eq('id', input.leadId)
          .eq('account_id', input.accountId)
          .maybeSingle()
      : input.contactId
        ? db
            .from('leads')
            .select(
              'id, stage, followup_status, reminder_count, last_customer_reply_at, last_automated_message_at'
            )
            .eq('account_id', input.accountId)
            .eq('contact_id', input.contactId)
            .not('stage', 'in', '(CONVERTED,LOST)')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    db
      .from('whatsapp_configs')
      .select('id, status')
      .eq('account_id', input.accountId)
      .limit(1)
      .maybeSingle(),
    input.contactId
      ? db
          .from('patients')
          .select('consent_status')
          .eq('id', input.contactId)
          .eq('account_id', input.accountId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  snapshot.account = (accountRes.data as { status?: string } | null) ?? null;
  snapshot.conversation =
    (convRes.data as GuardSnapshot['conversation']) ?? null;
  snapshot.lead = (leadRes.data as GuardSnapshot['lead']) ?? null;
  const wa = waRes.data as { status?: string } | null;
  snapshot.whatsappConnected = wa ? wa.status !== 'disconnected' : true;
  const consent = (patientRes.data as { consent_status?: string } | null)
    ?.consent_status;
  snapshot.optedOut = consent === 'opted_out';

  if (input.conversationId) {
    const since = input.scheduledAt;
    const inboundQuery = db
      .from('messages')
      .select('id, created_at, content_text, sender_type, direction')
      .eq('account_id', input.accountId)
      .eq('conversation_id', input.conversationId)
      .order('created_at', { ascending: false })
      .limit(8);
    const { data: recent } = await inboundQuery;
    const rows = (recent || []) as Array<{
      created_at?: string;
      content_text?: string | null;
      sender_type?: string | null;
      direction?: string | null;
    }>;
    const inbound = rows.filter(
      (m) => m.direction === 'inbound' || m.sender_type === 'customer'
    );
    snapshot.latestCustomerText = inbound[0]?.content_text ?? null;
    if (since) {
      const sinceMs = new Date(since).getTime();
      snapshot.customerRepliedSince = inbound.some((m) => {
        const at = m.created_at ? new Date(m.created_at).getTime() : 0;
        return at > sinceMs;
      });
    }
  }

  if (input.leadId) {
    const { data: jobs } = await db
      .from('lead_followups')
      .select('id, status, followup_type')
      .eq('account_id', input.accountId)
      .eq('lead_id', input.leadId);
    const list = (jobs || []) as Array<{
      status: string;
      followup_type: string;
    }>;
    snapshot.pendingFollowup = list.some((j) => j.status === 'scheduled');
    snapshot.reminderAlreadySent = list.some(
      (j) => j.followup_type === 'reminder' && j.status === 'sent'
    );
  }

  return snapshot;
}

export async function evaluateDelayedOutboundGuard(
  db: AdminClient,
  input: {
    accountId: string;
    conversationId?: string | null;
    contactId?: string | null;
    leadId?: string | null;
    scheduledAt?: string | null;
    isReminder?: boolean;
    ignoreCustomerReply?: boolean;
  }
): Promise<OutboundGuardDecision> {
  const snapshot = await loadGuardSnapshot(db, input);
  return evaluateGuardSnapshot(snapshot, {
    scheduledAt: input.scheduledAt,
    isReminder: input.isReminder,
    ignoreCustomerReply: input.ignoreCustomerReply,
  });
}
