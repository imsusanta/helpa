import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/automations/admin-client';
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
    const db = supabaseAdmin();

    let account: Record<string, unknown> | null = null;
    let { data, error } = await db
      .from('accounts')
      .select(
        'name, openrouter_model, openrouter_api_key, ai_system_prompt, welcome_message, industry'
      )
      .eq('id', ctx.accountId)
      .single();

    if (error && error.message?.includes('welcome_message')) {
      // Fallback query if welcome_message column is not yet in PostgREST schema cache
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

    return NextResponse.json({
      account_name: (account?.name as string) || '',
      openrouter_model: (account?.openrouter_model as string) || '',
      has_api_key: !!account?.openrouter_api_key,
      ai_system_prompt: resolveSystemPrompt(
        account?.industry as string,
        account?.ai_system_prompt as string
      ),
      welcome_message: (account?.welcome_message as string) || '',
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

    const limit = checkRateLimit(
      `admin:ai-config:${ctx.userId}`,
      RATE_LIMITS.adminAction
    );
    if (!limit.success) return rateLimitResponse(limit);

    const body = await request.json().catch(() => null);
    const openrouter_api_key = body?.openrouter_api_key;
    const openrouter_model = body?.openrouter_model;
    const ai_system_prompt = body?.ai_system_prompt;
    const welcome_message = body?.welcome_message;

    const updates: Record<string, unknown> = {};

    if (typeof openrouter_model === 'string') {
      updates.openrouter_model = openrouter_model.trim();
    }

    if (typeof openrouter_api_key === 'string') {
      const keyTrimmed = openrouter_api_key.trim();
      if (keyTrimmed.length > 0) {
        updates.openrouter_api_key = encrypt(keyTrimmed);
      } else if (openrouter_api_key === '') {
        updates.openrouter_api_key = null;
      }
    }

    if (typeof ai_system_prompt === 'string') {
      updates.ai_system_prompt = ai_system_prompt.trim();
    }

    if (typeof welcome_message === 'string') {
      updates.welcome_message = welcome_message.trim();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided to update' },
        { status: 400 }
      );
    }

    const db = supabaseAdmin();
    let { data, error } = await db
      .from('accounts')
      .update(updates)
      .eq('id', ctx.accountId)
      .select(
        'name, openrouter_model, openrouter_api_key, ai_system_prompt, welcome_message, industry'
      )
      .single();

    // If welcome_message is not in PostgREST schema cache yet, retry without welcome_message
    if (
      error &&
      (error.message?.includes('welcome_message') ||
        error.message?.includes('schema cache'))
    ) {
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
    return NextResponse.json({
      account_name: (resData?.name as string) || '',
      openrouter_model: (resData?.openrouter_model as string) || '',
      has_api_key: !!resData?.openrouter_api_key,
      ai_system_prompt: resolveSystemPrompt(
        resData?.industry as string,
        resData?.ai_system_prompt as string
      ),
      welcome_message: (resData?.welcome_message as string) || '',
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
