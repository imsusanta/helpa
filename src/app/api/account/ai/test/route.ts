import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { decrypt } from '@/lib/whatsapp/encryption';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';
import { getProviderInstance } from '@/core/ai/provider';
import type { AiProviderName } from '@/core/ai/types';

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');

    const limit = checkRateLimit(
      `admin:ai-test:${ctx.userId}`,
      RATE_LIMITS.adminAction
    );
    if (!limit.success) return rateLimitResponse(limit);

    const body = await request.json().catch(() => null);
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
    if (!api_key || api_key.trim() === '' || api_key.includes('••••')) {
      const { data: account, error } = await ctx.appwrite
        .from('accounts')
        .select('openrouter_api_key, openrouter_model, orcarouter_api_key, orcarouter_model')
        .eq('id', ctx.accountId)
        .single();

      if (error) {
        console.error('[POST /api/account/ai/test] db fetch error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch saved API credentials' },
          { status: 500 }
        );
      }

      const dbKey =
        providerName === 'orcarouter'
          ? account?.orcarouter_api_key
          : account?.openrouter_api_key;

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

      if (!model || model.trim() === '') {
        model =
          providerName === 'orcarouter'
            ? account?.orcarouter_model || 'orcarouter/auto'
            : account?.openrouter_model || 'google/gemini-2.5-flash';
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
