export const APPWRITE_CONFIG = {
  endpoint:
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT &&
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT.includes('sgp.')
      ? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
      : 'https://sgp.cloud.appwrite.io/v1',
  projectId:
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID.length === 20
      ? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
      : '6a79822b003adde92f63',
  apiKey:
    process.env.APPWRITE_API_KEY ||
    'standard_95784974917c87f02101954bf8fa40f5d4f6ac92d6e0230624a7792818adef2635d4faa049316bb8a90d9436b7a94f299304dd07f4f53bb6df25d7fadb63c4d44f50f981fcfb7e5b8c0232f5aae36a80399f3cf71beba0b85faf34faa078980e3e5668cfdb416fe5d283c41d170dcb870f87880f670e5dabeb5a2dbac350ba81',
  databaseId: process.env.APPWRITE_DATABASE_ID || 'wacrm_production',
  buckets: {
    chatMedia: 'chat-media',
    voiceTranscripts: 'voice-transcripts',
    webhookPayloads: 'webhook-payloads',
    pdfTickets: 'pdf-tickets',
  },
  collections: {
    leads: 'leads',
    leadStageHistory: 'lead_stage_history',
    idempotencyKeys: 'idempotency_keys',
    auditLogs: 'audit_logs',
    contacts: 'contacts',
    conversations: 'conversations',
    messages: 'messages',
    appointments: 'appointments',
    calls: 'calls',
    followups: 'followups',
    integrations: 'integrations',
    accounts: 'accounts',
    providerEvents: 'provider_events',
  },
};
