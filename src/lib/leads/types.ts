/**
 * Shared types for the AI lead-detection / qualification / follow-up layer.
 * Kept industry-agnostic: industry-specific question sets live in
 * lead-qualification.service.ts and are selected from the account industry.
 */

export const LEAD_INTENT_LEVELS = ['high', 'medium', 'low', 'none'] as const;
export type LeadIntentLevel = (typeof LEAD_INTENT_LEVELS)[number];

export const LEAD_SCORE_LABELS = ['hot', 'warm', 'cold'] as const;
export type LeadScoreLabel = (typeof LEAD_SCORE_LABELS)[number];

export const FOLLOWUP_STATUSES = [
  'none',
  'scheduled',
  'waiting_for_reply',
  'reminder_sent',
  'stopped',
  'human_takeover',
] as const;
export type FollowupStatus = (typeof FOLLOWUP_STATUSES)[number];

export const LEAD_FOLLOWUP_JOB_STATUSES = [
  'scheduled',
  'processing',
  'cancelled',
  'sent',
  'failed',
  'skipped',
] as const;
export type LeadFollowupJobStatus = (typeof LEAD_FOLLOWUP_JOB_STATUSES)[number];

export const TERMINAL_LEAD_STAGES = ['CONVERTED', 'LOST'] as const;

export const LEAD_LAYER_EVENTS = {
  AI_LEAD_DETECTED: 'AI_LEAD_DETECTED',
  AI_LEAD_NOT_DETECTED: 'AI_LEAD_NOT_DETECTED',
  LEAD_CREATED: 'LEAD_CREATED',
  LEAD_UPDATED: 'LEAD_UPDATED',
  AI_QUALIFIED: 'AI_QUALIFIED',
  FOLLOWUP_SCHEDULED: 'FOLLOWUP_SCHEDULED',
  FOLLOWUP_CANCELLED: 'FOLLOWUP_CANCELLED',
  FOLLOWUP_SENT: 'FOLLOWUP_SENT',
  FOLLOWUP_SKIPPED: 'FOLLOWUP_SKIPPED',
  FOLLOWUP_STOPPED: 'FOLLOWUP_STOPPED',
  HUMAN_HANDOFF: 'HUMAN_HANDOFF',
} as const;

export type LeadLayerEvent =
  (typeof LEAD_LAYER_EVENTS)[keyof typeof LEAD_LAYER_EVENTS];

export interface LeadDetectionResult {
  is_business_enquiry: boolean;
  intent: LeadIntentLevel;
  lead_confidence: number;
  service: string | null;
  summary: string | null;
  requires_qualification: boolean;
  budget: string | null;
  timeline: string | null;
  next_action: string | null;
  score_label: LeadScoreLabel;
  score_numeric: number;
}

export interface QualificationField {
  key: string;
  label: string;
  /** Hint the AI/receptionist may ask, never a hardcoded interrogation script. */
  promptHint: string;
}

export interface QualificationSnapshot {
  known: Record<string, string | null>;
  missing: QualificationField[];
  nextQuestion: string | null;
}

export interface FollowupPolicy {
  enabled: boolean;
  maxReminders: number;
  reminderDelayDays: number;
}

export const DEFAULT_FOLLOWUP_POLICY: FollowupPolicy = {
  enabled: true,
  maxReminders: 1,
  reminderDelayDays: 7,
};

export type FollowupStopReason =
  | 'customer_replied'
  | 'max_reminders'
  | 'pending_followup'
  | 'recent_automated_message'
  | 'opted_out'
  | 'human_handoff'
  | 'conversation_closed'
  | 'lead_lost'
  | 'lead_converted'
  | 'automation_disabled'
  | 'account_inactive'
  | 'whatsapp_unavailable'
  | 'stop_keyword'
  | 'negative_intent'
  | 'already_sent'
  | 'policy_disabled'
  | 'not_an_enquiry';

export interface OutboundGuardDecision {
  allow: boolean;
  reason?: FollowupStopReason;
}

export interface InboundLeadContext {
  accountId: string;
  userId: string;
  conversationId: string;
  contactId: string;
  messageId: string;
  messageText: string;
  contactName?: string | null;
  contactPhone?: string | null;
  industry?: string | null;
  assignedAgentId?: string | null;
  conversationStatus?: string | null;
  aiDisabled?: boolean;
  correlationId?: string;
}
