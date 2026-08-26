/**
 * CRM side effects of a parsed AI receptionist reply.
 *
 * After every AI turn the conversation row gets fresh insight columns,
 * and the sales pipeline is kept in sync: an existing deal for the
 * contact is enriched with the newest AI signals, or a new deal is
 * created in the default pipeline's "new" stage when the model flagged
 * a sales signal. Failures are logged, never thrown — CRM sync must not
 * block the customer-facing reply.
 */
import type { AdminClient } from '@/lib/db/server';
import type { StructuredAiInsights } from '@/lib/whatsapp/ai-pipeline';

export interface CrmSyncArgs {
  accountId: string;
  userId: string;
  conversationId: string;
  contactId: string;
  contact: { name?: string | null; phone?: string | null } | null;
  insights: StructuredAiInsights;
}

/** Write the latest AI insight columns onto the conversation row. */
export async function updateConversationInsights(
  db: AdminClient,
  args: Pick<CrmSyncArgs, 'conversationId' | 'insights'>
): Promise<void> {
  const { insights } = args;
  const { error } = await db
    .from('conversations')
    .update({
      ai_intent: insights.intent,
      ai_lead_score: insights.leadScore,
      ai_sentiment: insights.sentiment,
      ai_summary: insights.summary,
      ai_handoff_required: insights.handoffRequired,
      ai_resolved: insights.resolved,
      ai_faq_category: insights.faqCategory,
    })
    .eq('id', args.conversationId);

  if (error) {
    console.error(
      '[AI Assistant] Failed to update conversation AI insights:',
      error
    );
  }
}

/** Pick the stage a fresh AI-sourced deal should land in. */
export function pickNewLeadStage<T extends { name: string }>(
  stages: T[]
): T | undefined {
  return (
    stages.find(
      (s) =>
        s.name.toLowerCase() === 'new inquiry' ||
        s.name.toLowerCase() === 'new lead'
    ) || stages[0]
  );
}

/** Title for an auto-created pipeline card. */
export function buildDealTitle(
  contact: { name?: string | null; phone?: string | null } | null,
  interestedService: string | null
): string {
  const contactName = contact?.name || contact?.phone || 'Unknown Client';
  return interestedService
    ? `${contactName} - ${interestedService}`
    : `${contactName} - WhatsApp Lead`;
}

/**
 * Enrich the contact's existing deal with the newest AI signals, or
 * create one when the model reported a sales signal.
 */
export async function syncDealPipeline(
  db: AdminClient,
  args: CrmSyncArgs
): Promise<void> {
  const { insights } = args;
  try {
    const { data: existingDeal } = await db
      .from('deals')
      .select('*')
      .eq('contact_id', args.contactId)
      .eq('account_id', args.accountId)
      .maybeSingle();

    if (existingDeal) {
      const { error: dealUpdateErr } = await db
        .from('deals')
        .update({
          ai_lead_score: insights.leadScore,
          ai_buying_intent: insights.intent,
          ai_budget: insights.budget || existingDeal.ai_budget,
          ai_timeline: insights.timeline || existingDeal.ai_timeline,
          ai_summary: insights.summary || existingDeal.ai_summary,
          ai_next_action: insights.nextAction || existingDeal.ai_next_action,
          ai_product_service:
            insights.interestedService || existingDeal.ai_product_service,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingDeal.id);

      if (dealUpdateErr) {
        console.error(
          '[AI Pipeline] Failed to update existing deal:',
          dealUpdateErr
        );
      } else {
        console.log(
          '[AI Pipeline] Successfully updated existing Pipeline card:',
          existingDeal.id
        );
      }
      return;
    }

    if (!insights.salesSignal) return;

    const { data: pipelines } = await db
      .from('pipelines')
      .select('id')
      .eq('account_id', args.accountId)
      .order('created_at', { ascending: true });

    if (!pipelines || pipelines.length === 0) return;
    const pipelineId = pipelines[0].id;

    const { data: stages } = await db
      .from('pipeline_stages')
      .select('id, name')
      .eq('pipeline_id', pipelineId)
      .order('position', { ascending: true });

    if (!stages || stages.length === 0) return;
    const newLeadStage = pickNewLeadStage(
      stages as { id: string; name: string }[]
    );
    if (!newLeadStage) return;

    const { error: dealInsertErr } = await db.from('deals').insert({
      account_id: args.accountId,
      user_id: args.userId,
      pipeline_id: pipelineId,
      stage_id: newLeadStage.id,
      contact_id: args.contactId,
      conversation_id: args.conversationId,
      title: buildDealTitle(args.contact, insights.interestedService),
      ai_lead_score: insights.leadScore,
      ai_buying_intent: insights.intent,
      ai_budget: insights.budget,
      ai_timeline: insights.timeline,
      ai_summary: insights.summary,
      ai_next_action: insights.nextAction,
      ai_product_service: insights.interestedService,
    });

    if (dealInsertErr) {
      console.error('[AI Pipeline] Failed to create new deal:', dealInsertErr);
    } else {
      console.log(
        '[AI Pipeline] Successfully created new Pipeline card for contact:',
        args.contactId
      );
    }
  } catch (pipelineErr) {
    console.error(
      '[AI Pipeline] Error during pipeline synchronization:',
      pipelineErr
    );
  }
}
