/**
 * Helpa Core Platform — Unified WhatsApp Service
 *
 * Single, industry-agnostic entrypoint for all WhatsApp operations across Helpa:
 * outgoing messages, health checks, multi-tenant connection status, disconnect,
 * and reconnect.
 */

import { getAdminClient } from '@/lib/db/server';
import { decrypt } from '@/lib/whatsapp/encryption';
import { normalizePhone } from '@/lib/whatsapp/phone-utils';
import { coreEvents } from '@/core/events';
import type {
  WhatsAppConnection,
  WhatsAppHealthReport,
  WhatsAppSendOptions,
  WhatsAppSendResult,
} from './types';
import {
  classifyWhatsAppProvider,
  loadCanonicalWhatsAppConfig,
} from './canonical-config';
import { resolveWhatsAppProvider } from '@/core/providers/whatsapp/provider-resolver';
import { UnsupportedWhatsAppOperationError } from '@/core/providers/whatsapp/whatsapp-provider.interface';
import {
  disconnectEvolutionQrSession,
  reconnectEvolutionQrSession,
  updateEvolutionHealth,
} from './evolution-connection';

const META_API_VERSION = 'v21.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

/**
 * Retrieves the current WhatsApp connection record for a tenant.
 */
export async function getWhatsAppConnection(
  tenantId: string
): Promise<WhatsAppConnection | null> {
  if (!tenantId) return null;

  const canonical = await loadCanonicalWhatsAppConfig(tenantId);
  if (canonical?.providerKind === 'evolution') {
    const connected =
      canonical.status === 'connected' ||
      canonical.connectionStatus === 'connected';
    return {
      id: canonical.id || canonical.accountId,
      workspaceId: tenantId,
      wabaId: canonical.wabaId,
      phoneNumberId: canonical.phoneNumberId,
      displayPhoneNumber: canonical.displayPhoneNumber || undefined,
      businessName: canonical.verifiedName || undefined,
      connectionStatus: connected
        ? 'CONNECTED'
        : canonical.connectionStatus === 'reconnect_required'
          ? 'RECONNECT_REQUIRED'
          : canonical.status === 'connecting'
            ? 'CONNECTING'
            : 'NOT_CONNECTED',
      connectedAt:
        typeof canonical.raw.connected_at === 'string'
          ? canonical.raw.connected_at
          : undefined,
      lastWebhookAt:
        typeof canonical.raw.last_webhook_at === 'string'
          ? canonical.raw.last_webhook_at
          : undefined,
      lastHealthCheckAt:
        typeof canonical.raw.last_health_check_at === 'string'
          ? canonical.raw.last_health_check_at
          : undefined,
    };
  }

  const db = getAdminClient();
  const { data: rows, error } = await db
    .from('whatsapp_config')
    .select('*')
    .eq('account_id', tenantId)
    .limit(1);

  if (error || !rows || rows.length === 0) {
    return null;
  }

  const config = rows[0];
  const hasToken = Boolean(
    config.access_token_encrypted ||
    config.encrypted_access_token ||
    config.access_token
  );
  const isRegistered = Boolean(config.registered_at);

  let connectionStatus: WhatsAppConnection['connectionStatus'] =
    'NOT_CONNECTED';
  if (hasToken && config.phone_number_id && isRegistered) {
    connectionStatus = 'CONNECTED';
  } else if (hasToken && config.phone_number_id) {
    connectionStatus = 'PENDING_VERIFICATION';
  } else if (hasToken) {
    connectionStatus = 'CONNECTING';
  }

  return {
    id: String(config.id || config.account_id),
    workspaceId: tenantId,
    businessId: config.business_id || undefined,
    wabaId: String(config.waba_id || ''),
    phoneNumberId: String(config.phone_number_id || ''),
    displayPhoneNumber:
      config.display_phone_number || config.phone_number || undefined,
    businessName: config.verified_name || config.business_name || undefined,
    connectionStatus,
    coexistenceStatus: config.coexistence_eligible ? 'active' : 'unknown',
    connectedAt: config.registered_at || config.created_at || undefined,
    lastWebhookAt: config.last_webhook_at || undefined,
    lastMessageAt: config.last_message_at || undefined,
    lastHealthCheckAt: config.last_health_check_at || undefined,
  };
}

/**
 * Sends a WhatsApp message via Meta Cloud API with multi-tenant isolation.
 */
export async function sendWhatsAppMessage(
  options: WhatsAppSendOptions
): Promise<WhatsAppSendResult> {
  const {
    tenantId,
    to,
    type = 'text',
    text,
    mediaUrl,
    templateName,
    templateLanguage = 'en_US',
    templateComponents,
  } = options;

  if (!tenantId) {
    return {
      success: false,
      error: 'Tenant ID is required to send WhatsApp messages',
      timestamp: new Date().toISOString(),
    };
  }

  if (!to) {
    return {
      success: false,
      error: 'Recipient phone number is required',
      timestamp: new Date().toISOString(),
    };
  }

  const canonical = await loadCanonicalWhatsAppConfig(tenantId);
  if (
    canonical &&
    classifyWhatsAppProvider(canonical.providerRaw) === 'unknown'
  ) {
    return {
      success: false,
      error: 'WhatsApp provider is not supported for this workspace',
      timestamp: new Date().toISOString(),
    };
  }
  if (
    canonical?.providerKind === 'evolution' ||
    canonical?.providerKind === 'waha'
  ) {
    try {
      const resolved = await resolveWhatsAppProvider(tenantId);
      if (!resolved.provider) {
        return {
          success: false,
          error: 'WhatsApp provider is not available',
          timestamp: new Date().toISOString(),
        };
      }
      const cleanRecipient = normalizePhone(to).replace(/^\+/, '');
      let result: { externalMessageId: string };
      if (type === 'template') {
        result = await resolved.provider.sendTemplate(
          tenantId,
          cleanRecipient,
          templateName || '',
          templateLanguage,
          templateComponents
        );
      } else if (
        (type === 'image' ||
          type === 'document' ||
          type === 'audio' ||
          type === 'video') &&
        mediaUrl
      ) {
        result = await resolved.provider.sendMedia(
          tenantId,
          cleanRecipient,
          mediaUrl,
          type,
          options.mediaCaption
        );
      } else {
        result = await resolved.provider.sendText(
          tenantId,
          cleanRecipient,
          text || ''
        );
      }
      return {
        success: true,
        metaMessageId: result.externalMessageId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof UnsupportedWhatsAppOperationError
            ? error.message
            : 'WhatsApp send failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  const db = getAdminClient();
  const { data: rows, error: configErr } = await db
    .from('whatsapp_config')
    .select('*')
    .eq('account_id', tenantId)
    .limit(1);

  if (configErr || !rows || rows.length === 0) {
    return {
      success: false,
      error: `No WhatsApp configuration found for tenant ${tenantId}`,
      timestamp: new Date().toISOString(),
    };
  }

  const config = rows[0];
  const phoneNumberId = String(config.phone_number_id || '');
  const encToken = String(
    config.access_token_encrypted ||
      config.encrypted_access_token ||
      config.access_token ||
      ''
  );

  if (!phoneNumberId || !encToken) {
    return {
      success: false,
      error: 'WhatsApp connection is not fully configured for this workspace',
      timestamp: new Date().toISOString(),
    };
  }

  let accessToken = '';
  try {
    accessToken = decrypt(encToken);
  } catch {
    accessToken = encToken;
  }

  const cleanRecipient = normalizePhone(to).replace(/^\+/, '');

  // Construct Meta payload
  let payload: Record<string, unknown>;

  if (type === 'template' && templateName) {
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanRecipient,
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLanguage },
        components: templateComponents || [],
      },
    };
  } else if (type === 'image' && mediaUrl) {
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanRecipient,
      type: 'image',
      image: {
        link: mediaUrl,
        caption: options.mediaCaption || undefined,
      },
    };
  } else if (type === 'document' && mediaUrl) {
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanRecipient,
      type: 'document',
      document: {
        link: mediaUrl,
        caption: options.mediaCaption || undefined,
        filename: options.mediaFilename || 'document.pdf',
      },
    };
  } else if (
    type === 'interactive' ||
    options.ctaUrl ||
    (options.buttons && options.buttons.length > 0) ||
    options.interactive
  ) {
    let interactiveObj: Record<string, unknown>;

    if (options.ctaUrl) {
      interactiveObj = {
        type: 'cta_url',
        body: { text: text || 'Please click the link below:' },
        action: {
          name: 'cta_url',
          parameters: {
            display_text: options.ctaUrl.displayText.trim(),
            url: options.ctaUrl.url.trim(),
          },
        },
      };
    } else if (options.buttons && options.buttons.length > 0) {
      interactiveObj = {
        type: 'button',
        body: { text: text || 'Please choose an option:' },
        action: {
          buttons: options.buttons.slice(0, 3).map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      };
    } else if (options.interactive && typeof options.interactive === 'object') {
      interactiveObj = options.interactive as Record<string, unknown>;
    } else {
      interactiveObj = {
        type: 'button',
        body: { text: text || '' },
        action: { buttons: [] },
      };
    }

    if (options.headerText && !interactiveObj.header) {
      interactiveObj.header = {
        type: 'text',
        text: options.headerText.slice(0, 60),
      };
    }
    if (options.footerText && !interactiveObj.footer) {
      interactiveObj.footer = { text: options.footerText.slice(0, 60) };
    }

    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanRecipient,
      type: 'interactive',
      interactive: interactiveObj,
    };
  } else {
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanRecipient,
      type: 'text',
      text: {
        preview_url: true,
        body: text || '',
      },
    };
  }

  try {
    const metaRes = await fetch(`${META_BASE_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const metaData = await metaRes.json().catch(() => null);

    if (!metaRes.ok || !metaData?.messages?.[0]?.id) {
      const errorMsg =
        metaData?.error?.message ||
        `Meta API error: ${metaRes.status} ${metaRes.statusText}`;
      console.error('[Core WhatsApp Service] Send failed:', metaData);
      return {
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }

    const metaMessageId = metaData.messages[0].id as string;

    // Record message in database if conversationId is provided
    let createdMessageId: string | undefined;
    if (options.conversationId) {
      const { data: msgRow } = await db
        .from('messages')
        .insert({
          conversation_id: options.conversationId,
          sender_type: 'staff',
          content_type: type,
          content_text: text || `[${type} sent]`,
          status: 'sent',
          meta_message_id: metaMessageId,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      createdMessageId = msgRow?.id;

      // Update conversation last message timestamp
      await db
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', options.conversationId)
        .eq('account_id', tenantId);
    }

    // Emit core event for observability and audit logging
    coreEvents.emit('message.sent', tenantId, {
      tenantId,
      conversationId: options.conversationId || '',
      messageId: createdMessageId || metaMessageId,
      recipient: cleanRecipient,
      content: text || '',
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      messageId: createdMessageId,
      metaMessageId,
      timestamp: new Date().toISOString(),
    };
  } catch (netErr) {
    const errorMsg = netErr instanceof Error ? netErr.message : 'Network error';
    console.error('[Core WhatsApp Service] Network error during send:', netErr);
    return {
      success: false,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Checks WhatsApp connection health for a tenant.
 */
export async function getWhatsAppHealth(
  tenantId: string
): Promise<WhatsAppHealthReport> {
  const canonical = await loadCanonicalWhatsAppConfig(tenantId);
  if (canonical?.providerKind === 'evolution') {
    const now = new Date().toISOString();
    const live = await updateEvolutionHealth(tenantId);
    return {
      connected: live.status === 'connected',
      status:
        live.status === 'connected'
          ? 'CONNECTED'
          : live.status === 'reconnect_required'
            ? 'RECONNECT_REQUIRED'
            : live.status === 'error'
              ? 'ERROR'
              : live.status === 'waiting_for_qr' ||
                  live.status === 'waiting_for_scan' ||
                  live.status === 'creating_instance'
                ? 'CONNECTING'
                : 'DISCONNECTED',
      phoneNumber: live.phone_number || undefined,
      businessName: live.verified_name || undefined,
      apiStatus:
        live.status === 'connected'
          ? 'healthy'
          : live.status === 'error'
            ? 'error'
            : 'degraded',
      webhookStatus: live.status === 'connected' ? 'healthy' : 'unregistered',
      coexistenceStatus: 'not_supported',
      lastCheckAt: now,
      issues:
        live.status === 'connected'
          ? undefined
          : [live.error || 'Evolution Go QR connection is not active.'],
    };
  }

  const conn = await getWhatsAppConnection(tenantId);
  const now = new Date().toISOString();

  if (!conn || conn.connectionStatus === 'NOT_CONNECTED') {
    return {
      connected: false,
      status: 'NOT_CONNECTED',
      apiStatus: 'error',
      webhookStatus: 'unregistered',
      coexistenceStatus: 'unknown',
      lastCheckAt: now,
      issues: ['No WhatsApp Business configuration found for this workspace.'],
    };
  }

  const issues: string[] = [];
  let apiStatus: WhatsAppHealthReport['apiStatus'] = 'healthy';
  let webhookStatus: WhatsAppHealthReport['webhookStatus'] = 'healthy';

  if (!conn.phoneNumberId) {
    issues.push('Phone Number ID is missing.');
    apiStatus = 'error';
  }

  if (!conn.wabaId) {
    issues.push('WABA ID is missing.');
    apiStatus = 'degraded';
  }

  if (conn.connectionStatus === 'PENDING_VERIFICATION') {
    webhookStatus = 'unregistered';
    issues.push('Webhook event delivery is pending two-step registration.');
  }

  return {
    connected: conn.connectionStatus === 'CONNECTED',
    status: conn.connectionStatus,
    phoneNumber: conn.displayPhoneNumber,
    businessName: conn.businessName,
    wabaId: conn.wabaId,
    apiStatus,
    webhookStatus,
    coexistenceStatus: conn.coexistenceStatus || 'eligible',
    lastCheckAt: now,
    issues: issues.length > 0 ? issues : undefined,
  };
}

/**
 * Cleanly disconnects WhatsApp from Helpa workspace.
 * Non-destructive: preserves conversation history and does not delete customer's Meta WABA.
 */
export async function disconnectWhatsApp(
  tenantId: string
): Promise<{ success: boolean; message: string }> {
  if (!tenantId) {
    return { success: false, message: 'Tenant ID is required' };
  }

  const canonical = await loadCanonicalWhatsAppConfig(tenantId);
  if (canonical?.providerKind === 'evolution') {
    const result = await disconnectEvolutionQrSession(tenantId);
    return { success: result.success, message: result.message };
  }

  const db = getAdminClient();
  const { error } = await db
    .from('whatsapp_config')
    .delete()
    .eq('account_id', tenantId);

  if (error) {
    return {
      success: false,
      message: `Failed to disconnect WhatsApp: ${error.message}`,
    };
  }

  return {
    success: true,
    message:
      'WhatsApp has been disconnected cleanly. Conversation history was preserved.',
  };
}

/**
 * Reconnects or refreshes the tenant's WhatsApp registration.
 */
export async function reconnectWhatsApp(
  tenantId: string
): Promise<{ success: boolean; message: string }> {
  const canonical = await loadCanonicalWhatsAppConfig(tenantId);
  if (canonical?.providerKind === 'evolution') {
    const result = await reconnectEvolutionQrSession(tenantId);
    return {
      success: result.success,
      message:
        result.status === 'connected'
          ? 'WhatsApp QR connection is active.'
          : result.error || 'Scan the QR code to finish reconnecting.',
    };
  }

  const health = await getWhatsAppHealth(tenantId);
  if (!health.connected) {
    return {
      success: false,
      message:
        'WhatsApp is not connected. Please click Connect WhatsApp to link with Meta.',
    };
  }

  return {
    success: true,
    message: 'WhatsApp connection is active and healthy.',
  };
}
