import { describe, expect, it } from 'vitest';
import {
  MAX_AI_REPLIES_PER_CONVERSATION,
  buildContactPhoneVariants,
  extractStructuredInsights,
  formatKnowledgeBaseContext,
  isHospitalIndustryEnabled,
  latestUnansweredCustomerMessage,
  outboundCreatedAtAfter,
  unansweredCustomerTurn,
  shouldSkipAiConversation,
  honorModelHandoff,
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

describe('honorModelHandoff', () => {
  it('ignores a model handoff on a normal question', () => {
    expect(honorModelHandoff(true, 'What is the consultation fee?')).toBe(
      false
    );
    expect(honorModelHandoff(true, 'Hi')).toBe(false);
  });

  it('honors a handoff when the customer asked for a human', () => {
    expect(honorModelHandoff(true, 'Can I talk to an agent?')).toBe(true);
    expect(honorModelHandoff(true, 'মানুষ সাথে কথা বলতে চাই')).toBe(true);
  });

  it('stays off when the model did not request handoff', () => {
    expect(honorModelHandoff(false, 'Please connect me to staff')).toBe(false);
  });
});

describe('latestUnansweredCustomerMessage', () => {
  const customerId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const customer = {
    id: customerId,
    sender_type: 'customer',
    content_text: 'Can I book an appointment?',
    created_at: '2026-08-27T10:00:00.000Z',
  };

  it('returns the latest customer when a newer bot row has no reply_to', () => {
    expect(
      latestUnansweredCustomerMessage([
        {
          id: 'bot-1',
          sender_type: 'bot',
          content_text: 'Previous AI reply',
          created_at: '2026-08-27T10:00:20.000Z',
        },
        customer,
      ])
    ).toEqual(customer);
  });

  it('skips when an outbound row already points at that customer message', () => {
    expect(
      latestUnansweredCustomerMessage([
        {
          id: 'bot-2',
          sender_type: 'bot',
          content_text: 'Already answered',
          created_at: '2026-08-27T10:00:01.000Z',
          reply_to_message_id: customerId,
        },
        customer,
      ])
    ).toBeNull();
  });

  it('treats a staff reply as answering that customer turn', () => {
    expect(
      latestUnansweredCustomerMessage([
        {
          id: 'agent-1',
          sender_type: 'agent',
          content_text: 'Staff already replied',
          reply_to_message_id: customerId,
        },
        customer,
      ])
    ).toBeNull();
  });

  it('falls back to newest-is-customer when ids are missing', () => {
    expect(
      latestUnansweredCustomerMessage([
        {
          sender_type: 'bot',
          content_text: 'Earlier bot',
          created_at: '2026-08-27T10:00:20.000Z',
        },
        {
          sender_type: 'customer',
          content_text: 'Hello',
          created_at: '2026-08-27T10:00:00.000Z',
        },
      ])
    ).toBeNull();
    expect(
      latestUnansweredCustomerMessage([
        {
          sender_type: 'customer',
          content_text: 'Hello',
        },
      ])?.content_text
    ).toBe('Hello');
  });
});

describe('unansweredCustomerTurn', () => {
  const inboundId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const inbound = {
    id: inboundId,
    sender_type: 'customer',
    content_text: 'New inbound',
    created_at: '2026-08-27T08:00:00.000Z',
  };

  it('prefers the webhook inbound id even when a later customer exists', () => {
    expect(
      unansweredCustomerTurn(
        [
          {
            id: 'newer-customer',
            sender_type: 'customer',
            content_text: 'Later by created_at',
            created_at: '2026-08-27T09:00:00.000Z',
          },
          inbound,
        ],
        inboundId
      )
    ).toEqual({ message: inbound, missingInbound: false });
  });

  it('skips when outbound already points at that inbound id', () => {
    expect(
      unansweredCustomerTurn(
        [
          {
            id: 'bot-1',
            sender_type: 'agent',
            reply_to_message_id: inboundId,
          },
          inbound,
        ],
        inboundId
      )
    ).toEqual({ message: null, missingInbound: false });
  });

  it('signals when the inbound row is outside the recent history window', () => {
    expect(
      unansweredCustomerTurn(
        [
          {
            id: 'bot-1',
            sender_type: 'agent',
            content_text: 'Previous reply',
          },
        ],
        inboundId
      )
    ).toEqual({ message: null, missingInbound: true });
  });
});

describe('outboundCreatedAtAfter', () => {
  it('places the outbound row one second after the customer turn', () => {
    expect(outboundCreatedAtAfter('2026-08-27T10:00:00.000Z')).toBe(
      '2026-08-27T10:00:01.000Z'
    );
  });

  it('returns undefined for missing or invalid timestamps', () => {
    expect(outboundCreatedAtAfter(undefined)).toBeUndefined();
    expect(outboundCreatedAtAfter('not-a-date')).toBeUndefined();
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
    expect(buildContactPhoneVariants('')).toEqual([]);
    expect(buildContactPhoneVariants('ab')).toEqual([]);
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
