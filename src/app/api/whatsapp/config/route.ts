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

// Lazy-initialised service-role client for conflict detection across tenants
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null;
function appwriteAdmin() {
  if (!_adminClient) {
    _adminClient = createAdminClient();
  }
  return _adminClient;
}

const CANONICAL_COLLECTION = APPWRITE_CONFIG.collections.whatsappConfigs;

/**
 * Helper: Safely list documents from whatsapp_configs collection
 */
async function listAllConfigs(): Promise<{
  docs: Record<string, unknown>[];
  error: unknown;
}> {
  try {
    const admin = appwriteAdmin();
    const res = await admin.from(CANONICAL_COLLECTION).select('*');
    if (res.error) {
      const msg = String(
        (res.error as { message?: string })?.message || res.error
      );
      if (
        msg.includes('not_found') ||
        msg.includes('404') ||
        msg.includes('collection') ||
        msg.includes('Attribute') ||
        msg.includes('Index') ||
        msg.includes('Appwrite request failed') ||
        msg.includes('Server Error')
      ) {
        return { docs: [], error: null };
      }
      return { docs: [], error: res.error };
    }
    const docs = Array.isArray(res.data)
      ? res.data
      : res.data
        ? [res.data]
        : [];
    return { docs, error: null };
  } catch {
    return { docs: [], error: null };
  }
}

/**
 * GET /api/whatsapp/config
 *
 * Checks saved configuration health and Meta connectivity for caller's account.
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
        .select('account_id, accountId')
        .eq('user_id', user.id)
        .maybeSingle()
        .catch(() => ({ data: null }));
      if (profile?.account_id || profile?.accountId) {
        accountId = String(profile.account_id || profile.accountId);
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

    const { docs, error: fetchErr } = await listAllConfigs();

    if (fetchErr) {
      const errMsg =
        fetchErr instanceof Error
          ? fetchErr.message
          : typeof fetchErr === 'object' &&
              fetchErr !== null &&
              'message' in fetchErr
            ? String((fetchErr as { message: unknown }).message)
            : 'Database error';
      console.error('[GET /api/whatsapp/config] DB Query Error:', fetchErr);
      return NextResponse.json(
        {
          code: 'DATABASE_ERROR',
          error: `Failed to fetch WhatsApp configuration: ${errMsg}`,
        },
        { status: 500 }
      );
    }

    const config = docs.find(
      (doc) =>
        String(doc.accountId || doc.account_id || '') === String(accountId)
    );

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
      config.phoneNumberId || config.phone_number_id || ''
    );
    const wabaNumId = config.wabaId
      ? String(config.wabaId)
      : config.waba_id
        ? String(config.waba_id)
        : null;
    const rawEncryptedToken =
      typeof config.encryptedAccessToken === 'string'
        ? config.encryptedAccessToken
        : typeof config.encrypted_access_token === 'string'
          ? config.encrypted_access_token
          : typeof config.access_token === 'string'
            ? config.access_token
            : null;
    const rawEncryptedVerify =
      config.encryptedVerifyToken || config.verify_token;

    const safeConfig = {
      phone_number_id: phoneNumId,
      phoneNumberId: phoneNumId,
      waba_id: wabaNumId,
      wabaId: wabaNumId,
      has_access_token: Boolean(rawEncryptedToken),
      has_verify_token: Boolean(rawEncryptedVerify),
      status: config.status || 'disconnected',
      registered_at: config.registeredAt || config.registered_at || null,
      registeredAt: config.registeredAt || config.registered_at || null,
      last_registration_error:
        config.lastRegistrationError || config.last_registration_error || null,
      lastRegistrationError:
        config.lastRegistrationError || config.last_registration_error || null,
      subscribed_apps_at:
        config.subscribedAppsAt || config.subscribed_apps_at || null,
      subscribedAppsAt:
        config.subscribedAppsAt || config.subscribed_apps_at || null,
    };

    if (!rawEncryptedToken) {
      return NextResponse.json(
        {
          connected: false,
          config: safeConfig,
          reason: 'misconfigured',
          message: 'WhatsApp access token is missing.',
        },
        { status: 200 }
      );
    }

    let accessToken: string;
    try {
      accessToken = decrypt(rawEncryptedToken);
    } catch (err) {
      console.error('[GET /api/whatsapp/config] Decryption error:', err);
      return NextResponse.json(
        {
          connected: false,
          config: safeConfig,
          reason: 'token_corrupted',
          needs_reset: true,
          message:
            'Stored access token decryption failed with current ENCRYPTION_KEY. Click "Reset Configuration" and re-save credentials.',
        },
        { status: 200 }
      );
    }

    try {
      const phoneInfo = await verifyPhoneNumber({
        phoneNumberId: phoneNumId,
        accessToken,
      });
      return NextResponse.json({
        connected: true,
        config: safeConfig,
        phone_info: phoneInfo,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown Meta API error';
      console.error(
        '[GET /api/whatsapp/config] Meta verification failed:',
        msg
      );
      return NextResponse.json(
        {
          connected: false,
          config: safeConfig,
          reason: 'meta_api_error',
          message: `Meta API rejected the credentials: ${msg}`,
        },
        { status: 200 }
      );
    }
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
        .select('account_id, accountId, role, account_role')
        .eq('user_id', user.id)
        .maybeSingle()
        .catch(() => ({ data: null }));

      if (profile?.account_id || profile?.accountId) {
        accountId = String(profile.account_id || profile.accountId);
        userRole = profile.role || profile.account_role || 'member';
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

    const { docs: allConfigs } = await listAllConfigs();

    // Check if phone number is claimed by another account
    const claimedConfig = allConfigs.find(
      (doc) =>
        String(doc.phoneNumberId || doc.phone_number_id || '') ===
          String(phoneNumberId) &&
        String(doc.accountId || doc.account_id || '') !== String(accountId)
    );

    if (claimedConfig) {
      return NextResponse.json(
        {
          code: 'WHATSAPP_PHONE_ALREADY_CLAIMED',
          error:
            'This WhatsApp phone number is already linked to another account. Each phone number can only be connected to one tenant account.',
        },
        { status: 409 }
      );
    }

    // Lookup existing config for caller's account
    const existingConfig = allConfigs.find(
      (doc) =>
        String(doc.accountId || doc.account_id || '') === String(accountId)
    );

    let accessTokenToUse: string | null = null;
    if (
      rawAccessToken &&
      typeof rawAccessToken === 'string' &&
      rawAccessToken.trim()
    ) {
      accessTokenToUse = rawAccessToken.trim();
    } else if (existingConfig) {
      const existingEnc =
        existingConfig.encryptedAccessToken ||
        existingConfig.encrypted_access_token ||
        existingConfig.access_token;
      if (typeof existingEnc === 'string') {
        try {
          accessTokenToUse = decrypt(existingEnc);
        } catch (err) {
          console.error(
            '[whatsapp/config POST] Stored token decryption failed:',
            err
          );
        }
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

    const existingPhoneId =
      existingConfig?.phoneNumberId || existingConfig?.phone_number_id;
    const existingRegAt =
      existingConfig?.registeredAt || existingConfig?.registered_at;
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
      userId: user.id,
      user_id: user.id,
      phoneNumberId,
      phone_number_id: phoneNumberId,
      wabaId,
      waba_id: wabaId,
      encryptedAccessToken,
      encrypted_access_token: encryptedAccessToken,
      access_token: encryptedAccessToken,
      encryptedVerifyToken,
      status: registrationError ? 'disconnected' : 'connected',
      registeredAt,
      registered_at: registeredAt,
      lastRegistrationError: registrationError,
      last_registration_error: registrationError,
      subscribedAppsAt,
      subscribed_apps_at: subscribedAppsAt,
      encryptionKeyVersion: 'v1',
      updatedAt: now,
      updatedBy: user.id,
    };

    const appwriteEndpoint = APPWRITE_CONFIG.endpoint.replace(/\/$/, '');
    const databaseId = APPWRITE_CONFIG.databaseId;
    const adminHeaders = new Headers({
      'Content-Type': 'application/json',
      'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
      'X-Appwrite-Key': APPWRITE_CONFIG.apiKey,
    });

    const payloadData: Record<string, unknown> = {
      account_id: accountId,
      user_id: user.id,
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
      encrypted_access_token: encryptedAccessToken,
      access_token: encryptedAccessToken,
      encrypted_verify_token: encryptedVerifyToken,
      status: registrationError ? 'disconnected' : 'connected',
      registered_at: registeredAt,
      last_registration_error: registrationError,
      subscribed_apps_at: subscribedAppsAt,
      encryption_key_version: 'v1',
      updated_at: now,
      updated_by: user.id,
    };

    if (!existingConfig) {
      payloadData.created_at = now;
      payloadData.created_by = user.id;
    }

    let saveSuccess = false;
    let lastSaveError = 'DB save error';

    if (existingConfig) {
      const docId = String(existingConfig.$id || existingConfig.id || '');
      if (docId) {
        let patchRes = await fetch(
          `${appwriteEndpoint}/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(CANONICAL_COLLECTION)}/documents/${encodeURIComponent(docId)}`,
          {
            method: 'PATCH',
            headers: adminHeaders,
            body: JSON.stringify({ data: payloadData }),
          }
        );
        let patchBody = await patchRes.json().catch(() => ({}));

        let attempts = 0;
        while (
          !patchRes.ok &&
          patchBody?.message?.includes('Unknown attribute:') &&
          attempts < 15
        ) {
          attempts++;
          const match = patchBody.message.match(
            /Unknown attribute:\s*"([^"]+)"/
          );
          if (!match || !match[1]) break;
          delete payloadData[match[1]];
          patchRes = await fetch(
            `${appwriteEndpoint}/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(CANONICAL_COLLECTION)}/documents/${encodeURIComponent(docId)}`,
            {
              method: 'PATCH',
              headers: adminHeaders,
              body: JSON.stringify({ data: payloadData }),
            }
          );
          patchBody = await patchRes.json().catch(() => ({}));
        }

        if (patchRes.ok) {
          saveSuccess = true;
        } else {
          lastSaveError =
            patchBody?.message || 'Failed to patch existing configuration';
        }
      }
    }

    if (!saveSuccess) {
      let createRes = await fetch(
        `${appwriteEndpoint}/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(CANONICAL_COLLECTION)}/documents`,
        {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({
            documentId: 'unique()',
            data: payloadData,
            permissions: [
              `read("user:${user.id}")`,
              `update("user:${user.id}")`,
              `delete("user:${user.id}")`,
            ],
          }),
        }
      );
      let createBody = await createRes.json().catch(() => ({}));

      let attempts = 0;
      while (
        !createRes.ok &&
        createBody?.message?.includes('Unknown attribute:') &&
        attempts < 15
      ) {
        attempts++;
        const match = createBody.message.match(
          /Unknown attribute:\s*"([^"]+)"/
        );
        if (!match || !match[1]) break;
        delete payloadData[match[1]];
        createRes = await fetch(
          `${appwriteEndpoint}/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(CANONICAL_COLLECTION)}/documents`,
          {
            method: 'POST',
            headers: adminHeaders,
            body: JSON.stringify({
              documentId: 'unique()',
              data: payloadData,
              permissions: [
                `read("user:${user.id}")`,
                `update("user:${user.id}")`,
                `delete("user:${user.id}")`,
                'read("users")',
                'update("users")',
                'delete("users")',
              ],
            }),
          }
        );
        createBody = await createRes.json().catch(() => ({}));
      }

      if (createRes.ok || createRes.status === 409) {
        saveSuccess = true;
      } else {
        lastSaveError = createBody?.message || 'Failed to insert configuration';
      }
    }

    if (!saveSuccess) {
      return NextResponse.json(
        {
          code: 'WHATSAPP_CONFIG_PERSISTENCE_FAILED',
          error: `Failed to save configuration in database: ${lastSaveError}`,
        },
        { status: 500 }
      );
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
        .select('account_id, accountId, role, account_role')
        .eq('user_id', user.id)
        .maybeSingle()
        .catch(() => ({ data: null }));

      if (profile?.account_id || profile?.accountId) {
        accountId = String(profile.account_id || profile.accountId);
        userRole = profile.role || profile.account_role || 'member';
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

    const { docs } = await listAllConfigs();
    const target = docs.find(
      (doc) =>
        String(doc.accountId || doc.account_id || '') === String(accountId)
    );

    if (target) {
      const docId = target.$id || target.id;
      const admin = appwriteAdmin();
      const { error: deleteError } = await admin
        .from(CANONICAL_COLLECTION)
        .delete()
        .eq('id', docId);

      if (deleteError) {
        console.error(
          '[DELETE /api/whatsapp/config] Delete error:',
          deleteError
        );
        return NextResponse.json(
          {
            code: 'WHATSAPP_CONFIG_PERSISTENCE_FAILED',
            error: `Failed to delete configuration: ${deleteError.message || 'DB error'}`,
          },
          { status: 500 }
        );
      }
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
