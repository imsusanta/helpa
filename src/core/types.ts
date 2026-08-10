// Normalized Internal Events & Data Contracts for Helpa Omnichannel AI Receptionist

export type ChannelType = 'whatsapp' | 'sms' | 'voice' | 'email';
export type CallStatusType =
  | 'initiated'
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'no_answer'
  | 'busy'
  | 'transferred';
export type LeadStageType =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFYING'
  | 'QUALIFIED'
  | 'APPOINTMENT_OFFERED'
  | 'BOOKED'
  | 'CONFIRMED'
  | 'FOLLOW_UP'
  | 'ATTENDED'
  | 'CONVERTED'
  | 'LOST';

export interface MessageEvent {
  eventId: string;
  messageId?: string;
  clinicId: string;
  provider: 'meta' | 'waha' | 'twilio' | 'exotel';
  channel: 'whatsapp' | 'sms';
  externalMessageId: string;
  direction: 'inbound' | 'outbound';
  patientAddress: string;
  senderPhone?: string;
  recipientPhone?: string;
  content?: string;
  clinicAddress?: string;
  contentType?:
    | 'text'
    | 'image'
    | 'document'
    | 'audio'
    | 'video'
    | 'location'
    | 'template';
  text?: string;
  mediaUrl?: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  occurredAt: string;
  timestamp?: string;
}

export interface CallEvent {
  eventId: string;
  callId?: string;
  clinicId: string;
  provider: 'sarvam' | 'xai' | 'elevenlabs';
  externalCallId: string;
  externalAgentId?: string;
  externalPhoneNumberId?: string;
  direction: 'inbound' | 'outbound';
  status: CallStatusType;
  patientPhone: string;
  transcript?: string;
  summary?: string;
  outcome?: string;
  recordingUrl?: string;
  failureReason?: string;
  humanHandoff?: boolean;
  startedAt: string;
  answeredAt?: string;
  endedAt?: string;
  durationSeconds?: number;
}

export interface CalendlyEvent {
  eventId: string;
  clinicId: string;
  type?: 'scheduled' | 'canceled' | 'rescheduled';
  eventType:
    | 'invitee.created'
    | 'invitee.canceled'
    | 'invitee_no_show.created'
    | 'invitee_no_show.deleted';
  eventUri: string;
  inviteeUri: string;
  patientName?: string;
  patientPhone?: string;
  patientEmail?: string;
  contactDetails: {
    name?: string;
    email?: string;
    phone?: string;
  };
  startAt: string;
  endAt: string;
  startTime?: string;
  endTime?: string;
  timezone: string;
  status: 'active' | 'canceled';
  rescheduled: boolean;
  occurredAt: string;
  rawPayload?: Record<string, unknown>;
}

export interface LeadEvent {
  clinicId: string;
  leadId: string;
  contactId?: string;
  eventType: 'stage_transition';
  previousStage: LeadStageType;
  nextStage: LeadStageType;
  source: string;
  actor: 'system' | 'ai' | 'user' | 'webhook';
  metadata?: Record<string, unknown>;
  occurredAt: string;
}
