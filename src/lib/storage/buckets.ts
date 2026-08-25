export const STORAGE_BUCKETS = {
  avatars: process.env.STORAGE_BUCKET_AVATARS || 'avatars',
  chatMedia: process.env.STORAGE_BUCKET_CHAT_MEDIA || 'chat-media',
  voiceTranscripts:
    process.env.STORAGE_BUCKET_VOICE_TRANSCRIPTS || 'voice-transcripts',
  webhookPayloads:
    process.env.STORAGE_BUCKET_WEBHOOK_PAYLOADS || 'webhook-payloads',
  pdfTickets: process.env.STORAGE_BUCKET_PDF_TICKETS || 'pdf-tickets',
} as const;
