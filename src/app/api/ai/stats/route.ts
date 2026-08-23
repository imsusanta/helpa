import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { checkPlanLimits } from '@/lib/saas/subscription';
import { getAccountChatbotSettings } from '@/core/ai/chatbot-settings';

/**
 * Read-only AI overview metrics for the Automation & AI module.
 *
 * SECURITY: viewer+ can read. Every figure returned here is a REAL value —
 * AI request usage comes from the SaaS usage tracker (usage_tracking) via the
 * plan-limits helper, and the entry/conversation figures are live COUNT(*)
 * queries scoped to the authenticated account. There are no placeholder or
 * hard-coded statistics. `ctx.appwrite` is the service-role client, so every
 * query is explicitly constrained to `account_id = ctx.accountId`.
 */
export async function GET() {
  try {
    const ctx = await requireRole('viewer');
    const db = ctx.appwrite;
    const accountId = ctx.accountId;

    if (!db) {
      throw new Error('Account data client is unavailable.');
    }

    // Real monthly AI request usage vs. plan limit.
    let aiRequestsUsed = 0;
    let aiRequestsLimit = 0;
    let aiRequestsRemaining = 0;
    let aiRequestsPercent = 0;
    try {
      const usage = await checkPlanLimits(accountId, 'max_ai_requests');
      aiRequestsUsed = usage.currentUsage;
      aiRequestsLimit = usage.limit;
      aiRequestsRemaining = usage.remaining;
      aiRequestsPercent = usage.percentageUsed;
    } catch (err) {
      console.warn('[GET /api/ai/stats] usage lookup failed:', err);
    }

    // Live counts — all scoped to the authenticated account.
    const [kbTotalRes, faqRes, conversationsRes] = await Promise.all([
      db
        .from('knowledge_base')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId),
      db
        .from('knowledge_base')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .eq('category', 'faq'),
      db
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId),
    ]);

    const knowledgeBaseEntries = kbTotalRes.count ?? 0;
    const faqEntries = faqRes.count ?? 0;
    const conversations = conversationsRes.count ?? 0;

    // Real chatbot master-switch state (system_settings mirror).
    const chatbot = await getAccountChatbotSettings(accountId, db);

    return NextResponse.json({
      ai_requests_used: aiRequestsUsed,
      ai_requests_limit: aiRequestsLimit,
      ai_requests_remaining: aiRequestsRemaining,
      ai_requests_percent: aiRequestsPercent,
      knowledge_base_entries: knowledgeBaseEntries,
      faq_entries: faqEntries,
      conversations,
      chatbot_enabled: chatbot.enabled,
      response_style: chatbot.responseStyle,
    });
  } catch (err) {
    console.error('[GET /api/ai/stats] error:', err);
    return toErrorResponse(err);
  }
}
