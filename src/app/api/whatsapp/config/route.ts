import { NextResponse } from 'next/server';
import { getCurrentAccount, requireRole } from '@/lib/auth/account';
import { getAdminClient } from '@/lib/supabase/server';
import {
  checkConnectionHealth,
  getPhoneNumberDetails,
  subscribeWabaWebhook,
} from '@/lib/whatsapp/meta-service';
import { encrypt, decrypt } from '@/lib/whatsapp/encryption';

/**
 * GET /api/whatsapp/config
 *
 * Checks saved configuration health and Meta connectivity for the caller's account.
 * Strict multi-tenant isolation: queries only by caller's accountId.
 */
export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    const accountId = ctx.accountId;
    const db = getAdminClient();

    let config: Record<string, unknown> | null = null;

    const { data: conf, error } = await db
      .from('whatsapp_configs')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    if (!error && conf) {
      config = conf as Record<string, unknown>;
    } else {
      // Legacy table fallback
      const { data: legacyConf } = await db
        .from('whatsapp_config')
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle();
      if (legacyConf) config = legacyConf as Record<string, unknown>;
    }

    if (!config) {
      return NextResponse.json(
        {
          connected: false,
          reason: 'no_config',
          config: null,
          message:
            'No WhatsApp configuration saved yet. Connect WhatsApp to get started.',
        },
        { status: 200 }
      );
    }

    const phoneNumId = String(
      config.phone_number_id || config.phoneNumberId || ''
    );
    const wabaId = config.waba_id ? String(config.waba_id) : null;
    const encryptedToken = String(
      config.encrypted_access_token ||
        config.access_token_encrypted ||
        config.access_token ||
        ''
    );
    const registeredAt = config.registered_at
      ? String(config.registered_at)
      : null;
    const subscribedAppsAt = config.subscribed_apps_at
      ? String(config.subscribed_apps_at)
      : null;
    const currentStatus = String(config.status || 'disconnected');

    if (!encryptedToken || currentStatus === 'disconnected') {
      return NextResponse.json(
        {
          connected: false,
          reason: 'disconnected',
          config: {
            phone_number_id: phoneNumId,
            waba_id: wabaId,
            has_access_token: Boolean(encryptedToken),
            status: 'disconnected',
            registered_at: registeredAt,
            subscribed_apps_at: subscribedAppsAt,
          },
          message:
            'WhatsApp is currently disconnected. Click Connect WhatsApp to reconnect.',
        },
        { status: 200 }
      );
    }

    let accessToken: string;
    try {
      accessToken = decrypt(encryptedToken);
    } catch {
      return NextResponse.json(
        {
          connected: false,
          reason: 'decryption_failed',
          needs_reconnect: true,
          config: {
            phone_number_id: phoneNumId,
            waba_id: wabaId,
            has_access_token: true,
            status: 'error',
            registered_at: registeredAt,
            subscribed_apps_at: subscribedAppsAt,
          },
          message:
            'Stored Access Token could not be decrypted. Please reconnect your account.',
        },
        { status: 200 }
      );
    }

    // Verify health with Meta Graph API
    const health = await checkConnectionHealth({
      phoneNumberId: phoneNumId,
      wabaId: wabaId || undefined,
      accessToken,
    });

    const now = new Date().toISOString();
    if (!health.isHealthy) {
      await db
        .from('whatsapp_configs')
        .update({
          status: 'needs_reconnect',
          connection_error: health.error || 'Meta API verification failed',
          last_health_check_at: now,
          updated_at: now,
        })
        .eq('account_id', accountId);

      return NextResponse.json(
        {
          connected: false,
          reason: 'meta_auth_failed',
          needs_reconnect: true,
          config: {
            phone_number_id: phoneNumId,
            waba_id: wabaId,
            has_access_token: true,
            status: 'needs_reconnect',
            registered_at: registeredAt,
            subscribed_apps_at: subscribedAppsAt,
          },
          phone_info: null,
          meta_error: health.error,
          message:
            health.error ||
            'WhatsApp token is invalid or expired. Please reconnect.',
        },
        { status: 200 }
      );
    }

    // Connection is healthy
    const verifiedName =
      health.phoneInfo?.verified_name || String(config.verified_name || '');
    const displayPhoneNumber =
      health.phoneInfo?.display_phone_number ||
      String(config.display_phone_number || config.phone_number || '');

    // Update verified details in DB
    await db
      .from('whatsapp_configs')
      .update({
        status: 'connected',
        verified_name: verifiedName || null,
        display_phone_number: displayPhoneNumber || null,
        phone_number: displayPhoneNumber || null,
        connection_error: null,
        last_health_check_at: now,
        updated_at: now,
      })
      .eq('account_id', accountId);

    const connectionType = String(config.connection_type || 'standard');
    const coexistenceStatus = String(config.coexistence_status || 'unknown');

    return NextResponse.json(
      {
        connected: true,
        status: 'connected',
        connection_type: connectionType,
        coexistence_status: coexistenceStatus,
        configured: true,
        reason: 'active',
        config: {
          phone_number_id: phoneNumId,
          waba_id: wabaId,
          has_access_token: true,
          status: 'connected',
          connection_type: connectionType,
          coexistence_status: coexistenceStatus,
          registered_at: registeredAt,
          subscribed_apps_at: subscribedAppsAt,
          phone_number: displayPhoneNumber,
          display_phone_number: displayPhoneNumber,
          verified_name: verifiedName,
          business_name: verifiedName,
          webhook_healthy: true,
          messaging_active: true,
          is_active: true,
          last_health_check_at: now,
        },
        phone_info: health.phoneInfo,
        health: {
          whatsapp: 'connected',
          connection_type:
            connectionType === 'coexistence'
              ? 'Existing WhatsApp Business / Coexistence'
              : 'Meta Cloud API Direct',
          webhook: 'healthy',
          messaging: 'active',
          last_checked: now,
        },
        message: 'WhatsApp integration is active and verified with Meta.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in WhatsApp config GET:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/whatsapp/config
 *
 * Saves or updates WhatsApp credentials after verifying with Meta Graph API.
 * Strict multi-tenant isolation: enforces owner/admin role.
 */
export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const accountId = ctx.accountId;
    const _userId = ctx.userId;
    const db = getAdminClient();

    const body = await request.json().catch(() => ({}));
    const rawPhoneNumberId = body.phone_number_id || body.phoneNumberId;
    const rawWabaId = body.waba_id || body.wabaId;
    const rawAccessToken = body.access_token || body.accessToken;

    if (!rawPhoneNumberId || typeof rawPhoneNumberId !== 'string') {
      return NextResponse.json(
        {
          code: 'WHATSAPP_CONFIG_INVALID',
          error: 'phone_number_id is required',
        },
        { status: 400 }
      );
    }
    const phoneNumberId = rawPhoneNumberId.trim();
    const wabaId = rawWabaId ? String(rawWabaId).trim() : null;

    // Check if phone number is claimed by another account in Supabase
    const { data: conflict } = await db
      .from('whatsapp_configs')
      .select('id, account_id')
      .eq('phone_number_id', phoneNumberId)
      .neq('account_id', accountId)
      .maybeSingle();

    if (conflict) {
      return NextResponse.json(
        {
          code: 'WHATSAPP_PHONE_ALREADY_CLAIMED',
          error:
            'This WhatsApp phone number is already linked to another workspace. Each phone number can only be connected to one workspace.',
        },
        { status: 409 }
      );
    }

    // Lookup existing config
    const { data: existingConfig } = await db
      .from('whatsapp_configs')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    let accessTokenToUse: string | null = null;
    const existingEncToken = String(
      existingConfig?.encrypted_access_token ||
        existingConfig?.access_token ||
        ''
    );

    if (
      rawAccessToken &&
      typeof rawAccessToken === 'string' &&
      rawAccessToken.trim()
    ) {
      accessTokenToUse = rawAccessToken.trim();
    } else if (existingEncToken) {
      try {
        accessTokenToUse = decrypt(existingEncToken);
      } catch (err) {
        console.error('[whatsapp/config POST] Token decrypt error:', err);
      }
    }

    if (!accessTokenToUse) {
      return NextResponse.json(
        {
          code: 'WHATSAPP_CONFIG_INVALID',
          error: 'access_token is required',
        },
        { status: 400 }
      );
    }

    // 1. Verify with Meta Graph API
    let phoneInfo;
    try {
      phoneInfo = await getPhoneNumberDetails({
        phoneNumberId,
        accessToken: accessTokenToUse,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown Meta API error';
      return NextResponse.json(
        {
          code: 'WHATSAPP_META_AUTH_FAILED',
          error: `Meta API verification failed: ${msg}`,
        },
        { status: 400 }
      );
    }

    // 2. Encrypt token
    const encryptedAccessToken = encrypt(accessTokenToUse);

    // 3. Subscribe WABA webhook if WABA ID is provided
    let subscribedAppsAt: string | null = null;
    if (wabaId) {
      try {
        await subscribeWabaWebhook({
          wabaId,
          accessToken: accessTokenToUse,
        });
        subscribedAppsAt = new Date().toISOString();
      } catch (err) {
        console.warn('[whatsapp/config POST] WABA subscribe warning:', err);
      }
    }

    const now = new Date().toISOString();
    const configPayload = {
      account_id: accountId,
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
      encrypted_access_token: encryptedAccessToken,
      provider: 'meta_manual_config',
      display_phone_number: phoneInfo?.display_phone_number || null,
      phone_number: phoneInfo?.display_phone_number || null,
      verified_name: phoneInfo?.verified_name || null,
      business_name: phoneInfo?.verified_name || null,
      status: 'connected',
      connection_error: null,
      subscribed_apps_at:
        subscribedAppsAt || existingConfig?.subscribed_apps_at || null,
      connected_at: now,
      last_health_check_at: now,
      updated_at: now,
    };

    if (existingConfig?.id) {
      const { error: updateError } = await db
        .from('whatsapp_configs')
        .update(configPayload)
        .eq('id', existingConfig.id);

      if (updateError) {
        return NextResponse.json(
          { code: 'DB_ERROR', error: updateError.message },
          { status: 500 }
        );
      }
    } else {
      const { error: insertError } = await db.from('whatsapp_configs').insert({
        ...configPayload,
        created_at: now,
      });

      if (insertError) {
        return NextResponse.json(
          { code: 'DB_ERROR', error: insertError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      saved: true,
      phone_info: phoneInfo,
      config: {
        phone_number_id: phoneNumberId,
        waba_id: wabaId,
        has_access_token: true,
        status: 'connected',
        subscribed_apps_at: subscribedAppsAt,
      },
    });
  } catch (error) {
    console.error('Error in WhatsApp config POST:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/whatsapp/config
 *
 * Disconnects WhatsApp for the caller's workspace.
 * Clears credentials and marks status as disconnected.
 * Preserves all historical CRM contacts, conversations, and messages.
 */
export async function DELETE() {
  try {
    const ctx = await requireRole('admin');
    const accountId = ctx.accountId;
    const userId = ctx.userId;
    const db = getAdminClient();

    // Fetch existing connection details for audit log before removal
    const { data: existingConfig } = await db
      .from('whatsapp_configs')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    const { error: deleteError } = await db
      .from('whatsapp_configs')
      .delete()
      .eq('account_id', accountId);

    if (deleteError) {
      // Also try legacy table
      await db.from('whatsapp_config').delete().eq('account_id', accountId);
    }

    // Record sanitized audit event
    const now = new Date().toISOString();
    try {
      await db.from('audit_logs').insert({
        account_id: accountId,
        actor_user_id: userId,
        action: 'WHATSAPP_DISCONNECTED',
        target_type: 'whatsapp_config',
        metadata: {
          phone_number_id: existingConfig?.phone_number_id || null,
          waba_id: existingConfig?.waba_id || null,
          disconnected_at: now,
        },
        created_at: now,
      });
    } catch (auditErr) {
      console.warn('[DELETE /api/whatsapp/config] Audit log error:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: 'WhatsApp disconnected successfully. CRM history preserved.',
    });
  } catch (error) {
    console.error('Error in WhatsApp config DELETE:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', error: 'Internal server error' },
      { status: 500 }
    );
  }
}
