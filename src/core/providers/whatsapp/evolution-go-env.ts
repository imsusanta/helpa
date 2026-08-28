/**
 * Server-only Evolution Go v0.7.2 environment helpers.
 *
 * Verified against evolution-foundation/evolution-go@0.7.2 routes.go
 * and pkg/middleware/auth_middleware.go (apikey header).
 */

import { AsyncLocalStorage } from 'node:async_hooks';

export const EVOLUTION_GO_VERSION = '0.7.2';

const DEFAULT_TIMEOUT_MS = 30_000;
const MIN_REQUEST_TIMEOUT_MS = 1_000;
/** Hobby-safe default: leave headroom before a ~10s platform kill. */
export const VERCEL_EVOLUTION_SESSION_BUDGET_MS = 5_000;
export const VERCEL_EVOLUTION_REQUEST_TIMEOUT_MS = 3_500;

export class EvolutionGoConfigError extends Error {
  readonly code = 'EVOLUTION_GO_CONFIG';

  constructor(message: string) {
    super(message);
    this.name = 'EvolutionGoConfigError';
  }
}

function trimEnv(name: string): string {
  return String(process.env[name] || '').trim();
}

function configuredTimeoutMs(): number {
  const raw = Number(trimEnv('EVOLUTION_GO_TIMEOUT_MS'));
  if (Number.isFinite(raw) && raw >= 3_000 && raw <= 120_000) return raw;
  return DEFAULT_TIMEOUT_MS;
}

type EvolutionDeadline = { at: number };

const evolutionDeadlineAls = new AsyncLocalStorage<EvolutionDeadline>();

export function evolutionSessionBudgetMs(): number {
  const raw = Number(trimEnv('EVOLUTION_GO_SESSION_BUDGET_MS'));
  if (Number.isFinite(raw) && raw >= 3_000 && raw <= 120_000) return raw;
  if (process.env.VERCEL) return VERCEL_EVOLUTION_SESSION_BUDGET_MS;
  return 60_000;
}

export function runWithEvolutionDeadline<T>(fn: () => Promise<T>): Promise<T> {
  return evolutionDeadlineAls.run(
    { at: Date.now() + evolutionSessionBudgetMs() },
    fn
  );
}

export function remainingEvolutionDeadlineMs(): number | null {
  const deadline = evolutionDeadlineAls.getStore();
  if (!deadline) return null;
  return deadline.at - Date.now();
}

export function hasEnoughEvolutionDeadline(minMs = 2_000): boolean {
  const remaining = remainingEvolutionDeadlineMs();
  if (remaining == null) return true;
  return remaining >= minMs;
}

export function evolutionGoTimeoutMs(): number {
  const configured = configuredTimeoutMs();
  const remaining = remainingEvolutionDeadlineMs();
  if (remaining != null) {
    return Math.max(MIN_REQUEST_TIMEOUT_MS, Math.min(configured, remaining));
  }
  if (process.env.VERCEL) {
    return Math.min(configured, VERCEL_EVOLUTION_REQUEST_TIMEOUT_MS);
  }
  return configured;
}

export function getEvolutionGoBaseUrl(): string {
  const raw = trimEnv('EVOLUTION_GO_BASE_URL').replace(/\/+$/, '');
  if (!raw) {
    throw new EvolutionGoConfigError(
      'Evolution Go is not configured. Set EVOLUTION_GO_BASE_URL.'
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new EvolutionGoConfigError(
      'EVOLUTION_GO_BASE_URL is not a valid URL.'
    );
  }
  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw new EvolutionGoConfigError(
      'EVOLUTION_GO_BASE_URL must use HTTPS in production.'
    );
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new EvolutionGoConfigError(
      'EVOLUTION_GO_BASE_URL must be an http or https URL.'
    );
  }
  return raw;
}

export function getEvolutionGoGlobalApiKey(): string {
  const key = trimEnv('EVOLUTION_GO_GLOBAL_API_KEY');
  if (!key) {
    throw new EvolutionGoConfigError(
      'Evolution Go is not configured. Set EVOLUTION_GO_GLOBAL_API_KEY.'
    );
  }
  return key;
}

export function getEvolutionGoWebhookBaseUrl(): string {
  const raw = (
    trimEnv('EVOLUTION_GO_WEBHOOK_BASE_URL') || trimEnv('NEXT_PUBLIC_SITE_URL')
  ).replace(/\/+$/, '');
  if (!raw) {
    throw new EvolutionGoConfigError(
      'Set EVOLUTION_GO_WEBHOOK_BASE_URL to the public Helpa origin for Evolution webhooks.'
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new EvolutionGoConfigError(
      'EVOLUTION_GO_WEBHOOK_BASE_URL is not a valid URL.'
    );
  }
  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw new EvolutionGoConfigError(
      'EVOLUTION_GO_WEBHOOK_BASE_URL must use HTTPS in production.'
    );
  }
  return raw;
}

export function buildEvolutionWebhookUrl(secret: string): string {
  const base = getEvolutionGoWebhookBaseUrl();
  return `${base}/api/webhooks/evolution/${encodeURIComponent(secret)}`;
}

export function isWhatsAppQrSimulationAllowed(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.NODE_ENV === 'test') return true;
  return trimEnv('ALLOW_WHATSAPP_QR_SIMULATION') === 'true';
}
