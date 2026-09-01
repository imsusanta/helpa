const TAKEOVER_CONVERSATION_ID = '00000000-0000-4000-8000-000000000202';
const DEMO_SEED_MARKER = 'helpa-product-demo-v1';

export const PATIENT_JOURNEY_STEPS = [
  'whatsapp_inbound',
  'ai_intent_and_availability',
  'slot_selected',
  'appointment_confirmed',
  'confirmation_message',
  'reminder',
  'staff_inbox_view',
  'staff_takeover',
  'conversation_history',
] as const;

export type PatientJourneyStep = (typeof PATIENT_JOURNEY_STEPS)[number];

export type JourneyCoverage = 'seeded' | 'ui_only' | 'human_staging';

export interface PatientJourneyCheck {
  step: PatientJourneyStep;
  coverage: JourneyCoverage;
  evidence: string;
  fictionalOnly: true;
}

export interface DemoJourneyRows {
  messages: Array<{
    direction?: string | number;
    sender_type?: string | number;
    content_text?: string | number | null;
  }>;
  conversations: Array<{
    id: string;
    ai_chat_enabled?: boolean;
  }>;
  appointments: Array<{
    booking_id?: string | null;
  }>;
}

export function inspectDemoPatientJourney(
  rows: DemoJourneyRows,
  environment: string
): PatientJourneyCheck[] {
  const inbound = rows.messages.filter(
    (message) => message.direction === 'inbound'
  );
  const aiReplies = rows.messages.filter(
    (message) => message.sender_type === 'bot'
  );
  const staffReplies = rows.messages.filter(
    (message) => message.sender_type === 'agent'
  );
  const takeoverConversation = rows.conversations.find(
    (conversation) => conversation.ai_chat_enabled === false
  );
  const appointment = rows.appointments[0];

  return [
    {
      step: 'whatsapp_inbound',
      coverage: inbound.length > 0 ? 'seeded' : 'human_staging',
      evidence: String(inbound[0]?.content_text || 'No inbound fixture'),
      fictionalOnly: true,
    },
    {
      step: 'ai_intent_and_availability',
      coverage: aiReplies.some((message) =>
        String(message.content_text).includes('available')
      )
        ? 'seeded'
        : 'human_staging',
      evidence: String(
        aiReplies.find((message) =>
          String(message.content_text).includes('available')
        )?.content_text || 'No availability reply'
      ),
      fictionalOnly: true,
    },
    {
      step: 'slot_selected',
      coverage: inbound.some((message) =>
        String(message.content_text).includes('10:30')
      )
        ? 'seeded'
        : 'human_staging',
      evidence: 'Patient fixture selects 10:30 AM',
      fictionalOnly: true,
    },
    {
      step: 'appointment_confirmed',
      coverage:
        appointment?.booking_id === 'HLP-DEMO-8921'
          ? 'seeded'
          : 'human_staging',
      evidence: String(appointment?.booking_id || 'missing booking'),
      fictionalOnly: true,
    },
    {
      step: 'confirmation_message',
      coverage: 'ui_only',
      evidence:
        'Confirmation is shown on the appointments page; no extra WhatsApp confirmation row is seeded.',
      fictionalOnly: true,
    },
    {
      step: 'reminder',
      coverage: 'ui_only',
      evidence:
        'Reminder capture uses the automations/reminder settings UI. No live reminder is sent.',
      fictionalOnly: true,
    },
    {
      step: 'staff_inbox_view',
      coverage: rows.conversations.length >= 2 ? 'seeded' : 'human_staging',
      evidence: `conversations=${rows.conversations.length}`,
      fictionalOnly: true,
    },
    {
      step: 'staff_takeover',
      coverage:
        takeoverConversation?.id === TAKEOVER_CONVERSATION_ID &&
        staffReplies.length > 0
          ? 'seeded'
          : 'human_staging',
      evidence: 'Priya Patel conversation has AI disabled and a staff reply',
      fictionalOnly: true,
    },
    {
      step: 'conversation_history',
      coverage: rows.messages.length >= 9 ? 'seeded' : 'human_staging',
      evidence: `messages=${rows.messages.length} marker=${DEMO_SEED_MARKER} env=${environment}`,
      fictionalOnly: true,
    },
  ];
}
