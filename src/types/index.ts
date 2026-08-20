import type { AccountRole } from '@/lib/auth/roles';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  role: string;
  beta_features?: string[];
  account_id?: string;
  account_role?: AccountRole;
  created_at: string;
}

export interface Account {
  id: string;
  name: string;
  owner_user_id: string;
  openrouter_api_key?: string;
  openrouter_model?: string;
  ai_system_prompt?: string;
  welcome_message?: string;
  created_at: string;
  updated_at: string;
  industry?: string;
  logo?: string;
  status?: string;
}

export interface AccountMember {
  user_id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  role: AccountRole;
  joined_at: string;
}

export interface AccountInvitation {
  id: string;
  account_id: string;
  role: Exclude<AccountRole, 'owner'>;
  created_by_user_id: string | null;
  label: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by_user_id: string | null;
}

export interface Contact {
  id: string;
  user_id: string;
  account_id: string;
  phone: string;
  phone_normalized?: string;
  name?: string;
  email?: string;
  company?: string;
  avatar_url?: string;
  address?: string;
  notes?: string;
  industry?: string;
  entity_type?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ContactTag {
  id: string;
  contact_id: string;
  tag_id: string;
}

export type ConversationStatus = 'open' | 'pending' | 'closed';
export interface Conversation {
  id: string;
  user_id: string;
  contact_id: string;
  status: ConversationStatus;
  assigned_agent_id?: string;
  last_message_text?: string;
  last_message_at?: string;
  unread_count: number;
  ai_chat_enabled?: boolean;
  ai_intent?: string | null;
  ai_lead_score?: string | null;
  ai_summary?: string | null;
  ai_sentiment?: string | null;
  ai_handoff_required?: boolean;
  ai_resolved?: boolean;
  ai_faq_category?: string | null;
  created_at: string;
  updated_at: string;
  contact?: Contact;
}

export type SenderType = 'customer' | 'agent' | 'bot';
export type ContentType = 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'template' | 'interactive';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export interface Message {
  id: string;
  conversation_id: string;
  sender_type: SenderType;
  sender_id?: string;
  content_type: ContentType;
  content_text?: string;
  media_url?: string;
  template_name?: string;
  message_id?: string;
  status: MessageStatus;
  created_at: string;
  reply_to_message_id?: string;
  interactive_reply_id?: string;
}

export type ReactionActor = 'customer' | 'agent';
export interface MessageReaction {
  id: string;
  message_id: string;
  conversation_id: string;
  actor_type: ReactionActor;
  actor_id?: string;
  emoji: string;
  created_at: string;
}

export type WhatsAppConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'coexistence_pending' | 'coexistence_connected' | 'action_required' | 'not_eligible' | 'error' | 'reconnect_required';
export type WhatsAppConnectionType = 'coexistence' | 'standard' | 'manual';
export type WhatsAppCoexistenceStatus = 'eligible' | 'active' | 'pending' | 'not_eligible' | 'unknown';
export interface WhatsAppConfig {
  id: string;
  user_id: string;
  account_id?: string;
  phone_number_id: string;
  waba_id?: string;
  access_token: string;
  verify_token?: string;
  status: WhatsAppConnectionStatus;
  connection_type?: WhatsAppConnectionType;
  coexistence_status?: WhatsAppCoexistenceStatus;
  connected_at?: string;
  phone_number?: string;
  display_phone_number?: string;
  verified_name?: string;
  business_name?: string;
  coexistence_eligible?: boolean;
  platform_type?: string;
  quality_rating?: string;
  last_health_check_at?: string;
  webhook_healthy?: boolean;
  messaging_active?: boolean;
  registered_at?: string;
  subscribed_apps_at?: string;
  last_registration_error?: string;
}

export type MessageTemplateStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED' | 'IN_APPEAL' | 'PENDING_DELETION';
export type TemplateButton =
  | { type: 'QUICK_REPLY'; text: string }
  | { type: 'URL'; text: string; url: string; example?: string }
  | { type: 'PHONE_NUMBER'; text: string; phone_number: string }
  | { type: 'COPY_CODE'; text: string; example: string };
export interface TemplateSampleValues { body?: string[]; header?: string[]; }
export interface MessageTemplate {
  id: string; user_id: string; name: string; category: 'Marketing' | 'Utility' | 'Authentication'; language?: string;
  header_type?: 'text' | 'image' | 'video' | 'document'; header_content?: string; header_handle?: string; header_media_url?: string;
  body_text: string; footer_text?: string; buttons?: TemplateButton[]; sample_values?: TemplateSampleValues; status?: MessageTemplateStatus;
  meta_template_id?: string; rejection_reason?: string; quality_score?: 'GREEN' | 'YELLOW' | 'RED'; submission_error?: string; last_submitted_at?: string; created_at: string;
}

export interface Pipeline { id: string; user_id: string; name: string; created_at: string; }

// ============================================================
// Automations
// ============================================================

export type AutomationTriggerType =
  | 'new_message_received'
  | 'first_inbound_message'
  | 'keyword_match'
  | 'new_contact_created'
  | 'conversation_assigned'
  | 'tag_added'
  | 'time_based'
  | 'appointment_created'
  | 'appointment_reminder'
  | 'appointment_cancelled';

export type AutomationStepType =
  | 'send_message' | 'send_template' | 'add_tag' | 'remove_tag' | 'assign_conversation'
  | 'update_contact_field' | 'create_deal' | 'wait' | 'condition' | 'send_webhook' | 'close_conversation';
export type AutomationLogStatus = 'success' | 'partial' | 'failed';

export interface KeywordMatchTriggerConfig { keywords: string[]; match_type: 'exact' | 'contains'; case_sensitive?: boolean; }
export interface TagTriggerConfig { tag_id: string; }
export interface TimeBasedTriggerConfig { schedule: string; timezone?: string; }
export interface AppointmentReminderTriggerConfig { before_minutes: number; timezone?: string; }
export type AutomationTriggerConfig = Record<string, never> | KeywordMatchTriggerConfig | TagTriggerConfig | TimeBasedTriggerConfig | AppointmentReminderTriggerConfig | Record<string, unknown>;

export interface SendMessageStepConfig { text: string; }
export interface SendTemplateStepConfig { template_name: string; language?: string; variables?: Record<string, string>; }
export interface TagStepConfig { tag_id: string; }
export interface AssignConversationStepConfig { mode: 'specific' | 'round_robin'; agent_id?: string; }
export interface UpdateContactFieldStepConfig { field: string; value: string; }
export interface CreateDealStepConfig { pipeline_id: string; stage_id: string; title: string; value?: number; }
export interface WaitStepConfig { amount: number; unit: 'minutes' | 'hours' | 'days'; }
export type ConditionSubject = 'contact_field' | 'tag_presence' | 'message_content' | 'time_of_day';
export interface ConditionStepConfig { subject: ConditionSubject; operand?: string; value?: string; }
export interface SendWebhookStepConfig { url: string; headers?: Record<string, string>; body_template?: string; }
export type AutomationStepConfig = SendMessageStepConfig | SendTemplateStepConfig | TagStepConfig | AssignConversationStepConfig | UpdateContactFieldStepConfig | CreateDealStepConfig | WaitStepConfig | ConditionStepConfig | SendWebhookStepConfig | Record<string, never> | Record<string, unknown>;
export interface Automation {
  id: string; account_id: string; user_id: string; name: string; description?: string;
  trigger_type: AutomationTriggerType; trigger_config: AutomationTriggerConfig; is_active: boolean; execution_count: number; last_executed_at?: string | null; created_at: string; updated_at: string;
}
export interface AutomationStep { id: string; automation_id: string; parent_step_id?: string | null; branch?: 'yes' | 'no' | null; step_type: AutomationStepType; step_config: AutomationStepConfig; position: number; created_at: string; }
export interface AutomationLogStepResult { step_id: string; step_type: AutomationStepType; status: 'success' | 'skipped' | 'failed'; detail?: string; }
export interface AutomationLog { id: string; automation_id: string; user_id: string; contact_id: string | null; trigger_event: string; steps_executed: AutomationLogStepResult[]; status: AutomationLogStatus; error_message?: string | null; created_at: string; contact?: Contact; }
