import { NextResponse } from 'next/server';
import {
  createClient,
  appwriteAdmin as createAdminClient,
} from '@/lib/appwrite-server-compat';
import { getCurrentAccount } from '@/lib/auth/account';
import {
  registerPhoneNumber,
  subscribeWabaToApp,
  verifyPhoneNumber,
} from '@/lib/whatsapp/meta-api';
import { encrypt, decrypt } from '@/lib/whatsapp/encryption';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';

const CANONICAL_COLLECTION = APPWRITE_CONFIG.collections.whatsappConfigs;

function appwriteAdmin() {
  return createAdminClient();
}

/**
 * GET /api/whatsapp/config
 *
 * Checks saved configuration health and Meta connectivity for caller's account.
 * Queries single config row by accountId (zero full collection scans).
 */
export async function GET() {
  try {
    const appwrite = await createClient();
    const {
      data: { user },
      error: authError,
    } = await appwrite.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { code: 'AUTH_REQUIRED', error: 'Authentication required' },
        { status: 401 }
      );
    }

    let accountId: string | null = null;
    const ctx = await getCurrentAccount().catch(() => null);
    if (ctx?.accountId) {
      accountId = ctx.accountId;
    } else {
      const { data: profile } = await appwrite
        .from('profiles')
        .select('accountId')
        .eq('userId', user.id)
        .maybeSingle()
        .catch(() => ({ data: null }));
      if (profile?.accountId) {
        accountId = String(profile.accountId);
      }
    }

    if (!accountId) {
      return NextResponse.json(
        {
          code: 'ACCOUNT_MEMBERSHIP_REQUIRED',
          error: 'Account membership required',
        },
        { status: 403 }
      );
    }

    const admin = appwriteAdmin();
    let config: Record<string, unknown> | null = null;

    try {
      const { data: conf } = await admin
        .from('whatsapp_config')
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle();
      if (conf) config = conf as Record<string, unknown>;
    } catch {
      // Fallback to canonical collection
    }

    if (!config) {
      try {
        const { data: conf } = await admin
          .from(CANONICAL_COLLECTION)
          .select('*')
          .eq('accountId', accountId)
          .maybeSingle();
        if (conf) config = conf as Record<string, unknown>;
      } catch {
        // Ignored
      }
    }

    if (!config) {
      return NextResponse.json(
        {
          connected: false,
          reason: 'no_config',
          config: null,
          message:
            'No WhatsApp configuration saved yet. Fill in the form and click Save Configuration.',
        },
        { status: 200 }
      );
    }

    const phoneNumId = String(
      config.phone_number_id || config.phoneNumberId || ''
    );
    const wabaId =
      config.waba_id || config.wabaId
        ? String(config.waba_id || config.wabaId)
        : null;
    const encryptedToken = String(
      config.encrypted_access_token ||
        config.encryptedAccessToken ||
        config.access_token ||
        config.accessToken ||
        ''
    );
    const hasVerifyToken = Boolean(
      config.encrypted_verify_token ||
      config.encryptedVerifyToken ||
      config.verify_token ||
      config.verifyToken
    );
    const registeredAt =
      config.registered_at || config.registeredAt
        ? String(config.registered_at || config.registeredAt)
        : null;
    const lastRegistrationError =
      config.last_registration_error || config.lastRegistrationError
        ? String(config.last_registration_error || config.lastRegistrationError)
        : null;
    const subscribedAppsAt =
      config.subscribed_apps_at || config.subscribedAppsAt
        ? String(config.subscribed_apps_at || config.subscribedAppsAt)
        : null;

    if (!encryptedToken) {
      return NextResponse.json(
        {
          connected: false,
          reason: 'missing_access_token',
          config: {
            phone_number_id: phoneNumId,
            waba_id: wabaId,
            has_access_token: false,
            has_verify_token: hasVerifyToken,
            status: 'disconnected',
            registered_at: registeredAt,
            subscribed_apps_at: subscribedAppsAt,
          },
          message: 'Access Token is missing. Please save your Access Token.',
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
          config: {
            phone_number_id: phoneNumId,
            waba_id: wabaId,
            has_access_token: true,
            has_verify_token: hasVerifyToken,
            status: 'disconnected',
            registered_at: registeredAt,
            subscribed_apps_at: subscribedAppsAt,
          },
          message:
            'Stored Access Token could not be decrypted. Please re-save your WhatsApp configuration.',
        },
        { status: 200 }
      );
    }

    // Verify token with Meta API
    let metaValid = false;
    let phoneInfo: import('@/lib/whatsapp/meta-api').MetaPhoneInfo | null =
      null;
    let metaErrorMessage: string | null = null;

    try {
      phoneInfo = await verifyPhoneNumber({
        phoneNumberId: phoneNumId,
        accessToken,
      });
      metaValid = true;
    } catch (err: unknown) {
      metaValid = false;
      metaErrorMessage =
        err instanceof Error ? err.message : 'Meta API verification failed';
    }

    if (!metaValid) {
      return NextResponse.json(
        {
          connected: false,
          reason: 'meta_auth_failed',
          config: {
            phone_number_id: phoneNumId,
            waba_id: wabaId,
            has_access_token: true,
            has_verify_token: hasVerifyToken,
            status: 'disconnected',
            registered_at: registeredAt,
            subscribed_apps_at: subscribedAppsAt,
          },
          phone_info: null,
          meta_error: metaErrorMessage,
          message: `WhatsApp token is invalid or expired: ${metaErrorMessage}`,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        connected: true,
        status: 'connected',
        configured: true,
        reason: 'active',
        config: {
          phone_number_id: phoneNumId,
          waba_id: wabaId,
          has_access_token: true,
          has_verify_token: hasVerifyToken,
          status: 'connected',
          registered_at: registeredAt,
          last_registration_error: lastRegistrationError,
          subscribed_apps_at: subscribedAppsAt,
        },
        phone_info: phoneInfo,
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
 * Saves WhatsApp credentials after verifying with Meta Graph API and encrypting tokens.
 * Enforces owner/admin role authorization.
 */
export async function POST(request: Request) {
  try {
    const appwrite = await createClient();
    const {
      data: { user },
      error: authError,
    } = await appwrite.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { code: 'AUTH_REQUIRED', error: 'Authentication required' },
        { status: 401 }
      );
    }

    let accountId: string | null = null;
    let userRole: string | null = null;
    const ctx = await getCurrentAccount().catch(() => null);

    if (ctx?.accountId) {
      accountId = ctx.accountId;
      userRole = ctx.role;
    } else {
      const { data: profile } = await appwrite
        .from('profiles')
        .select('accountId, role')
        .eq('userId', user.id)
        .maybeSingle()
        .catch(() => ({ data: null }));

      if (profile?.accountId) {
        accountId = String(profile.accountId);
        userRole = profile.role || 'member';
      }
    }

    if (!accountId) {
      return NextResponse.json(
        {
          code: 'ACCOUNT_MEMBERSHIP_REQUIRED',
          error: 'Account membership required',
        },
        { status: 403 }
      );
    }

    if (userRole && !['owner', 'admin'].includes(userRole.toLowerCase())) {
      return NextResponse.json(
        {
          code: 'ROLE_REQUIRED',
          error:
            'Owner or admin role required to modify WhatsApp configuration',
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawPhoneNumberId = body.phone_number_id || body.phoneNumberId;
    const rawWabaId = body.waba_id || body.wabaId;
    const rawAccessToken = body.access_token || body.accessToken;
    const rawVerifyToken = body.verify_token || body.verifyToken;
    const rawPin = body.pin;

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

    if (rawPin !== undefined && rawPin !== null && rawPin !== '') {
      if (typeof rawPin !== 'string' || !/^\d{6}$/.test(rawPin.trim())) {
        return NextResponse.json(
          {
            code: 'WHATSAPP_CONFIG_INVALID',
            error: 'PIN must be exactly 6 digits.',
          },
          { status: 400 }
        );
      }
    }
    const pin = rawPin ? String(rawPin).trim() : null;
    const wabaId = rawWabaId ? String(rawWabaId).trim() : null;

    const admin = appwriteAdmin();

    // Check if phone number is claimed by another account
    const { data: claimedRows } = await admin
      .from(CANONICAL_COLLECTION)
      .select('id, accountId, phoneNumberId')
      .eq('phoneNumberId', phoneNumberId)
      .limit(5);

    if (claimedRows && claimedRows.length > 0) {
      const conflict = claimedRows.find(
        (row: Record<string, unknown>) =>
          String(row.accountId || '') !== String(accountId)
      );
      if (conflict) {
        return NextResponse.json(
          {
            code: 'WHATSAPP_PHONE_ALREADY_CLAIMED',
            error:
              'This WhatsApp phone number is already linked to another account. Each phone number can only be connected to one tenant account.',
          },
          { status: 409 }
        );
      }
    }

    // Lookup existing config for caller's account
    const { data: existingConfig } = await admin
      .from(CANONICAL_COLLECTION)
      .select('*')
      .eq('accountId', accountId)
      .maybeSingle();

    let accessTokenToUse: string | null = null;
    if (
      rawAccessToken &&
      typeof rawAccessToken === 'string' &&
      rawAccessToken.trim()
    ) {
      accessTokenToUse = rawAccessToken.trim();
    } else if (existingConfig?.encryptedAccessToken) {
      try {
        accessTokenToUse = decrypt(String(existingConfig.encryptedAccessToken));
      } catch (err) {
        console.error(
          '[whatsapp/config POST] Stored token decryption failed:',
          err
        );
      }
    }

    if (!accessTokenToUse) {
      return NextResponse.json(
        {
          code: 'WHATSAPP_CONFIG_INVALID',
          error: 'access_token is required for initial setup',
        },
        { status: 400 }
      );
    }

    // 1. Verify with Meta Graph API
    let phoneInfo;
    try {
      phoneInfo = await verifyPhoneNumber({
        phoneNumberId,
        accessToken: accessTokenToUse,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown Meta API error';
      console.error('[whatsapp/config POST] Meta verification failed:', msg);
      return NextResponse.json(
        {
          code: 'WHATSAPP_META_AUTH_FAILED',
          error: `Meta API verification failed: ${msg}`,
        },
        { status: 400 }
      );
    }

    // 2. Encrypt tokens
    let encryptedAccessToken: string;
    let encryptedVerifyToken: string | null = null;
    try {
      encryptedAccessToken = encrypt(accessTokenToUse);
      if (rawVerifyToken && typeof rawVerifyToken === 'string') {
        encryptedVerifyToken = encrypt(rawVerifyToken.trim());
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Encryption error';
      console.error('[whatsapp/config POST] Encryption failed:', msg);
      return NextResponse.json(
        {
          code: 'WHATSAPP_TOKEN_ENCRYPTION_FAILED',
          error: `Token encryption failed: ${msg}`,
        },
        { status: 500 }
      );
    }

    const existingPhoneId = existingConfig?.phoneNumberId;
    const existingRegAt = existingConfig?.registeredAt;
    const sameNumber =
      existingPhoneId === phoneNumberId && existingRegAt != null;

    let registeredAt: string | null =
      typeof existingRegAt === 'string' ? existingRegAt : null;
    let registrationError: string | null = null;
    let registrationSkipped = false;

    if (!sameNumber || pin) {
      if (!pin) {
        registrationSkipped = true;
      } else {
        try {
          await registerPhoneNumber({
            phoneNumberId,
            accessToken: accessTokenToUse,
            pin,
          });
          registeredAt = new Date().toISOString();
        } catch (err) {
          registrationError =
            err instanceof Error ? err.message : 'Meta registration failed';
          console.error(
            '[whatsapp/config POST] Phone registration failed:',
            registrationError
          );
        }
      }
    }

    let subscribedAppsAt: string | null = null;
    if (wabaId) {
      try {
        await subscribeWabaToApp({
          wabaId,
          accessToken: accessTokenToUse,
        });
        subscribedAppsAt = new Date().toISOString();
      } catch (err) {
        console.warn('[whatsapp/config POST] WABA subscribe warning:', err);
      }
    }

    const now = new Date().toISOString();
    const canonicalDocument: Record<string, unknown> = {
      accountId,
      account_id: accountId,
      createdBy:
        existingConfig?.createdBy || existingConfig?.created_by || user.id,
      created_by:
        existingConfig?.createdBy || existingConfig?.created_by || user.id,
      user_id: user.id,
      userId: user.id,
      updatedBy: user.id,
      updated_by: user.id,
      phoneNumberId,
      phone_number_id: phoneNumberId,
      wabaId,
      waba_id: wabaId,
      encryptedAccessToken,
      access_token: encryptedAccessToken,
      encryptedVerifyToken:
        encryptedVerifyToken || existingConfig?.encryptedVerifyToken || null,
      verify_token:
        encryptedVerifyToken ||
        existingConfig?.encryptedVerifyToken ||
        existingConfig?.verify_token ||
        null,
      encryptionKeyVersion: 'v1',
      status: registrationError ? 'disconnected' : 'connected',
      registeredAt,
      registered_at: registeredAt,
      lastRegistrationError: registrationError,
      last_registration_error: registrationError,
      subscribedAppsAt,
      subscribed_apps_at: subscribedAppsAt,
      connected_at: now,
      createdAt: existingConfig?.createdAt || existingConfig?.created_at || now,
      created_at:
        existingConfig?.createdAt || existingConfig?.created_at || now,
      updatedAt: now,
      updated_at: now,
    };

    if (existingConfig) {
      const docId = String(existingConfig.$id || existingConfig.id || '');
      const { error: updateErr } = await admin
        .from(CANONICAL_COLLECTION)
        .update(canonicalDocument)
        .eq('id', docId);

      if (updateErr) {
        console.error('[whatsapp/config POST] Update error:', updateErr);
        return NextResponse.json(
          {
            code: 'WHATSAPP_CONFIG_PERSISTENCE_FAILED',
            error: `Failed to update configuration: ${updateErr.message}`,
          },
          { status: 500 }
        );
      }
    } else {
      const { error: insertErr } = await admin
        .from(CANONICAL_COLLECTION)
        .insert(canonicalDocument);

      if (insertErr) {
        console.error('[whatsapp/config POST] Insert error:', insertErr);
        return NextResponse.json(
          {
            code: 'WHATSAPP_CONFIG_PERSISTENCE_FAILED',
            error: `Failed to insert configuration: ${insertErr.message}`,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      saved: true,
      registered: registeredAt != null,
      registration_skipped: registrationSkipped,
      registration_error: registrationError,
      phone_info: phoneInfo,
      config: {
        phone_number_id: phoneNumberId,
        waba_id: wabaId,
        has_access_token: true,
        has_verify_token: Boolean(encryptedVerifyToken),
        status: canonicalDocument.status,
        registered_at: registeredAt,
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
 * Removes the authenticated user's WhatsApp configuration row.
 * Strictly scoped to caller's accountId.
 */
export async function DELETE() {
  try {
    const appwrite = await createClient();
    const {
      data: { user },
      error: authError,
    } = await appwrite.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { code: 'AUTH_REQUIRED', error: 'Authentication required' },
        { status: 401 }
      );
    }

    let accountId: string | null = null;
    let userRole: string | null = null;
    const ctx = await getCurrentAccount().catch(() => null);

    if (ctx?.accountId) {
      accountId = ctx.accountId;
      userRole = ctx.role;
    } else {
      const { data: profile } = await appwrite
        .from('profiles')
        .select('accountId, role')
        .eq('userId', user.id)
        .maybeSingle()
        .catch(() => ({ data: null }));

      if (profile?.accountId) {
        accountId = String(profile.accountId);
        userRole = profile.role || 'member';
      }
    }

    if (!accountId) {
      return NextResponse.json(
        {
          code: 'ACCOUNT_MEMBERSHIP_REQUIRED',
          error: 'Account membership required',
        },
        { status: 403 }
      );
    }

    if (userRole && !['owner', 'admin'].includes(userRole.toLowerCase())) {
      return NextResponse.json(
        {
          code: 'ROLE_REQUIRED',
          error:
            'Owner or admin role required to delete WhatsApp configuration',
        },
        { status: 403 }
      );
    }

    const admin = appwriteAdmin();
    const { error: deleteError } = await admin
      .from(CANONICAL_COLLECTION)
      .delete()
      .eq('accountId', accountId);

    if (deleteError) {
      console.error('[DELETE /api/whatsapp/config] Delete error:', deleteError);
      return NextResponse.json(
        {
          code: 'WHATSAPP_CONFIG_PERSISTENCE_FAILED',
          error: `Failed to delete configuration: ${deleteError.message || 'DB error'}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in WhatsApp config DELETE:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', error: 'Internal server error' },
      { status: 500 }
    );
  }
}
