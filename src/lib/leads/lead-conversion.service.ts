/**
 * Create-or-update the existing public.leads row from a validated
 * detection result. Never invents a second CRM.
 */
import type { AdminClient } from '@/lib/db/server';
import { runAutomationsForTrigger } from '@/lib/automations/engine';
import {
  computeLeadScore,
  mergeKnownDetails,
} from '@/lib/leads/lead-qualification.service';
import { logLeadEvent } from '@/lib/leads/lead-events';
import { LEAD_LAYER_EVENTS, TERMINAL_LEAD_STAGES } from '@/lib/leads/types';
import type { LeadDetectionResult } from '@/lib/leads/types';

export interface UpsertLeadInput {
  accountId: string;
  userId: string;
  conversationId: string;
  contactId: string;
  contactName?: string | null;
  contactPhone?: string | null;
  messageId: string;
  messageText: string;
  industry?: string | null;
  detection: LeadDetectionResult;
  correlationId?: string;
}

export interface UpsertLeadResult {
  leadId: string | null;
  created: boolean;
  updated: boolean;
  skipped: boolean;
}

interface LeadRow {
  id: string;
  contact_id?: string | null;
  stage?: string | null;
  source?: string | null;
  channel?: string | null;
  service?: string | null;
  score?: string | null;
  lead_score?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  conversation_id?: string | null;
  followup_status?: string | null;
  reminder_count?: number | null;
  ai_budget?: string | null;
  ai_timeline?: string | null;
  ai_summary?: string | null;
  ai_next_action?: string | null;
  ai_product_service?: string | null;
}

function isTerminalStage(stage: string | null | undefined): boolean {
  const value = String(stage || '').toUpperCase();
  return (TERMINAL_LEAD_STAGES as readonly string[]).includes(value);
}

export async function findActiveLead(
  db: AdminClient,
  input: {
    accountId: string;
    contactId?: string | null;
    conversationId?: string | null;
    phone?: string | null;
  }
): Promise<LeadRow | null> {
  if (input.contactId) {
    const { data } = await db
      .from('leads')
      .select('*')
      .eq('account_id', input.accountId)
      .eq('contact_id', input.contactId)
      .not('stage', 'in', '(CONVERTED,LOST)')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as LeadRow;
  }
  if (input.conversationId) {
    const { data } = await db
      .from('leads')
      .select('*')
      .eq('account_id', input.accountId)
      .eq('conversation_id', input.conversationId)
      .not('stage', 'in', '(CONVERTED,LOST)')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as LeadRow;
  }
  if (input.phone) {
    const { data } = await db
      .from('leads')
      .select('*')
      .eq('account_id', input.accountId)
      .eq('phone', input.phone)
      .not('stage', 'in', '(CONVERTED,LOST)')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as LeadRow;
  }
  return null;
}

function nextStageForDetection(
  existingStage: string | null | undefined,
  detection: LeadDetectionResult
): string {
  const current = String(existingStage || 'NEW').toUpperCase();
  if (isTerminalStage(current)) return current;
  if (detection.intent === 'high' && current === 'NEW') return 'QUALIFYING';
  if (
    detection.requires_qualification === false &&
    (current === 'NEW' || current === 'CONTACTED' || current === 'QUALIFYING')
  ) {
    return 'QUALIFIED';
  }
  if (current === 'NEW' && detection.is_business_enquiry) return 'CONTACTED';
  return current;
}

export async function upsertLeadFromDetection(
  db: AdminClient,
  input: UpsertLeadInput
): Promise<UpsertLeadResult> {
  const empty: UpsertLeadResult = {
    leadId: null,
    created: false,
    updated: false,
    skipped: true,
  };
  try {
    if (!input.detection.is_business_enquiry) {
      logLeadEvent(LEAD_LAYER_EVENTS.AI_LEAD_NOT_DETECTED, {
        accountId: input.accountId,
        conversationId: input.conversationId,
        contactId: input.contactId,
        correlationId: input.correlationId,
        reason: 'not_an_enquiry',
      });
      return empty;
    }

    const existingByMessage = await db
      .from('leads')
      .select('id, stage')
      .eq('account_id', input.accountId)
      .eq('source_message_id', input.messageId)
      .maybeSingle();
    if (existingByMessage.data?.id) {
      return {
        leadId: existingByMessage.data.id as string,
        created: false,
        updated: false,
        skipped: true,
      };
    }

    const existing = await findActiveLead(db, {
      accountId: input.accountId,
      contactId: input.contactId,
      conversationId: input.conversationId,
      phone: input.contactPhone,
    });

    const known = mergeKnownDetails(input.detection);
    const scored = computeLeadScore({
      detection: input.detection,
      known,
      industry: input.industry,
      customerEngaged: true,
    });
    const nowIso = new Date().toISOString();
    const name =
      input.contactName ||
      input.contactPhone ||
      input.detection.service ||
      'WhatsApp enquiry';

    if (existing) {
      const stage = nextStageForDetection(existing.stage, input.detection);
      const metadata = {
        ...((existing.metadata as Record<string, unknown> | null) || {}),
        ai_qualification: known,
        last_detection_message_id: input.messageId,
      };
      const previousScore = existing.lead_score || existing.score;
      const { error } = await db
        .from('leads')
        .update({
          conversation_id: existing.conversation_id || input.conversationId,
          contact_id: existing.contact_id || input.contactId,
          service: input.detection.service || existing.service,
          stage,
          score: scored.label,
          lead_score: scored.label,
          ai_lead_score: scored.label,
          ai_score_numeric: scored.numeric,
          ai_buying_intent: input.detection.intent,
          ai_summary: input.detection.summary || existing.ai_summary,
          ai_next_action:
            input.detection.next_action || existing.ai_next_action,
          ai_product_service:
            input.detection.service || existing.ai_product_service,
          ai_budget: input.detection.budget || existing.ai_budget,
          ai_timeline: input.detection.timeline || existing.ai_timeline,
          source: existing.source || 'whatsapp',
          channel: existing.channel || 'whatsapp',
          last_customer_reply_at: nowIso,
          metadata,
          updated_at: nowIso,
        })
        .eq('id', existing.id)
        .eq('account_id', input.accountId);

      if (error) {
        console.error('[lead-conversion] update failed', error);
        return empty;
      }

      await db.from('lead_activities').insert({
        account_id: input.accountId,
        lead_id: existing.id,
        activity_type: 'ai_qualified',
        notes: input.detection.summary,
        metadata: {
          intent: input.detection.intent,
          score: scored.label,
          score_numeric: scored.numeric,
        },
      });

      logLeadEvent(LEAD_LAYER_EVENTS.LEAD_UPDATED, {
        accountId: input.accountId,
        leadId: existing.id,
        conversationId: input.conversationId,
        contactId: input.contactId,
        correlationId: input.correlationId,
      });
      logLeadEvent(LEAD_LAYER_EVENTS.AI_QUALIFIED, {
        accountId: input.accountId,
        leadId: existing.id,
        conversationId: input.conversationId,
        contactId: input.contactId,
        correlationId: input.correlationId,
      });

      try {
        await runAutomationsForTrigger({
          accountId: input.accountId,
          triggerType: 'lead_qualified',
          contactId: input.contactId,
          context: {
            conversation_id: input.conversationId,
            message_text: input.messageText,
            vars: {
              lead_id: existing.id,
              service: input.detection.service,
              intent: input.detection.intent,
              score: scored.label,
            },
          },
        });
        if (previousScore && previousScore !== scored.label) {
          await runAutomationsForTrigger({
            accountId: input.accountId,
            triggerType: 'lead_score_changed',
            contactId: input.contactId,
            context: {
              conversation_id: input.conversationId,
              vars: {
                lead_id: existing.id,
                previous_score: previousScore,
                score: scored.label,
              },
            },
          });
        }
      } catch (err) {
        console.error('[lead-conversion] automation dispatch failed', err);
      }

      return {
        leadId: existing.id,
        created: false,
        updated: true,
        skipped: false,
      };
    }

    const stage = nextStageForDetection('NEW', input.detection);
    const insertPayload = {
      account_id: input.accountId,
      contact_id: input.contactId,
      conversation_id: input.conversationId,
      name,
      phone: input.contactPhone || null,
      service: input.detection.service,
      stage,
      source: 'whatsapp',
      channel: 'whatsapp',
      score: scored.label,
      lead_score: scored.label,
      ai_lead_score: scored.label,
      ai_score_numeric: scored.numeric,
      ai_buying_intent: input.detection.intent,
      ai_summary: input.detection.summary,
      ai_next_action: input.detection.next_action,
      ai_product_service: input.detection.service,
      ai_budget: input.detection.budget,
      ai_timeline: input.detection.timeline,
      source_message_id: input.messageId,
      last_customer_reply_at: nowIso,
      followup_status: 'none',
      reminder_count: 0,
      value: 0,
      currency: 'INR',
      attention_required: input.detection.intent === 'high',
      metadata: {
        ai_qualification: known,
        last_detection_message_id: input.messageId,
      },
    };

    const { data: created, error } = await db
      .from('leads')
      .insert(insertPayload)
      .select('id')
      .maybeSingle();

    if (error) {
      // Unique source_message_id means a webhook retry already created the lead.
      if (
        String((error as { code?: string }).code) === '23505' ||
        String((error as { message?: string }).message || '')
          .toLowerCase()
          .includes('duplicate')
      ) {
        const again = await findActiveLead(db, {
          accountId: input.accountId,
          contactId: input.contactId,
          conversationId: input.conversationId,
          phone: input.contactPhone,
        });
        return {
          leadId: again?.id ?? null,
          created: false,
          updated: false,
          skipped: true,
        };
      }
      console.error('[lead-conversion] insert failed', error);
      return empty;
    }

    const leadId = (created as { id?: string } | null)?.id ?? null;
    if (!leadId) return empty;

    await db.from('lead_activities').insert({
      account_id: input.accountId,
      lead_id: leadId,
      activity_type: 'lead_created',
      notes: input.detection.summary,
      metadata: {
        source: 'whatsapp',
        intent: input.detection.intent,
        score: scored.label,
      },
    });

    logLeadEvent(LEAD_LAYER_EVENTS.AI_LEAD_DETECTED, {
      accountId: input.accountId,
      leadId,
      conversationId: input.conversationId,
      contactId: input.contactId,
      correlationId: input.correlationId,
    });
    logLeadEvent(LEAD_LAYER_EVENTS.LEAD_CREATED, {
      accountId: input.accountId,
      leadId,
      conversationId: input.conversationId,
      contactId: input.contactId,
      correlationId: input.correlationId,
    });

    try {
      await runAutomationsForTrigger({
        accountId: input.accountId,
        triggerType: 'lead_created',
        contactId: input.contactId,
        context: {
          conversation_id: input.conversationId,
          message_text: input.messageText,
          vars: {
            lead_id: leadId,
            service: input.detection.service,
            intent: input.detection.intent,
            score: scored.label,
          },
        },
      });
      await runAutomationsForTrigger({
        accountId: input.accountId,
        triggerType: 'lead_qualified',
        contactId: input.contactId,
        context: {
          conversation_id: input.conversationId,
          message_text: input.messageText,
          vars: {
            lead_id: leadId,
            service: input.detection.service,
            intent: input.detection.intent,
            score: scored.label,
          },
        },
      });
    } catch (err) {
      console.error('[lead-conversion] automation dispatch failed', err);
    }

    return { leadId, created: true, updated: false, skipped: false };
  } catch (err) {
    console.error('[lead-conversion] upsert failed', err);
    return empty;
  }
}
