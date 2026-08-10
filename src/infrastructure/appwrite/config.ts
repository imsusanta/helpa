export const APPWRITE_CONFIG = {
  endpoint: 'https://sgp.cloud.appwrite.io/v1',
  projectId: '6a79822b003adde92f63',
  apiKey:
    process.env.APPWRITE_API_KEY ||
    'standard_95784974917c87f02101954bf8fa40f5d4f6ac92d6e0230624a7792818adef2635d4faa049316bb8a90d9436b7a94f299304dd07f4f53bb6df25d7fadb63c4d44f50f981fcfb7e5b8c0232f5aae36a80399f3cf71beba0b85faf34faa078980e3e5668cfdb416fe5d283c41d170dcb870f87880f670e5dabeb5a2dbac350ba81',
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
