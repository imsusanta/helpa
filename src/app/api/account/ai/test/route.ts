import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient } from '@/lib/db/server';
import { decrypt } from '@/lib/whatsapp/encryption';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';
import { getProviderInstance } from '@/core/ai/provider';
import { executeAiPipeline } from '@/core/ai/engine';
import type { AiProviderName } from '@/core/ai/types';

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const db = getAdminClient();

    const limit = await checkRateLimit(
      `admin:ai-test:${ctx.userId}`,
      RATE_LIMITS.adminAction
    );
    if (!limit.success) return rateLimitResponse(limit);

    const body = await request.json().catch(() => null);

    // If a simulated customer message is provided, execute full AI pipeline
    if (body?.message && typeof body.message === 'string') {
      const userMsg = body.message.trim();
      const accountRes = await db
        .from('accounts')
        .select('name, industry, welcome_message, ai_system_prompt')
        .eq('id', ctx.accountId)
        .maybeSingle();

      const industry =
        (accountRes.data?.industry as string) || 'hospital_clinic';
      const result = await executeAiPipeline({
        context: {
          accountId: ctx.accountId,
          userId: ctx.userId,
          conversationId: `sim-${Date.now()}`,
          contactId: `sim-contact-${Date.now()}`,
          industry,
        },
        userMessage: userMsg,
      });

      return NextResponse.json({
        success: true,
        reply: result.replyText,
        latencyMs: 250,
      });
    }

    const providerName: AiProviderName =
      body?.provider === 'orcarouter' ? 'orcarouter' : 'openrouter';

    let api_key =
      providerName === 'orcarouter'
        ? body?.orcarouter_api_key || body?.api_key
        : body?.openrouter_api_key || body?.api_key;

    let model =
      providerName === 'orcarouter'
        ? body?.orcarouter_model || body?.model
        : body?.openrouter_model || body?.model;

    // If key is empty/not provided or is a password placeholder, fetch and decrypt from DB
    if (
      !api_key ||
      typeof api_key !== 'string' ||
      api_key.trim() === '' ||
      api_key.includes('••••')
    ) {
      let account: Record<string, unknown> | null = null;

      let { data: accData, error: accErr } = await db
        .from('accounts')
        .select(
          'openrouter_api_key, openrouter_model, orcarouter_api_key, orcarouter_model'
        )
        .eq('id', ctx.accountId)
        .maybeSingle();

      if (
        accErr &&
        (accErr.message?.includes('column') ||
          accErr.message?.includes('schema cache'))
      ) {
        const fallback = await db
          .from('accounts')
          .select('openrouter_api_key, openrouter_model')
          .eq('id', ctx.accountId)
          .maybeSingle();
        accData = fallback.data as unknown as typeof accData;
        accErr = fallback.error;
      }

      account = accData as Record<string, unknown> | null;

      let dbKey =
        providerName === 'orcarouter'
          ? (account?.orcarouter_api_key as string)
          : (account?.openrouter_api_key as string);

      if (!dbKey) {
        // Fallback to system_settings mirror for tenant-specific key
        const { data: sysRow } = await db
          .from('system_settings')
          .select('value')
          .eq(
            'key',
            `account:${ctx.accountId}:${providerName === 'orcarouter' ? 'orcarouter_api_key' : 'openrouter_api_key'}`
          )
          .maybeSingle();
        if (sysRow?.value) {
          dbKey = sysRow.value;
        }
      }

      if (!dbKey) {
        // Fallback to system-level key in system_settings
        const { data: globalSysRow } = await db
          .from('system_settings')
          .select('value')
          .eq(
            'key',
            providerName === 'orcarouter'
              ? 'system_orcarouter_api_key'
              : 'system_openrouter_api_key'
          )
          .maybeSingle();
        if (globalSysRow?.value) {
          dbKey = globalSysRow.value;
        }
      }

      const envKey =
        providerName === 'orcarouter'
          ? process.env.ORCAROUTER_API_KEY
          : process.env.OPENROUTER_API_KEY;

      if (!dbKey && !envKey) {
        return NextResponse.json(
          {
            error: `${providerName === 'orcarouter' ? 'OrcaRouter' : 'OpenRouter'} API Key is not configured`,
          },
          { status: 400 }
        );
      }

      if (dbKey) {
        try {
          api_key = decrypt(dbKey);
        } catch (err) {
          console.error('[POST /api/account/ai/test] decryption error:', err);
          if (envKey) {
            api_key = envKey;
          } else {
            return NextResponse.json(
              {
                error:
                  'Saved API Key cannot be decrypted. Please re-enter your API key and click Save.',
              },
              { status: 400 }
            );
          }
        }
      } else {
        api_key = envKey;
      }

      if (!model || typeof model !== 'string' || model.trim() === '') {
        const savedModel =
          providerName === 'orcarouter'
            ? (account?.orcarouter_model as string)
            : (account?.openrouter_model as string);

        if (savedModel && savedModel.trim()) {
          model = savedModel.trim();
        } else {
          // Check system_settings for model
          const { data: sysModelRow } = await db
            .from('system_settings')
            .select('value')
            .eq(
              'key',
              `account:${ctx.accountId}:${providerName === 'orcarouter' ? 'orcarouter_model' : 'openrouter_model'}`
            )
            .maybeSingle();

          model =
            sysModelRow?.value ||
            (providerName === 'orcarouter'
              ? 'orcarouter/auto'
              : 'google/gemini-2.5-flash');
        }
      }
    }

    const provider = getProviderInstance(providerName);
    const health = await provider.healthCheck(api_key, model);

    if (health.status === 'healthy') {
      return NextResponse.json({
        success: true,
        provider: providerName,
        message: health.message || 'Connected successfully',
        latencyMs: health.latencyMs,
      });
    }

    return NextResponse.json(
      {
        success: false,
        provider: providerName,
        error: health.message || `${providerName} connection check failed`,
      },
      { status: 400 }
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
