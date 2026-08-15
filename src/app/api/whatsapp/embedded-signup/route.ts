/**
 * src/app/api/whatsapp/embedded-signup/route.ts
 *
 * Handles OAuth callback from Meta WhatsApp Embedded Signup.
 * Exchanges authorization code for a long-lived access token,
 * verifies/subscribes the WABA, fetches phone number info, and persists
 * encrypted configuration to the active account.
 */

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { encrypt } from '@/lib/whatsapp/encryption';
import { subscribeWabaToApp, verifyPhoneNumber } from '@/lib/whatsapp/meta-api';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const accountId = ctx.accountId;

    const rateLimit = checkRateLimit(
      `embedded_signup_${ctx.userId}`,
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

    const { code, waba_id, phone_number_id } = body as {
      code?: string;
      waba_id?: string;
      phone_number_id?: string;
    };

    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      );
    }

    const appId =
      process.env.META_APP_ID ||
      process.env.NEXT_PUBLIC_META_APP_ID ||
      '1461038582135406';
    const appSecret = process.env.META_APP_SECRET;

    if (!appSecret) {
      return NextResponse.json(
        {
          error:
            'META_APP_SECRET is not configured on the server. Please configure it in your environment variables.',
        },
        { status: 500 }
      );
    }

    // 1. Exchange OAuth code for Meta Access Token
    const tokenUrl = new URL(
      'https://graph.facebook.com/v21.0/oauth/access_token'
    );
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('code', code.trim());

    const tokenRes = await fetch(tokenUrl.toString(), { method: 'GET' });
    const tokenData = await tokenRes.json().catch(() => null);

    if (!tokenRes.ok || !tokenData?.access_token) {
      const errorMsg =
        tokenData?.error?.message ||
        'Failed to exchange authorization code for Meta access token.';
      console.error('[Embedded Signup Token Exchange Error]:', tokenData);
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const accessToken = tokenData.access_token as string;

    let resolvedWabaId = typeof waba_id === 'string' ? waba_id.trim() : '';
    let resolvedPhoneId =
      typeof phone_number_id === 'string' ? phone_number_id.trim() : '';

    // 2. If WABA or Phone Number ID were not passed in postMessage, discover them from Graph API
    if (!resolvedWabaId || !resolvedPhoneId) {
      try {
        const debugRes = await fetch(
          `https://graph.facebook.com/v21.0/debug_token?input_token=${accessToken}&access_token=${appId}|${appSecret}`
        );
        const debugData = await debugRes.json().catch(() => null);
        const granularScopes = debugData?.data?.granular_scopes || [];

        for (const scope of granularScopes) {
          if (
            scope.scope === 'whatsapp_business_management' &&
            scope.target_ids
          ) {
            resolvedWabaId = resolvedWabaId || scope.target_ids[0];
          }
        }
      } catch (err) {
        console.warn('[Embedded Signup] Debug token discovery error:', err);
      }
    }

    if (resolvedWabaId && !resolvedPhoneId) {
      try {
        const phoneListRes = await fetch(
          `https://graph.facebook.com/v21.0/${resolvedWabaId}/phone_numbers?access_token=${accessToken}`
        );
        const phoneListData = await phoneListRes.json().catch(() => null);
        if (phoneListData?.data?.[0]?.id) {
          resolvedPhoneId = phoneListData.data[0].id;
        }
      } catch (err) {
        console.warn('[Embedded Signup] Phone discovery error:', err);
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

    // 3. Subscribe WABA to webhooks if WABA ID is known
    if (resolvedWabaId) {
      try {
        await subscribeWabaToApp({
          wabaId: resolvedWabaId,
          accessToken,
        });
      } catch (err) {
        console.warn('[Embedded Signup] Subscribed apps warning:', err);
      }
    }

    // 4. Verify Phone Number details from Meta
    let verifiedName: string | null = null;
    let displayPhoneNumber: string | null = null;
    try {
      const phoneInfo = await verifyPhoneNumber({
        phoneNumberId: resolvedPhoneId,
        accessToken,
      });
      verifiedName = phoneInfo.verified_name || null;
      displayPhoneNumber = phoneInfo.display_phone_number || null;
    } catch (err) {
      console.warn('[Embedded Signup] Phone info fetch warning:', err);
    }

    // 5. Encrypt token and persist configuration to DB
    const encryptedToken = encrypt(accessToken);
    const db = appwriteAdmin();
    const now = new Date().toISOString();

    const configPayload: Record<string, unknown> = {
      account_id: accountId,
      user_id: ctx.userId,
      phone_number_id: resolvedPhoneId,
      waba_id: resolvedWabaId || 'waba_auto',
      access_token: encryptedToken,
      status: 'connected',
      registered_at: now,
      subscribed_apps_at: now,
      connected_at: now,
      updated_at: now,
    };

    // Update existing or create new config record
    let existingId: string | null = null;
    try {
      const { data: existing } = await db
        .from('whatsapp_config')
        .select('id')
        .eq('account_id', accountId)
        .maybeSingle();
      if (existing?.id) existingId = existing.id;
    } catch {
      // Fallback
    }

    if (!existingId) {
      try {
        const { data: existing } = await db
          .from('whatsapp_configs')
          .select('id')
          .eq('account_id', accountId)
          .maybeSingle();
        if (existing?.id) existingId = existing.id;
      } catch {
        // Ignore
      }
    }

    if (existingId) {
      const res = await db
        .from('whatsapp_config')
        .update(configPayload)
        .eq('id', existingId);
      if (res.error) {
        await db
          .from('whatsapp_configs')
          .update(configPayload)
          .eq('id', existingId);
      }
    } else {
      configPayload.created_at = now;
      const res = await db.from('whatsapp_config').insert(configPayload);
      if (res.error) {
        await db.from('whatsapp_configs').insert(configPayload);
      }
    }

    return NextResponse.json({
      success: true,
      connected: true,
      waba_id: resolvedWabaId,
      phone_number_id: resolvedPhoneId,
      display_phone_number: displayPhoneNumber,
      verified_name: verifiedName,
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
