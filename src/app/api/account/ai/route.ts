import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { encrypt } from '@/lib/whatsapp/encryption';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';
import { resolveSystemPrompt } from '@/modules/registry';

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
    let { data, error } = await db
      .from('accounts')
      .select(
        'name, ai_provider, ai_fallback_provider, openrouter_model, openrouter_api_key, orcarouter_model, orcarouter_api_key, ai_system_prompt, welcome_message, industry'
      )
      .eq('id', ctx.accountId)
      .single();

    if (error && (error.message?.includes('ai_provider') || error.message?.includes('welcome_message') || error.message?.includes('column'))) {
      // Fallback query if columns are not yet in Appwrite/Postgres schema cache
      const fallback = await db
        .from('accounts')
        .select(
          'name, openrouter_model, openrouter_api_key, ai_system_prompt, industry'
        )
        .eq('id', ctx.accountId)
        .single();
      data = fallback.data as unknown as typeof data;
      error = fallback.error;
    }

    if (error) {
      console.error('[GET /api/account/ai] fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch AI configuration: ' + error.message },
        { status: 500 }
      );
    }

    account = data as Record<string, unknown>;

    // Fetch system_settings mirror for guaranteed persistence
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

    const openrouterApiKey = (account?.openrouter_api_key as string) || sysMap.openrouter_api_key;
    const orcarouterApiKey = (account?.orcarouter_api_key as string) || sysMap.orcarouter_api_key;
    const primaryProvider = (account?.ai_provider as string) || sysMap.ai_provider || 'openrouter';
    const fallbackProvider = (account?.ai_fallback_provider as string) || sysMap.ai_fallback_provider || 'none';
    const openrouterModel = (account?.openrouter_model as string) || sysMap.openrouter_model || 'google/gemini-2.5-flash';
    const orcarouterModel = (account?.orcarouter_model as string) || sysMap.orcarouter_model || 'orcarouter/auto';
    const aiSystemPrompt = (account?.ai_system_prompt as string) || sysMap.ai_system_prompt;
    const welcomeMessage = (account?.welcome_message as string) || sysMap.welcome_message || '';

    const hasOpenRouterKey = !!openrouterApiKey || !!process.env.OPENROUTER_API_KEY;
    const hasOrcaRouterKey = !!orcarouterApiKey || !!process.env.ORCAROUTER_API_KEY;

    return NextResponse.json({
      account_name: (account?.name as string) || '',
      ai_provider: primaryProvider,
      ai_fallback_provider: fallbackProvider,
      openrouter_model: openrouterModel,
      orcarouter_model: orcarouterModel,
      has_openrouter_key: hasOpenRouterKey,
      has_orcarouter_key: hasOrcaRouterKey,
      has_api_key: primaryProvider === 'orcarouter' ? hasOrcaRouterKey : hasOpenRouterKey,
      ai_system_prompt: resolveSystemPrompt(
        account?.industry as string,
        aiSystemPrompt
      ),
      welcome_message: welcomeMessage,
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
    const ai_provider = body?.ai_provider;
    const ai_fallback_provider = body?.ai_fallback_provider;
    const openrouter_api_key = body?.openrouter_api_key;
    const openrouter_model = body?.openrouter_model;
    const orcarouter_api_key = body?.orcarouter_api_key;
    const orcarouter_model = body?.orcarouter_model;
    const ai_system_prompt = body?.ai_system_prompt;
    const welcome_message = body?.welcome_message;

    const updates: Record<string, unknown> = {};
    const sysUpserts: Array<{ key: string; value: string }> = [];

    if (typeof ai_provider === 'string' && ['openrouter', 'orcarouter'].includes(ai_provider)) {
      updates.ai_provider = ai_provider;
      sysUpserts.push({ key: `account:${ctx.accountId}:ai_provider`, value: ai_provider });
    }

    if (typeof ai_fallback_provider === 'string' && ['openrouter', 'orcarouter', 'none'].includes(ai_fallback_provider)) {
      updates.ai_fallback_provider = ai_fallback_provider;
      sysUpserts.push({ key: `account:${ctx.accountId}:ai_fallback_provider`, value: ai_fallback_provider });
    }

    if (typeof openrouter_model === 'string') {
      const val = openrouter_model.trim();
      updates.openrouter_model = val;
      sysUpserts.push({ key: `account:${ctx.accountId}:openrouter_model`, value: val });
    }

    if (typeof orcarouter_model === 'string') {
      const val = orcarouter_model.trim();
      updates.orcarouter_model = val;
      sysUpserts.push({ key: `account:${ctx.accountId}:orcarouter_model`, value: val });
    }

    if (typeof openrouter_api_key === 'string') {
      const keyTrimmed = openrouter_api_key.trim();
      if (keyTrimmed.length > 0) {
        const encrypted = encrypt(keyTrimmed);
        updates.openrouter_api_key = encrypted;
        sysUpserts.push({ key: `account:${ctx.accountId}:openrouter_api_key`, value: encrypted });
      } else if (openrouter_api_key === '') {
        updates.openrouter_api_key = null;
        await db.from('system_settings').delete().eq('key', `account:${ctx.accountId}:openrouter_api_key`).catch(() => {});
      }
    }

    if (typeof orcarouter_api_key === 'string') {
      const keyTrimmed = orcarouter_api_key.trim();
      if (keyTrimmed.length > 0) {
        const encrypted = encrypt(keyTrimmed);
        updates.orcarouter_api_key = encrypted;
        sysUpserts.push({ key: `account:${ctx.accountId}:orcarouter_api_key`, value: encrypted });
      } else if (orcarouter_api_key === '') {
        updates.orcarouter_api_key = null;
        await db.from('system_settings').delete().eq('key', `account:${ctx.accountId}:orcarouter_api_key`).catch(() => {});
      }
    }

    if (typeof ai_system_prompt === 'string') {
      const val = ai_system_prompt.trim();
      updates.ai_system_prompt = val;
      sysUpserts.push({ key: `account:${ctx.accountId}:ai_system_prompt`, value: val });
    }

    if (typeof welcome_message === 'string') {
      const val = welcome_message.trim();
      updates.welcome_message = val;
      sysUpserts.push({ key: `account:${ctx.accountId}:welcome_message`, value: val });
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided to update' },
        { status: 400 }
      );
    }

    // Persist to system_settings mirror first to guarantee storage
    if (sysUpserts.length > 0) {
      try {
        await db.from('system_settings').upsert(sysUpserts, { onConflict: 'key' });
      } catch (sysErr) {
        console.warn('[PATCH /api/account/ai] system_settings upsert note:', sysErr);
      }
    }

    let { data, error } = await db
      .from('accounts')
      .update(updates)
      .eq('id', ctx.accountId)
      .select(
        'name, ai_provider, ai_fallback_provider, openrouter_model, openrouter_api_key, orcarouter_model, orcarouter_api_key, ai_system_prompt, welcome_message, industry'
      )
      .single();

    // If new columns are not in Appwrite schema cache yet, remove them and retry safely
    if (
      error &&
      (error.message?.includes('schema cache') || error.message?.includes('column'))
    ) {
      delete updates.ai_provider;
      delete updates.ai_fallback_provider;
      delete updates.orcarouter_model;
      delete updates.orcarouter_api_key;
      delete updates.welcome_message;

      if (Object.keys(updates).length > 0) {
        const retry = await db
          .from('accounts')
          .update(updates)
          .eq('id', ctx.accountId)
          .select(
            'name, openrouter_model, openrouter_api_key, ai_system_prompt, industry'
          )
          .single();
        data = retry.data as unknown as typeof data;
        error = retry.error;
      } else {
        error = null;
      }
    }

    if (error) {
      console.error('[PATCH /api/account/ai] update error:', error);
      return NextResponse.json(
        { error: 'Failed to update AI configuration: ' + error.message },
        { status: 500 }
      );
    }

    const resData = data as Record<string, unknown>;
    const hasOpenRouterKey =
      !!resData?.openrouter_api_key ||
      !!updates.openrouter_api_key ||
      !!sysUpserts.find((u) => u.key.endsWith(':openrouter_api_key')) ||
      !!process.env.OPENROUTER_API_KEY;

    const hasOrcaRouterKey =
      !!resData?.orcarouter_api_key ||
      !!updates.orcarouter_api_key ||
      !!sysUpserts.find((u) => u.key.endsWith(':orcarouter_api_key')) ||
      !!process.env.ORCAROUTER_API_KEY;

    const primary =
      (resData?.ai_provider as string) ||
      (updates.ai_provider as string) ||
      'openrouter';

    return NextResponse.json({
      account_name: (resData?.name as string) || '',
      ai_provider: primary,
      ai_fallback_provider: (resData?.ai_fallback_provider as string) || (updates.ai_fallback_provider as string) || 'none',
      openrouter_model: (resData?.openrouter_model as string) || (updates.openrouter_model as string) || 'google/gemini-2.5-flash',
      orcarouter_model: (resData?.orcarouter_model as string) || (updates.orcarouter_model as string) || 'orcarouter/auto',
      has_openrouter_key: hasOpenRouterKey,
      has_orcarouter_key: hasOrcaRouterKey,
      has_api_key: primary === 'orcarouter' ? hasOrcaRouterKey : hasOpenRouterKey,
      ai_system_prompt: resolveSystemPrompt(
        resData?.industry as string,
        (resData?.ai_system_prompt as string) || (updates.ai_system_prompt as string)
      ),
      welcome_message: (resData?.welcome_message as string) || (updates.welcome_message as string) || '',
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
