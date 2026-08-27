/**
 * Inbound orchestrator for the AI lead-detection layer.
 *
 * Called from the existing WhatsApp processMessage path AFTER the
 * inbound message is persisted. Must never throw to the webhook.
 */
import { getAdminClient, type AdminClient } from '@/lib/db/server';
import {
  detectionFromInsights,
  heuristicDetection,
  validateLeadDetection,
} from '@/lib/leads/lead-detection.service';
import { upsertLeadFromDetection } from '@/lib/leads/lead-conversion.service';
import {
  cancelScheduledFollowups,
  scheduleLeadReminder,
  stopFollowupsForLead,
} from '@/lib/leads/lead-followup.service';
import { detectStopIntent } from '@/lib/leads/stop-intent';
import { logLeadEvent } from '@/lib/leads/lead-events';
import { LEAD_LAYER_EVENTS } from '@/lib/leads/types';
import type { InboundLeadContext } from '@/lib/leads/types';
import type { StructuredAiInsights } from '@/lib/whatsapp/ai-pipeline';

export async function handleCustomerReply(
  context: InboundLeadContext,
  db: AdminClient = getAdminClient()
): Promise<void> {
  try {
    const stop = detectStopIntent(context.messageText);
    const reason = stop
      ? stop === 'stop'
        ? 'stop_keyword'
        : 'negative_intent'
      : 'customer_replied';

    await cancelScheduledFollowups(db, {
      accountId: context.accountId,
      conversationId: context.conversationId,
      contactId: context.contactId,
      reason,
      correlationId: context.correlationId,
    });

    if (stop) {
      const { data: lead } = await db
        .from('leads')
        .select('id')
        .eq('account_id', context.accountId)
        .eq('contact_id', context.contactId)
        .not('stage', 'in', '(CONVERTED,LOST)')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lead?.id) {
        await stopFollowupsForLead(db, {
          accountId: context.accountId,
          leadId: lead.id as string,
          reason,
          correlationId: context.correlationId,
        });
      }
    }
  } catch (err) {
    console.error('[lead-layer] handleCustomerReply failed', err);
  }
}

export async function applyDetectionToLead(
  context: InboundLeadContext,
  detectionSource: StructuredAiInsights | null,
  db: AdminClient = getAdminClient()
): Promise<{ leadId: string | null; created: boolean }> {
  try {
    if (context.assignedAgentId) {
      return { leadId: null, created: false };
    }

    let industry = context.industry;
    if (!industry) {
      const { data: account } = await db
        .from('accounts')
        .select('industry')
        .eq('id', context.accountId)
        .maybeSingle();
      industry = (account?.industry as string | null) ?? null;
    }

    const detection = detectionSource
      ? detectionFromInsights(detectionSource, context.messageText)
      : validateLeadDetection(null, context.messageText);

    if (!detection.is_business_enquiry) {
      logLeadEvent(LEAD_LAYER_EVENTS.AI_LEAD_NOT_DETECTED, {
        accountId: context.accountId,
        conversationId: context.conversationId,
        contactId: context.contactId,
        correlationId: context.correlationId,
        reason: 'not_an_enquiry',
      });
      return { leadId: null, created: false };
    }

    const result = await upsertLeadFromDetection(db, {
      accountId: context.accountId,
      userId: context.userId,
      conversationId: context.conversationId,
      contactId: context.contactId,
      contactName: context.contactName,
      contactPhone: context.contactPhone,
      messageId: context.messageId,
      messageText: context.messageText,
      industry,
      detection,
      correlationId: context.correlationId,
    });

    if (result.leadId && !context.aiDisabled && !context.assignedAgentId) {
      await scheduleLeadReminder(db, {
        accountId: context.accountId,
        leadId: result.leadId,
        conversationId: context.conversationId,
        contactId: context.contactId,
        userId: context.userId,
        correlationId: context.correlationId,
      });
    }

    return { leadId: result.leadId, created: result.created };
  } catch (err) {
    console.error('[lead-layer] applyDetectionToLead failed', err);
    return { leadId: null, created: false };
  }
}

/**
 * When the receptionist AI did not run, still create/update a lead for
 * genuine enquiries using the heuristic (no extra model call for "Hi").
 */
export async function processInboundLeadDetection(
  context: InboundLeadContext,
  options: { aiAlreadySynced?: boolean } = {},
  db: AdminClient = getAdminClient()
): Promise<void> {
  try {
    if (options.aiAlreadySynced) return;
    if (context.assignedAgentId) return;
    const heuristic = heuristicDetection(context.messageText);
    if (!heuristic.is_business_enquiry) {
      logLeadEvent(LEAD_LAYER_EVENTS.AI_LEAD_NOT_DETECTED, {
        accountId: context.accountId,
        conversationId: context.conversationId,
        contactId: context.contactId,
        correlationId: context.correlationId,
        reason: 'heuristic_skip',
      });
      return;
    }
    await applyDetectionToLead(context, null, db);
  } catch (err) {
    console.error('[lead-layer] processInboundLeadDetection failed', err);
  }
}
