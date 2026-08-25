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
    conversation.is_ai_enabled === false
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
    salesSignal: !!payload.sales_signal,
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
