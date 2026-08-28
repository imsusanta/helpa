#!/usr/bin/env node

/**
 * Safe preflight check for Helpa's Evolution Go QR integration.
 * Never prints API keys or other secret values.
 */

const baseUrl = String(process.env.EVOLUTION_GO_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');
const apiKey = String(process.env.EVOLUTION_GO_GLOBAL_API_KEY || '').trim();
const webhookBaseUrl = String(
  process.env.EVOLUTION_GO_WEBHOOK_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ''
)
  .trim()
  .replace(/\/+$/, '');

const missing = [];
if (!baseUrl) missing.push('EVOLUTION_GO_BASE_URL');
if (!apiKey) missing.push('EVOLUTION_GO_GLOBAL_API_KEY');
if (!webhookBaseUrl) missing.push('EVOLUTION_GO_WEBHOOK_BASE_URL');

if (missing.length) {
  console.error(`Missing Evolution Go configuration: ${missing.join(', ')}`);
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(baseUrl);
} catch {
  console.error('EVOLUTION_GO_BASE_URL is not a valid URL.');
  process.exit(1);
}

if (!['http:', 'https:'].includes(parsed.protocol)) {
  console.error('EVOLUTION_GO_BASE_URL must use http:// or https://.');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
  console.error('EVOLUTION_GO_BASE_URL must use HTTPS in production.');
  process.exit(1);
}

try {
  new URL(webhookBaseUrl);
} catch {
  console.error('EVOLUTION_GO_WEBHOOK_BASE_URL is not a valid URL.');
  process.exit(1);
}

const healthUrl = `${baseUrl}/server/ok`;
console.log(`Checking Evolution Go at ${healthUrl}`);

try {
  const healthResponse = await fetch(healthUrl, {
    redirect: 'manual',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!healthResponse.ok) {
    console.error(
      `Evolution Go health check failed with HTTP ${healthResponse.status}.`
    );
    process.exit(1);
  }

  const authProbe = await fetch(
    `${baseUrl}/instance/info/__helpa_preflight__`,
    {
      redirect: 'manual',
      headers: { apikey: apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    }
  );
  const body = await authProbe.text();
  if (authProbe.status === 401 || authProbe.status === 403) {
    console.error(
      'Evolution Go is reachable, but the configured API key was rejected.'
    );
    process.exit(1);
  }
  if (!authProbe.ok && authProbe.status !== 404) {
    console.error(
      `Evolution Go authenticated probe failed with HTTP ${authProbe.status}.`
    );
    if (/license required/i.test(body)) {
      console.error('Evolution Go license activation is required.');
    }
    process.exit(1);
  }

  console.log(
    'Evolution Go is reachable and the configured API key passed the protected API probe.'
  );
  console.log(`Webhook base URL: ${webhookBaseUrl}`);
} catch (error) {
  console.error(
    `Evolution Go is unreachable: ${error instanceof Error ? error.message : 'network error'}`
  );
  process.exit(1);
}
