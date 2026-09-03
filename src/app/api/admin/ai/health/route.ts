import { NextResponse } from 'next/server';
import { checkSuperAdmin } from '@/lib/auth/admin';
import { getAdminClient } from '@/lib/db/server';
import { decrypt } from '@/lib/whatsapp/encryption';
import { getProviderInstance, CloudflareAiProvider } from '@/core/ai/provider';
import type { AiProviderName } from '@/core/ai/types';

async function resolveAdminProviderCredentials(providerName: AiProviderName) {
  const db = getAdminClient();
  const { data: sysSettings } = await db
    .from('system_settings')
    .select('key, value');

  const settingsMap: Record<string, string> = {};
  sysSettings?.forEach((row: Record<string, unknown>) => {
    if (typeof row.key === 'string' && typeof row.value === 'string') {
      settingsMap[row.key] = row.value;
    }
  });

  let apiKey: string | undefined = undefined;
  let accountId: string | undefined = undefined;
  let model: string = 'google/gemini-2.5-flash';

  if (providerName === 'orcarouter') {
    apiKey = process.env.ORCAROUTER_API_KEY;
    if (settingsMap.system_orcarouter_api_key) {
      try {
        apiKey = decrypt(settingsMap.system_orcarouter_api_key);
      } catch {
        // Fallback to env
      }
    }
    model = settingsMap.system_orcarouter_model || 'orcarouter/auto';
  } else if (providerName === 'cloudflare') {
    apiKey = process.env.CLOUDFLARE_API_TOKEN;
    accountId =
      settingsMap.system_cloudflare_account_id ||
      process.env.CLOUDFLARE_ACCOUNT_ID;
    if (settingsMap.system_cloudflare_api_token) {
      try {
        apiKey = decrypt(settingsMap.system_cloudflare_api_token);
      } catch {
        // Fallback to env
      }
    }
    model =
      settingsMap.system_cloudflare_model || '@cf/meta/llama-3.1-8b-instruct';
  } else {
    apiKey = process.env.OPENROUTER_API_KEY;
    if (settingsMap.system_openrouter_api_key) {
      try {
        apiKey = decrypt(settingsMap.system_openrouter_api_key);
      } catch {
        // Fallback to env
      }
    }
    model = settingsMap.system_openrouter_model || 'google/gemini-2.5-flash';
  }

  return { apiKey, accountId, model };
}

export async function GET() {
  try {
    const isSuper = await checkSuperAdmin();
    if (!isSuper) {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    const [openCreds, orcaCreds, cfCreds] = await Promise.all([
      resolveAdminProviderCredentials('openrouter'),
      resolveAdminProviderCredentials('orcarouter'),
      resolveAdminProviderCredentials('cloudflare'),
    ]);

    const openRouter = getProviderInstance('openrouter');
    const orcaRouter = getProviderInstance('orcarouter');
    const cloudflareProvider = getProviderInstance(
      'cloudflare'
    ) as CloudflareAiProvider;

    const [openHealth, orcaHealth, cfHealth] = await Promise.all([
      openRouter.healthCheck(openCreds.apiKey, openCreds.model),
      orcaRouter.healthCheck(orcaCreds.apiKey, orcaCreds.model),
      cloudflareProvider.healthCheck(
        cfCreds.apiKey,
        cfCreds.model,
        cfCreds.accountId
      ),
    ]);

    return NextResponse.json({
      openrouter: openHealth,
      orcarouter: orcaHealth,
      cloudflare: cfHealth,
      checkedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error('[GET /api/admin/ai/health] error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const isSuper = await checkSuperAdmin();
    if (!isSuper) {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawProvider = String(body.provider || 'openrouter').toLowerCase();
    const providerName: AiProviderName =
      rawProvider === 'orcarouter'
        ? 'orcarouter'
        : rawProvider === 'cloudflare'
          ? 'cloudflare'
          : 'openrouter';

    const creds = await resolveAdminProviderCredentials(providerName);
    const testApiKey =
      typeof body.apiKey === 'string' && body.apiKey.trim()
        ? body.apiKey.trim()
        : typeof body.apiToken === 'string' && body.apiToken.trim()
          ? body.apiToken.trim()
          : creds.apiKey;
    const testAccountId =
      typeof body.accountId === 'string' && body.accountId.trim()
        ? body.accountId.trim()
        : creds.accountId;
    const testModel =
      typeof body.model === 'string' && body.model.trim()
        ? body.model.trim()
        : creds.model;

    const provider = getProviderInstance(providerName);
    let health;

    if (providerName === 'cloudflare') {
      health = await (provider as CloudflareAiProvider).healthCheck(
        testApiKey,
        testModel,
        testAccountId
      );
    } else {
      health = await provider.healthCheck(testApiKey, testModel);
    }

    if (health.status === 'healthy') {
      const successMsg =
        providerName === 'cloudflare'
          ? 'Cloudflare AI is connected and ready to use.'
          : health.message || 'Connected and healthy';

      return NextResponse.json({
        success: true,
        provider: providerName,
        message: successMsg,
        latencyMs: health.latencyMs,
        checkedAt: new Date().toISOString(),
      });
    }

    let failMsg = health.message || 'Connection test failed';
    if (failMsg.includes('daily free allocation of 10,000 neurons')) {
      failMsg =
        'Cloudflare Daily Quota Reached: You have used up your free allocation of 10,000 neurons for today. Upgrade to Cloudflare Workers Paid ($5/mo) for unlimited usage, or wait for the daily reset.';
    } else if (
      failMsg.includes('Workers Free plan') ||
      failMsg.includes('Upgrade to access this model')
    ) {
      failMsg =
        'This model requires Cloudflare Workers Paid plan. Please choose a free-tier model (e.g. Llama 3.3 70B Fast, Llama 3.2 3B) or upgrade your Cloudflare plan.';
    }

    return NextResponse.json(
      {
        success: false,
        provider: providerName,
        error: failMsg,
        latencyMs: health.latencyMs,
        checkedAt: new Date().toISOString(),
      },
      { status: 400 }
    );
  } catch (err: unknown) {
    console.error('[POST /api/admin/ai/health] error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
