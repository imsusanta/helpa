#!/usr/bin/env node

/**
 * Safe preflight check for Helpa's Evolution Go QR integration.
 * Never prints API keys or other secret values.
 *
 * Identity is proven on GET /server/ok (JSON, not HTML or a redirect)
 * before the global API key is sent to any host.
 */

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const EVOLUTION_GO_WRONG_HOST_MESSAGE =
  'EVOLUTION_GO_BASE_URL is not Evolution Go. Point it at an Evolution Go server exposing GET /server/ok JSON, not the Helpa app or a login page.';

export function isHttpRedirectStatus(status) {
  return (
    status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308
  );
}

export function looksLikeHtmlDocument(text, contentType) {
  const type = String(contentType || '').toLowerCase();
  if (type.includes('text/html')) return true;
  const trimmed = String(text || '').trim();
  return (
    trimmed.startsWith('<') ||
    /<!doctype html/i.test(trimmed) ||
    /<html[\s>]/i.test(trimmed)
  );
}

function isWrongEngineResponse(response, text) {
  if (
    isHttpRedirectStatus(response.status) ||
    response.type === 'opaqueredirect'
  ) {
    return true;
  }
  return looksLikeHtmlDocument(
    text,
    response.headers.get('content-type') || ''
  );
}

function readEnv(env, name) {
  return String(env[name] || '').trim();
}

/**
 * @param {{
 *   env?: NodeJS.ProcessEnv,
 *   fetchImpl?: typeof fetch,
 * }} [options]
 * @returns {Promise<{ webhookBaseUrl: string }>}
 */
export async function runEvolutionGoPreflight(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;

  const baseUrl = readEnv(env, 'EVOLUTION_GO_BASE_URL').replace(/\/+$/, '');
  const apiKey = readEnv(env, 'EVOLUTION_GO_GLOBAL_API_KEY');
  const webhookBaseUrl = (
    readEnv(env, 'EVOLUTION_GO_WEBHOOK_BASE_URL') ||
    readEnv(env, 'NEXT_PUBLIC_SITE_URL')
  ).replace(/\/+$/, '');

  const missing = [];
  if (!baseUrl) missing.push('EVOLUTION_GO_BASE_URL');
  if (!apiKey) missing.push('EVOLUTION_GO_GLOBAL_API_KEY');
  if (!webhookBaseUrl) missing.push('EVOLUTION_GO_WEBHOOK_BASE_URL');
  if (missing.length) {
    throw new Error(
      `Missing Evolution Go configuration: ${missing.join(', ')}`
    );
  }

  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error('EVOLUTION_GO_BASE_URL is not a valid URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('EVOLUTION_GO_BASE_URL must use http:// or https://.');
  }

  if (env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw new Error('EVOLUTION_GO_BASE_URL must use HTTPS in production.');
  }

  try {
    new URL(webhookBaseUrl);
  } catch {
    throw new Error('EVOLUTION_GO_WEBHOOK_BASE_URL is not a valid URL.');
  }

  const healthUrl = `${baseUrl}/server/ok`;
  const healthResponse = await fetchImpl(healthUrl, {
    redirect: 'manual',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  const healthBody = await healthResponse.text();

  if (isWrongEngineResponse(healthResponse, healthBody)) {
    throw new Error(EVOLUTION_GO_WRONG_HOST_MESSAGE);
  }
  if (!healthResponse.ok) {
    throw new Error(
      `Evolution Go health check failed with HTTP ${healthResponse.status}.`
    );
  }

  let healthJson = null;
  if (healthBody.trim()) {
    try {
      healthJson = JSON.parse(healthBody);
    } catch {
      throw new Error(EVOLUTION_GO_WRONG_HOST_MESSAGE);
    }
  }
  if (
    healthJson === null ||
    typeof healthJson !== 'object' ||
    Array.isArray(healthJson)
  ) {
    throw new Error(EVOLUTION_GO_WRONG_HOST_MESSAGE);
  }

  const authProbe = await fetchImpl(
    `${baseUrl}/instance/info/__helpa_preflight__`,
    {
      redirect: 'manual',
      headers: { apikey: apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    }
  );
  const body = await authProbe.text();
  if (isWrongEngineResponse(authProbe, body)) {
    throw new Error(EVOLUTION_GO_WRONG_HOST_MESSAGE);
  }
  if (authProbe.status === 401 || authProbe.status === 403) {
    throw new Error(
      'Evolution Go is reachable, but the configured API key was rejected.'
    );
  }
  if (!authProbe.ok && authProbe.status !== 404) {
    const detail = /license required/i.test(body)
      ? ' Evolution Go license activation is required.'
      : '';
    throw new Error(
      `Evolution Go authenticated probe failed with HTTP ${authProbe.status}.${detail}`
    );
  }

  return { webhookBaseUrl };
}

function isExecutedDirectly() {
  const argvPath = process.argv[1];
  if (!argvPath) return false;
  try {
    return import.meta.url === pathToFileURL(resolve(argvPath)).href;
  } catch {
    return false;
  }
}

async function main() {
  const baseUrl = String(process.env.EVOLUTION_GO_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  console.log(`Checking Evolution Go at ${baseUrl}/server/ok`);
  const result = await runEvolutionGoPreflight();
  console.log(
    'Evolution Go is reachable and the configured API key passed the protected API probe.'
  );
  console.log(`Webhook base URL: ${result.webhookBaseUrl}`);
}

if (isExecutedDirectly()) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : 'Evolution Go is unreachable.'
    );
    process.exit(1);
  });
}
