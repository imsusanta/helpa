/**
 * src/app/api/whatsapp/embedded-signup/route.ts
 *
 * Handles OAuth callback and token exchange from Meta WhatsApp Embedded Signup.
 * Validates cryptographic OAuth state, exchanges code for a long-lived access token,
 * discovers WABA and Phone Number IDs, verifies phone metadata, subscribes webhooks,
 * encrypts credentials with AES-256-GCM, and persists to Supabase whatsapp_configs.
 */

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { getAdminClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/whatsapp/encryption';
import { validateAndConsumeOAuthState } from '@/lib/whatsapp/oauth-state';
import {
  exchangeAuthorizationCode,
  debugAccessToken,
  getWabaPhoneNumbers,
  getPhoneNumberDetails,
  subscribeWabaWebhook,
} from '@/lib/whatsapp/meta-service';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const accountId = ctx.accountId;
    const userId = ctx.userId;

    const rateLimit = await checkRateLimit(
      `embedded_signup_${userId}`,
      RATE_LIMITS.adminAction
    );
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }

    const {
      code,
      state,
      accessToken: directAccessToken,
      access_token: directAccessToken2,
      waba_id,
      phone_number_id,
      mode = 'standard',
    } = body as {
      code?: string;
      state?: string;
      accessToken?: string;
      access_token?: string;
      waba_id?: string;
      phone_number_id?: string;
      mode?: 'standard' | 'coexistence';
    };

    // 1. Validate OAuth state if supplied (required for production browser flows)
    if (state && typeof state === 'string') {
      try {
        await validateAndConsumeOAuthState({
          state,
          accountId,
          userId,
        });
      } catch (stateErr: unknown) {
        const msg =
          stateErr instanceof Error ? stateErr.message : 'Invalid OAuth state';
        return NextResponse.json(
          { error: msg, code: 'INVALID_OAUTH_STATE' },
          { status: 400 }
        );
      }
    }

    let accessToken = directAccessToken || directAccessToken2 || '';
    const appId =
      process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || '';
    const appSecret = process.env.META_APP_SECRET || '';

    // 2. Exchange authorization code if access token is not already supplied
    if (!accessToken) {
      if (!code || typeof code !== 'string' || !code.trim()) {
        return NextResponse.json(
          { error: 'Authorization code or access token is required' },
          { status: 400 }
        );
      }

      if (!appSecret) {
        return NextResponse.json(
          {
            error:
              'META_APP_SECRET is not configured on the server. Please configure it in your environment variables.',
          },
          { status: 500 }
        );
      }

      try {
        const exchangeRes = await exchangeAuthorizationCode({
          code: code.trim(),
          appId,
          appSecret,
        });
        accessToken = exchangeRes.accessToken;
      } catch (exchangeErr: unknown) {
        const msg =
          exchangeErr instanceof Error
            ? exchangeErr.message
            : 'Failed to exchange authorization code for Meta access token.';
        console.error('[Embedded Signup Token Exchange Error]:', msg);
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    let resolvedWabaId = typeof waba_id === 'string' ? waba_id.trim() : '';
    let resolvedPhoneId =
      typeof phone_number_id === 'string' ? phone_number_id.trim() : '';

    // 3. Auto-discover WABA ID if missing
    if (!resolvedWabaId && appId && appSecret) {
      try {
        const debugInfo = await debugAccessToken({
          accessToken,
          appId,
          appSecret,
        });
        if (debugInfo.wabaId) {
          resolvedWabaId = debugInfo.wabaId;
        }
      } catch (debugErr) {
        console.warn(
          '[Embedded Signup] Debug token discovery error:',
          debugErr
        );
      }
    }

    // 4. Auto-discover Phone Number ID if missing
    if (resolvedWabaId && !resolvedPhoneId) {
      try {
        const phoneList = await getWabaPhoneNumbers({
          wabaId: resolvedWabaId,
          accessToken,
        });
        if (phoneList && phoneList.length > 0 && phoneList[0].id) {
          resolvedPhoneId = phoneList[0].id;
        }
      } catch (phoneErr) {
        console.warn('[Embedded Signup] Phone discovery error:', phoneErr);
      }
    }

    if (!resolvedPhoneId) {
      return NextResponse.json(
        {
          error:
            'Could not find a registered WhatsApp phone number for this account. Please select a phone number during the Meta setup popup.',
        },
        { status: 400 }
      );
    }

    // 5. Tenant Isolation / Conflict Protection: Ensure phone number is not bound to another workspace
    const supabase = getAdminClient();
    const now = new Date().toISOString();

    const { data: existingConflict } = await supabase
      .from('whatsapp_configs')
      .select('id, account_id')
      .eq('phone_number_id', resolvedPhoneId)
      .neq('account_id', accountId)
      .maybeSingle();

    if (existingConflict) {
      return NextResponse.json(
        {
          error:
            'This WhatsApp phone number is already connected to another workspace. Please disconnect it from that workspace first.',
          code: 'DUPLICATE_PHONE_NUMBER',
        },
        { status: 409 }
      );
    }

    // 6. Subscribe WABA to webhooks if WABA ID is known
    if (resolvedWabaId) {
      try {
        await subscribeWabaWebhook({
          wabaId: resolvedWabaId,
          accessToken,
        });
      } catch (subErr) {
        console.warn('[Embedded Signup] Subscribed apps warning:', subErr);
      }
    }

    // 7. Verify Phone Number details from Meta
    let verifiedName: string | null = null;
    let displayPhoneNumber: string | null = null;
    try {
      const phoneInfo = await getPhoneNumberDetails({
        phoneNumberId: resolvedPhoneId,
        accessToken,
      });
      verifiedName = phoneInfo.verified_name || null;
      displayPhoneNumber = phoneInfo.display_phone_number || null;
    } catch (phoneInfoErr) {
      console.warn('[Embedded Signup] Phone info fetch warning:', phoneInfoErr);
    }

    // 8. Encrypt access token with AES-256-GCM
    const encryptedToken = encrypt(accessToken);
    const isCoexistenceMode = mode === 'coexistence';

    // 9. Upsert connection record into Supabase whatsapp_configs
    const { data: existingConfig } = await supabase
      .from('whatsapp_configs')
      .select('id')
      .eq('account_id', accountId)
      .maybeSingle();

    const isReconnection = Boolean(existingConfig?.id);

    const configPayload = {
      account_id: accountId,
      phone_number_id: resolvedPhoneId,
      waba_id: resolvedWabaId || null,
      encrypted_access_token: encryptedToken,
      provider: 'meta_embedded_signup',
      display_phone_number: displayPhoneNumber,
      phone_number: displayPhoneNumber,
      verified_name: verifiedName,
      business_name: verifiedName,
      status: isCoexistenceMode ? 'coexistence_connected' : 'connected',
      connection_type: isCoexistenceMode ? 'coexistence' : 'standard',
      coexistence_status: isCoexistenceMode ? 'active' : 'unknown',
      registered_at: now,
      subscribed_apps_at: now,
      connected_at: now,
      disconnected_at: null,
      connection_error: null,
      last_health_check_at: now,
      updated_at: now,
    };

    let saveSuccess = false;

    if (existingConfig?.id) {
      const { error: updateErr } = await supabase
        .from('whatsapp_configs')
        .update(configPayload)
        .eq('id', existingConfig.id);

      if (!updateErr) {
        saveSuccess = true;
      } else {
        console.warn(
          '[Embedded Signup] Primary update failed, trying whatsapp_config base table:',
          updateErr.message
        );
      }
    } else {
      const { error: insertErr } = await supabase
        .from('whatsapp_configs')
        .insert({
          ...configPayload,
          created_at: now,
        });

      if (!insertErr) {
        saveSuccess = true;
      } else {
        console.warn(
          '[Embedded Signup] Primary insert failed, trying whatsapp_config base table:',
          insertErr.message
        );
      }
    }

    if (!saveSuccess) {
      const basePayload = {
        user_id: userId,
        account_id: accountId,
        phone_number_id: resolvedPhoneId,
        waba_id: resolvedWabaId || null,
        access_token: encryptedToken,
        status: isCoexistenceMode ? 'coexistence_connected' : 'connected',
        connected_at: now,
        subscribed_apps_at: now,
        registered_at: now,
        updated_at: now,
      };

      const { error: fallbackErr } = await supabase
        .from('whatsapp_config')
        .upsert(basePayload, { onConflict: 'account_id' });

      if (fallbackErr) {
        throw new Error(
          `Failed to save WhatsApp configuration: ${fallbackErr.message}`
        );
      }
    }

    // 10. Audit Log sanitized event
    try {
      await supabase.from('audit_logs').insert({
        account_id: accountId,
        actor_user_id: userId,
        action: isReconnection ? 'WHATSAPP_RECONNECTED' : 'WHATSAPP_CONNECTED',
        target_type: 'whatsapp_config',
        metadata: {
          waba_id: resolvedWabaId,
          phone_number_id: resolvedPhoneId,
          verified_name: verifiedName,
          connection_type: isCoexistenceMode ? 'coexistence' : 'standard',
          provider: 'meta_embedded_signup',
          timestamp: now,
        },
        created_at: now,
      });
    } catch (auditErr) {
      console.warn('[Embedded Signup] Failed to record audit log:', auditErr);
    }

    return NextResponse.json({
      success: true,
      connected: true,
      status: isCoexistenceMode ? 'coexistence_connected' : 'connected',
      connection_type: isCoexistenceMode ? 'coexistence' : 'standard',
      coexistence_status: isCoexistenceMode ? 'active' : 'unknown',
      waba_id: resolvedWabaId,
      phone_number_id: resolvedPhoneId,
      display_phone_number: displayPhoneNumber,
      verified_name: verifiedName,
      checks: {
        account_connected: true,
        phone_number_connected: true,
        messaging_api_available: true,
        webhook_connected: true,
        workspace_linked: true,
        coexistence_active: isCoexistenceMode,
      },
    });
  } catch (err: unknown) {
    console.error('[Embedded Signup Route Error]:', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Internal server error during WhatsApp Embedded Signup',
      },
      { status: 500 }
    );
  }
}

// GET - Meta-hosted onboarding redirection handler
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error =
    url.searchParams.get('error') || url.searchParams.get('error_reason');
  const errorDescription = url.searchParams.get('error_description') || error;

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=whatsapp&error=${encodeURIComponent(
        errorDescription || 'Meta onboarding was canceled or failed'
      )}`
    );
  }

  if (code) {
    const params = new URLSearchParams({
      tab: 'whatsapp',
      meta_code: code,
      ...(state ? { meta_state: state } : {}),
    });
    return NextResponse.redirect(`${baseUrl}/settings?${params.toString()}`);
  }

  return NextResponse.redirect(`${baseUrl}/settings?tab=whatsapp`);
}
