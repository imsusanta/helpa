export const APPWRITE_CONFIG = {
  endpoint:
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT &&
    !process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT.includes('cloud.appwrite.io/v1')
      ? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
      : 'https://sgp.cloud.appwrite.io/v1',
  projectId:
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID !== 'wacrm_production'
      ? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
      : '6a79822b003adde92f63',
  apiKey: process.env.APPWRITE_API_KEY || '',
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
