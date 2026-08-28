/**
 * Browser-safe parsing for /api/whatsapp/qr/session responses.
 * Proxies and framework error pages often return HTML; never surface
 * JSON.parse SyntaxError text in the QR panel.
 */

export type QrUiStatus =
  | 'creating_instance'
  | 'waiting_for_qr'
  | 'waiting_for_scan'
  | 'connected'
  | 'disconnected'
  | 'reconnect_required'
  | 'expired'
  | 'error';

export interface QrSessionResponse {
  success?: boolean;
  connected?: boolean;
  status?: QrUiStatus | string;
  qr?: string | null;
  qr_code?: string | null;
  qr_image?: string | null;
  pairing_code?: string | null;
  expires_in?: number | null;
  expires_in_seconds?: number | null;
  phone_number?: string | null;
  display_name?: string | null;
  verified_name?: string | null;
  error?: string;
  error_code?: string;
}

export function qrSessionUnavailableMessage(status: number): string {
  if (status === 401 || status === 403) {
    return 'You need to be signed in as an admin to connect WhatsApp with QR.';
  }
  if (status === 404) {
    return 'WhatsApp QR is unavailable. Refresh the page and try again.';
  }
  if (status === 429) {
    return 'Too many QR requests. Wait a moment and try again.';
  }
  if (status === 502 || status === 503 || status === 504) {
    return 'WhatsApp QR service is unreachable. Check Evolution Go and try again.';
  }
  return 'Could not start the WhatsApp QR connection. Try again.';
}

export function isQrHtmlOrParseError(err: unknown): boolean {
  if (err instanceof SyntaxError) return true;
  const message = err instanceof Error ? err.message : String(err || '');
  return /unexpected token|not valid json|<!doctype|json\.parse/i.test(message);
}

export function friendlyQrSessionError(
  err: unknown,
  fallback = 'Could not start the WhatsApp QR connection. Try again.'
): string {
  if (isQrHtmlOrParseError(err)) {
    return qrSessionUnavailableMessage(502);
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

export async function readQrSessionResponse(
  res: Response
): Promise<QrSessionResponse> {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  const trimmed = text.trim();
  const looksHtml = trimmed.startsWith('<') || /<!doctype html/i.test(trimmed);
  const looksJson =
    !looksHtml &&
    (contentType.toLowerCase().includes('application/json') ||
      trimmed.startsWith('{') ||
      trimmed.startsWith('['));

  if (!looksJson) {
    throw new Error(qrSessionUnavailableMessage(res.status));
  }

  try {
    return JSON.parse(text) as QrSessionResponse;
  } catch {
    throw new Error(qrSessionUnavailableMessage(res.status));
  }
}
