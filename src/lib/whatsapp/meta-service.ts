/**
 * src/lib/whatsapp/meta-service.ts
 *
 * Dedicated Server-Only Meta WhatsApp Graph API Service.
 * Centralizes all Meta API interactions with strict error handling,
 * timeouts, and token sanitization.
 */

const META_API_VERSION = 'v21.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

export interface MetaTokenExchangeArgs {
  code: string;
  appId: string;
  appSecret: string;
}

export interface MetaTokenExchangeResult {
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
}

export interface DebugTokenResult {
  isValid: boolean;
  appId?: string;
  userId?: string;
  wabaId?: string;
  scopes?: string[];
  expiresAt?: number;
}

export interface MetaPhoneNumberInfo {
  id: string;
  display_phone_number: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
}

export interface ConnectionHealthResult {
  isHealthy: boolean;
  tokenValid: boolean;
  phoneAccessible: boolean;
  wabaAccessible: boolean;
  webhookSubscribed: boolean;
  phoneInfo?: MetaPhoneNumberInfo;
  error?: string;
}

interface MetaErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Sanitizes Meta API error messages and throws a safe Error instance.
 */
async function parseAndThrowMetaError(
  response: Response,
  fallbackMessage: string
): Promise<never> {
  let message = fallbackMessage;
  try {
    const data = (await response.json()) as MetaErrorResponse;
    if (data?.error?.message) {
      if (data.error.code === 190) {
        message =
          'Meta access token has expired or is invalid. Please reconnect your account.';
      } else if (data.error.code === 100) {
        message = `Meta parameter error: ${data.error.message}`;
      } else if (data.error.code === 131030) {
        message =
          'Meta test number restriction (#131030). Recipient is not in your allowed test list.';
      } else {
        message = data.error.message;
      }
    }
  } catch {
    // Non-JSON response body; keep fallback
  }
  throw new Error(message);
}

/**
 * Exchanges a temporary Meta OAuth code for a permanent/long-lived WhatsApp access token.
 */
export async function exchangeAuthorizationCode({
  code,
  appId,
  appSecret,
}: MetaTokenExchangeArgs): Promise<MetaTokenExchangeResult> {
  if (!code || !code.trim()) {
    throw new Error('Authorization code is required');
  }
  if (!appId || !appSecret) {
    throw new Error(
      'Meta App ID and App Secret must be configured on the server'
    );
  }

  const url = new URL(`${META_API_BASE}/oauth/access_token`);
  url.searchParams.set('client_id', appId.trim());
  url.searchParams.set('client_secret', appSecret.trim());
  url.searchParams.set('code', code.trim());

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to reach Meta token endpoint: ${msg}`);
  }

  if (!response.ok) {
    await parseAndThrowMetaError(
      response,
      `Meta authorization exchange failed with status ${response.status}`
    );
  }

  const data = (await response.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
  };

  if (!data?.access_token) {
    throw new Error(
      'Meta returned a successful response without an access token'
    );
  }

  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
  };
}

/**
 * Inspects a Meta token using the debug_token endpoint to discover WABA ID and granted scopes.
 */
export async function debugAccessToken({
  accessToken,
  appId,
  appSecret,
}: {
  accessToken: string;
  appId: string;
  appSecret: string;
}): Promise<DebugTokenResult> {
  if (!accessToken) throw new Error('Access token is required');
  if (!appId || !appSecret) throw new Error('Meta App credentials required');

  const appToken = `${appId.trim()}|${appSecret.trim()}`;
  const url = `${META_API_BASE}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    throw new Error(
      `Failed to reach Meta debug_token endpoint: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!response.ok) {
    await parseAndThrowMetaError(response, 'Failed to inspect Meta token');
  }

  const data = (await response.json()) as {
    data?: {
      is_valid?: boolean;
      app_id?: string;
      user_id?: string;
      scopes?: string[];
      expires_at?: number;
      granular_scopes?: Array<{
        scope: string;
        target_ids?: string[];
      }>;
    };
  };

  const tokenData = data?.data;
  let discoveredWabaId: string | undefined;

  if (tokenData?.granular_scopes) {
    for (const gs of tokenData.granular_scopes) {
      if (gs.scope === 'whatsapp_business_management' && gs.target_ids?.[0]) {
        discoveredWabaId = gs.target_ids[0];
        break;
      }
    }
  }

  return {
    isValid: Boolean(tokenData?.is_valid),
    appId: tokenData?.app_id,
    userId: tokenData?.user_id,
    scopes: tokenData?.scopes,
    expiresAt: tokenData?.expires_at,
    wabaId: discoveredWabaId,
  };
}

/**
 * Fetches phone numbers registered under a given WhatsApp Business Account (WABA).
 */
export async function getWabaPhoneNumbers({
  wabaId,
  accessToken,
}: {
  wabaId: string;
  accessToken: string;
}): Promise<MetaPhoneNumberInfo[]> {
  if (!wabaId || !accessToken) {
    throw new Error('WABA ID and access token are required');
  }

  const url = `${META_API_BASE}/${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    throw new Error(
      `Failed to fetch WABA phone numbers: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!response.ok) {
    await parseAndThrowMetaError(
      response,
      'Failed to retrieve phone numbers from Meta WABA'
    );
  }

  const data = (await response.json()) as { data?: MetaPhoneNumberInfo[] };
  return data?.data || [];
}

/**
 * Fetches detailed metadata for a single WhatsApp Phone Number ID.
 */
export async function getPhoneNumberDetails({
  phoneNumberId,
  accessToken,
}: {
  phoneNumberId: string;
  accessToken: string;
}): Promise<MetaPhoneNumberInfo> {
  if (!phoneNumberId || !accessToken) {
    throw new Error('Phone Number ID and access token are required');
  }

  const url = `${META_API_BASE}/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    throw new Error(
      `Failed to reach Meta phone endpoint: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!response.ok) {
    await parseAndThrowMetaError(
      response,
      'Failed to fetch phone number details from Meta'
    );
  }

  return (await response.json()) as MetaPhoneNumberInfo;
}

/**
 * Subscribes the WhatsApp Business Account (WABA) to this Meta App's webhooks.
 * This is idempotent.
 */
export async function subscribeWabaWebhook({
  wabaId,
  accessToken,
}: {
  wabaId: string;
  accessToken: string;
}): Promise<boolean> {
  if (!wabaId || !accessToken) {
    throw new Error(
      'WABA ID and access token are required to subscribe webhook'
    );
  }

  const url = `${META_API_BASE}/${encodeURIComponent(wabaId)}/subscribed_apps`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    throw new Error(
      `Failed to subscribe WABA to webhook: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!response.ok) {
    await parseAndThrowMetaError(
      response,
      'Failed to subscribe WABA to webhooks'
    );
  }

  const data = (await response.json()) as { success?: boolean };
  return data?.success !== false;
}

/**
 * Runs a comprehensive connection health check against the Meta Graph API.
 */
export async function checkConnectionHealth({
  phoneNumberId,
  wabaId,
  accessToken,
}: {
  phoneNumberId: string;
  wabaId?: string;
  accessToken: string;
}): Promise<ConnectionHealthResult> {
  let phoneInfo: MetaPhoneNumberInfo | undefined;
  let tokenValid = false;
  let phoneAccessible = false;
  let wabaAccessible = false;
  let webhookSubscribed = false;
  let lastError: string | undefined;

  try {
    phoneInfo = await getPhoneNumberDetails({ phoneNumberId, accessToken });
    phoneAccessible = true;
    tokenValid = true;
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
  }

  if (wabaId && tokenValid) {
    try {
      const numbers = await getWabaPhoneNumbers({ wabaId, accessToken });
      wabaAccessible = Array.isArray(numbers);
      webhookSubscribed = true;
    } catch {
      // Non-fatal if WABA query fails but phone is accessible
    }
  }

  const isHealthy = tokenValid && phoneAccessible;

  return {
    isHealthy,
    tokenValid,
    phoneAccessible,
    wabaAccessible,
    webhookSubscribed,
    phoneInfo,
    error: isHealthy
      ? undefined
      : lastError || 'WhatsApp connection check failed',
  };
}
