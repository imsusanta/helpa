import { NextResponse } from 'next/server';
import { checkSuperAdmin } from '@/lib/auth/admin';
import { getCurrentAccount } from '@/lib/auth/account';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { encrypt } from '@/lib/whatsapp/encryption';
import { validateAiModelId } from '@/core/ai/validation';

export async function GET() {
  try {
    const isSuper = await checkSuperAdmin();
    if (!isSuper) {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    const db = appwriteAdmin();
    const { data, error } = await db
      .from('system_settings')
      .select('key, value');

    if (error) throw error;

    // Convert list to key-value object
    const settings: Record<string, unknown> = {};
    data?.forEach((row: Record<string, unknown>) => {
      if (typeof row.key === 'string') {
        if (row.key.includes('api_key')) {
          // Never return raw secret keys in responses
          settings[`has_${row.key}`] = !!row.value;
        } else {
          settings[row.key] = row.value;
        }
      }
    });

    // Default provider values if not set
    if (!settings.system_ai_provider)
      settings.system_ai_provider = 'openrouter';
    if (!settings.system_ai_fallback_provider)
      settings.system_ai_fallback_provider = 'none';
    if (!settings.system_openrouter_model)
      settings.system_openrouter_model = 'google/gemini-2.5-flash';
    if (!settings.system_orcarouter_model)
      settings.system_orcarouter_model = 'orcarouter/auto';
    if (settings.system_openrouter_enabled === undefined)
      settings.system_openrouter_enabled = 'true';
    if (settings.system_orcarouter_enabled === undefined)
      settings.system_orcarouter_enabled = 'true';

    // Environment fallback visibility flags
    if (
      settings.has_system_openrouter_api_key === undefined ||
      settings.has_system_openrouter_api_key === false
    ) {
      settings.has_system_openrouter_api_key = !!process.env.OPENROUTER_API_KEY;
    }
    if (
      settings.has_system_orcarouter_api_key === undefined ||
      settings.has_system_orcarouter_api_key === false
    ) {
      settings.has_system_orcarouter_api_key = !!process.env.ORCAROUTER_API_KEY;
    }

    return NextResponse.json(settings);
  } catch (err: unknown) {
    console.error('[GET /api/admin/settings] error:', err);
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

    const ctx = await getCurrentAccount().catch(() => null);
    const body = await req.json();
    const {
      landing_hero_video_url,
      landing_action_video_url,
      system_openrouter_api_key,
      system_orcarouter_api_key,
      system_ai_provider,
      system_ai_fallback_provider,
      system_openrouter_model,
      system_orcarouter_model,
      system_openrouter_enabled,
      system_orcarouter_enabled,
      available_models,
      system_feature_routing,
    } = body;

    const db = appwriteAdmin();
    const upserts: Array<{ key: string; value: string }> = [];
    const auditActions: string[] = [];

    if (typeof landing_hero_video_url === 'string') {
      upserts.push({
        key: 'landing_hero_video_url',
        value: landing_hero_video_url,
      });
    }
    if (typeof landing_action_video_url === 'string') {
      upserts.push({
        key: 'landing_action_video_url',
        value: landing_action_video_url,
      });
    }

    if (
      typeof system_ai_provider === 'string' &&
      ['openrouter', 'orcarouter'].includes(system_ai_provider)
    ) {
      upserts.push({ key: 'system_ai_provider', value: system_ai_provider });
      auditActions.push('AI_PRIMARY_PROVIDER_CHANGED');
    }

    if (
      typeof system_ai_fallback_provider === 'string' &&
      ['openrouter', 'orcarouter', 'none'].includes(system_ai_fallback_provider)
    ) {
      upserts.push({
        key: 'system_ai_fallback_provider',
        value: system_ai_fallback_provider,
      });
      auditActions.push('AI_FALLBACK_PROVIDER_CHANGED');
    }

    if (
      typeof system_openrouter_model === 'string' &&
      system_openrouter_model.trim()
    ) {
      const val = validateAiModelId(system_openrouter_model, 'openrouter');
      if (!val.valid) {
        return NextResponse.json({ error: val.error }, { status: 400 });
      }
      upserts.push({ key: 'system_openrouter_model', value: val.normalizedId });
      auditActions.push('AI_DEFAULT_MODEL_CHANGED');
    }

    if (
      typeof system_orcarouter_model === 'string' &&
      system_orcarouter_model.trim()
    ) {
      const val = validateAiModelId(system_orcarouter_model, 'orcarouter');
      if (!val.valid) {
        return NextResponse.json({ error: val.error }, { status: 400 });
      }
      upserts.push({ key: 'system_orcarouter_model', value: val.normalizedId });
      auditActions.push('AI_DEFAULT_MODEL_CHANGED');
    }

    if (
      typeof system_openrouter_enabled === 'string' ||
      typeof system_openrouter_enabled === 'boolean'
    ) {
      upserts.push({
        key: 'system_openrouter_enabled',
        value: String(system_openrouter_enabled),
      });
      auditActions.push('AI_PROVIDER_STATUS_CHANGED');
    }

    if (
      typeof system_orcarouter_enabled === 'string' ||
      typeof system_orcarouter_enabled === 'boolean'
    ) {
      upserts.push({
        key: 'system_orcarouter_enabled',
        value: String(system_orcarouter_enabled),
      });
      auditActions.push('AI_PROVIDER_STATUS_CHANGED');
    }

    if (available_models !== undefined) {
      const val =
        typeof available_models === 'string'
          ? available_models
          : JSON.stringify(available_models);
      upserts.push({ key: 'available_models', value: val });
      auditActions.push('AI_MODEL_UPDATED');
    }

    if (system_feature_routing !== undefined) {
      const val =
        typeof system_feature_routing === 'string'
          ? system_feature_routing
          : JSON.stringify(system_feature_routing);
      upserts.push({ key: 'system_feature_routing', value: val });
      auditActions.push('AI_FEATURE_ROUTING_UPDATED');
    }

    if (typeof system_openrouter_api_key === 'string') {
      const trimmed = system_openrouter_api_key.trim();
      if (trimmed.length > 0) {
        upserts.push({
          key: 'system_openrouter_api_key',
          value: encrypt(trimmed),
        });
        auditActions.push('AI_API_KEY_UPDATED');
      } else if (system_openrouter_api_key === '') {
        await db
          .from('system_settings')
          .delete()
          .eq('key', 'system_openrouter_api_key')
          .catch(() => {});
        auditActions.push('AI_API_KEY_CLEARED');
      }
    }

    if (typeof system_orcarouter_api_key === 'string') {
      const trimmed = system_orcarouter_api_key.trim();
      if (trimmed.length > 0) {
        upserts.push({
          key: 'system_orcarouter_api_key',
          value: encrypt(trimmed),
        });
        auditActions.push('AI_API_KEY_UPDATED');
      } else if (system_orcarouter_api_key === '') {
        await db
          .from('system_settings')
          .delete()
          .eq('key', 'system_orcarouter_api_key')
          .catch(() => {});
        auditActions.push('AI_API_KEY_CLEARED');
      }
    }

    if (upserts.length > 0) {
      const { error } = await db
        .from('system_settings')
        .upsert(upserts, { onConflict: 'key' });

      if (error) throw error;

      // Log Super Admin Audit Trail (strictly zero secret keys logged)
      if (ctx?.userId) {
        try {
          await db.from('audit_logs').insert({
            account_id: ctx.accountId || 'super-admin',
            actor_id: ctx.userId,
            action: auditActions[0] || 'AI_INFRASTRUCTURE_UPDATED',
            resource_type: 'system_settings',
            resource_id: 'ai_infrastructure',
            metadata: {
              actions: auditActions,
              updated_keys: upserts.map((u) => u.key),
              timestamp: new Date().toISOString(),
            },
          });
        } catch {
          // Non-blocking audit log
        }
      }
    }

    return NextResponse.json({
      success: true,
      updated: upserts.map((u) => u.key),
    });
  } catch (err: unknown) {
    console.error('[POST /api/admin/settings] error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
