import { APPWRITE_CONFIG } from './config';

export interface StorageBucketConfig {
  id: string;
  name: string;
  maxSizeBytes: number;
  allowedExtensions: string[];
  allowedMimeTypes: string[];
  fileSecurity: boolean; // Appwrite fileSecurity: true = per-file permissions, false = bucket permissions
  isPublic: boolean;
  retentionPolicy: string;
  intendedAccessPattern: 'client_upload_server_managed' | 'server_only_private';
}

export const REQUIRED_STORAGE_BUCKETS: Record<string, StorageBucketConfig> = {
  avatars: {
    id: APPWRITE_CONFIG.buckets.avatars || 'avatars',
    name: 'User & Clinic Avatars',
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    fileSecurity: false,
    isPublic: false, // Served via authenticated server route / mediated URL
    retentionPolicy:
      'Indefinite (until user avatar update or account deletion)',
    intendedAccessPattern: 'client_upload_server_managed',
  },
  chatMedia: {
    id: APPWRITE_CONFIG.buckets.chatMedia || 'chat-media',
    name: 'WhatsApp & Chat Attachments',
    maxSizeBytes: 30 * 1024 * 1024, // 30MB
    allowedExtensions: [
      'jpg',
      'jpeg',
      'png',
      'webp',
      'pdf',
      'mp4',
      'ogg',
      'mp3',
      'wav',
    ],
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'video/mp4',
      'audio/ogg',
      'audio/mpeg',
      'audio/wav',
    ],
    fileSecurity: false,
    isPublic: false,
    retentionPolicy: 'Tenant lifecycle retention',
    intendedAccessPattern: 'client_upload_server_managed',
  },
  voiceTranscripts: {
    id: APPWRITE_CONFIG.buckets.voiceTranscripts || 'voice-transcripts',
    name: 'Voice Call Transcripts',
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedExtensions: ['json', 'txt'],
    allowedMimeTypes: ['application/json', 'text/plain'],
    fileSecurity: false,
    isPublic: false,
    retentionPolicy: 'Encrypted tenant audit retention',
    intendedAccessPattern: 'server_only_private',
  },
  webhookPayloads: {
    id: APPWRITE_CONFIG.buckets.webhookPayloads || 'webhook-payloads',
    name: 'Voice Webhook Raw Payloads',
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedExtensions: ['json'],
    allowedMimeTypes: ['application/json'],
    fileSecurity: false,
    isPublic: false,
    retentionPolicy: 'Audit trail (30-day rolling)',
    intendedAccessPattern: 'server_only_private',
  },
  pdfTickets: {
    id: APPWRITE_CONFIG.buckets.pdfTickets || 'pdf-tickets',
    name: 'PDF Appointment Tickets & Reports',
    maxSizeBytes: 20 * 1024 * 1024, // 20MB
    allowedExtensions: ['pdf'],
    allowedMimeTypes: ['application/pdf'],
    fileSecurity: false,
    isPublic: false,
    retentionPolicy: 'Patient record retention',
    intendedAccessPattern: 'client_upload_server_managed',
  },
};
