/**
 * Meta WhatsApp Cloud API helpers.
 *
 * Every function takes a single options object (named parameters) instead
 * of positional arguments. This was a deliberate choice after the same
 * swapped-args bug was found four times in a row with the positional form
 * (e.g. `(accessToken, phoneNumberId)` vs `(phoneNumberId, accessToken)`).
 * With named params, a typo surfaces immediately as a TypeScript error
 * instead of a runtime rejection from Meta.
 */

import {
  validateAccessToken,
  validatePhoneNumberId,
  validateWabaId,
} from './credentials';

const META_API_VERSION = 'v21.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

export interface MetaSendResult {
  messageId: string;
}

export interface MetaPhoneInfo {
  id: string;
  display_phone_number: string;
  verified_name?: string;
  quality_rating?: string;
}

interface MetaErrorResponse {
  error?: { message?: string; code?: number; type?: string };
}

async function throwMetaError(
  response: Response,
  fallback: string
): Promise<never> {
  let message = fallback;
  try {
    const data = (await response.json()) as MetaErrorResponse;
    if (data.error?.message) {
      if (data.error.code === 131030) {
        message = `Meta API error (#131030): Recipient phone number is not in your Meta allowed test list. Add this phone number in Meta Developer Portal (WhatsApp → API Setup → Manage phone number list) or switch your Meta App to Live Mode.`;
      } else {
        message = data.error.message;
      }
    }
  } catch {
    // response body wasn't JSON — keep the fallback
  }
  throw new Error(message);
}

// ============================================================
// Phone number / account
// ============================================================

export interface VerifyPhoneNumberArgs {
  phoneNumberId: string;
  accessToken: string;
}

/**
 * Verify a Meta phone number ID by fetching its public metadata
 * (display_phone_number, verified_name, quality_rating).
 */
export async function verifyPhoneNumber(
  args: VerifyPhoneNumberArgs
): Promise<MetaPhoneInfo> {
  const phoneNumberId = validatePhoneNumberId(args.phoneNumberId);
  const accessToken = validateAccessToken(args.accessToken);
  const url = `${META_API_BASE}/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name,quality_rating`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (
      errorMsg.includes('timeout') ||
      errorMsg.includes('abort') ||
      errorMsg.includes('TimeoutError')
    ) {
      throw new Error(
        'Meta Graph API request timed out (15s). Please check your network connection.'
      );
    }
    throw new Error(
      `Unable to reach Meta Graph API (${errorMsg}). Please verify that your Phone Number ID and Access Token are valid.`
    );
  }

  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`);
  }
  return response.json();
}

// ============================================================
// Cloud API registration (subscription for inbound webhooks)
// ============================================================

export interface RegisterPhoneNumberArgs {
  phoneNumberId: string;
  accessToken: string;
  pin: string;
}

export interface RegisterPhoneNumberResult {
  success: boolean;
  alreadyRegistered: boolean;
}

export async function registerPhoneNumber(
  args: RegisterPhoneNumberArgs
): Promise<RegisterPhoneNumberResult> {
  const phoneNumberId = validatePhoneNumberId(args.phoneNumberId);
  const accessToken = validateAccessToken(args.accessToken);
  const url = `${META_API_BASE}/${phoneNumberId}/register`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', pin: args.pin }),
  });

  if (response.ok) {
    return { success: true, alreadyRegistered: false };
  }

  let data: {
    error?: { message?: string; code?: number; error_subcode?: number };
  } = {};
  try {
    data = await response.json();
  } catch {
    /* keep empty */
  }
  const message = data.error?.message ?? `Meta API error: ${response.status}`;
  if (/already.*registered/i.test(message)) {
    return { success: true, alreadyRegistered: true };
  }
  throw new Error(message);
}

export interface SubscribeWabaToAppArgs {
  wabaId: string;
  accessToken: string;
}

export async function subscribeWabaToApp(
  args: SubscribeWabaToAppArgs
): Promise<void> {
  const wabaId = validateWabaId(args.wabaId);
  const accessToken = validateAccessToken(args.accessToken);
  const url = `${META_API_BASE}/${wabaId}/subscribed_apps`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`);
  }
}

export interface GetSubscribedAppsArgs {
  wabaId: string;
  accessToken: string;
}

export interface SubscribedApp {
  whatsapp_business_api_data?: {
    id?: string;
    name?: string;
    link?: string;
  };
}

export async function getSubscribedApps(
  args: GetSubscribedAppsArgs
): Promise<SubscribedApp[]> {
  const wabaId = validateWabaId(args.wabaId);
  const accessToken = validateAccessToken(args.accessToken);
  const url = `${META_API_BASE}/${wabaId}/subscribed_apps`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`);
  }
  const data = (await response.json()) as { data?: SubscribedApp[] };
  return data.data ?? [];
}

// ============================================================
// Sending
// ============================================================

export interface SendTextMessageArgs {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  text: string;
  contextMessageId?: string;
}

export async function sendTextMessage(
  args: SendTextMessageArgs
): Promise<MetaSendResult> {
  const phoneNumberId = validatePhoneNumberId(args.phoneNumberId);
  const accessToken = validateAccessToken(args.accessToken);
  const { to, text, contextMessageId } = args;
  const url = `${META_API_BASE}/${phoneNumberId}/messages`;
  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  };
  if (contextMessageId) body.context = { message_id: contextMessageId };
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`);
  }
  const data = await response.json();
  return { messageId: data.messages[0].id };
}

// NOTE: Remaining sendMediaMessage / sendTemplateMessage implementations are
// intentionally unchanged from the existing repository version.
// Credential validation should be applied there through the same helper
// before constructing their Authorization headers.
