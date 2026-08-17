/**
 * Helpa Core Platform — WhatsApp Integration Types
 *
 * Industry-agnostic WhatsApp definitions, connection states, message options,
 * health reports, and webhook events.
 */

export type WhatsAppConnectionStatus =
  | 'NOT_CONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECT_REQUIRED'
  | 'DISCONNECTED'
  | 'ERROR'
  | 'PENDING_VERIFICATION'
  | 'COEXISTENCE_PENDING'
  | 'COEXISTENCE_CONNECTED';

export type CoexistenceStatus =
  'active' | 'eligible' | 'ineligible' | 'not_supported' | 'unknown';

export interface WhatsAppConnection {
  id: string;
  workspaceId: string;
  businessId?: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber?: string;
  businessName?: string;
  connectionStatus: WhatsAppConnectionStatus;
  coexistenceStatus?: CoexistenceStatus;
  connectedAt?: string;
  lastWebhookAt?: string;
  lastMessageAt?: string;
  lastHealthCheckAt?: string;
}

export interface WhatsAppSendOptions {
  tenantId: string;
  to: string;
  type?:
    | 'text'
    | 'template'
    | 'image'
    | 'document'
    | 'audio'
    | 'video'
    | 'interactive';
  text?: string;
  headerText?: string;
  footerText?: string;
  buttons?: Array<{ id: string; title: string }>;
  ctaUrl?: { displayText: string; url: string };
  mediaUrl?: string;
  mediaCaption?: string;
  mediaFilename?: string;
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: unknown[];
  interactive?: unknown;
  conversationId?: string;
  contactId?: string;
  metadata?: Record<string, unknown>;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  metaMessageId?: string;
  error?: string;
  timestamp: string;
}

export interface WhatsAppHealthReport {
  connected: boolean;
  status: WhatsAppConnectionStatus;
  phoneNumber?: string;
  businessName?: string;
  wabaId?: string;
  apiStatus: 'healthy' | 'degraded' | 'error';
  webhookStatus: 'healthy' | 'degraded' | 'unregistered';
  coexistenceStatus: CoexistenceStatus;
  lastCheckAt: string;
  issues?: string[];
}

export interface ResolvedTenantContext {
  tenantId: string;
  userId: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  displayPhoneNumber?: string;
  businessName?: string;
}
