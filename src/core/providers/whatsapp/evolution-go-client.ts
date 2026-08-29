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

/** Never accept the Helpa app/login page as an Evolution Go endpoint. */
export const EVOLUTION_GO_WRONG_HOST_MESSAGE =
  'EVOLUTION_GO_BASE_URL is not Evolution Go. Point it at an Evolution Go server exposing GET /server/ok JSON, not the Helpa app or a login page.';

function isHttpRedirectStatus(status: number): boolean {
  return (
    status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308
  );
}

function looksLikeHtmlDocument(text: string, contentType: string): boolean {
  const type = contentType.toLowerCase();
  if (type.includes('text/html')) return true;
  const trimmed = text.trim();
  return (
    trimmed.startsWith('<') ||
    /<!doctype html/i.test(trimmed) ||
    /<html[\s>]/i.test(trimmed)
  );
}

function assertEvolutionEngineResponse(response: Response, text: string): void {
  if (
    isHttpRedirectStatus(response.status) ||
    response.type === 'opaqueredirect'
  ) {
    throw new EvolutionGoConfigError(EVOLUTION_GO_WRONG_HOST_MESSAGE);
  }
  // Reject HTTP 200 HTML pages or explicit Helpa/Next.js pages
  if (
    response.ok &&
    looksLikeHtmlDocument(text, response.headers.get('content-type') || '')
  ) {
    throw new EvolutionGoConfigError(EVOLUTION_GO_WRONG_HOST_MESSAGE);
  }
  if (text.includes('/_next/static') || text.includes('__NEXT_DATA__')) {
    throw new EvolutionGoConfigError(EVOLUTION_GO_WRONG_HOST_MESSAGE);
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
  const id = asString(raw.id || raw.Id || raw.instanceId || raw.name);
  const name = asString(raw.name || raw.Name || raw.id);
  if (!id && !name) {
    throw new EvolutionGoRequestError(
      'Evolution Go did not return an instance identity.'
    );
  }
  return {
    id: id || name,
    name: name || id,
    jid: asString(raw.jid || raw.Jid) || undefined,
    connected: Boolean(
      raw.connected ?? raw.Connected ?? raw.status === 'WORKING'
    ),
    webhook: asString(raw.webhook || raw.Webhook) || undefined,
    events: asString(raw.events || raw.Events) || undefined,
    expiration:
      typeof raw.expiration === 'number'
        ? raw.expiration
        : typeof raw.Expiration === 'number'
          ? raw.Expiration
          : undefined,
    qrcode: asString(raw.qrcode || raw.Qrcode || raw.qr) || undefined,
  };
}

export function parseEvolutionGoQrcode(payload: unknown): EvolutionGoQrcode {
  const raw = dataEnvelope(asRecord(payload));
  const qr = asString(
    raw.qrcode || raw.Qrcode || raw.qr || raw.code || raw.image
  );
  return {
    qrcode: qr,
    code: asString(raw.code || raw.Code) || qr,
    passkeyStage: asString(raw.passkeyStage) || undefined,
    passkeyOpenUrl: asString(raw.passkeyOpenUrl) || undefined,
    passkeyCode: asString(raw.passkeyCode) || undefined,
  };
}

export function parseEvolutionGoStatus(payload: unknown): EvolutionGoStatus {
  const raw = dataEnvelope(asRecord(payload));
  const statusStr = asString(raw.status || '').toUpperCase();
  const jidValue =
    raw.jid ?? raw.Jid ?? raw.myJid ?? (raw.me as Record<string, unknown>)?.id;
  const jid =
    typeof jidValue === 'string'
      ? jidValue
      : jidValue && typeof jidValue === 'object'
        ? asString((jidValue as Record<string, unknown>).user) ||
          asString((jidValue as Record<string, unknown>).User) ||
          asString((jidValue as Record<string, unknown>).id)
        : '';
  const isWorking = statusStr === 'WORKING' || statusStr === 'CONNECTED';
  return {
    connected: Boolean(raw.connected ?? raw.Connected ?? isWorking),
    loggedIn: Boolean(raw.loggedIn ?? raw.LoggedIn ?? isWorking),
    name: asString(
      raw.name || raw.Name || (raw.me as Record<string, unknown>)?.pushName
    ),
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
    asString(info.id) ||
    asString(raw.messageId);
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
        'X-Api-Key': apikey,
        Accept: 'application/json, image/png, */*',
        ...(options.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      redirect: 'manual',
      signal: controller.signal,
    });

    if (
      isHttpRedirectStatus(response.status) ||
      response.type === 'opaqueredirect'
    ) {
      throw new EvolutionGoConfigError(EVOLUTION_GO_WRONG_HOST_MESSAGE);
    }

    const contentType = response.headers.get('content-type') || '';

    // Handle binary image responses only when the upstream actually succeeded.
    if (response.ok && contentType.includes('image/')) {
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const dataUrl = `data:${contentType.split(';')[0]};base64,${base64}`;
      return {
        qrcode: dataUrl,
        code: dataUrl,
        raw: dataUrl,
        image: dataUrl,
      };
    }

    const text = await response.text();
    assertEvolutionEngineResponse(response, text);

    let json: Record<string, unknown> | null = null;
    if (text) {
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        json = null;
      }
    }

    if (!response.ok) {
      const code = json ? asString(json.code) : '';
      const safeText = sanitizeErrorText(text);
      if (code === 'LICENSE_REQUIRED' || /license required/i.test(safeText)) {
        throw new EvolutionGoConfigError(
          'Evolution Go is not licensed. Open the Evolution manager, activate the community license, then generate the QR again.'
        );
      }
      throw new EvolutionGoRequestError(
        `Evolution Go request failed (${response.status}).`,
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
  input: EvolutionGoConnectInput,
  _instanceName?: string
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
  instanceToken: string,
  _instanceName?: string
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
  instanceToken: string,
  _instanceName?: string
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
  instanceToken: string,
  _instanceName?: string
): Promise<void> {
  await evolutionGoRequest({
    method: 'POST',
    path: '/instance/reconnect',
    auth: 'instance',
    instanceToken,
  });
}

export async function disconnectEvolutionGoInstance(
  instanceToken: string,
  _instanceName?: string
): Promise<void> {
  await evolutionGoRequest({
    method: 'POST',
    path: '/instance/disconnect',
    auth: 'instance',
    instanceToken,
  });
}

export async function logoutEvolutionGoInstance(
  instanceToken: string,
  _instanceName?: string
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
