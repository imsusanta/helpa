export const DEMO_SEED_MARKER = 'helpa-product-demo-v1';

export const DEMO_IDS = {
  contacts: [
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000103',
  ],
  conversations: [
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000202',
    '00000000-0000-4000-8000-000000000203',
  ],
  messages: [
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000303',
    '00000000-0000-4000-8000-000000000304',
    '00000000-0000-4000-8000-000000000305',
    '00000000-0000-4000-8000-000000000306',
    '00000000-0000-4000-8000-000000000307',
    '00000000-0000-4000-8000-000000000308',
    '00000000-0000-4000-8000-000000000309',
  ],
  doctors: [
    '00000000-0000-4000-8000-000000000401',
    '00000000-0000-4000-8000-000000000402',
  ],
  appointments: ['00000000-0000-4000-8000-000000000501'],
} as const;

export interface DemoConfiguration {
  accountId: string;
  userId: string;
  supabaseUrl: string;
  serviceRoleKey: string;
  referenceDate: Date;
  environment: 'local' | 'staging';
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the demo harness`);
  return value;
}

function parseOptionalUrl(value: string | undefined): URL | null {
  if (!value?.trim()) return null;
  try {
    return new URL(value);
  } catch {
    throw new Error(`Invalid demo URL: ${value}`);
  }
}

export function assertSafeDemoEnvironment(
  env: NodeJS.ProcessEnv = process.env
): DemoConfiguration {
  if (env.DEMO_MODE !== 'true') {
    throw new Error('Refusing to continue unless DEMO_MODE=true');
  }

  const environment = required(env, 'DEMO_ENVIRONMENT');
  if (environment !== 'local' && environment !== 'staging') {
    throw new Error('DEMO_ENVIRONMENT must be local or staging');
  }

  const accountId = required(env, 'DEMO_ACCOUNT_ID');
  const userId = required(env, 'DEMO_USER_ID');
  if (!UUID_PATTERN.test(accountId) || !UUID_PATTERN.test(userId)) {
    throw new Error('DEMO_ACCOUNT_ID and DEMO_USER_ID must be valid UUIDs');
  }
  if (env.DEMO_CONFIRM_ACCOUNT_ID !== accountId) {
    throw new Error(
      'DEMO_CONFIRM_ACCOUNT_ID must exactly match DEMO_ACCOUNT_ID'
    );
  }

  const supabaseUrl = required(env, 'NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = required(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const databaseUrl = parseOptionalUrl(supabaseUrl);
  if (!databaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');

  const isLocal = ['localhost', '127.0.0.1'].includes(databaseUrl.hostname);
  if (environment === 'local' && !isLocal) {
    throw new Error('Local demo mode can only target localhost Supabase');
  }
  if (environment === 'staging' && isLocal) {
    throw new Error('Staging demo mode cannot target localhost Supabase');
  }

  const applicationUrl = parseOptionalUrl(
    env.PLAYWRIGHT_TEST_BASE_URL ?? env.NEXT_PUBLIC_SITE_URL
  );
  if (
    applicationUrl &&
    ['helpa.studio', 'www.helpa.studio'].includes(applicationUrl.hostname)
  ) {
    throw new Error('The demo harness cannot target the production application');
  }

  const referenceDateValue = env.DEMO_REFERENCE_DATE?.trim();
  if (
    referenceDateValue &&
    !/^\d{4}-\d{2}-\d{2}$/.test(referenceDateValue)
  ) {
    throw new Error('DEMO_REFERENCE_DATE must use YYYY-MM-DD');
  }
  const referenceDate = referenceDateValue
    ? new Date(`${referenceDateValue}T00:00:00.000Z`)
    : new Date();
  if (Number.isNaN(referenceDate.valueOf())) {
    throw new Error('DEMO_REFERENCE_DATE is invalid');
  }

  return {
    accountId,
    userId,
    supabaseUrl,
    serviceRoleKey,
    referenceDate,
    environment,
  };
}

function isoAt(date: Date, hour: number, minute: number): string {
  const value = new Date(date);
  value.setUTCHours(hour, minute, 0, 0);
  return value.toISOString();
}

function addDays(date: Date, days: number): Date {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildDemoRows(input: {
  accountId: string;
  userId: string;
  referenceDate: Date;
}) {
  const { accountId, userId, referenceDate } = input;
  const appointmentDate = addDays(referenceDate, 1);
  const syntheticMetadata = {
    demo_seed: DEMO_SEED_MARKER,
    is_synthetic: true,
  };

  const contacts = [
    {
      id: DEMO_IDS.contacts[0],
      account_id: accountId,
      user_id: userId,
      name: 'Aarav Sharma',
      phone: '+919000000001',
      email: 'aarav.demo@example.invalid',
      consent_status: 'opted_in',
      metadata: { ...syntheticMetadata, scenario: 'appointment_enquiry' },
    },
    {
      id: DEMO_IDS.contacts[1],
      account_id: accountId,
      user_id: userId,
      name: 'Priya Patel',
      phone: '+919000000002',
      email: 'priya.demo@example.invalid',
      consent_status: 'opted_in',
      metadata: { ...syntheticMetadata, scenario: 'staff_takeover' },
    },
    {
      id: DEMO_IDS.contacts[2],
      account_id: accountId,
      user_id: userId,
      name: 'Rohan Mehta',
      phone: '+919000000003',
      email: 'rohan.demo@example.invalid',
      consent_status: 'opted_in',
      metadata: { ...syntheticMetadata, scenario: 'lab_report' },
    },
  ];

  const doctors = [
    {
      id: DEMO_IDS.doctors[0],
      account_id: accountId,
      name: 'Dr. Ananya Rao',
      department: 'General Medicine',
      specialization: 'General Medicine',
      consultation_fee: 700,
      working_hours: { start: '09:00', end: '13:00' },
      available_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      available_time_slots: ['09:30', '10:30', '11:30', '12:30'],
      is_available: true,
      status: 'active',
    },
    {
      id: DEMO_IDS.doctors[1],
      account_id: accountId,
      name: 'Dr. Rajesh Kumar',
      department: 'Orthopedics',
      specialization: 'Orthopedics',
      consultation_fee: 900,
      working_hours: { start: '14:00', end: '18:00' },
      available_days: ['Monday', 'Wednesday', 'Friday'],
      available_time_slots: ['14:30', '15:30', '16:30', '17:30'],
      is_available: true,
      status: 'active',
    },
  ];

  const conversations = [
    {
      id: DEMO_IDS.conversations[0],
      account_id: accountId,
      user_id: userId,
      contact_id: DEMO_IDS.contacts[0],
      channel: 'whatsapp',
      status: 'open',
      unread_count: 1,
      ai_chat_enabled: true,
      last_message_text: '10:30 AM works for me. Please confirm.',
      last_message_at: isoAt(referenceDate, 9, 4),
      updated_at: isoAt(referenceDate, 9, 4),
    },
    {
      id: DEMO_IDS.conversations[1],
      account_id: accountId,
      user_id: userId,
      contact_id: DEMO_IDS.contacts[1],
      channel: 'whatsapp',
      status: 'open',
      unread_count: 0,
      ai_chat_enabled: false,
      last_message_text: 'A receptionist has joined this conversation.',
      last_message_at: isoAt(referenceDate, 9, 15),
      updated_at: isoAt(referenceDate, 9, 15),
    },
    {
      id: DEMO_IDS.conversations[2],
      account_id: accountId,
      user_id: userId,
      contact_id: DEMO_IDS.contacts[2],
      channel: 'whatsapp',
      status: 'pending',
      unread_count: 1,
      ai_chat_enabled: true,
      last_message_text: 'Is my blood test report ready?',
      last_message_at: isoAt(referenceDate, 9, 25),
      updated_at: isoAt(referenceDate, 9, 25),
    },
  ];

  const messages = [
    [0, 0, 'customer', 'inbound', 'Hi, I need an appointment with Dr. Rao for tomorrow morning.', 9, 0],
    [1, 0, 'bot', 'outbound', 'Dr. Ananya Rao is available at 9:30, 10:30, 11:30, or 12:30.', 9, 1],
    [2, 0, 'customer', 'inbound', '10:30 AM works for me. Please confirm.', 9, 4],
    [3, 1, 'customer', 'inbound', 'I need help changing the phone number on my file.', 9, 10],
    [4, 1, 'bot', 'outbound', 'I will connect you with the clinic reception team.', 9, 11],
    [5, 1, 'agent', 'outbound', 'Hello Priya, I can help. A receptionist has joined this conversation.', 9, 15],
    [6, 2, 'customer', 'inbound', 'Is my blood test report ready?', 9, 20],
    [7, 2, 'bot', 'outbound', 'I am checking the report status with CityCare Clinic.', 9, 21],
    [8, 2, 'agent', 'outbound', 'Your report is ready. The clinic will share the secure link shortly.', 9, 25],
  ].map(([messageIndex, conversationIndex, senderType, direction, text, hour, minute]) => ({
    id: DEMO_IDS.messages[messageIndex as number],
    account_id: accountId,
    conversation_id: DEMO_IDS.conversations[conversationIndex as number],
    sender_type: senderType,
    direction,
    content_type: 'text',
    content_text: text,
    status: 'read',
    message_id: `demo-message-${Number(messageIndex) + 1}`,
    provider_message_id: `demo-message-${Number(messageIndex) + 1}`,
    created_at: isoAt(referenceDate, hour as number, minute as number),
    updated_at: isoAt(referenceDate, hour as number, minute as number),
  }));

  const appointments = [
    {
      id: DEMO_IDS.appointments[0],
      account_id: accountId,
      patient_id: DEMO_IDS.contacts[0],
      contact_id: DEMO_IDS.contacts[0],
      doctor_id: DEMO_IDS.doctors[0],
      appointment_date: dateOnly(appointmentDate),
      appointment_time: '10:30',
      starts_at: `${dateOnly(appointmentDate)}T10:30:00+05:30`,
      department: 'General Medicine',
      status: 'Confirmed',
      booking_id: 'HLP-DEMO-8921',
      token_number: 'A-12',
      queue_position: 3,
      patient_name: 'Aarav Sharma',
      patient_phone: '+919000000001',
      notes: `[${DEMO_SEED_MARKER}] Synthetic appointment for product demonstration only.`,
    },
  ];

  return { contacts, doctors, conversations, messages, appointments };
}
