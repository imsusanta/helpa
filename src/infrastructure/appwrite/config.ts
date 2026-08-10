export const APPWRITE_CONFIG = {
  endpoint:
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'wacrm_production',
  apiKey: process.env.APPWRITE_API_KEY || '',
  databaseId: process.env.APPWRITE_DATABASE_ID || 'wacrm_production',
  buckets: {
    chatMedia: process.env.APPWRITE_BUCKET_CHAT_MEDIA || 'chat-media',
    voiceTranscripts:
      process.env.APPWRITE_BUCKET_VOICE_TRANSCRIPTS || 'voice-transcripts',
    webhookPayloads:
      process.env.APPWRITE_BUCKET_WEBHOOK_PAYLOADS || 'webhook-payloads',
    pdfTickets: process.env.APPWRITE_BUCKET_PDF_TICKETS || 'pdf-tickets',
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
  },
};
