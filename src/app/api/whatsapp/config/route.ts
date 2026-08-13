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

// Lazy-initialised service-role client. We need it to detect a
// phone_number_id already claimed by a *different* user — under RLS,
// the user's own session can't see other users' rows, so the conflict
// would be invisible without the service role.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null;
function appwriteAdmin() {
  if (!_adminClient) {
    _adminClient = createAdminClient();
  }
  return _adminClient;
}

/**
 * GET /api/whatsapp/config
 *
 * Used by the "Test API Connection" button and by the page to check
 * whether the saved config is healthy.
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
    const admin = appwriteAdmin();

    let { data: config, error: configError } = await admin
      .from('whatsapp_configs')
      .select(
        'phone_number_id, waba_id, access_token, status, registered_at, last_registration_error, subscribed_apps_at'
      )
      .eq('account_id', accountId)
      .maybeSingle();

    if (configError) {
      console.warn(
        '[whatsapp/config GET] Query failed on account_id, retrying accountId:',
        configError
      );
      const retry = await admin
        .from('whatsapp_configs')
        .select(
          'phone_number_id, waba_id, access_token, status, registered_at, last_registration_error, subscribed_apps_at'
        )
        .eq('accountId', accountId)
        .maybeSingle();
      config = retry.data;
      configError = retry.error;
    }

    if (configError) {
      console.error('Error fetching whatsapp_configs from DB:', configError);
      return NextResponse.json(
        {
          code: 'DATABASE_ERROR',
          error: `Failed to fetch WhatsApp configuration: ${configError.message || 'Database error'}`,
        },
        { status: 500 }
      );
    }

    if (!config) {
      return NextResponse.json(
        {
          connected: false,
          reason: 'no_config',
          message:
            'No WhatsApp configuration saved yet. Fill in the form and click Save Configuration.',
        },
        { status: 200 }
      );
    }

    const safeConfig = {
      phone_number_id: config.phone_number_id,
      waba_id: config.waba_id,
      status: config.status,
      registered_at: config.registered_at,
      last_registration_error: config.last_registration_error,
      subscribed_apps_at: config.subscribed_apps_at,
    };

    // Try to decrypt the stored token with the current ENCRYPTION_KEY.
    let accessToken: string;
    try {
      accessToken = decrypt(config.access_token);
    } catch (err) {
      console.error('[whatsapp/config GET] Token decryption failed:', err);
      return NextResponse.json(
        {
          connected: false,
          config: safeConfig,
          reason: 'token_corrupted',
          needs_reset: true,
          message:
            'The stored access token cannot be decrypted with the current ENCRYPTION_KEY. This usually means the key changed, or it differs between environments. Click "Reset Configuration" below, then re-save.',
        },
        { status: 200 }
      );
    }

    // Validate credentials against Meta
    try {
      const phoneInfo = await verifyPhoneNumber({
        phoneNumberId: config.phone_number_id,
        accessToken,
      });
      return NextResponse.json({
        connected: true,
        config: safeConfig,
        phone_info: phoneInfo,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown Meta API error';
      console.error(
        '[whatsapp/config GET] Meta API verification failed:',
        message
      );
      return NextResponse.json(
        {
          connected: false,
          config: safeConfig,
          reason: 'meta_api_error',
          message: `Meta API rejected the credentials: ${message}`,
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
 * Saves or updates the WhatsApp config for the authenticated user.
 * Verifies credentials with Meta first, then encrypts and stores.
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

    const body = await request.json();
    const { phone_number_id, waba_id, access_token, verify_token, pin } = body;

    if (!access_token || !phone_number_id) {
      return NextResponse.json(
        { error: 'access_token and phone_number_id are required' },
        { status: 400 }
      );
    }

    if (pin !== undefined && pin !== null && pin !== '') {
      if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
        return NextResponse.json(
          { error: 'PIN must be exactly 6 digits.' },
          { status: 400 }
        );
      }
    }

    // Reject if another account has already claimed this phone_number_id.
    let claimed: { account_id?: string } | null = null;
    try {
      const { data, error: claimedError } = await appwriteAdmin()
        .from('whatsapp_configs')
        .select('account_id')
        .eq('phone_number_id', phone_number_id)
        .neq('account_id', accountId)
        .maybeSingle();

      if (!claimedError) {
        claimed = data;
      }
    } catch (err) {
      console.warn('[whatsapp/config] Ownership check warning:', err);
    }

    if (claimed) {
      return NextResponse.json(
        {
          error:
            'This WhatsApp phone number is already linked to another account on this instance. Each phone number can only be connected to one wacrm user.',
        },
        { status: 409 }
      );
    }

    // Verify credentials with Meta BEFORE saving
    let phoneInfo;
    try {
      phoneInfo = await verifyPhoneNumber({
        phoneNumberId: phone_number_id,
        accessToken: access_token,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown Meta API error';
      console.error('Meta API verification failed during save:', message);
      return NextResponse.json(
        { error: `Meta API error: ${message}` },
        { status: 400 }
      );
    }

    // Encrypt sensitive tokens before storing
    let encryptedAccessToken: string;
    let encryptedVerifyToken: string | null;
    try {
      encryptedAccessToken = encrypt(access_token);
      encryptedVerifyToken = verify_token ? encrypt(verify_token) : null;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown encryption error';
      console.error('Encryption failed:', message);
      return NextResponse.json(
        {
          error:
            'Failed to encrypt token. Check that ENCRYPTION_KEY is a valid 64-character hex string in your environment variables.',
        },
        { status: 500 }
      );
    }

    const adminClient = appwriteAdmin();
    const { data: existing } = await adminClient
      .from('whatsapp_configs')
      .select('id, registered_at, phone_number_id')
      .eq('account_id', accountId)
      .maybeSingle();

    const sameNumber =
      existing?.phone_number_id === phone_number_id &&
      existing?.registered_at != null;

    let registeredAt: string | null = existing?.registered_at ?? null;
    let registrationError: string | null = null;
    let registrationSkipped = false;

    const needsRegistration =
      !sameNumber || (typeof pin === 'string' && pin.length > 0);
    if (needsRegistration) {
      if (!pin) {
        registrationSkipped = true;
      } else {
        try {
          await registerPhoneNumber({
            phoneNumberId: phone_number_id,
            accessToken: access_token,
            pin,
          });
          registeredAt = new Date().toISOString();
        } catch (err) {
          registrationError =
            err instanceof Error ? err.message : 'Unknown Meta API error';
          console.error('Phone number /register failed:', registrationError);
        }
      }
    }

    let subscribedAppsAt: string | null = null;
    if (waba_id) {
      try {
        await subscribeWabaToApp({
          wabaId: waba_id,
          accessToken: access_token,
        });
        subscribedAppsAt = new Date().toISOString();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn('WABA subscribed_apps failed (non-fatal):', message);
      }
    }

    const baseRow = {
      account_id: accountId,
      accountId: accountId,
      user_id: user.id,
      userId: user.id,
      phone_number_id,
      phoneNumberId: phone_number_id,
      waba_id: waba_id || null,
      wabaId: waba_id || null,
      access_token: encryptedAccessToken,
      accessToken: encryptedAccessToken,
      verify_token: encryptedVerifyToken,
      status: registrationError ? 'disconnected' : 'connected',
      registered_at: registrationError ? null : registeredAt,
      registeredAt: registrationError ? null : registeredAt,
      subscribed_apps_at: subscribedAppsAt ?? null,
      subscribedAppsAt: subscribedAppsAt ?? null,
      last_registration_error: registrationError,
      lastRegistrationError: registrationError,
      updated_at: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      const { error: updateError } = await adminClient
        .from('whatsapp_configs')
        .update(baseRow)
        .eq('account_id', accountId);

      if (updateError) {
        console.error('Error updating whatsapp_configs:', updateError);
        return NextResponse.json(
          {
            error: `Failed to update configuration: ${updateError.message || 'Database error'}`,
          },
          { status: 500 }
        );
      }
    } else {
      const { error: insertError } = await adminClient
        .from('whatsapp_configs')
        .insert({
          createdAt: new Date().toISOString(),
          ...baseRow,
        });

      if (insertError) {
        console.error('Error inserting whatsapp_configs:', insertError);
        return NextResponse.json(
          {
            error: `Failed to save configuration: ${insertError.message || 'Database error'}`,
          },
          { status: 500 }
        );
      }
    }

    if (registrationError) {
      return NextResponse.json({
        success: false,
        saved: true,
        registered: false,
        registration_error: registrationError,
        phone_info: phoneInfo,
      });
    }

    return NextResponse.json({
      success: true,
      saved: true,
      registered: registeredAt != null,
      registration_skipped: registrationSkipped,
      phone_info: phoneInfo,
    });
  } catch (error) {
    console.error('Error in WhatsApp config POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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
    const { error: deleteError } = await appwrite
      .from('whatsapp_configs')
      .delete()
      .eq('account_id', accountId);

    if (deleteError) {
      console.error('Error deleting whatsapp_configs:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in WhatsApp config DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
