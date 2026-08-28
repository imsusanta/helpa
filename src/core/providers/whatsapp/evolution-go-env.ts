/**
 * Server-only Evolution Go v0.7.2 environment helpers.
 *
 * Verified against evolution-foundation/evolution-go@0.7.2 routes.go
 * and pkg/middleware/auth_middleware.go (apikey header).
 */

export const EVOLUTION_GO_VERSION = '0.7.2';

const DEFAULT_TIMEOUT_MS = 30_000;

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

export function evolutionGoTimeoutMs(): number {
  const raw = Number(trimEnv('EVOLUTION_GO_TIMEOUT_MS'));
  if (Number.isFinite(raw) && raw >= 3_000 && raw <= 120_000) return raw;
  return DEFAULT_TIMEOUT_MS;
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
