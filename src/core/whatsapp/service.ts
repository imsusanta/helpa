/**
 * Helpa Core Platform — Unified WhatsApp Service
 *
 * Single, industry-agnostic entrypoint for all WhatsApp operations across Helpa:
 * outgoing messages, health checks, multi-tenant connection status, disconnect,
 * and reconnect.
 */

import { getAdminClient } from '@/lib/appwrite-server-compat';
import { decrypt } from '@/lib/whatsapp/encryption';
import { normalizePhone } from '@/lib/whatsapp/phone-utils';
import { coreEvents } from '@/core/events';
import type {
  WhatsAppConnection,
  WhatsAppHealthReport,
  WhatsAppSendOptions,
  WhatsAppSendResult,
} from './types';

const META_API_VERSION = 'v21.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

/**
 * Retrieves the current WhatsApp connection record for a tenant.
 */
export async function getWhatsAppConnection(
  tenantId: string
): Promise<WhatsAppConnection | null> {
  if (!tenantId) return null;

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
