/**
 * Typed server-only HTTP client for Evolution Go v0.7.2.
 *
 * Endpoints are taken from pkg/routes/routes.go and docs/swagger.json
 * at tag 0.7.2 — not from the Node.js Evolution API.
 *
 * Auth (pkg/middleware/auth_middleware.go):
 *   - Administrative instance routes: header `apikey` = GLOBAL_API_KEY
 *   - Instance operation routes: header `apikey` = tenant instance token
 */

import {
  EVOLUTION_GO_VERSION,
  EvolutionGoConfigError,
  evolutionGoTimeoutMs,
  getEvolutionGoBaseUrl,
  getEvolutionGoGlobalApiKey,
} from './evolution-go-env';

export { EvolutionGoConfigError, EVOLUTION_GO_VERSION };

export class EvolutionGoRequestError extends Error {
  readonly code = 'EVOLUTION_GO_REQUEST';
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'EvolutionGoRequestError';
    this.status = status;
  }
}

export const EVOLUTION_GO_SUBSCRIBE_EVENTS = [
  'MESSAGE',
  'CONNECTION',
  'READ_RECEIPT',
  'QRCODE',
] as const;

export interface EvolutionGoCreateInstanceInput {
  name: string;
  token: string;
  instanceId?: string;
}

export interface EvolutionGoInstance {
  id: string;
  name: string;
  jid?: string;
  connected?: boolean;
  webhook?: string;
  events?: string;
  expiration?: number;
  qrcode?: string;
}

export interface EvolutionGoConnectInput {
  webhookUrl: string;
  subscribe?: string[];
}

export interface EvolutionGoConnectResult {
  jid?: string;
  webhookUrl?: string;
  eventString?: string;
}

export interface EvolutionGoQrcode {
  qrcode: string;
  code: string;
  passkeyStage?: string;
  passkeyOpenUrl?: string;
  passkeyCode?: string;
}

export interface EvolutionGoStatus {
  connected: boolean;
  loggedIn: boolean;
  name: string;
  jid?: string;
}

export interface EvolutionGoSendTextInput {
  number: string;
  text: string;
}

export interface EvolutionGoSendMediaInput {
  number: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'document';
  caption?: string;
  filename?: string;
}

type AuthMode = 'admin' | 'instance';

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  auth: AuthMode;
  instanceToken?: string;
  body?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeErrorText(text: string): string {
  return text
    .replace(/apikey["']?\s*[:=]\s*["']?[^"'\\s]+/gi, 'apikey=[redacted]')
    .replace(
      /instanceToken["']?\s*[:=]\s*["']?[^"'\\s]+/gi,
      'instanceToken=[redacted]'
    )
    .replace(/token["']?\s*[:=]\s*["']?[^"'\\s]{8,}/gi, 'token=[redacted]')
    .slice(0, 300);
}

function dataEnvelope(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const data = payload.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return payload;
}

export function parseEvolutionGoInstance(
  payload: unknown
): EvolutionGoInstance {
  const raw = dataEnvelope(asRecord(payload));
  const id = asString(raw.id || raw.Id || raw.instanceId);
  const name = asString(raw.name || raw.Name);
  if (!id && !name) {
    throw new EvolutionGoRequestError(
      'Evolution Go did not return an instance identity.'
    );
  }
  return {
    id: id || name,
    name: name || id,
    jid: asString(raw.jid || raw.Jid) || undefined,
    connected: Boolean(raw.connected ?? raw.Connected),
    webhook: asString(raw.webhook || raw.Webhook) || undefined,
    events: asString(raw.events || raw.Events) || undefined,
    expiration:
      typeof raw.expiration === 'number'
        ? raw.expiration
        : typeof raw.Expiration === 'number'
          ? raw.Expiration
          : undefined,
    qrcode: asString(raw.qrcode || raw.Qrcode) || undefined,
  };
}

export function parseEvolutionGoQrcode(payload: unknown): EvolutionGoQrcode {
  const raw = dataEnvelope(asRecord(payload));
  return {
    qrcode: asString(raw.qrcode || raw.Qrcode),
    code: asString(raw.code || raw.Code),
    passkeyStage: asString(raw.passkeyStage) || undefined,
    passkeyOpenUrl: asString(raw.passkeyOpenUrl) || undefined,
    passkeyCode: asString(raw.passkeyCode) || undefined,
  };
}

export function parseEvolutionGoStatus(payload: unknown): EvolutionGoStatus {
  const raw = dataEnvelope(asRecord(payload));
  const jidValue = raw.jid ?? raw.Jid ?? raw.myJid;
  const jid =
    typeof jidValue === 'string'
      ? jidValue
      : jidValue && typeof jidValue === 'object'
        ? asString((jidValue as Record<string, unknown>).user) ||
          asString((jidValue as Record<string, unknown>).User)
        : '';
  return {
    connected: Boolean(raw.connected ?? raw.Connected),
    loggedIn: Boolean(raw.loggedIn ?? raw.LoggedIn),
    name: asString(raw.name || raw.Name),
    jid: jid || undefined,
  };
}

function extractSendMessageId(payload: unknown): string {
  const raw = dataEnvelope(asRecord(payload));
  const key = asRecord(raw.key || raw.Key);
  const info = asRecord(raw.Info || raw.info);
  const id =
    asString(raw.id) ||
    asString(raw.ID) ||
    asString(key.id) ||
    asString(key.ID) ||
    asString(info.ID) ||
    asString(info.id);
  if (!id) {
    throw new EvolutionGoRequestError(
      'Evolution Go did not return a message id.'
    );
  }
  return id;
}

async function evolutionGoRequest(
  options: RequestOptions
): Promise<Record<string, unknown>> {
  const baseUrl = getEvolutionGoBaseUrl();
  const apikey =
    options.auth === 'admin'
      ? getEvolutionGoGlobalApiKey()
      : String(options.instanceToken || '').trim();
  if (!apikey) {
    throw new EvolutionGoRequestError(
      'Evolution Go instance token is missing.',
      401
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), evolutionGoTimeoutMs());
  try {
    const response = await fetch(`${baseUrl}${options.path}`, {
      method: options.method,
      headers: {
        apikey,
        Accept: 'application/json',
        ...(options.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    const text = await response.text();
    let json: Record<string, unknown> | null = null;
    if (text) {
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        json = null;
      }
    }

    if (!response.ok) {
      const remoteError = json
        ? asString(json.error || json.message)
        : sanitizeErrorText(text);
      throw new EvolutionGoRequestError(
        remoteError
          ? `Evolution Go request failed (${response.status}).`
          : `Evolution Go request failed (${response.status}).`,
        response.status >= 400 && response.status < 500 ? response.status : 502
      );
    }

    return json || { message: 'success' };
  } catch (error) {
    if (error instanceof EvolutionGoRequestError) throw error;
    if (error instanceof EvolutionGoConfigError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new EvolutionGoRequestError(
        'Evolution Go did not respond in time.',
        504
      );
    }
    throw new EvolutionGoRequestError(
      'Evolution Go is currently unreachable.',
      503
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function createEvolutionGoInstance(
  input: EvolutionGoCreateInstanceInput
): Promise<EvolutionGoInstance> {
  const payload = await evolutionGoRequest({
    method: 'POST',
    path: '/instance/create',
    auth: 'admin',
    body: {
      name: input.name,
      token: input.token,
      ...(input.instanceId ? { instanceId: input.instanceId } : {}),
    },
  });
  return parseEvolutionGoInstance(payload);
}

export async function connectEvolutionGoInstance(
  instanceToken: string,
  input: EvolutionGoConnectInput
): Promise<EvolutionGoConnectResult> {
  const payload = await evolutionGoRequest({
    method: 'POST',
    path: '/instance/connect',
    auth: 'instance',
    instanceToken,
    body: {
      webhookUrl: input.webhookUrl,
      subscribe: input.subscribe || [...EVOLUTION_GO_SUBSCRIBE_EVENTS],
      rabbitmqEnable: 'disabled',
      websocketEnable: 'disabled',
      natsEnable: 'disabled',
    },
  });
  const data = dataEnvelope(payload);
  return {
    jid: asString(data.jid) || undefined,
    webhookUrl: asString(data.webhookUrl) || undefined,
    eventString: asString(data.eventString) || undefined,
  };
}

export async function getEvolutionGoQr(
  instanceToken: string
): Promise<EvolutionGoQrcode> {
  const payload = await evolutionGoRequest({
    method: 'GET',
    path: '/instance/qr',
    auth: 'instance',
    instanceToken,
  });
  return parseEvolutionGoQrcode(payload);
}

export async function getEvolutionGoStatus(
  instanceToken: string
): Promise<EvolutionGoStatus> {
  const payload = await evolutionGoRequest({
    method: 'GET',
    path: '/instance/status',
    auth: 'instance',
    instanceToken,
  });
  return parseEvolutionGoStatus(payload);
}

export async function reconnectEvolutionGoInstance(
  instanceToken: string
): Promise<void> {
  await evolutionGoRequest({
    method: 'POST',
    path: '/instance/reconnect',
    auth: 'instance',
    instanceToken,
  });
}

export async function disconnectEvolutionGoInstance(
  instanceToken: string
): Promise<void> {
  await evolutionGoRequest({
    method: 'POST',
    path: '/instance/disconnect',
    auth: 'instance',
    instanceToken,
  });
}

export async function logoutEvolutionGoInstance(
  instanceToken: string
): Promise<void> {
  await evolutionGoRequest({
    method: 'DELETE',
    path: '/instance/logout',
    auth: 'instance',
    instanceToken,
  });
}

export async function deleteEvolutionGoInstance(
  instanceId: string
): Promise<void> {
  await evolutionGoRequest({
    method: 'DELETE',
    path: `/instance/delete/${encodeURIComponent(instanceId)}`,
    auth: 'admin',
  });
}

export async function getEvolutionGoInstanceInfo(
  instanceId: string
): Promise<EvolutionGoInstance> {
  const payload = await evolutionGoRequest({
    method: 'GET',
    path: `/instance/info/${encodeURIComponent(instanceId)}`,
    auth: 'admin',
  });
  return parseEvolutionGoInstance(payload);
}

export async function sendEvolutionGoText(
  instanceToken: string,
  input: EvolutionGoSendTextInput
): Promise<{ externalMessageId: string }> {
  const payload = await evolutionGoRequest({
    method: 'POST',
    path: '/send/text',
    auth: 'instance',
    instanceToken,
    body: {
      number: input.number,
      text: input.text,
      formatJid: true,
    },
  });
  return { externalMessageId: extractSendMessageId(payload) };
}

export async function sendEvolutionGoMedia(
  instanceToken: string,
  input: EvolutionGoSendMediaInput
): Promise<{ externalMessageId: string }> {
  const payload = await evolutionGoRequest({
    method: 'POST',
    path: '/send/media',
    auth: 'instance',
    instanceToken,
    body: {
      number: input.number,
      url: input.url,
      type: input.type,
      caption: input.caption || '',
      filename: input.filename || '',
      formatJid: true,
    },
  });
  return { externalMessageId: extractSendMessageId(payload) };
}

export function isEvolutionGoNotFoundError(error: unknown): boolean {
  return (
    error instanceof EvolutionGoRequestError &&
    (error.status === 404 || error.status === 400)
  );
}
