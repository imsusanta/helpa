import { NextResponse } from 'next/server';
import {
  appwriteAdmin as createAdminClient,
  createClient,
} from '@/lib/appwrite-server-compat';
import { getCurrentAccount } from '@/lib/auth/account';
import { decrypt } from '@/lib/whatsapp/encryption';
import { getSubscribedApps, verifyPhoneNumber } from '@/lib/whatsapp/meta-api';

/**
 * GET /api/whatsapp/config/verify-registration
 *
 * Diagnostic endpoint — confirms the user's saved phone number is
 * actually reachable on Meta's side.
 */
export async function GET() {
  const appwrite = await createClient();
  const {
    data: { user },
    error: authError,
  } = await appwrite.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      { error: 'Account membership required' },
      { status: 403 }
    );
  }

  const dbAdmin = createAdminClient();
  const { data: config, error: configError } = await dbAdmin
    .from('whatsapp_configs')
    .select('*')
    .eq('accountId', accountId)
    .maybeSingle();

  if (configError) {
    console.error(
      'Error querying whatsapp_configs in verify-registration:',
      configError
    );
    return NextResponse.json(
      { error: `Database error: ${configError.message || 'Unknown'}` },
      { status: 500 }
    );
  }

  if (!config) {
    return NextResponse.json({
      live: false,
      checks: { config_exists: false },
      message: 'No WhatsApp configuration saved yet.',
    });
  }

  // Access config fields with camelCase primary, snake_case fallback
  const encToken =
    config.encryptedAccessToken ||
    config.encrypted_access_token ||
    config.accessToken ||
    config.access_token;
  const phoneNumId = String(
    config.phoneNumberId || config.phone_number_id || ''
  );
  const wabaIdValue = config.wabaId || config.waba_id || null;
  const regAt = config.registeredAt || config.registered_at || null;
  const lastRegErr =
    config.lastRegistrationError || config.last_registration_error || null;
  const subAppsAt =
    config.subscribedAppsAt || config.subscribed_apps_at || null;

  let accessToken: string;
  try {
    accessToken = decrypt(encToken);
  } catch {
    return NextResponse.json({
      live: false,
      checks: {
        config_exists: true,
        token_decryptable: false,
      },
      message:
        "Stored access token can't be decrypted — likely ENCRYPTION_KEY changed. Re-enter the token to repair.",
    });
  }

  const checks: {
    config_exists: boolean;
    token_decryptable: boolean;
    phone_metadata_ok: boolean;
    waba_subscribed_to_app: boolean | null;
    locally_marked_registered: boolean;
  } = {
    config_exists: true,
    token_decryptable: true,
    phone_metadata_ok: false,
    waba_subscribed_to_app: null,
    locally_marked_registered: regAt != null,
  };
  const errors: string[] = [];

  // 1. Phone metadata
  try {
    await verifyPhoneNumber({
      phoneNumberId: phoneNumId,
      accessToken,
    });
    checks.phone_metadata_ok = true;
  } catch (err) {
    errors.push(
      `Phone metadata check failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // 2. WABA subscription
  if (wabaIdValue) {
    try {
      const subs = await getSubscribedApps({
        wabaId: String(wabaIdValue),
        accessToken,
      });
      checks.waba_subscribed_to_app = subs.length > 0;
      if (!checks.waba_subscribed_to_app) {
        errors.push(
          'WABA has no subscribed apps. Re-save the configuration to subscribe.'
        );
      }
    } catch (err) {
      errors.push(
        `WABA subscription check failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  } else {
    errors.push(
      "No WABA ID on file — webhooks can't be wired without it. Add it in the form and re-save."
    );
  }

  const live =
    checks.phone_metadata_ok &&
    (checks.waba_subscribed_to_app ?? false) &&
    checks.locally_marked_registered;

  return NextResponse.json({
    live,
    checks,
    errors,
    last_registration_error: lastRegErr,
    registered_at: regAt,
    subscribed_apps_at: subAppsAt,
  });
}
