import { Client, Databases, Storage } from 'node-appwrite';
import { APPWRITE_CONFIG } from '../src/infrastructure/appwrite/config';
import { REQUIRED_STORAGE_BUCKETS } from '../src/infrastructure/appwrite/storage-manifest';

export const SCHEMA_VERSION = '1.0.0';

export interface AttributeDef {
  key: string;
  type: 'string' | 'integer' | 'boolean';
  size?: number;
  required: boolean;
  array?: boolean;
  default?: string | number | boolean;
}

export interface IndexDef {
  key: string;
  type: string;
  attributes: string[];
}

export interface CollectionSchema {
  id: string;
  attributes: AttributeDef[];
  indexes: IndexDef[];
}

export const SCHEMA_MANIFEST: Record<string, CollectionSchema> = {
  accounts: {
    id: APPWRITE_CONFIG.collections.accounts,
    attributes: [
      { key: 'name', type: 'string', size: 255, required: true },
      { key: 'slug', type: 'string', size: 255, required: false },
      {
        key: 'plan',
        type: 'string',
        size: 64,
        required: false,
        default: 'free',
      },
      { key: 'createdAt', type: 'string', size: 64, required: true },
      { key: 'updatedAt', type: 'string', size: 64, required: true },
    ],
    indexes: [{ key: 'idx_accounts_slug', type: 'key', attributes: ['slug'] }],
  },
  broadcasts: {
    id: APPWRITE_CONFIG.collections.broadcasts,
    attributes: [
      { key: 'accountId', type: 'string', size: 255, required: false },
      { key: 'userId', type: 'string', size: 255, required: false },
      { key: 'name', type: 'string', size: 255, required: true },
      { key: 'category', type: 'string', size: 64, required: false },
      { key: 'templateName', type: 'string', size: 255, required: false },
      { key: 'templateLanguage', type: 'string', size: 32, required: false },
      {
        key: 'status',
        type: 'string',
        size: 32,
        required: true,
        default: 'draft',
      },
      { key: 'totalRecipients', type: 'integer', required: false, default: 0 },
      { key: 'sentCount', type: 'integer', required: false, default: 0 },
      { key: 'deliveredCount', type: 'integer', required: false, default: 0 },
      { key: 'readCount', type: 'integer', required: false, default: 0 },
      { key: 'repliedCount', type: 'integer', required: false, default: 0 },
      { key: 'failedCount', type: 'integer', required: false, default: 0 },
      { key: 'createdAt', type: 'string', size: 64, required: true },
      { key: 'updatedAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      { key: 'idx_broadcasts_account', type: 'key', attributes: ['accountId'] },
    ],
  },
  campaigns: {
    id: APPWRITE_CONFIG.collections.campaigns,
    attributes: [
      { key: 'accountId', type: 'string', size: 255, required: false },
      { key: 'name', type: 'string', size: 255, required: true },
      {
        key: 'status',
        type: 'string',
        size: 32,
        required: true,
        default: 'draft',
      },
      { key: 'createdAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      { key: 'idx_campaigns_account', type: 'key', attributes: ['accountId'] },
    ],
  },
  profiles: {
    id: APPWRITE_CONFIG.collections.profiles,
    attributes: [
      { key: 'userId', type: 'string', size: 255, required: true },
      { key: 'accountId', type: 'string', size: 255, required: true },
      { key: 'fullName', type: 'string', size: 255, required: true },
      { key: 'email', type: 'string', size: 255, required: true },
      {
        key: 'role',
        type: 'string',
        size: 64,
        required: true,
        default: 'agent',
      },
      { key: 'avatarUrl', type: 'string', size: 1000, required: false },
      { key: 'createdAt', type: 'string', size: 64, required: true },
      { key: 'updatedAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      { key: 'unique_user_profile', type: 'unique', attributes: ['userId'] },
      { key: 'idx_profile_account', type: 'key', attributes: ['accountId'] },
    ],
  },
  memberships: {
    id: APPWRITE_CONFIG.collections.memberships,
    attributes: [
      { key: 'userId', type: 'string', size: 255, required: true },
      { key: 'accountId', type: 'string', size: 255, required: true },
      {
        key: 'role',
        type: 'string',
        size: 64,
        required: true,
        default: 'agent',
      },
      { key: 'createdAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      {
        key: 'unique_user_account_membership',
        type: 'unique',
        attributes: ['userId', 'accountId'],
      },
    ],
  },
  contacts: {
    id: APPWRITE_CONFIG.collections.contacts,
    attributes: [
      { key: 'accountId', type: 'string', size: 255, required: true },
      { key: 'name', type: 'string', size: 255, required: true },
      { key: 'phone', type: 'string', size: 64, required: false },
      { key: 'email', type: 'string', size: 255, required: false },
      {
        key: 'consentStatus',
        type: 'string',
        size: 32,
        required: false,
        default: 'pending',
      },
      { key: 'tags', type: 'string', size: 64, required: false, array: true },
      { key: 'createdAt', type: 'string', size: 64, required: true },
      { key: 'updatedAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      { key: 'idx_contacts_account', type: 'key', attributes: ['accountId'] },
      {
        key: 'unique_contact_phone_per_account',
        type: 'unique',
        attributes: ['accountId', 'phone'],
      },
    ],
  },
  patients: {
    id: APPWRITE_CONFIG.collections.patients,
    attributes: [
      { key: 'accountId', type: 'string', size: 255, required: true },
      { key: 'contactId', type: 'string', size: 255, required: false },
      { key: 'name', type: 'string', size: 255, required: true },
      { key: 'phone', type: 'string', size: 64, required: false },
      { key: 'medicalNotes', type: 'string', size: 4000, required: false },
      {
        key: 'consentStatus',
        type: 'string',
        size: 32,
        required: false,
        default: 'pending',
      },
      { key: 'createdAt', type: 'string', size: 64, required: true },
      { key: 'updatedAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      { key: 'idx_patients_account', type: 'key', attributes: ['accountId'] },
    ],
  },
  leads: {
    id: APPWRITE_CONFIG.collections.leads,
    attributes: [
      { key: 'accountId', type: 'string', size: 255, required: true },
      { key: 'contactId', type: 'string', size: 255, required: false },
      { key: 'name', type: 'string', size: 255, required: true },
      {
        key: 'stage',
        type: 'string',
        size: 64,
        required: true,
        default: 'NEW',
      },
      { key: 'value', type: 'integer', required: false, default: 0 },
      { key: 'lostReason', type: 'string', size: 500, required: false },
      { key: 'assignedUserId', type: 'string', size: 255, required: false },
      { key: 'createdAt', type: 'string', size: 64, required: true },
      { key: 'updatedAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      { key: 'idx_leads_account', type: 'key', attributes: ['accountId'] },
      {
        key: 'idx_leads_stage',
        type: 'key',
        attributes: ['accountId', 'stage'],
      },
    ],
  },
  lead_stage_history: {
    id: APPWRITE_CONFIG.collections.leadStageHistory,
    attributes: [
      { key: 'accountId', type: 'string', size: 255, required: true },
      { key: 'leadId', type: 'string', size: 255, required: true },
      { key: 'fromStage', type: 'string', size: 64, required: true },
      { key: 'toStage', type: 'string', size: 64, required: true },
      { key: 'actorUserId', type: 'string', size: 255, required: true },
      { key: 'createdAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      {
        key: 'idx_lead_history',
        type: 'key',
        attributes: ['accountId', 'leadId'],
      },
    ],
  },
  conversations: {
    id: APPWRITE_CONFIG.collections.conversations,
    attributes: [
      { key: 'accountId', type: 'string', size: 255, required: true },
      { key: 'contactId', type: 'string', size: 255, required: true },
      {
        key: 'channel',
        type: 'string',
        size: 32,
        required: false,
        default: 'whatsapp',
      },
      {
        key: 'status',
        type: 'string',
        size: 32,
        required: false,
        default: 'open',
      },
      { key: 'lastMessageText', type: 'string', size: 2000, required: false },
      { key: 'lastMessageAt', type: 'string', size: 64, required: true },
      { key: 'createdAt', type: 'string', size: 64, required: true },
      { key: 'updatedAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      {
        key: 'idx_conversations_account',
        type: 'key',
        attributes: ['accountId'],
      },
      {
        key: 'unique_account_contact_conv',
        type: 'unique',
        attributes: ['accountId', 'contactId'],
      },
    ],
  },
  messages: {
    id: APPWRITE_CONFIG.collections.messages,
    attributes: [
      { key: 'conversationId', type: 'string', size: 255, required: true },
      { key: 'senderType', type: 'string', size: 32, required: true },
      { key: 'contentType', type: 'string', size: 32, required: true },
      { key: 'contentText', type: 'string', size: 4000, required: false },
      { key: 'mediaUrl', type: 'string', size: 1000, required: false },
      { key: 'messageId', type: 'string', size: 255, required: false },
      { key: 'status', type: 'string', size: 32, required: true },
      { key: 'replyToMessageId', type: 'string', size: 255, required: false },
      { key: 'createdAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      { key: 'idx_messages_conv', type: 'key', attributes: ['conversationId'] },
      {
        key: 'unique_external_message_id',
        type: 'unique',
        attributes: ['messageId'],
      },
    ],
  },
  appointments: {
    id: APPWRITE_CONFIG.collections.appointments,
    attributes: [
      { key: 'accountId', type: 'string', size: 255, required: true },
      { key: 'contactId', type: 'string', size: 255, required: false },
      { key: 'patientName', type: 'string', size: 255, required: true },
      { key: 'patientPhone', type: 'string', size: 64, required: false },
      { key: 'serviceType', type: 'string', size: 128, required: false },
      {
        key: 'status',
        type: 'string',
        size: 32,
        required: true,
        default: 'scheduled',
      },
      { key: 'startTime', type: 'string', size: 64, required: true },
      { key: 'endTime', type: 'string', size: 64, required: false },
      { key: 'createdAt', type: 'string', size: 64, required: true },
      { key: 'updatedAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      {
        key: 'idx_appointments_account',
        type: 'key',
        attributes: ['accountId'],
      },
    ],
  },
  calls: {
    id: APPWRITE_CONFIG.collections.calls,
    attributes: [
      { key: 'accountId', type: 'string', size: 255, required: true },
      { key: 'externalCallId', type: 'string', size: 255, required: true },
      { key: 'provider', type: 'string', size: 64, required: true },
      { key: 'direction', type: 'string', size: 32, required: false },
      { key: 'status', type: 'string', size: 32, required: false },
      { key: 'fromMasked', type: 'string', size: 64, required: false },
      { key: 'toMasked', type: 'string', size: 64, required: false },
      { key: 'agentId', type: 'string', size: 255, required: false },
      { key: 'contactId', type: 'string', size: 255, required: false },
      { key: 'leadId', type: 'string', size: 255, required: false },
      { key: 'startedAt', type: 'string', size: 64, required: false },
      { key: 'answeredAt', type: 'string', size: 64, required: false },
      { key: 'endedAt', type: 'string', size: 64, required: false },
      { key: 'durationSeconds', type: 'integer', required: false },
      { key: 'failureCode', type: 'string', size: 128, required: false },
      {
        key: 'failureMessageSanitized',
        type: 'string',
        size: 500,
        required: false,
      },
      { key: 'transcriptStatus', type: 'string', size: 32, required: false },
      { key: 'recordingStatus', type: 'string', size: 32, required: false },
      {
        key: 'transcriptReference',
        type: 'string',
        size: 500,
        required: false,
      },
      { key: 'recordingReference', type: 'string', size: 500, required: false },
      { key: 'version', type: 'integer', required: false, default: 1 },
      { key: 'createdAt', type: 'string', size: 64, required: true },
      { key: 'updatedAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      {
        key: 'unique_account_external_call',
        type: 'unique',
        attributes: ['accountId', 'externalCallId'],
      },
      {
        key: 'idx_calls_account_created',
        type: 'key',
        attributes: ['accountId', 'createdAt'],
      },
      {
        key: 'idx_calls_account_status',
        type: 'key',
        attributes: ['accountId', 'status'],
      },
      {
        key: 'idx_calls_provider_external',
        type: 'key',
        attributes: ['provider', 'externalCallId'],
      },
    ],
  },
  voice_integrations: {
    id: APPWRITE_CONFIG.collections.voiceIntegrations,
    attributes: [
      { key: 'accountId', type: 'string', size: 255, required: true },
      { key: 'provider', type: 'string', size: 64, required: true },
      {
        key: 'encryptedCredentialsReference',
        type: 'string',
        size: 1000,
        required: true,
      },
      { key: 'agentId', type: 'string', size: 255, required: true },
      {
        key: 'providerPhoneNumberId',
        type: 'string',
        size: 255,
        required: true,
      },
      { key: 'phoneNumberMasked', type: 'string', size: 64, required: false },
      { key: 'status', type: 'string', size: 32, required: true },
      {
        key: 'capabilities',
        type: 'string',
        size: 64,
        required: false,
        array: true,
      },
      { key: 'createdAt', type: 'string', size: 64, required: true },
      { key: 'updatedAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      {
        key: 'unique_voice_integration',
        type: 'unique',
        attributes: ['provider', 'agentId', 'providerPhoneNumberId'],
      },
      {
        key: 'unique_account_provider',
        type: 'unique',
        attributes: ['accountId', 'provider'],
      },
      {
        key: 'idx_voice_account_status',
        type: 'key',
        attributes: ['accountId', 'status'],
      },
    ],
  },
  voice_commands: {
    id: APPWRITE_CONFIG.collections.voiceCommands,
    attributes: [
      { key: 'accountId', type: 'string', size: 255, required: true },
      { key: 'commandType', type: 'string', size: 64, required: true },
      { key: 'idempotencyKey', type: 'string', size: 255, required: true },
      { key: 'commandFingerprint', type: 'string', size: 128, required: true },
      { key: 'status', type: 'string', size: 32, required: true },
      { key: 'externalCallId', type: 'string', size: 255, required: false },
      { key: 'resultReference', type: 'string', size: 500, required: false },
      { key: 'lastErrorSanitized', type: 'string', size: 500, required: false },
      { key: 'createdAt', type: 'string', size: 64, required: true },
      { key: 'updatedAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      {
        key: 'unique_command_idempotency',
        type: 'unique',
        attributes: ['accountId', 'idempotencyKey'],
      },
      {
        key: 'idx_commands_account_created',
        type: 'key',
        attributes: ['accountId', 'createdAt'],
      },
    ],
  },
  followups: {
    id: APPWRITE_CONFIG.collections.followups,
    attributes: [
      { key: 'accountId', type: 'string', size: 255, required: true },
      { key: 'contactId', type: 'string', size: 255, required: true },
      { key: 'channel', type: 'string', size: 32, required: true },
      { key: 'scheduledAt', type: 'string', size: 64, required: true },
      {
        key: 'status',
        type: 'string',
        size: 32,
        required: true,
        default: 'pending',
      },
      { key: 'messageText', type: 'string', size: 2000, required: false },
      { key: 'createdAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      { key: 'idx_followups_account', type: 'key', attributes: ['accountId'] },
    ],
  },
  integrations: {
    id: APPWRITE_CONFIG.collections.integrations,
    attributes: [
      { key: 'accountId', type: 'string', size: 255, required: true },
      { key: 'provider', type: 'string', size: 64, required: true },
      {
        key: 'encryptedCredentials',
        type: 'string',
        size: 2000,
        required: true,
      },
      {
        key: 'status',
        type: 'string',
        size: 32,
        required: true,
        default: 'active',
      },
      { key: 'createdAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      {
        key: 'unique_account_provider_integration',
        type: 'unique',
        attributes: ['accountId', 'provider'],
      },
    ],
  },
  provider_events: {
    id: APPWRITE_CONFIG.collections.providerEvents,
    attributes: [
      { key: 'accountId', type: 'string', size: 255, required: false },
      { key: 'provider', type: 'string', size: 64, required: true },
      { key: 'externalEventId', type: 'string', size: 255, required: true },
      { key: 'eventType', type: 'string', size: 128, required: true },
      { key: 'payloadHash', type: 'string', size: 128, required: true },
      { key: 'rawPayloadReference', type: 'string', size: 500, required: true },
      { key: 'processingStatus', type: 'string', size: 32, required: true },
      {
        key: 'processingAttempts',
        type: 'integer',
        required: false,
        default: 0,
      },
      {
        key: 'maxAttempts',
        type: 'integer',
        required: false,
        default: 5,
      },
      {
        key: 'lastErrorSanitized',
        type: 'string',
        size: 500,
        required: false,
      },
      { key: 'receivedAt', type: 'string', size: 64, required: true },
      {
        key: 'processingStartedAt',
        type: 'string',
        size: 64,
        required: false,
      },
      { key: 'lockOwner', type: 'string', size: 255, required: false },
      { key: 'lockExpiresAt', type: 'string', size: 64, required: false },
      { key: 'heartbeatAt', type: 'string', size: 64, required: false },
      { key: 'nextAttemptAt', type: 'string', size: 64, required: false },
      { key: 'processedAt', type: 'string', size: 64, required: false },
      { key: 'deadLetteredAt', type: 'string', size: 64, required: false },
    ],
    indexes: [
      {
        key: 'unique_provider_event',
        type: 'unique',
        attributes: ['provider', 'externalEventId'],
      },
      {
        key: 'idx_provider_events_account_received',
        type: 'key',
        attributes: ['accountId', 'receivedAt'],
      },
      {
        key: 'idx_provider_events_status_next',
        type: 'key',
        attributes: ['processingStatus', 'nextAttemptAt'],
      },
    ],
  },
  knowledge_base: {
    id: APPWRITE_CONFIG.collections.knowledgeBase,
    attributes: [
      { key: 'accountId', type: 'string', size: 255, required: true },
      { key: 'category', type: 'string', size: 64, required: true },
      { key: 'questionTitle', type: 'string', size: 500, required: true },
      { key: 'answerContent', type: 'string', size: 5000, required: true },
      { key: 'createdAt', type: 'string', size: 64, required: false },
      { key: 'updatedAt', type: 'string', size: 64, required: false },
    ],
    indexes: [
      { key: 'idx_kb_account', type: 'key', attributes: ['accountId'] },
    ],
  },
  audit_logs: {
    id: APPWRITE_CONFIG.collections.auditLogs,
    attributes: [
      { key: 'accountId', type: 'string', size: 255, required: true },
      { key: 'actorUserId', type: 'string', size: 255, required: true },
      { key: 'action', type: 'string', size: 128, required: true },
      { key: 'targetType', type: 'string', size: 64, required: true },
      { key: 'targetId', type: 'string', size: 255, required: true },
      { key: 'metadataJson', type: 'string', size: 4000, required: false },
      { key: 'createdAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      { key: 'idx_audit_logs_account', type: 'key', attributes: ['accountId'] },
    ],
  },
  idempotency_keys: {
    id: APPWRITE_CONFIG.collections.idempotencyKeys,
    attributes: [
      { key: 'accountId', type: 'string', size: 255, required: true },
      { key: 'key', type: 'string', size: 255, required: true },
      { key: 'status', type: 'string', size: 32, required: true },
      { key: 'responseJson', type: 'string', size: 4000, required: false },
      { key: 'createdAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      {
        key: 'unique_account_idempotency_key',
        type: 'unique',
        attributes: ['accountId', 'key'],
      },
    ],
  },
  outbound_outbox: {
    id: APPWRITE_CONFIG.collections.outboundOutbox,
    attributes: [
      { key: 'accountId', type: 'string', size: 255, required: true },
      { key: 'channel', type: 'string', size: 32, required: true },
      { key: 'idempotencyKey', type: 'string', size: 255, required: true },
      { key: 'status', type: 'string', size: 32, required: true },
      { key: 'metaMessageId', type: 'string', size: 255, required: false },
      { key: 'createdAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      {
        key: 'unique_outbox_idempotency',
        type: 'unique',
        attributes: ['accountId', 'idempotencyKey'],
      },
    ],
  },
  flow_runs: {
    id: APPWRITE_CONFIG.collections.flowRuns,
    attributes: [
      { key: 'accountId', type: 'string', size: 255, required: true },
      { key: 'contactId', type: 'string', size: 255, required: true },
      { key: 'flowId', type: 'string', size: 255, required: true },
      { key: 'status', type: 'string', size: 32, required: true },
      { key: 'endReason', type: 'string', size: 128, required: false },
      { key: 'endedAt', type: 'string', size: 64, required: false },
      { key: 'createdAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      {
        key: 'idx_flow_runs_account',
        type: 'key',
        attributes: ['accountId', 'contactId'],
      },
    ],
  },
  message_templates: {
    id: APPWRITE_CONFIG.collections.messageTemplates,
    attributes: [
      { key: 'accountId', type: 'string', size: 255, required: true },
      { key: 'name', type: 'string', size: 255, required: true },
      {
        key: 'language',
        type: 'string',
        size: 32,
        required: true,
        default: 'en_US',
      },
      { key: 'category', type: 'string', size: 64, required: false },
      {
        key: 'status',
        type: 'string',
        size: 32,
        required: true,
        default: 'APPROVED',
      },
      { key: 'componentsJson', type: 'string', size: 8000, required: false },
      { key: 'createdAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      {
        key: 'unique_template_name_language',
        type: 'unique',
        attributes: ['accountId', 'name', 'language'],
      },
    ],
  },
  worker_health: {
    id: APPWRITE_CONFIG.collections.workerHealth,
    attributes: [
      { key: 'workerId', type: 'string', size: 255, required: true },
      { key: 'commitSha', type: 'string', size: 64, required: true },
      { key: 'startedAt', type: 'string', size: 64, required: true },
      { key: 'lastHeartbeatAt', type: 'string', size: 64, required: true },
      { key: 'lastScanAt', type: 'string', size: 64, required: false },
      { key: 'lastSuccessAt', type: 'string', size: 64, required: false },
      { key: 'lastFailureCode', type: 'string', size: 128, required: false },
      { key: 'processedCount', type: 'integer', required: false, default: 0 },
      { key: 'retryCount', type: 'integer', required: false, default: 0 },
      { key: 'deadLetterCount', type: 'integer', required: false, default: 0 },
      { key: 'updatedAt', type: 'string', size: 64, required: true },
    ],
    indexes: [
      {
        key: 'unique_worker_id',
        type: 'unique',
        attributes: ['workerId'],
      },
    ],
  },
  whatsapp_configs: {
    id: APPWRITE_CONFIG.collections.whatsappConfigs,
    attributes: [
      { key: 'accountId', type: 'string', size: 255, required: false },
      { key: 'account_id', type: 'string', size: 255, required: false },
      { key: 'userId', type: 'string', size: 255, required: false },
      { key: 'user_id', type: 'string', size: 255, required: false },
      { key: 'phone_number_id', type: 'string', size: 255, required: false },
      { key: 'phoneNumberId', type: 'string', size: 255, required: false },
      { key: 'waba_id', type: 'string', size: 255, required: false },
      { key: 'wabaId', type: 'string', size: 255, required: false },
      { key: 'access_token', type: 'string', size: 2000, required: false },
      { key: 'accessToken', type: 'string', size: 2000, required: false },
      {
        key: 'encrypted_access_token',
        type: 'string',
        size: 2000,
        required: false,
      },
      {
        key: 'encryptedAccessToken',
        type: 'string',
        size: 2000,
        required: false,
      },
      {
        key: 'status',
        type: 'string',
        size: 32,
        required: false,
        default: 'active',
      },
      { key: 'registered_at', type: 'string', size: 64, required: false },
      { key: 'registeredAt', type: 'string', size: 64, required: false },
      {
        key: 'last_registration_error',
        type: 'string',
        size: 1000,
        required: false,
      },
      {
        key: 'lastRegistrationError',
        type: 'string',
        size: 1000,
        required: false,
      },
      { key: 'subscribed_apps_at', type: 'string', size: 64, required: false },
      { key: 'subscribedAppsAt', type: 'string', size: 64, required: false },
      {
        key: 'business_phone_number',
        type: 'string',
        size: 64,
        required: false,
      },
      { key: 'businessPhoneNumber', type: 'string', size: 64, required: false },
      { key: 'createdAt', type: 'string', size: 64, required: false },
      { key: 'updatedAt', type: 'string', size: 64, required: false },
    ],
    indexes: [
      {
        key: 'unique_whatsapp_account_id',
        type: 'unique',
        attributes: ['account_id'],
      },
      {
        key: 'idx_whatsapp_phone_number',
        type: 'key',
        attributes: ['phone_number_id'],
      },
    ],
  },
};

async function setupAppwriteDatabase() {
  console.log(
    `🚀 Starting Appwrite Schema-as-Code Setup (Schema Version ${SCHEMA_VERSION})...`
  );

  const endpoint =
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || APPWRITE_CONFIG.endpoint;
  const projectId =
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || APPWRITE_CONFIG.projectId;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!apiKey) {
    console.warn(
      '⚠️ APPWRITE_API_KEY is not set. Setup script requires server API key to provision databases.'
    );
    process.exit(0);
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);
  const databases = new Databases(client);
  const storage = new Storage(client);

  const databaseId =
    process.env.APPWRITE_DATABASE_ID || APPWRITE_CONFIG.databaseId;

  // 1. Create Database if missing
  try {
    await databases.get(databaseId);
    console.log(`✅ Database '${databaseId}' exists.`);
  } catch {
    console.log(`📦 Creating Database '${databaseId}'...`);
    await databases.create(databaseId, databaseId);
    console.log(`✅ Database '${databaseId}' created.`);
  }

  // 2. Provision Collections, Attributes, and Indexes
  const collections = Object.values(APPWRITE_CONFIG.collections);

  for (const collectionId of collections) {
    try {
      await databases.getCollection(databaseId, collectionId);
      console.log(`✅ Collection '${collectionId}' exists.`);
    } catch {
      console.log(`📄 Creating Collection '${collectionId}'...`);
      // Server-managed collections with document-level security enabled, no public browser access
      await databases.createCollection(
        databaseId,
        collectionId,
        collectionId,
        [],
        true,
        true
      );
      console.log(`✅ Collection '${collectionId}' created.`);
    }

    const schema = SCHEMA_MANIFEST[collectionId];
    if (schema) {
      const existingCol = await databases.getCollection(
        databaseId,
        collectionId
      );
      const existingAttrKeys = new Set(
        existingCol.attributes.map((a) => a.key)
      );

      for (const attr of schema.attributes) {
        if (!existingAttrKeys.has(attr.key)) {
          try {
            if (attr.type === 'string') {
              await databases.createStringAttribute(
                databaseId,
                collectionId,
                attr.key,
                attr.size || 255,
                attr.required,
                attr.default as string | undefined,
                attr.array || false
              );
            } else if (attr.type === 'integer') {
              await databases.createIntegerAttribute(
                databaseId,
                collectionId,
                attr.key,
                attr.required,
                undefined,
                undefined,
                attr.default as number | undefined,
                attr.array || false
              );
            } else if (attr.type === 'boolean') {
              await databases.createBooleanAttribute(
                databaseId,
                collectionId,
                attr.key,
                attr.required,
                attr.default as boolean | undefined,
                attr.array || false
              );
            }
            console.log(
              `  └─ Created attribute '${attr.key}' on '${collectionId}'`
            );
          } catch (err: unknown) {
            console.warn(
              `  └─ Warning creating attribute '${attr.key}': ${(err as Error).message}`
            );
          }
        }
      }

      const existingIndexKeys = new Set(
        existingCol.indexes.map((idx) => idx.key)
      );
      for (const idx of schema.indexes) {
        if (!existingIndexKeys.has(idx.key)) {
          try {
            await (
              databases.createIndex as (...args: unknown[]) => Promise<unknown>
            )(databaseId, collectionId, idx.key, idx.type, idx.attributes);
            console.log(
              `  └─ Created index '${idx.key}' (${idx.type}) on '${collectionId}'`
            );
          } catch (err: unknown) {
            console.warn(
              `  └─ Warning creating index '${idx.key}': ${(err as Error).message}`
            );
          }
        }
      }
    }
  }

  // 3. Private Storage Buckets Provisioning
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isProductionConfirm = args.includes('--confirm-production');

  const isProductionEnv =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production';

  if (isApply && isProductionEnv && !isProductionConfirm) {
    console.error(
      '❌ Production Mutation Protection: Refusing schema mutation in production environment without explicit --confirm-production flag.'
    );
    process.exit(1);
  }

  const shouldMutate = isApply && (!isProductionEnv || isProductionConfirm);

  if (!shouldMutate) {
    console.log('ℹ️ Running in DRY-RUN mode (no mutations will be performed).');
  }

  const requiredBuckets = Object.values(REQUIRED_STORAGE_BUCKETS);
  let bucketFailures = 0;

  for (const bDef of requiredBuckets) {
    try {
      const bucket = await storage.getBucket(bDef.id);
      console.log(`✅ Storage Bucket '${bucket.$id}' ('${bDef.name}') exists.`);
    } catch {
      if (!shouldMutate) {
        console.log(
          `[DRY-RUN] Storage Bucket '${bDef.id}' ('${bDef.name}') is MISSING (would be created).`
        );
      } else {
        console.log(`🪣 Creating Storage Bucket '${bDef.id}'...`);
        try {
          await storage.createBucket(
            bDef.id,
            bDef.name,
            [], // Private: no public permissions (server-managed)
            bDef.fileSecurity,
            true, // enabled
            bDef.maxSizeBytes,
            bDef.allowedExtensions
          );
          console.log(
            `✅ Private Storage Bucket '${bDef.id}' created successfully.`
          );
        } catch (createErr: unknown) {
          console.error(
            `❌ Failed to create Storage Bucket '${bDef.id}':`,
            (createErr as Error).message
          );
          bucketFailures++;
        }
      }
    }
  }

  if (bucketFailures > 0) {
    console.error(
      `❌ Appwrite setup failed: ${bucketFailures} required storage bucket(s) could not be created.`
    );
    process.exit(1);
  }

  console.log(
    `🎉 Appwrite Schema & Storage setup complete (Version ${SCHEMA_VERSION}, Mutated: ${shouldMutate}).`
  );
}

setupAppwriteDatabase().catch((err) => {
  console.error('❌ Appwrite database setup error:', err);
  process.exit(1);
});
