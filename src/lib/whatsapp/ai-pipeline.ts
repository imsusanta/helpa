export const MAX_AI_REPLIES_PER_CONVERSATION = 100;

export type AiSkipReason = 'assigned' | 'disabled' | 'cap';

export type AiSkipDecision =
  { skip: false } | { skip: true; reason: AiSkipReason };

/**
 * Conversation-level gates that run before any model call.
 * Assigned chats, master-off flags, and the per-thread reply cap all
 * suppress auto-reply without touching the rest of the pipeline.
 */
export function shouldSkipAiConversation(
  conversation: Record<string, unknown> | null | undefined
): AiSkipDecision {
  if (!conversation) return { skip: false };

  const assignedAgentId =
    conversation.assigned_agent_id || conversation.assignedAgentId;
  if (assignedAgentId) return { skip: true, reason: 'assigned' };

  if (
    conversation.ai_chat_enabled === false ||
    conversation.ai_autoreply_disabled === true ||
    conversation.is_ai_enabled === false ||
    conversation.ai_handoff_required === true
  ) {
    return { skip: true, reason: 'disabled' };
  }

  const aiReplyCount = Number(
    conversation.ai_reply_count || conversation.aiReplyCount || 0
  );
  if (aiReplyCount >= MAX_AI_REPLIES_PER_CONVERSATION) {
    return { skip: true, reason: 'cap' };
  }

  return { skip: false };
}

export interface HistoryMessage {
  id?: string;
  sender_type: string;
  content_type?: string;
  content_text?: string;
  created_at?: string;
  reply_to_message_id?: string | null;
}

/**
 * Inbound rows use WhatsApp provider time; outbound rows were persisted with
 * server time. After outbound persist started working, the newest row by
 * `created_at` is often the previous AI/staff bubble, so the old
 * "latest sender must be customer" guard skipped every new customer turn.
 *
 * Skip only when we already stored an outbound reply pointing at that
 * customer message id.
 */
export function latestUnansweredCustomerMessage(
  messages: HistoryMessage[]
): HistoryMessage | null {
  const latestCustomer = messages.find(
    (message) => message.sender_type === 'customer'
  );
  if (!latestCustomer) return null;

  const customerId = latestCustomer.id;
  if (!customerId) {
    return messages[0]?.sender_type === 'customer' ? latestCustomer : null;
  }

  const answered = messages.some(
    (message) =>
      message.sender_type !== 'customer' &&
      message.reply_to_message_id === customerId
  );
  return answered ? null : latestCustomer;
}

/**
 * Prefer the inbound row this webhook just stored. History is ordered by
 * `created_at`, so a new patient message can fall outside the recent window
 * when previous outbound rows used server time.
 */
export function unansweredCustomerTurn(
  messages: HistoryMessage[],
  inboundMessageId?: string | null
): { message: HistoryMessage | null; missingInbound: boolean } {
  if (!inboundMessageId) {
    return {
      message: latestUnansweredCustomerMessage(messages),
      missingInbound: false,
    };
  }

  const inbound = messages.find((message) => message.id === inboundMessageId);
  if (!inbound) {
    return { message: null, missingInbound: true };
  }

  const answered = messages.some(
    (message) =>
      message.sender_type !== 'customer' &&
      message.reply_to_message_id === inbound.id
  );
  return { message: answered ? null : inbound, missingInbound: false };
}

export function outboundCreatedAtAfter(
  customerCreatedAt?: string
): string | undefined {
  if (!customerCreatedAt) return undefined;
  const timestamp = Date.parse(customerCreatedAt);
  if (!Number.isFinite(timestamp)) return undefined;
  return new Date(timestamp + 1000).toISOString();
}

/**
 * Phone lookup variants used to find sibling contacts registered under
 * the same WhatsApp number (E.164, local 10-digit, +91 prefix, etc.).
 */
export function buildContactPhoneVariants(rawPhone: string): string[] {
  const cleanDigits = rawPhone.replace(/\D/g, '');
  return Array.from(
    new Set(
      [
        rawPhone,
        `+${cleanDigits}`,
        cleanDigits,
        cleanDigits.startsWith('91')
          ? cleanDigits.slice(2)
          : `91${cleanDigits}`,
        cleanDigits.startsWith('91')
          ? `+${cleanDigits.slice(2)}`
          : `+91${cleanDigits}`,
      ].filter((p) => Boolean(p && p.trim().length > 3))
    )
  );
}

export interface KnowledgeBaseEntry {
  category: string;
  question_title: string;
  answer_content: string;
}

export function formatKnowledgeBaseContext(
  entries: KnowledgeBaseEntry[] | null | undefined
): string {
  if (!entries || entries.length === 0) return '';
  let kbContext =
    'Here is the verified knowledge base and pricing information for our company:\n\n';
  for (const entry of entries) {
    kbContext += `[${String(entry.category).toUpperCase()}] ${entry.question_title}: ${entry.answer_content}\n`;
  }
  return kbContext;
}

export function isHospitalIndustryEnabled(
  industry: string | null | undefined,
  moduleId?: string
): boolean {
  return (
    moduleId === 'hospital_clinic' ||
    !industry ||
    industry === 'hospital' ||
    industry === 'clinic' ||
    industry === 'healthcare' ||
    industry === 'general'
  );
}

export interface StructuredAiInsights {
  intent: string;
  leadScore: string;
  sentiment: string;
  handoffRequired: boolean;
  resolved: boolean;
  summary: string | null;
  faqCategory: string;
  salesSignal: boolean;
  interestedService: string | null;
  budget: string | null;
  timeline: string | null;
  nextAction: string | null;
  hospitalPatientInfo: Record<string, unknown> | null;
  hospitalBooking: Record<string, unknown> | null;
  hospitalProfileUpdate: Record<string, unknown> | null;
  hospitalReportSend: Record<string, unknown> | null;
  coachingStudentUpdate: Record<string, unknown> | null;
  emergencyDetected: boolean;
}

const EMPTY_INSIGHTS: StructuredAiInsights = {
  intent: 'other',
  leadScore: 'cold',
  sentiment: 'neutral',
  handoffRequired: false,
  resolved: false,
  summary: null,
  faqCategory: 'general',
  salesSignal: false,
  interestedService: null,
  budget: null,
  timeline: null,
  nextAction: null,
  hospitalPatientInfo: null,
  hospitalBooking: null,
  hospitalProfileUpdate: null,
  hospitalReportSend: null,
  coachingStudentUpdate: null,
  emergencyDetected: false,
};

/**
 * Maps a parsed receptionist JSON payload onto the CRM side-effect fields.
 * Missing keys fall back to safe defaults so a partial model reply cannot
 * skip the rest of the pipeline.
 */
export function extractStructuredInsights(
  payload: Record<string, unknown> | null | undefined
): StructuredAiInsights {
  if (!payload) return { ...EMPTY_INSIGHTS };

  const extracted = (payload.extracted_lead_info || {}) as Record<
    string,
    unknown
  >;

  return {
    intent: (payload.intent as string) || 'other',
    leadScore: (payload.lead_score as string) || 'cold',
    sentiment: (payload.sentiment as string) || 'neutral',
    handoffRequired: !!payload.handoff_required,
    resolved: !!payload.resolved,
    summary: (payload.summary as string) || null,
    faqCategory: (payload.faq_category as string) || 'general',
    salesSignal: !!payload.sales_signal || !!payload.is_business_enquiry,
    interestedService: (extracted.interested_service as string) || null,
    budget: (extracted.budget as string) || null,
    timeline: (extracted.timeline as string) || null,
    nextAction: (extracted.next_action as string) || null,
    hospitalPatientInfo:
      (payload.hospital_patient_info as Record<string, unknown>) || null,
    hospitalBooking:
      (payload.hospital_booking as Record<string, unknown>) || null,
    hospitalProfileUpdate:
      (payload.hospital_profile_update as Record<string, unknown>) || null,
    hospitalReportSend:
      (payload.hospital_report_send as Record<string, unknown>) || null,
    coachingStudentUpdate:
      (payload.coaching_student_update as Record<string, unknown>) || null,
    emergencyDetected: !!payload.emergency_detected,
  };
}

/** If the model nested `reply` inside a JSON object string, unwrap it. */
export function unwrapNestedReply(reply: string): string {
  if (!reply.startsWith('{') || !reply.endsWith('}')) return reply;
  try {
    const parsed: unknown = JSON.parse(reply);
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      typeof (parsed as { reply?: unknown }).reply === 'string'
    ) {
      return String((parsed as { reply: string }).reply);
    }
  } catch {
    // keep original
  }
  return reply;
}
