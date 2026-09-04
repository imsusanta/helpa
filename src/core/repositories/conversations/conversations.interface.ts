import type { TenantContext } from '../tenant-context';
import type { HistoryMessage } from '@/lib/whatsapp/ai-pipeline';

export interface ConversationRecord {
  id: string;
  account_id: string;
  contact_id: string;
  status?: string | null;
  ai_chat_enabled?: boolean;
  ai_autoreply_disabled?: boolean;
  is_ai_enabled?: boolean;
  ai_handoff_required?: boolean;
  assigned_agent_id?: string | null;
  last_message_at?: string | null;
  last_message_text?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ConversationContextOptions {
  limit?: number;
  fallbackLimit?: number;
  inboundMessageId?: string | null;
}

export interface ConversationContextResult {
  conversation: ConversationRecord | null;
  messages: HistoryMessage[];
}

export interface IConversationsRepository {
  readonly tenantContext: TenantContext;
  getConversationById(
    conversationId: string
  ): Promise<ConversationRecord | null>;
  getConversationByContact(
    contactId: string
  ): Promise<ConversationRecord | null>;
  listRecentMessages(
    conversationId: string,
    limit?: number
  ): Promise<HistoryMessage[]>;
  getMessageById(messageId: string): Promise<HistoryMessage | null>;
  loadConversationContext(
    conversationId: string,
    options?: ConversationContextOptions
  ): Promise<ConversationContextResult>;
}
