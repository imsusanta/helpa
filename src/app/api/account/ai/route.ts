import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';
import { resolveSystemPrompt } from '@/modules/registry';
import { checkPlanLimits } from '@/lib/saas/subscription';
import {
  getAccountChatbotSettings,
  updateAccountChatbotSettings,
  type ChatbotSettings,
  type ResponseStyle,
} from '@/core/ai/chatbot-settings';

const RESPONSE_STYLES: ResponseStyle[] = ['concise', 'balanced', 'detailed'];

export async function GET() {
  try {
    const ctx = await requireRole('admin');
    const db = appwriteAdmin();

    // Verify authenticated user's active membership and admin role for this specific account
    const { data: profileCheck, error: pErr } = await db
      .from('profiles')
      .select('account_id, role, account_role, is_super_admin')
      .eq('user_id', ctx.userId)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (pErr || !profileCheck) {
      return NextResponse.json(
        { error: 'Forbidden: Account ownership verification failed' },
        { status: 403 }
      );
    }

    const effectiveRole = String(
      profileCheck.account_role || profileCheck.role || ''
    ).toLowerCase();

    if (
      !profileCheck.is_super_admin &&
      !['admin', 'owner'].includes(effectiveRole)
    ) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient account permissions' },
        { status: 403 }
      );
    }

    let account: Record<string, unknown> | null = null;
    const { data, error } = await db
      .from('accounts')
      .select('name, ai_system_prompt, welcome_message, industry')
      .eq('id', ctx.accountId)
      .single();

    if (error) {
      // Fallback query
      const fallback = await db
        .from('accounts')
        .select('name, industry')
        .eq('id', ctx.accountId)
        .single();
      account = fallback.data as Record<string, unknown>;
    } else {
      account = data as Record<string, unknown>;
    }

    // Fetch tenant-specific prompts from system_settings mirror if present
    const { data: sysRows } = await db
      .from('system_settings')
      .select('key, value')
      .ilike('key', `account:${ctx.accountId}:%`);

    const sysMap: Record<string, string> = {};
    if (sysRows && Array.isArray(sysRows)) {
      sysRows.forEach((r: { key?: string; value?: string }) => {
        if (r.key && r.value) {
          const fieldName = r.key.replace(`account:${ctx.accountId}:`, '');
          sysMap[fieldName] = r.value;
        }
      });
    }

    const aiSystemPrompt =
      (account?.ai_system_prompt as string) || sysMap.ai_system_prompt;
    const welcomeMessage =
      (account?.welcome_message as string) || sysMap.welcome_message || '';

    // Real AI usage for this workspace, sourced from SaaS plan tracking
    // (usage_tracking.ai_requests for the current month vs. the plan limit).
    let usageRequests = 0;
    let maxRequests = 0;
    try {
      const usage = await checkPlanLimits(ctx.accountId, 'max_ai_requests');
      usageRequests = usage.currentUsage;
      maxRequests = usage.limit;
    } catch (usageErr) {
      console.warn('[GET /api/account/ai] usage lookup failed:', usageErr);
    }

    // Chatbot master switch + response style (stored in system_settings mirror)
    const chatbot = await getAccountChatbotSettings(ctx.accountId, db);

    return NextResponse.json({
      account_name: (account?.name as string) || '',
      ai_available: true,
      usage_requests: usageRequests,
      max_requests: maxRequests,
      ai_system_prompt: resolveSystemPrompt(
        account?.industry as string,
        aiSystemPrompt
      ),
      welcome_message: welcomeMessage,
      chatbot_enabled: chatbot.enabled,
      response_style: chatbot.responseStyle,
    });
  } catch (err: unknown) {
    console.error('[GET /api/account/ai] exception:', err);
    const errorObj = err as Record<string, unknown>;
    return NextResponse.json(
      { error: (err as Error)?.message || 'Failed to fetch AI configuration' },
      { status: (errorObj?.status as number) || 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const db = appwriteAdmin();

    // Strict account ownership and admin role verification
    const { data: profileCheck, error: pErr } = await db
      .from('profiles')
      .select('account_id, role, account_role, is_super_admin')
      .eq('user_id', ctx.userId)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (pErr || !profileCheck) {
      return NextResponse.json(
        { error: 'Forbidden: Account ownership verification failed' },
        { status: 403 }
      );
    }

    const effectiveRole = String(
      profileCheck.account_role || profileCheck.role || ''
    ).toLowerCase();

    if (
      !profileCheck.is_super_admin &&
      !['admin', 'owner'].includes(effectiveRole)
    ) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient account permissions' },
        { status: 403 }
      );
    }

    const limit = checkRateLimit(
      `admin:ai-config:${ctx.userId}`,
      RATE_LIMITS.adminAction
    );
    if (!limit.success) return rateLimitResponse(limit);

    const body = await request.json().catch(() => null);
    const ai_system_prompt = body?.ai_system_prompt;
    const welcome_message = body?.welcome_message;
    const ai_chatbot_enabled = body?.ai_chatbot_enabled;
    const ai_response_style = body?.ai_response_style;

    const updates: Record<string, unknown> = {};
    const sysUpserts: Array<{ key: string; value: string }> = [];

    if (typeof ai_system_prompt === 'string') {
      const val = ai_system_prompt.trim();
      updates.ai_system_prompt = val;
      sysUpserts.push({
        key: `account:${ctx.accountId}:ai_system_prompt`,
        value: val,
      });
    }

    if (typeof welcome_message === 'string') {
      const val = welcome_message.trim();
      updates.welcome_message = val;
      sysUpserts.push({
        key: `account:${ctx.accountId}:welcome_message`,
        value: val,
      });
    }

    // Chatbot master switch + response style live in the system_settings
    // mirror (no accounts column — see src/core/ai/chatbot-settings.ts).
    const chatbotPatch: Partial<ChatbotSettings> = {};
    if (typeof ai_chatbot_enabled === 'boolean') {
      chatbotPatch.enabled = ai_chatbot_enabled;
    }
    if (
      typeof ai_response_style === 'string' &&
      RESPONSE_STYLES.includes(ai_response_style as ResponseStyle)
    ) {
      chatbotPatch.responseStyle = ai_response_style as ResponseStyle;
    }
    const hasChatbotPatch = Object.keys(chatbotPatch).length > 0;

    if (Object.keys(updates).length === 0 && !hasChatbotPatch) {
      return NextResponse.json(
        { error: 'No valid fields provided to update' },
        { status: 400 }
      );
    }

    // Apply chatbot settings (independent of accounts columns).
    let chatbot = await getAccountChatbotSettings(ctx.accountId, db);
    if (hasChatbotPatch) {
      chatbot = await updateAccountChatbotSettings(
        ctx.accountId,
        chatbotPatch,
        db
      );
    }

    // Persist prompt/welcome mirror
    if (sysUpserts.length > 0) {
      try {
        await db
          .from('system_settings')
          .upsert(sysUpserts, { onConflict: 'key' });
      } catch (sysErr) {
        console.warn('[PATCH /api/account/ai] system_settings note:', sysErr);
      }
    }

    // Update accounts columns only when prompt/welcome were provided.
    let resData: Record<string, unknown> = {};
    if (Object.keys(updates).length > 0) {
      const { data, error } = await db
        .from('accounts')
        .update(updates)
        .eq('id', ctx.accountId)
        .select('name, ai_system_prompt, welcome_message, industry')
        .single();

      if (
        error &&
        !error.message?.includes('column') &&
        !error.message?.includes('schema cache')
      ) {
        console.error('[PATCH /api/account/ai] update error:', error);
        return NextResponse.json(
          { error: 'Failed to update AI configuration: ' + error.message },
          { status: 500 }
        );
      }
      resData = (data as Record<string, unknown>) || {};
    } else {
      // Chatbot-only change — read current account for response fields.
      const { data } = await db
        .from('accounts')
        .select('name, ai_system_prompt, welcome_message, industry')
        .eq('id', ctx.accountId)
        .single();
      resData = (data as Record<string, unknown>) || {};
    }

    return NextResponse.json({
      account_name: (resData?.name as string) || '',
      ai_available: true,
      ai_system_prompt: resolveSystemPrompt(
        resData?.industry as string,
        (resData?.ai_system_prompt as string) ||
          (updates.ai_system_prompt as string)
      ),
      welcome_message:
        (resData?.welcome_message as string) ||
        (updates.welcome_message as string) ||
        '',
      chatbot_enabled: chatbot.enabled,
      response_style: chatbot.responseStyle,
    });
  } catch (err: unknown) {
    console.error('[PATCH /api/account/ai] exception:', err);
    const errorObj = err as Record<string, unknown>;
    return NextResponse.json(
      { error: (err as Error)?.message || 'Failed to update AI configuration' },
      { status: (errorObj?.status as number) || 500 }
    );
  }
}
