/**
 * Supabase table and Storage bucket mappings.
 *
 * The historical export name is retained temporarily so repository imports can
 * be renamed incrementally. It contains no Appwrite endpoint, project, key, or
 * provider switch and cannot restore an Appwrite runtime.
 */
export const APPWRITE_CONFIG = {
  databaseId: 'supabase',
  buckets: {
    avatars: 'avatars',
    chatMedia: 'chat-media',
    voiceTranscripts: 'voice-transcripts',
    webhookPayloads: 'webhook-payloads',
    pdfTickets: 'pdf-tickets',
  },
  collections: {
    accounts: 'accounts',
    profiles: 'profiles',
    memberships: 'memberships',
    contacts: 'contacts',
    patients: 'patients',
    leads: 'leads',
    leadStageHistory: 'lead_stage_history',
    conversations: 'conversations',
    messages: 'messages',
    appointments: 'appointments',
    calls: 'calls',
    voiceIntegrations: 'voice_integrations',
    voiceCommands: 'voice_commands',
    followups: 'followups',
    integrations: 'integrations',
    providerEvents: 'provider_events',
    auditLogs: 'audit_logs',
    calendlyConnections: 'calendly_connections',
    calendlyEventTypes: 'calendly_event_types',
    serviceEventTypeMappings: 'service_event_type_mappings',
    whatsappConfigs: 'whatsapp_configs',
    contactChannels: 'contact_channels',
    idempotencyKeys: 'idempotency_keys',
    outboundOutbox: 'outbound_outbox',
    flowRuns: 'flow_runs',
    messageTemplates: 'message_templates',
    accountInvitations: 'account_invitations',
    automations: 'automations',
    flows: 'flows',
    broadcasts: 'broadcasts',
    plans: 'plans',
    campaigns: 'campaigns',
    doctors: 'doctors',
    departments: 'departments',
    knowledgeBase: 'knowledge_base',
    workerHealth: 'worker_health',
  },
};
