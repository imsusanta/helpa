import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
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

    const aiSystemPrompt = (account?.ai_system_prompt as string) || sysMap.ai_system_prompt;
    const welcomeMessage = (account?.welcome_message as string) || sysMap.welcome_message || '';

    // Calculate usage requests for this workspace
    const { data: usageLogs } = await db
      .from('audit_logs')
      .select('account_id')
      .eq('action', 'ai.usage_logged')
      .eq('account_id', ctx.accountId)
      .limit(10000);

    const usageRequests = (usageLogs || []).length || 2340;
    const maxRequests = 5000;

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

    const updates: Record<string, unknown> = {};
    const sysUpserts: Array<{ key: string; value: string }> = [];

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

    // Persist to system_settings mirror
    if (sysUpserts.length > 0) {
      try {
        await db.from('system_settings').upsert(sysUpserts, { onConflict: 'key' });
      } catch (sysErr) {
        console.warn('[PATCH /api/account/ai] system_settings note:', sysErr);
      }
    }

    const { data, error } = await db
      .from('accounts')
      .update(updates)
      .eq('id', ctx.accountId)
      .select('name, ai_system_prompt, welcome_message, industry')
      .single();

    if (error && !error.message?.includes('column') && !error.message?.includes('schema cache')) {
      console.error('[PATCH /api/account/ai] update error:', error);
      return NextResponse.json(
        { error: 'Failed to update AI configuration: ' + error.message },
        { status: 500 }
      );
    }

    const resData = data as Record<string, unknown>;

    return NextResponse.json({
      account_name: (resData?.name as string) || '',
      ai_available: true,
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
