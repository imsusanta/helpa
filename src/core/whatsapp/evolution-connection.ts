/**
 * Evolution Go QR connection lifecycle for a Helpa workspace.
 *
 * State lives in whatsapp_configs, not process memory.
 */

import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { getAdminClient } from '@/lib/db/server';
import { encrypt } from '@/lib/whatsapp/encryption';
import {
  decryptProviderToken,
  loadCanonicalWhatsAppConfig,
  evolutionPhoneNumberId,
  isMetaLiveConfig,
  phoneFromWhatsAppJid,
  type CanonicalWhatsAppConfig,
} from '@/core/whatsapp/canonical-config';
import {
  connectEvolutionGoInstance,
  createEvolutionGoInstance,
  deleteEvolutionGoInstance,
  disconnectEvolutionGoInstance,
  EvolutionGoRequestError,
  getEvolutionGoQr,
  getEvolutionGoStatus,
  isEvolutionGoNotFoundError,
  logoutEvolutionGoInstance,
  reconnectEvolutionGoInstance,
  EVOLUTION_GO_SUBSCRIBE_EVENTS,
} from '@/core/providers/whatsapp/evolution-go-client';
import { hashWebhookSecret } from '@/core/providers/whatsapp/evolution-go-provider';
import {
  EvolutionGoConfigError,
  buildEvolutionWebhookUrl,
  getEvolutionGoBaseUrl,
  hasEnoughEvolutionDeadline,
} from '@/core/providers/whatsapp/evolution-go-env';
import { logger } from '@/lib/observability/logger';

export type EvolutionConnectionUiStatus =
  | 'creating_instance'
  | 'waiting_for_qr'
  | 'waiting_for_scan'
  | 'connected'
  | 'disconnected'
  | 'reconnect_required'
  | 'error';

export interface EvolutionQrSessionResponse {
  success: boolean;
  status: EvolutionConnectionUiStatus;
  qr_code: string | null;
  qr_image: string | null;
  pairing_code?: string | null;
  expires_in: number | null;
  phone_number?: string | null;
  verified_name?: string | null;
  is_qr_linked?: boolean;
  provider?: 'evolution';
  connection_type?: 'qr_linked_device';
  error?: string;
  error_code?:
    | 'EVOLUTION_GO_CONFIG'
    | 'EVOLUTION_GO_AUTH_FAILED'
    | 'EVOLUTION_GO_LICENSE_REQUIRED'
    | 'EVOLUTION_GO_UNREACHABLE'
    | 'EVOLUTION_GO_REQUEST_FAILED';
  conflict?: boolean;
  /** Internal HTTP status for failed POST/reconnect. Not sent to clients. */
  failure_status?: 502 | 503 | 504;
}

const QR_TTL_SECONDS = 60;
const SAFE_CONNECT_ERROR = 'Could not complete the WhatsApp QR connection.';

function opaqueInstanceName(accountId: string): string {
  const digest = crypto
    .createHash('sha256')
    .update(`helpa-evo-v1:${accountId}`)
    .digest('hex')
    .slice(0, 24);
  return `h${digest}`;
}

function opaqueInstanceUuid(accountId: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(`helpa-evo-instance-v1:${accountId}`)
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

export function toPublicQrSession(session: EvolutionQrSessionResponse) {
  const expiresAt =
    session.expires_in && session.expires_in > 0
      ? new Date(Date.now() + session.expires_in * 1000).toISOString()
      : null;
  return {
    success: session.success,
    connected: session.status === 'connected',
    status: session.status,
    qr: session.qr_code,
    qr_code: session.qr_code,
    qr_image: session.qr_image,
    pairing_code: session.pairing_code ?? null,
    expires_in: session.expires_in,
    expires_in_seconds: session.expires_in,
    expires_at: expiresAt,
    phone_number: session.phone_number ?? null,
    display_name: session.verified_name ?? null,
    verified_name: session.verified_name ?? null,
    is_qr_linked: session.is_qr_linked ?? session.status === 'connected',
    provider: session.provider ?? 'evolution',
    connection_type: session.connection_type ?? 'qr_linked_device',
    error: session.error,
    error_code: session.error_code,
    conflict: session.conflict,
  };
}

function publicErrorCode(
  error: unknown
): EvolutionQrSessionResponse['error_code'] {
  if (error instanceof EvolutionGoConfigError) {
    return /license/i.test(error.message)
      ? 'EVOLUTION_GO_LICENSE_REQUIRED'
      : 'EVOLUTION_GO_CONFIG';
  }
  if (error instanceof EvolutionGoRequestError) {
    if (error.status === 401 || error.status === 403) {
      return 'EVOLUTION_GO_AUTH_FAILED';
    }
    if (error.status === 502 || error.status === 503 || error.status === 504) {
      return 'EVOLUTION_GO_UNREACHABLE';
    }
    return 'EVOLUTION_GO_REQUEST_FAILED';
  }
  return 'EVOLUTION_GO_REQUEST_FAILED';
}

function publicErrorMessage(error: unknown): string {
  if (error instanceof EvolutionGoConfigError) return error.message;
  if (error instanceof EvolutionGoRequestError) {
    if (error.status === 401 || error.status === 403) {
      return 'Evolution Go rejected the configured API key. Update EVOLUTION_GO_GLOBAL_API_KEY to match the Evolution Go server, then restart both services.';
    }
    if (error.status === 503 || error.status === 504) {
      return 'WhatsApp QR service is temporarily unreachable. Try again shortly.';
    }
    return SAFE_CONNECT_ERROR;
  }
  return SAFE_CONNECT_ERROR;
}

function evolutionGoHostname(): string | null {
  try {
    return new URL(getEvolutionGoBaseUrl()).hostname;
  } catch {
    return null;
  }
}

function qrSessionFailureStatus(error: unknown): 502 | 503 | 504 {
  if (error instanceof EvolutionGoConfigError) return 503;
  if (error instanceof EvolutionGoRequestError) {
    if (error.status === 504 || error.status === 503) return error.status;
  }
  return 502;
}

function failedQrSession(
  error: unknown,
  extras: {
    status?: EvolutionConnectionUiStatus;
    conflict?: boolean;
  } = {}
): EvolutionQrSessionResponse {
  const failure_status = qrSessionFailureStatus(error);
  logger.error('WhatsApp QR session failed', {
    component: 'qr-session',
    httpStatus: failure_status,
    evolutionHost: evolutionGoHostname(),
  });
  return {
    success: false,
    status: extras.status ?? 'error',
    qr_code: null,
    qr_image: null,
    expires_in: null,
    provider: 'evolution',
    connection_type: 'qr_linked_device',
    error: publicErrorMessage(error),
    error_code: publicErrorCode(error),
    failure_status,
    ...(extras.conflict ? { conflict: true } : {}),
  };
}

function waitingForQrSession(): EvolutionQrSessionResponse {
  return {
    success: true,
    status: 'waiting_for_qr',
    qr_code: null,
    qr_image: null,
    expires_in: null,
    provider: 'evolution',
    connection_type: 'qr_linked_device',
  };
}

function isQrNotReadyError(error: unknown): boolean {
  if (!(error instanceof EvolutionGoRequestError)) return false;
  return (
    error.status === 503 ||
    error.status === 504 ||
    error.status === 400 ||
    error.status === 404
  );
}

function storeSafeConnectionError(error: unknown): string {
  if (error instanceof EvolutionGoConfigError)
    return error.message.slice(0, 500);
  if (error instanceof EvolutionGoRequestError) {
    return `Evolution Go request failed (${error.status}).`.slice(0, 500);
  }
  return SAFE_CONNECT_ERROR;
}

async function qrImageFromPairing(
  code: string,
  png?: string
): Promise<{
  qrCode: string | null;
  qrImage: string | null;
}> {
  const pairing = code.startsWith('2@') || code.startsWith('1@') ? code : '';
  const imageCandidate = png || (!pairing ? code : '');
  let qrImage: string | null = null;
  if (imageCandidate.startsWith('data:image/')) {
    qrImage = imageCandidate;
  } else if (
    imageCandidate.startsWith('iVBOR') ||
    (imageCandidate.length > 80 && /^[A-Za-z0-9+/=]+$/.test(imageCandidate))
  ) {
    qrImage = `data:image/png;base64,${imageCandidate}`;
  }
  const scannable = pairing || code;
  if (scannable && !qrImage) {
    try {
      qrImage = await QRCode.toDataURL(scannable, {
        width: 320,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
    } catch {
      qrImage = null;
    }
  }
  return {
    qrCode: scannable || null,
    qrImage,
  };
}

async function persistEvolutionConfig(
  accountId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const db = getAdminClient();
  const now = new Date().toISOString();
  const payload = { ...patch, updated_at: now };
  const existing = await loadCanonicalWhatsAppConfig(accountId);
  if (existing?.source === 'whatsapp_configs' && existing.id) {
    const { error } = await db
      .from('whatsapp_configs')
      .update(payload)
      .eq('id', existing.id)
      .eq('account_id', accountId);
    if (error) throw error;
    return;
  }
  const { error } = await db.from('whatsapp_configs').insert({
    account_id: accountId,
    ...payload,
  });
  if (error) throw error;
}

async function markConnectionError(
  accountId: string,
  error: unknown
): Promise<void> {
  try {
    await persistEvolutionConfig(accountId, {
      connection_error: storeSafeConnectionError(error),
      connection_status: 'error',
      status: 'error',
      last_health_check_at: new Date().toISOString(),
    });
  } catch {
    // Persistence of the sanitized error is best-effort.
  }
}

function sessionFromConfig(
  config: CanonicalWhatsAppConfig,
  extras: Partial<EvolutionQrSessionResponse> = {}
): EvolutionQrSessionResponse {
  const status = (config.connectionStatus ||
    config.status ||
    'disconnected') as EvolutionConnectionUiStatus;
  const connected = status === 'connected';
  return {
    success: true,
    status,
    qr_code: extras.qr_code ?? null,
    qr_image: extras.qr_image ?? null,
    expires_in: extras.expires_in ?? null,
    phone_number: config.displayPhoneNumber || null,
    verified_name: config.verifiedName || null,
    is_qr_linked: connected,
    provider: 'evolution',
    connection_type: 'qr_linked_device',
    ...extras,
  };
}

async function applyLiveStatus(
  accountId: string,
  instanceToken: string,
  config: CanonicalWhatsAppConfig,
  instanceName?: string
): Promise<EvolutionQrSessionResponse> {
  const targetName =
    instanceName ||
    config.providerInstanceName ||
    opaqueInstanceName(accountId);
  const status = await getEvolutionGoStatus(instanceToken, targetName);
  const now = new Date().toISOString();
  if (status.connected && status.loggedIn) {
    const phone = phoneFromWhatsAppJid(status.jid) || config.displayPhoneNumber;
    await persistEvolutionConfig(accountId, {
      provider: 'evolution',
      connection_type: 'qr_linked_device',
      status: 'connected',
      connection_status: 'connected',
      connection_error: null,
      display_phone_number: phone || null,
      phone_number: phone || null,
      verified_name: status.name || config.verifiedName || null,
      registered_at: config.raw.registered_at || now,
      connected_at: now,
      disconnected_at: null,
      last_health_check_at: now,
    });
    return {
      success: true,
      status: 'connected',
      qr_code: null,
      qr_image: null,
      expires_in: null,
      phone_number: phone || null,
      verified_name: status.name || config.verifiedName || null,
      is_qr_linked: true,
      provider: 'evolution',
      connection_type: 'qr_linked_device',
    };
  }

  try {
    const qr = await getEvolutionGoQr(instanceToken, targetName);
    const rendered = await qrImageFromPairing(qr.code, qr.qrcode);
    if (rendered.qrCode || rendered.qrImage) {
      await persistEvolutionConfig(accountId, {
        provider: 'evolution',
        status: 'connecting',
        connection_status: 'waiting_for_scan',
        connection_error: null,
        last_health_check_at: now,
      });
      return {
        success: true,
        status: 'waiting_for_scan',
        qr_code: rendered.qrCode,
        qr_image: rendered.qrImage,
        pairing_code: qr.passkeyCode || null,
        expires_in: QR_TTL_SECONDS,
        provider: 'evolution',
        connection_type: 'qr_linked_device',
      };
    }
  } catch (error) {
    if (!isEvolutionGoNotFoundError(error)) {
      await persistEvolutionConfig(accountId, {
        connection_status: status.connected
          ? 'waiting_for_qr'
          : 'reconnect_required',
        status: status.connected ? 'connecting' : 'needs_reconnect',
        connection_error: storeSafeConnectionError(error),
        last_health_check_at: now,
      });
    }
  }

  const uiStatus: EvolutionConnectionUiStatus = status.connected
    ? 'waiting_for_qr'
    : config.status === 'connected'
      ? 'reconnect_required'
      : 'disconnected';
  await persistEvolutionConfig(accountId, {
    connection_status: uiStatus,
    status:
      uiStatus === 'reconnect_required' ? 'needs_reconnect' : 'disconnected',
    last_health_check_at: now,
  });
  return {
    success: true,
    status: uiStatus,
    qr_code: null,
    qr_image: null,
    expires_in: null,
    provider: 'evolution',
    connection_type: 'qr_linked_device',
  };
}

async function connectAndFetchQr(
  accountId: string,
  instanceToken: string,
  webhookSecret: string,
  instanceName?: string
): Promise<EvolutionQrSessionResponse> {
  const targetName = instanceName || opaqueInstanceName(accountId);
  const webhookUrl = buildEvolutionWebhookUrl(webhookSecret);
  try {
    await connectEvolutionGoInstance(
      instanceToken,
      {
        webhookUrl,
        subscribe: [...EVOLUTION_GO_SUBSCRIBE_EVENTS],
      },
      targetName
    );
  } catch (error) {
    await markConnectionError(accountId, error);
    return failedQrSession(error);
  }

  if (!hasEnoughEvolutionDeadline(1_500)) {
    await persistEvolutionConfig(accountId, {
      status: 'connecting',
      connection_status: 'waiting_for_qr',
      connection_error: null,
    });
    return {
      success: true,
      status: 'waiting_for_qr',
      qr_code: null,
      qr_image: null,
      expires_in: null,
      provider: 'evolution',
      connection_type: 'qr_linked_device',
    };
  }

  try {
    const qr = await getEvolutionGoQr(instanceToken, targetName);
    const rendered = await qrImageFromPairing(qr.code, qr.qrcode);
    await persistEvolutionConfig(accountId, {
      status: 'connecting',
      connection_status:
        rendered.qrCode || rendered.qrImage
          ? 'waiting_for_scan'
          : 'waiting_for_qr',
      connection_error: null,
    });
    return {
      success: true,
      status:
        rendered.qrCode || rendered.qrImage
          ? 'waiting_for_scan'
          : 'waiting_for_qr',
      qr_code: rendered.qrCode,
      qr_image: rendered.qrImage,
      pairing_code: qr.passkeyCode || null,
      expires_in: rendered.qrCode || rendered.qrImage ? QR_TTL_SECONDS : null,
      provider: 'evolution',
      connection_type: 'qr_linked_device',
    };
  } catch (error) {
    if (isQrNotReadyError(error)) {
      await persistEvolutionConfig(accountId, {
        status: 'connecting',
        connection_status: 'waiting_for_qr',
        connection_error: null,
      });
      return waitingForQrSession();
    }
    await markConnectionError(accountId, error);
    return failedQrSession(error, { status: 'waiting_for_qr' });
  }
}

export async function getEvolutionQrSession(
  accountId: string
): Promise<EvolutionQrSessionResponse> {
  const config = await loadCanonicalWhatsAppConfig(accountId);
  if (!config || config.providerKind !== 'evolution') {
    return {
      success: true,
      status: 'disconnected',
      qr_code: null,
      qr_image: null,
      expires_in: null,
      provider: 'evolution',
      connection_type: 'qr_linked_device',
    };
  }
  if (!config.providerInstanceId || !config.providerTokenEncrypted) {
    return sessionFromConfig(config, { status: 'disconnected' });
  }
  try {
    const instanceToken = decryptProviderToken(config);
    const instanceName =
      config.providerInstanceName || opaqueInstanceName(accountId);
    if (config.connectionStatus === 'creating_instance') {
      const secret = crypto.randomBytes(32).toString('base64url');
      await persistEvolutionConfig(accountId, {
        webhook_secret_hash: hashWebhookSecret(secret),
        connection_status: 'waiting_for_qr',
        status: 'connecting',
      });
      return await connectAndFetchQr(
        accountId,
        instanceToken,
        secret,
        instanceName
      );
    }
    return await applyLiveStatus(
      accountId,
      instanceToken,
      config,
      instanceName
    );
  } catch (error) {
    return failedQrSession(error);
  }
}

export async function startEvolutionQrSession(
  accountId: string
): Promise<EvolutionQrSessionResponse> {
  const existing = await loadCanonicalWhatsAppConfig(accountId);
  if (existing && isMetaLiveConfig(existing)) {
    return {
      success: false,
      status: 'error',
      qr_code: null,
      qr_image: null,
      expires_in: null,
      conflict: true,
      error:
        'Official WhatsApp (Meta) is already connected. Disconnect it before linking a QR device.',
    };
  }

  if (
    existing?.providerKind === 'evolution' &&
    existing.providerInstanceId &&
    existing.providerTokenEncrypted
  ) {
    try {
      const instanceToken = decryptProviderToken(existing);
      const existingName =
        existing.providerInstanceName || opaqueInstanceName(accountId);
      const live = await applyLiveStatus(
        accountId,
        instanceToken,
        existing,
        existingName
      );
      if (live.status === 'connected' || live.qr_code || live.qr_image) {
        return live;
      }
      const secret = crypto.randomBytes(32).toString('base64url');
      await persistEvolutionConfig(accountId, {
        webhook_secret_hash: hashWebhookSecret(secret),
        connection_status: 'waiting_for_qr',
        status: 'connecting',
      });
      return await connectAndFetchQr(
        accountId,
        instanceToken,
        secret,
        existingName
      );
    } catch (error) {
      if (
        error instanceof EvolutionGoRequestError &&
        (error.status === 504 || error.status === 503)
      ) {
        return {
          success: true,
          status: 'waiting_for_qr',
          qr_code: null,
          qr_image: null,
          expires_in: null,
          provider: 'evolution',
          connection_type: 'qr_linked_device',
        };
      }
      if (!isEvolutionGoNotFoundError(error)) {
        await markConnectionError(accountId, error);
        return failedQrSession(error);
      }
    }
  }

  const instanceId = opaqueInstanceUuid(accountId);
  const instanceName = opaqueInstanceName(accountId);
  const instanceToken = crypto.randomBytes(32).toString('hex');
  const webhookSecret = crypto.randomBytes(32).toString('base64url');
  const encryptedToken = encrypt(instanceToken);

  let resolvedId = instanceId;
  try {
    const created = await createEvolutionGoInstance({
      name: instanceName,
      token: instanceToken,
      instanceId,
    });
    resolvedId = created.id || instanceId;
  } catch (error) {
    if (!hasEnoughEvolutionDeadline(2_000)) {
      await markConnectionError(accountId, error);
      return failedQrSession(error);
    }
    try {
      await deleteEvolutionGoInstance(instanceId);
      const created = await createEvolutionGoInstance({
        name: instanceName,
        token: instanceToken,
        instanceId,
      });
      resolvedId = created.id || instanceId;
    } catch {
      try {
        await deleteEvolutionGoInstance(instanceId);
      } catch {
        // Compensating delete is best-effort when create partially succeeded.
      }
      await markConnectionError(accountId, error);
      return failedQrSession(error);
    }
  }

  try {
    await persistEvolutionConfig(accountId, {
      provider: 'evolution',
      connection_type: 'qr_linked_device',
      phone_number_id: evolutionPhoneNumberId(resolvedId),
      encrypted_access_token: encryptedToken,
      provider_token_encrypted: encryptedToken,
      provider_instance_id: resolvedId,
      provider_instance_name: instanceName,
      webhook_secret_hash: hashWebhookSecret(webhookSecret),
      status: 'connecting',
      connection_status: 'creating_instance',
      connection_error: null,
      waba_id: null,
      registered_at: null,
      connected_at: null,
      disconnected_at: null,
    });
  } catch (error) {
    try {
      await deleteEvolutionGoInstance(resolvedId);
    } catch {
      // Compensating delete when Helpa persistence fails after create.
    }
    await markConnectionError(accountId, error);
    return failedQrSession(error);
  }

  if (!hasEnoughEvolutionDeadline(2_000)) {
    return {
      success: true,
      status: 'creating_instance',
      qr_code: null,
      qr_image: null,
      expires_in: null,
      provider: 'evolution',
      connection_type: 'qr_linked_device',
    };
  }

  return connectAndFetchQr(
    accountId,
    instanceToken,
    webhookSecret,
    instanceName
  );
}

export async function reconnectEvolutionQrSession(
  accountId: string
): Promise<EvolutionQrSessionResponse> {
  const config = await loadCanonicalWhatsAppConfig(accountId);
  if (!config || config.providerKind !== 'evolution') {
    return startEvolutionQrSession(accountId);
  }
  try {
    const instanceToken = decryptProviderToken(config);
    const instanceName =
      config.providerInstanceName || opaqueInstanceName(accountId);
    await reconnectEvolutionGoInstance(instanceToken, instanceName);
    return await applyLiveStatus(
      accountId,
      instanceToken,
      config,
      instanceName
    );
  } catch (error) {
    await markConnectionError(accountId, error);
    return failedQrSession(error, { status: 'reconnect_required' });
  }
}

export async function disconnectEvolutionQrSession(
  accountId: string
): Promise<{ success: boolean; status: 'disconnected'; message: string }> {
  const config = await loadCanonicalWhatsAppConfig(accountId);
  if (!config || config.providerKind !== 'evolution') {
    return {
      success: true,
      status: 'disconnected',
      message:
        'WhatsApp QR device is not linked. Conversation history was preserved.',
    };
  }

  const instanceToken = config.providerTokenEncrypted
    ? decryptProviderToken(config)
    : '';
  const instanceName =
    config.providerInstanceName || opaqueInstanceName(accountId);
  if (instanceToken) {
    try {
      await logoutEvolutionGoInstance(instanceToken, instanceName);
    } catch (error) {
      if (!isEvolutionGoNotFoundError(error)) {
        try {
          await disconnectEvolutionGoInstance(instanceToken, instanceName);
        } catch {
          // External instance may already be gone.
        }
      }
    }
  }
  if (config.providerInstanceId) {
    try {
      await deleteEvolutionGoInstance(config.providerInstanceId);
    } catch {
      // Keep Helpa state cleared even if Evolution delete is delayed.
    }
  }

  const now = new Date().toISOString();
  const db = getAdminClient();
  if (config.source === 'whatsapp_configs' && config.id) {
    await db
      .from('whatsapp_configs')
      .delete()
      .eq('id', config.id)
      .eq('account_id', accountId)
      .eq('provider', 'evolution');
  } else {
    await persistEvolutionConfig(accountId, {
      provider: 'evolution',
      provider_instance_id: null,
      provider_instance_name: null,
      provider_token_encrypted: null,
      webhook_secret_hash: null,
      encrypted_access_token: encrypt(
        `evolution-cleared:${crypto.randomUUID()}`
      ),
      status: 'disconnected',
      connection_status: 'disconnected',
      disconnected_at: now,
      connected_at: null,
      registered_at: null,
      connection_error: null,
    });
  }

  return {
    success: true,
    status: 'disconnected',
    message:
      'WhatsApp QR device was unlinked. Contacts, conversations, and messages were preserved.',
  };
}

export async function updateEvolutionHealth(
  accountId: string
): Promise<EvolutionQrSessionResponse> {
  return getEvolutionQrSession(accountId);
}

export { publicErrorMessage };
