export function validateCsrfHeader(request: Request): boolean {
  // Webhooks, API keys, or non-browser/header authenticated calls are exempt
  const authHeader = request.headers.get('authorization');
  const apiKeyHeader = request.headers.get('x-appwrite-key');
  const webhookSig =
    request.headers.get('x-hub-signature-256') ||
    request.headers.get('x-waha-signature') ||
    request.headers.get('x-twilio-signature') ||
    request.headers.get('calendly-webhook-signature') ||
    request.headers.get('x-elevenlabs-signature');

  if (authHeader || apiKeyHeader || webhookSig) {
    return true;
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host =
    request.headers.get('host') || request.headers.get('x-forwarded-host');

  if (!origin && !referer) {
    // Standard browser requests with cookies must supply Origin or Referer
    return false;
  }

  const targetHeader = origin || referer;
  if (!targetHeader) return false;

  try {
    const headerUrl = new URL(targetHeader);
    if (!host) return true;
    const cleanHost = host.split(':')[0].toLowerCase();
    const headerHost = headerUrl.hostname.toLowerCase();
    return (
      headerHost === cleanHost ||
      headerHost === 'localhost' ||
      headerHost === '127.0.0.1'
    );
  } catch {
    return false;
  }
}
