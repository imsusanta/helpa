import { describe, expect, it } from 'vitest';
import {
  MAX_AI_REPLIES_PER_CONVERSATION,
  buildContactPhoneVariants,
  extractStructuredInsights,
  formatKnowledgeBaseContext,
  isHospitalIndustryEnabled,
  shouldSkipAiConversation,
  unwrapNestedReply,
} from './ai-pipeline';

describe('shouldSkipAiConversation', () => {
  it('continues when there is no conversation row yet', () => {
    expect(shouldSkipAiConversation(null)).toEqual({ skip: false });
  });

  it('skips chats already assigned to a human agent', () => {
    expect(shouldSkipAiConversation({ assigned_agent_id: 'agent-1' })).toEqual({
      skip: true,
      reason: 'assigned',
    });
    expect(shouldSkipAiConversation({ assignedAgentId: 'agent-2' })).toEqual({
      skip: true,
      reason: 'assigned',
    });
  });

  it('skips when any auto-reply flag is off', () => {
    expect(shouldSkipAiConversation({ ai_chat_enabled: false })).toEqual({
      skip: true,
      reason: 'disabled',
    });
    expect(shouldSkipAiConversation({ ai_autoreply_disabled: true })).toEqual({
      skip: true,
      reason: 'disabled',
    });
    expect(shouldSkipAiConversation({ is_ai_enabled: false })).toEqual({
      skip: true,
      reason: 'disabled',
    });
  });

  it('skips when the per-conversation reply cap is reached', () => {
    expect(
      shouldSkipAiConversation({
        ai_reply_count: MAX_AI_REPLIES_PER_CONVERSATION,
      })
    ).toEqual({ skip: true, reason: 'cap' });
  });

  it('allows a normal unassigned conversation', () => {
    expect(
      shouldSkipAiConversation({
        ai_chat_enabled: true,
        is_ai_enabled: true,
        ai_reply_count: 3,
      })
    ).toEqual({ skip: false });
  });
});

describe('buildContactPhoneVariants', () => {
  it('expands an Indian mobile into local, +91, and 91-prefixed forms', () => {
    const variants = buildContactPhoneVariants('+91 98765 43210');
    expect(variants).toContain('+919876543210');
    expect(variants).toContain('919876543210');
    expect(variants).toContain('9876543210');
  });

  it('drops empty or too-short values', () => {
    expect(buildContactPhoneVariants('12')).toEqual([]);
  });
});

describe('formatKnowledgeBaseContext', () => {
  it('returns empty string when there are no entries', () => {
    expect(formatKnowledgeBaseContext([])).toBe('');
    expect(formatKnowledgeBaseContext(null)).toBe('');
  });

  it('prefixes each entry with an uppercased category', () => {
    const text = formatKnowledgeBaseContext([
      {
        category: 'pricing',
        question_title: 'Consultation',
        answer_content: '₹500',
      },
    ]);
    expect(text).toContain('[PRICING] Consultation: ₹500');
    expect(text).toContain('verified knowledge base');
  });
});

describe('isHospitalIndustryEnabled', () => {
  it('defaults on when industry is unset so existing clinics keep hospital mode', () => {
    expect(isHospitalIndustryEnabled(null)).toBe(true);
    expect(isHospitalIndustryEnabled('clinic')).toBe(true);
  });

  it('follows the industry module id when present', () => {
    expect(isHospitalIndustryEnabled('coaching', 'hospital_clinic')).toBe(true);
    expect(isHospitalIndustryEnabled('coaching', 'coaching')).toBe(false);
  });
});

describe('extractStructuredInsights', () => {
  it('uses safe defaults when the model returned unstructured text', () => {
    expect(extractStructuredInsights(null)).toMatchObject({
      intent: 'other',
      leadScore: 'cold',
      handoffRequired: false,
      emergencyDetected: false,
    });
  });

  it('maps receptionist JSON onto CRM side-effect fields', () => {
    const insights = extractStructuredInsights({
      intent: 'booking',
      lead_score: 'hot',
      sentiment: 'positive',
      handoff_required: true,
      summary: 'Wants cardiology slot',
      faq_category: 'pricing',
      sales_signal: true,
      extracted_lead_info: {
        interested_service: 'cardiology',
        budget: '2000',
        timeline: 'tomorrow',
        next_action: 'book',
      },
      hospital_patient_info: { name: 'Ravi' },
      hospital_booking: { action: 'book', doctor_name: 'Dr. Test' },
      emergency_detected: false,
    });

    expect(insights.intent).toBe('booking');
    expect(insights.leadScore).toBe('hot');
    expect(insights.handoffRequired).toBe(true);
    expect(insights.interestedService).toBe('cardiology');
    expect(insights.hospitalPatientInfo).toEqual({ name: 'Ravi' });
    expect(insights.hospitalBooking).toEqual({
      action: 'book',
      doctor_name: 'Dr. Test',
    });
  });
});

describe('unwrapNestedReply', () => {
  it('extracts reply from a nested JSON string', () => {
    expect(unwrapNestedReply('{"reply":"Namaste"}')).toBe('Namaste');
  });

  it('leaves plain text unchanged', () => {
    expect(unwrapNestedReply('Namaste, how can I help?')).toBe(
      'Namaste, how can I help?'
    );
  });
});
