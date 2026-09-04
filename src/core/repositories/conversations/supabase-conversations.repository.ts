/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/db/server';
import { assertTenantContext, type TenantContext } from '../tenant-context';
import type { HistoryMessage } from '@/lib/whatsapp/ai-pipeline';
import type {
  ConversationContextOptions,
  ConversationContextResult,
  ConversationRecord,
  IConversationsRepository,
} from './conversations.interface';

export function mapHistoryMessage(m: Record<string, unknown>): HistoryMessage {
  return {
    id: String(m.id || ''),
    sender_type: String(m.sender_type || m.senderType || 'customer'),
    content_type: String(m.content_type || m.contentType || 'text'),
    content_text: String(m.content_text || m.contentText || ''),
    created_at: String(m.created_at || m.createdAt || new Date().toISOString()),
    reply_to_message_id: String(
      m.reply_to_message_id || m.replyToMessageId || ''
    ),
  };
}

export class SupabaseConversationsRepository implements IConversationsRepository {
  readonly tenantContext: TenantContext;
  private readonly client: SupabaseClient<any, any, any>;

  constructor(
    tenantContext: TenantContext,
    client?: SupabaseClient<any, any, any>
  ) {
    assertTenantContext(tenantContext);
    this.tenantContext = tenantContext;
    this.client =
      client ?? (getAdminClient() as unknown as SupabaseClient<any, any, any>);
  }

  /**
   * Internal fail-closed guard enforcing active tenant context on every operation.
   */
  private ensureContext(): string {
    assertTenantContext(this.tenantContext);
    return this.tenantContext.accountId.trim();
  }

  async getConversationById(
    conversationId: string
  ): Promise<ConversationRecord | null> {
    const accountId = this.ensureContext();
    if (!conversationId || !conversationId.trim()) return null;

    const { data, error } = await this.client
      .from('conversations')
      .select('*')
      .eq('id', conversationId.trim())
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) throw error;
    return (data as ConversationRecord | null) ?? null;
  }

  async getConversationByContact(
    contactId: string
  ): Promise<ConversationRecord | null> {
    const accountId = this.ensureContext();
    if (!contactId || !contactId.trim()) return null;

    const { data, error } = await this.client
      .from('conversations')
      .select('*')
      .eq('contact_id', contactId.trim())
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return (data as ConversationRecord | null) ?? null;
  }

  async listRecentMessages(
    conversationId: string,
    limit: number = 15
  ): Promise<HistoryMessage[]> {
    const accountId = this.ensureContext();
    if (!conversationId || !conversationId.trim()) return [];

    // Security requirement: Ensure conversation belongs to active tenant before querying messages.
    const conversation = await this.getConversationById(conversationId);
    if (!conversation) return [];

    const { data, error } = await this.client
      .from('messages')
      .select(
        'id, sender_type, content_type, content_text, created_at, reply_to_message_id'
      )
      .eq('conversation_id', conversationId.trim())
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map((m: any) => mapHistoryMessage(m));
  }

  async getMessageById(messageId: string): Promise<HistoryMessage | null> {
    const accountId = this.ensureContext();
    if (!messageId || !messageId.trim()) return null;

    const { data } = await this.client
      .from('messages')
      .select(
        'id, sender_type, content_type, content_text, created_at, reply_to_message_id'
      )
      .eq('id', messageId.trim())
      .eq('account_id', accountId)
      .maybeSingle();

    if (data) {
      return mapHistoryMessage(data as Record<string, unknown>);
    }

    // Fallback query with select('*') if column selection failed
    const { data: fallbackData } = await this.client
      .from('messages')
      .select('*')
      .eq('id', messageId.trim())
      .eq('account_id', accountId)
      .maybeSingle();

    if (fallbackData) {
      return mapHistoryMessage(fallbackData as Record<string, unknown>);
    }

    return null;
  }

  async loadConversationContext(
    conversationId: string,
    options?: ConversationContextOptions
  ): Promise<ConversationContextResult> {
    const accountId = this.ensureContext();
    if (!conversationId || !conversationId.trim()) {
      return { conversation: null, messages: [] };
    }

    // 1. Verify and fetch conversation ownership
    const conversation = await this.getConversationById(conversationId);
    if (!conversation) {
      return { conversation: null, messages: [] };
    }

    // 2. Fetch recent message history (default limit: 15)
    const limit = options?.limit ?? 15;
    let rawMessages: Array<Record<string, unknown>> = [];
    let msgError: unknown = null;

    try {
      const { data, error } = await this.client
        .from('messages')
        .select(
          'id, sender_type, content_type, content_text, created_at, reply_to_message_id'
        )
        .eq('conversation_id', conversationId.trim())
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        msgError = error;
      } else if (data) {
        rawMessages = data as Array<Record<string, unknown>>;
      }
    } catch (err) {
      msgError = err;
    }

    // 3. Fallback message query if empty or error (default limit: 50, matching ai.ts:269-284)
    if (msgError || rawMessages.length === 0) {
      try {
        const fallbackLimit = options?.fallbackLimit ?? 50;
        const fallbackRes = await this.client
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId.trim())
          .eq('account_id', accountId)
          .order('created_at', { ascending: false })
          .limit(fallbackLimit);

        if (fallbackRes.data && fallbackRes.data.length > 0) {
          rawMessages = fallbackRes.data as Array<Record<string, unknown>>;
        }
      } catch {
        // Fallback error ignored, preserve empty array
      }
    }

    const messages: HistoryMessage[] = rawMessages.map(mapHistoryMessage);

    // 4. Inbound message reconciliation if missing from fetched history
    if (options?.inboundMessageId) {
      const alreadyPresent = messages.some(
        (m) => m.id === options.inboundMessageId
      );
      if (!alreadyPresent) {
        try {
          const inboundMsg = await this.getMessageById(
            options.inboundMessageId
          );
          if (inboundMsg) {
            messages.unshift(inboundMsg);
          }
        } catch {
          // Ignore reconciliation error
        }
      }
    }

    return {
      conversation,
      messages,
    };
  }
}
