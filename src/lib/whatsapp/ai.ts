/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  isEmergencyQuery,
  isDiagnosticRequest,
  containsPromptInjection,
  sanitizeAiInput,
} from '@/lib/ai/safety';
import { logger } from '@/lib/observability/logger';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import {
  engineSendText,
  engineSendDocument,
  engineSendButtons,
} from '@/lib/automations/meta-send';
import { checkPlanLimits, incrementUsage } from '@/lib/saas/subscription';
import { getIndustryModule, resolveSystemPrompt } from '@/modules/registry';
import { parseAiResponse } from '@/lib/whatsapp/ai-response';

import {
  executeAiCompletionWithFallback,
  resolveAccountAiConfig,
} from '@/core/ai/resolver';

interface TriggerAiResponseArgs {
  accountId: string;
  userId: string;
  conversationId: string;
  contactId: string;
}

export async function triggerAiResponse(
  args: TriggerAiResponseArgs
): Promise<void> {
  const { accountId, userId, conversationId, contactId } = args;

  // Check SaaS subscription limits before running any AI requests
  try {
    await checkPlanLimits(accountId, 'max_ai_requests');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[AI Assistant] Limit check failed, skipping response:', msg);
    return;
  }

  const db = appwriteAdmin();

  // ═══════ PHASE 1: Parallel fetch all independent data in one shot ═══════
  const [contactRes, accRes, messagesRes, kbRes] = await Promise.all([
    db.from('contacts').select('*').eq('id', contactId).maybeSingle(),
    db
      .from('accounts')
      .select(
        'ai_provider, ai_fallback_provider, openrouter_api_key, openrouter_model, orcarouter_api_key, orcarouter_model, ai_system_prompt, welcome_message, industry, name'
      )
      .eq('id', accountId)
      .single(),
    db
      .from('messages')
      .select('sender_type, content_type, content_text, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(15),
    db
      .from('knowledge_base')
      .select('category, question_title, answer_content')
      .eq('account_id', accountId),
  ]);

  interface AccountSettings {
    ai_provider?: string | null;
    ai_fallback_provider?: string | null;
    openrouter_api_key?: string | null;
    openrouter_model?: string | null;
    orcarouter_api_key?: string | null;
    orcarouter_model?: string | null;
    ai_system_prompt?: string | null;
    welcome_message?: string | null;
    industry?: string | null;
    name?: string | null;
  }

  const contact = contactRes.data;
  let account: AccountSettings | null = null;
  const accError = accRes.error;
  let accData = accRes.data as AccountSettings | null;

  if (
    accError &&
    (accError.message?.includes('welcome_message') ||
      accError.code === '42703' ||
      accError.message?.includes('ai_provider'))
  ) {
    // Fallback if columns are not yet in DB schema cache
    const fallback = await db
      .from('accounts')
      .select(
        'openrouter_api_key, openrouter_model, ai_system_prompt, industry, name'
      )
      .eq('id', accountId)
      .single();
    accData = fallback.data as AccountSettings | null;
  }

  account = accData;

  const aiResolved = await resolveAccountAiConfig(accountId, {
    feature: 'AI_REPLY',
  });
  const hasValidKey = Boolean(
    aiResolved.primary.apiKey || aiResolved.fallback?.apiKey
  );

  if (!hasValidKey) {
    console.warn(
      '[AI Assistant] Neither OpenRouter nor OrcaRouter API credentials configured in Super Admin settings, environment, or account for account:',
      accountId
    );
    return;
  }

  // 3. Use pre-fetched messages
  const messages = messagesRes.data;
  const msgError = messagesRes.error;

  if (msgError || !messages || messages.length === 0) {
    console.error(
      '[AI Assistant] Failed to fetch message history or no messages found:',
      msgError
    );
    return;
  }

  // Guard: Only respond if the latest message is from the customer
  const latestMessage = messages[0];
  if (latestMessage.sender_type !== 'customer') {
    console.warn(
      '[AI Assistant] Latest message is not from customer. Skipping AI response. Latest sender:',
      latestMessage.sender_type
    );
    return;
  }

  const rawUserText = latestMessage.content_text || '';

  // 🛡️ AI SAFETY & HEALTHCARE GUARDRAILS (Production Module: src/lib/ai/safety.ts)
  if (isEmergencyQuery(rawUserText)) {
    logger.warn('Emergency intent detected', {
      component: 'ai-safety',
      accountId,
      correlationId: conversationId,
      classification: 'emergency',
    });
    await engineSendText({
      accountId,
      userId,
      conversationId,
      contactId,
      text: '⚠️ *EMERGENCY ALERT*: If you or the patient are experiencing a life-threatening medical emergency (e.g., chest pain, severe bleeding, difficulty breathing), please call your local emergency service or proceed immediately to the nearest hospital emergency room.\n\nA human receptionist may review this conversation. For immediate help, call your local emergency service or go to the nearest emergency department.',
    });
    await db.from('audit_logs').insert({
      account_id: accountId,
      actor_id: userId,
      action: 'emergency.escalation_created',
      resource_type: 'conversations',
      resource_id: conversationId,
      metadata: {
        severity: 'high',
        safety_classification: 'emergency',
        created_at: new Date().toISOString(),
      },
    });
    await db
      .from('conversations')
      .update({ is_ai_enabled: false })
      .eq('id', conversationId);
    return;
  }

  if (isDiagnosticRequest(rawUserText)) {
    console.info(
      `[AI Safety] Non-diagnostic boundary triggered for contact ${contactId}:`,
      rawUserText
    );
    await engineSendText({
      accountId,
      userId,
      conversationId,
      contactId,
      text: '🩺 *Medical Notice*: As an automated clinic receptionist, I cannot provide medical diagnoses, evaluate clinical symptoms, or prescribe medications.\n\nPlease consult directly with one of our qualified doctors. Would you like me to show available OPD consultation slots for booking?',
    });
    return;
  }

  if (containsPromptInjection(rawUserText)) {
    console.warn(
      `[AI Safety] Prompt injection attempt sanitized for contact ${contactId}`
    );
    latestMessage.content_text = sanitizeAiInput(rawUserText);
  }

  // Reverse messages to restore chronological order (ascending) for the LLM
  messages.reverse();

  // ═══════ PHASE 2: Sibling contacts & Patient IDs (depends on contact phone) ═══════
  const rawPhone = contact?.phone || '';
  const cleanDigits = rawPhone.replace(/\D/g, '');
  const phoneVariants = Array.from(
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

  let siblingContacts: { id: string }[] | null = null;
  if (phoneVariants.length > 0) {
    try {
      const res = await db
        .from('contacts')
        .select('id')
        .in('phone', phoneVariants);
      siblingContacts = res.data as { id: string }[] | null;
    } catch {
      // ignore
    }
  }

  const contactIds = Array.from(
    new Set(
      [
        contactId,
        ...(siblingContacts || []).map((c: { id: string }) => c.id),
      ].filter(Boolean)
    )
  );

  let registeredPatientIds: string[] = [];
  try {
    const { data: patsData } = await db
      .from('patients')
      .select('id, patient_seq_id')
      .in('id', contactIds);
    if (patsData && patsData.length > 0) {
      registeredPatientIds = patsData.map((p: { id: string }) => p.id);
    }
  } catch {
    // ignore
  }

  const allPatientAndContactIds = Array.from(
    new Set([...contactIds, ...registeredPatientIds])
  );

  // 3.5 Use pre-fetched Knowledge Base
  const kbEntries = kbRes.data;
  let kbContext = '';
  if (kbEntries && kbEntries.length > 0) {
    kbContext =
      'Here is the verified knowledge base and pricing information for our company:\n\n';
    kbEntries.forEach(
      (entry: {
        category: string;
        question_title: string;
        answer_content: string;
      }) => {
        kbContext += `[${entry.category.toUpperCase()}] ${entry.question_title}: ${entry.answer_content}\n`;
      }
    );
  }

  const industryModuleForContext = getIndustryModule(account?.industry);
  const isHospitalEnabled =
    industryModuleForContext.id === 'hospital_clinic' ||
    !account?.industry ||
    account?.industry === 'hospital' ||
    account?.industry === 'clinic' ||
    account?.industry === 'healthcare' ||
    account?.industry === 'general';
  const isCoachingEnabled = industryModuleForContext.id === 'coaching';
  const isSoloTeacherEnabled = industryModuleForContext.id === 'solo_teacher';
  let hospitalContext = '';
  let coachingContext = '';
  interface LabReportRow {
    id: string;
    test_name: string;
    status: string;
    report_pdf_url?: string | null;
    department?: string | null;
    expected_delivery_date?: string | null;
    notes?: string | null;
    internal_notes?: string | null;
  }
  let labReports: LabReportRow[] | null = null;

  // Build Contact profile context dynamically using active industry entity config
  const contactConfigForContext =
    industryModuleForContext.entityConfigs?.contacts;
  const entityLabelForContext = contactConfigForContext?.label || 'Contact';

  if (isCoachingEnabled || isSoloTeacherEnabled) {
    const { data: coachingStudents } = await db
      .from('contacts')
      .select('name, phone, metadata')
      .in('id', contactIds);

    if (coachingStudents && coachingStudents.length > 0) {
      coachingContext += `Registered ${entityLabelForContext}s under this WhatsApp/Phone Number:\n`;
      coachingStudents.forEach(
        (s: { metadata?: Record<string, string> | null; name: string }) => {
          const meta =
            s.metadata && typeof s.metadata === 'object'
              ? (s.metadata as Record<string, string>)
              : {};
          coachingContext += `- Name: ${s.name}, Student ID: ${meta.student_id || 'N/A'}, Exam Preparation (Target Exam): ${meta.parent_name || 'Not set'}\n`;
        }
      );
      coachingContext += '\n';
    }
  }

  if (isHospitalEnabled) {
    const [
      { data: doctors },
      { data: branches },
      { data: appts },
      { data: labReportsData },
      { data: registeredPatients },
      { data: lastCampaignRec },
    ] = await Promise.all([
      db
        .from('hospital_doctors')
        .select(
          'name, department, specialization, consultation_fee, available_days, working_hours'
        )
        .eq('account_id', accountId)
        .eq('status', 'active'),
      db
        .from('hospital_branches')
        .select('name, address, phone')
        .eq('account_id', accountId),
      db
        .from('appointments')
        .select('*, doctor:hospital_doctors(name), patient:contacts(name)')
        .in('patient_id', allPatientAndContactIds)
        .order('appointment_date', { ascending: false })
        .limit(5),
      db
        .from('hospital_lab_reports')
        .select(
          'id, test_name, status, expected_delivery_date, report_pdf_url, notes, department, doctor:hospital_doctors(name), patient:contacts(name)'
        )
        .in('patient_id', allPatientAndContactIds)
        .order('created_at', { ascending: false })
        .limit(20),
      db
        .from('patients')
        .select(
          'patient_seq_id, gender, date_of_birth, blood_group, emergency_contact, contact:contacts(name, phone)'
        )
        .in('id', allPatientAndContactIds),
      db
        .from('broadcast_recipients')
        .select('id, broadcast_id, broadcasts(*)')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    labReports = labReportsData as LabReportRow[] | null;

    if (registeredPatients && registeredPatients.length > 0) {
      hospitalContext +=
        'Registered Patients under this WhatsApp/Phone Number:\n';
      registeredPatients.forEach(
        (p: {
          contact?: unknown;
          patient_seq_id: string;
          gender?: string;
          date_of_birth?: string;
          blood_group?: string;
          emergency_contact?: string;
        }) => {
          const contactData = p.contact as
            | { name?: string; phone?: string }
            | Array<{ name?: string; phone?: string }>
            | null;
          const name =
            (Array.isArray(contactData)
              ? contactData[0]?.name
              : contactData?.name) || 'Unknown';
          const phone =
            (Array.isArray(contactData)
              ? contactData[0]?.phone
              : contactData?.phone) || 'N/A';
          hospitalContext += `- Name: ${name}, Patient ID: ${p.patient_seq_id}, Gender: ${p.gender || 'N/A'}, DOB: ${p.date_of_birth || 'N/A'}, Blood Group: ${p.blood_group || 'N/A'}, Phone: ${phone}, Emergency Contact: ${p.emergency_contact || 'N/A'}\n`;
        }
      );
      hospitalContext += '\n';
    }

    if (lastCampaignRec && lastCampaignRec.broadcasts) {
      const camp = lastCampaignRec.broadcasts as unknown as {
        id: string;
        name: string;
        category?: string;
        message_body?: string;
        cta_type?: string;
      };
      hospitalContext += `Last Sent Campaign to Patient (within last 7 days):\n`;
      hospitalContext += `- Campaign ID: ${camp.id}\n`;
      hospitalContext += `- Name: ${camp.name}\n`;
      hospitalContext += `- Category: ${camp.category || 'General Announcement'}\n`;
      hospitalContext += `- Message Content: "${camp.message_body || ''}"\n`;
      hospitalContext += `- CTA Configured: ${camp.cta_type || 'none'}\n\n`;
    }

    if (doctors && doctors.length > 0) {
      hospitalContext += 'Available Doctors & Clinic Schedules:\n';
      doctors.forEach(
        (d: {
          available_days?: string[];
          working_hours?: unknown;
          name: string;
          department: string;
          specialization?: string;
          consultation_fee?: number;
        }) => {
          const days = Array.isArray(d.available_days)
            ? d.available_days.join(', ')
            : '';
          const workingHours = d.working_hours as
            { start?: string; end?: string } | null | undefined;
          const start = workingHours?.start || '09:00';
          const end = workingHours?.end || '17:00';
          hospitalContext += `- Dr. ${d.name.replace(/^Dr\.\s+/i, '')} (${d.department} - ${d.specialization || 'General'}): Fee: ₹${d.consultation_fee || '0'}, Working Days: ${days}, Working Hours: ${start} to ${end}\n`;
        }
      );
    }
    if (branches && branches.length > 0) {
      hospitalContext += '\nClinic Branches Locations:\n';
      branches.forEach(
        (b: { name: string; address?: string; phone?: string }) => {
          hospitalContext += `- ${b.name}: ${b.address || ''} (Phone: ${b.phone || ''})\n`;
        }
      );
    }
    if (appts && appts.length > 0) {
      hospitalContext += "\nPatient's Recent/Upcoming Appointments:\n";
      appts.forEach((a: Record<string, any>) => {
        const patientData = a.patient as
          { name?: string } | { name?: string }[] | null;
        const pName =
          (Array.isArray(patientData)
            ? patientData[0]?.name
            : patientData?.name) || 'Unknown';
        const docName =
          (a.doctor as { name?: string } | null)?.name || 'Unassigned';
        hospitalContext += `- Patient: ${pName}, Date: ${a.appointment_date}, Time: ${a.appointment_time}, Doctor: ${docName}, Status: ${a.status}, Token: #${a.token_number || 'N/A'}, Queue Pos: ${a.queue_position || 'N/A'}\n`;
      });
    }
    if (labReports && labReports.length > 0) {
      hospitalContext += "\nPatient's Lab/Diagnostic Reports:\n";
      labReports.forEach((rItem) => {
        const r = rItem as unknown as Record<string, unknown>;
        const docData = r.doctor as
          { name?: string } | { name?: string }[] | null;
        const docName =
          (Array.isArray(docData) ? docData[0]?.name : docData?.name) ||
          'Doctor';
        const patientData = r.patient as
          { name?: string } | { name?: string }[] | null;
        const pName =
          (Array.isArray(patientData)
            ? patientData[0]?.name
            : patientData?.name) || 'Unknown';
        hospitalContext += `- Patient: ${pName}, Report Name: ${r.test_name}, Department: ${r.department || 'General'}, Referred By: Dr. ${docName.replace(/^Dr\.\s+/i, '')}, Status: ${r.status}, Expected Delivery: ${r.expected_delivery_date || 'N/A'}, Notes: ${r.notes || 'None'}, PDF Available: ${r.report_pdf_url ? 'Yes' : 'No'}\n`;
      });
    }
  }

  // 4. Formulate prompt messages
  const basePrompt = resolveSystemPrompt(
    account?.industry,
    account?.ai_system_prompt
  );

  const businessName = account?.name || 'our Business';

  // Inject system-level rules override to ensure database values override conversation history for patient profiles and actions
  const overrideRules = `

[CRITICAL INSTRUCTION - BUSINESS & SYSTEM OVERRIDE]:
1. BUSINESS IDENTITY: You are the official AI assistant representing "${businessName}". When welcoming a new patient/customer or starting a conversation, you MUST explicitly mention "${businessName}" by name (e.g. "Welcome to *${businessName}*!").
2. REAL-TIME DATABASE DATA ACCURACY: The "Registered Patients", "Available Doctors & Clinic Schedules", "Appointments", and "Lab Reports" sections in the Hospital Context contain the absolute, real-time database records.
3. DOCTOR & CLINIC DETAILS: When asked about doctors, departments, consultation fees, working hours, or available slots, ALWAYS reply using the exact database details from the "Available Doctors & Clinic Schedules" list.
4. PATIENT DETAILS & LOOKUP: When responding to a patient, prioritize their registered database details (Patient ID PAT-XXXXXX, Full Name, Blood Group, Gender, Appointments).
5. If a patient wants to correct/edit their profile details, extract the corrections into "hospital_profile_update" with the fields to update.
6. Never diagnose, recommend treatments/medicines, or interpret report values.
7. SHARED WHATSAPP NUMBER DISAMBIGUATION: Multiple family members (e.g. Father, Mother, Child) may share the exact same WhatsApp number. Each patient has a unique Patient ID (e.g. PAT-000021, PAT-000022). If multiple registered patients exist under this phone number and you cannot confidently identify which patient the user is asking about or booking for, ask: "I found multiple patient profiles linked to this WhatsApp number. Could you please tell me the patient's name?" Once the user specifies the name, switch to that patient profile and continue.`;

  let systemPromptContent = basePrompt + overrideRules;

  if (account?.welcome_message && account.welcome_message.trim().length > 0) {
    systemPromptContent += `\n\n[MANDATORY CUSTOM WELCOME GREETING TEMPLATE]:\nWhen greeting a new patient/customer or starting a new conversation, you MUST incorporate this custom welcome message:\n"${account.welcome_message.trim()}"\nFollowed by answering their query or guiding them through the registration/booking process using real-time database records.\n`;
  }

  if (kbContext) {
    systemPromptContent += `\n\n${kbContext}`;
  }

  if (isHospitalEnabled) {
    systemPromptContent += `\n\n=== HOSPITAL & CLINIC SYSTEM CONTEXT ===\n${hospitalContext}

You are acting as the AI medical receptionist for the hospital/clinic.
Your primary role is to answer patient inquiries 24/7, book appointments, check doctor availability, consultation fees, department information, hospital timings, report status, insurance FAQs, token number inquiries, and send appointment confirmations.

AI RULES & MEDICAL SAFETY PROTOCOLS:
1. **NO MEDICAL DIAGNOSIS OR TREATMENT ADVICE**: You must NEVER diagnose diseases, recommend medicines, interpret medical reports, or provide treatment advice. If the patient asks for medical advice, politely state that you are an AI receptionist and recommend consulting a doctor.
2. **NO EMERGENCY HANDLING**: You must NEVER handle medical emergencies. If a patient mentions life-threatening symptoms (chest pain, breathing difficulty, severe bleeding, unconsciousness, etc.), set "emergency_detected" to true in your JSON output. Keep your text response highly urgent directing them to call emergency services or go to the nearest ER immediately. Do not diagnose.
3. **Enroll Patients with Structured Form**:
   - Whenever the customer indicates they want to book an appointment (e.g. clicks the "📅 Book Now" button or asks to consult a doctor), you MUST reply with the following empty structured form for them to fill out:
     📋 *PATIENT REGISTRATION FORM*
     Please reply with the following details:
     - *Full Name:* [Enter Name]
     - *Mobile Number:* [Enter Mobile Number]
     - *Gender:* [Male/Female/Other]
     - *Date of Birth:* [YYYY-MM-DD]
     - *Department:* [e.g. Cardiology, Orthopedics, General Medicine]
     - *Blood Group:* [e.g. O+, A-]
     - *Emergency Contact:* [Name & Phone]
     
     (You can also specify your preferred Doctor name, and preferred Date & Time in your reply)
   - Do NOT confirm the appointment booking until you have collected their Name, Mobile Number, Gender, DOB, and Department.
   - **DEPARTMENT-FIRST DOCTOR SELECTION**: When a patient provides a department (e.g. "Cardiology", "Orthopedics") but has NOT specified a doctor name, you MUST look up the "Available Doctors & Clinic Schedules" list from the Hospital Context above, filter doctors matching that department, and present them as a numbered list for the patient to choose from. Example reply:
     "Here are the available doctors in *Cardiology*:
     1️⃣ Dr. Susanta Lohar — Fee: ₹500 — Mon, Wed, Fri (10:00–17:00)
     2️⃣ Dr. Priya Sharma — Fee: ₹700 — Tue, Thu (09:00–14:00)
     Please reply with the doctor number or name to proceed with booking."
   - Once the patient picks a doctor from the list, THEN set "hospital_booking" action to "book" with the selected doctor_name.
4. **Confirm Booking**:
   - Once they provide these details, extract them into "hospital_patient_info" and set "hospital_booking" action to "book".
   - Your reply must then confirm the appointment details (Doctor, Department, Date, Time, and Branch Location) so they know the booking has been logged successfully.
5. **REPORT STATUS RESPONSES**: When a patient asks about their report status, respond according to these templates:
   - If status is "pending": "Your report request has been received. Current Status: *Pending*. Expected Delivery: {{ExpectedDate}}. We will notify you as soon as it becomes available." (Substitute actual test name and expected date).
   - If status is "processing": "Your report is currently being processed. Expected Completion: {{ExpectedDate}}. Thank you for your patience." (Substitute actual values).
   - If status is "ready": "Great news! Your {{ReportName}} report is now *Ready*! Please visit the hospital reception to collect your report." (If PDF is available, tell them it is being sent).
   - If status is "delivered": "Your report has already been delivered. If you need another copy, please contact the hospital reception."
6. **SMART REPORT LOOKUP**: When a patient simply says "report" or similar:
   - If they have exactly 1 active report (pending/processing/ready), respond with that report's status directly.
   - If they have multiple reports, list them and ask which one they want to check.
   - If they have 0 reports, say "I don't have any active reports on file for you."
7. **REPORT SAFETY & NON-DIAGNOSIS**: NEVER share internal staff notes. NEVER interpret report values, explain medical findings, recommend medicines, or suggest treatments. If a patient asks: "My report says my sugar is high. What should I do?" or similar medical questions, you MUST politely respond: "I cannot interpret medical reports or provide medical advice. Please consult your doctor. I can help you book an appointment if you would like."
8. **CAMPAIGN RESPONSE HANDLING**: If the patient received a campaign recently (listed under Last Sent Campaign to Patient), acknowledge it when appropriate. If they reply "BOOK" or indicate interest in scheduling an appointment or check-up relative to that campaign, immediately display the Patient Registration Form to proceed with booking.`;
  }

  if (isCoachingEnabled) {
    systemPromptContent += `\n\n=== COACHING & ACADEMY SYSTEM CONTEXT ===\n${coachingContext}
You are acting as the AI student counselor and assistant for the coaching academy.
Your primary role is to answer student/parent inquiries, guide them on available courses, fee structures, schedules, and capture/update their targeted competitive exam or board exam preparation details (e.g. JEE, NEET, UPSC, Board Exam).

AI RULES & STUDENT PROFILE UPDATES:
1. **EXAM PREPARATION IDENTIFICATION**: When a student mentions which exam they are preparing for, or replies to a query about their preparation target, you MUST extract the exam name (e.g. "NEET") and their Student ID (if present in the context, e.g. STU-10001) into the "coaching_student_update" object in your JSON output.
2. **ACCOMMODATIVE INQUIRIES**: Keep the conversation friendly and helpful. If they have not specified their targeted exam yet, politely ask: "Which exam are you currently preparing for? (e.g. JEE, NEET, UPSC, etc.)" so we can tailor our academy details for them.
`;
  }

  // Always enforce that the AI responds in the exact language of the customer's conversation
  systemPromptContent += `\n\n═══════════════════════════════════════════════════════════════════════════
CRITICAL MANDATORY MULTILINGUAL RULE:
1. You MUST ALWAYS reply in the EXACT SAME LANGUAGE, SCRIPT, and DIALECT that the customer used in their latest message.
2. If the customer messages in Bengali (বাংলা or phonetic/Banglish like "ami doctor dekhte chai"), you MUST reply in natural, fluent Bengali (বাংলা or matching Banglish).
3. If the customer messages in Hindi (हिंदी or Hinglish like "mujhe appointment book karna hai"), you MUST reply in natural, fluent Hindi/Hinglish.
4. If the customer messages in English, reply in English.
5. If the customer messages in any other regional/international language (e.g. Marathi, Tamil, Telugu, Gujarati, Spanish, Arabic, Urdu, French), reply in that exact language.
6. UNDER NO CIRCUMSTANCES should you default or switch to English when the customer is speaking in another language.
═══════════════════════════════════════════════════════════════════════════`;

  if (latestMessage && latestMessage.content_text) {
    systemPromptContent += `\n\n[CUSTOMER'S LATEST MESSAGE]: "${latestMessage.content_text}"\n-> DIRECTIVE: Detect the language of this message and write your "reply" field in the EXACT SAME LANGUAGE.`;
  }

  // Enforce organized and beautiful formatting with WhatsApp markdown support
  systemPromptContent += `\n\nCRITICAL REPLY FORMATTING RULE: Write the "reply" in a highly organized, clean, and beautiful format.
  - Present lists of options, prices, services, or details in bullet points (using - or *) or numbered lists.
  - Use clear line breaks (\\n) to separate greetings, main details, lists, and the closing call-to-action.
  - Use WhatsApp markdown formatting where helpful (e.g., *bold* for key terms, headings, or pricing; _italics_ for emphasis).
  - Use relevant friendly emojis (like 👋, 😊, 🚀, 💬, ✅, etc.) naturally in the conversation to make the response feel warm, friendly, and visually engaging.
  - Never output walls of plain, unformatted text. Keep it neat, spaced, and easy to read.
  - KEEP REPLIES SHORT AND CONCISE. Maximum 3-4 short paragraphs. Do not write long essays. Speed matters.`;

  // Enforce JSON structured output format for analytics and features
  systemPromptContent += `\n\nCRITICAL OUTPUT FORMAT RULE: You must respond ONLY with a raw, valid JSON object matching the JSON schema below. Do not wrap the JSON block in markdown formatting (like \`\`\`json ... \`\`\`), do not output any other text before or after the JSON.

JSON Schema:
{
  "reply": "your text response to the customer (keep it short, friendly, and matching the language rule)",
  "intent": "sales" | "support" | "booking" | "complaint" | "other",
  "lead_score": "hot" | "warm" | "cold",
  "sentiment": "positive" | "neutral" | "negative",
  "handoff_required": true | false,
  "resolved": true | false,
  "summary": "an updated, short running summary of the conversation (under 150 characters, capturing the customer's current goal/status)",
  "faq_category": "pricing" | "delivery" | "refund" | "demo" | "general",
  "sales_signal": true | false,
  "extracted_lead_info": {
    "interested_service": "string or null",
    "budget": "string or null",
    "timeline": "string or null",
    "next_action": "string or null"
  },
  "hospital_patient_info": {
    "name": "string or null",
    "phone": "string or null",
    "gender": "Male | Female | Other | null",
    "dob": "YYYY-MM-DD string or null",
    "blood_group": "string or null",
    "emergency_contact": "string or null"
  },
  "hospital_booking": {
    "action": "book | reschedule | cancel | null",
    "patient_name": "string or null (Full name of the patient this action is for)",
    "doctor_name": "string or null",
    "department": "string or null",
    "date": "YYYY-MM-DD string or null",
    "time": "HH:MM string or null"
  },
  "hospital_report_send": {
    "send_report": true | false,
    "report_id": "string or null (ID of the report to send)",
    "test_name": "string or null (Name of the test, e.g. Blood Test, CBC)"
  },
  "hospital_profile_update": {
    "patient_id": "string or null (The Patient ID to modify, e.g. PAT-90325)",
    "name": "string or null (New or updated full name if corrected)",
    "phone": "string or null (New or updated phone number if corrected)",
    "email": "string or null (New or updated email if corrected)",
    "gender": "Male | Female | Other | null (New or updated gender if corrected)",
    "dob": "YYYY-MM-DD string or null (New or updated date of birth if corrected)",
    "blood_group": "string or null (New or updated blood group if corrected)",
    "emergency_contact": "string or null (New or updated emergency contact if corrected)",
    "address": "string or null (New or updated address if corrected)"
  },
  "coaching_student_update": {
    "student_id": "string or null (The Student ID to modify, e.g. STU-10001)",
    "target_exam": "string or null (The targeted competitive or board exam they are preparing for, e.g. JEE, NEET, UPSC)"
  },
  "emergency_detected": true | false
}

Note:
- ULTRA-FAST & CRISP REPLIES: Keep the "reply" concise, professional, and direct (1 to 3 short sentences maximum). Avoid long repetitive introductions or verbose text so the patient gets an instant response.
- Set "sales_signal" to true if you detect genuine buying intent, service inquiry, quotation request, booking intent, or any strong sales signal from the customer.
- Under "extracted_lead_info", populate only the fields mentioned by the customer. Use null for any details not mentioned or unknown.`;

  const systemPrompt = {
    role: 'system',
    content: systemPromptContent,
  };

  const apiMessages = [
    systemPrompt,
    ...messages
      .map(
        (m: {
          content_text?: string;
          content_type?: string;
          sender_type?: string;
        }) => {
          let content = m.content_text || '';
          if (!content && m.content_type) {
            content = `[${m.content_type}]`;
          }
          return {
            role: m.sender_type === 'customer' ? 'user' : 'assistant',
            content: content,
          };
        }
      )
      .filter((m: { content: string }) => m.content !== ''),
  ];

  // 5. Send request via Helpa AI Engine (Primary + Fallback Provider routing)
  let completion;
  try {
    completion = await executeAiCompletionWithFallback({
      messages: apiMessages,
      options: {
        temperature: 0.2,
        maxTokens: 320,
        responseFormat: { type: 'json_object' },
      },
      resolutionParams: {
        accountId,
        feature: 'AI_REPLY',
        conversationId,
      },
    });
  } catch (err) {
    console.error('[AI Assistant] AI completion failed:', err);
    return;
  }

  const aiText = completion.content.trim();
  if (!aiText) {
    console.warn('[AI Assistant] AI Engine returned empty response');
    return;
  }

  try {
    const parsedResponse = parseAiResponse(aiText);
    let reply =
      parsedResponse.reply ||
      (parsedResponse.isStructured
        ? 'Sorry, I could not process that response. Please try again.'
        : aiText);
    let intent = 'other';
    let lead_score = 'cold';
    let sentiment = 'neutral';
    let handoff_required = false;
    let resolved = false;
    let summary: string | null = null;
    let faq_category = 'general';

    let sales_signal = false;
    let interested_service: string | null = null;
    let budget: string | null = null;
    let timeline: string | null = null;
    let next_action: string | null = null;

    let hospital_patient_info: Record<string, unknown> | null = null;
    let hospital_booking: Record<string, unknown> | null = null;
    let hospital_profile_update: Record<string, unknown> | null = null;
    let hospital_report_send: Record<string, unknown> | null = null;
    let coaching_student_update: Record<string, unknown> | null = null;
    let emergency_detected = false;

    if (parsedResponse.payload) {
      const parsed = parsedResponse.payload as Record<string, unknown>;
      intent = (parsed.intent as string) || 'other';
      lead_score = (parsed.lead_score as string) || 'cold';
      sentiment = (parsed.sentiment as string) || 'neutral';
      handoff_required = !!parsed.handoff_required;
      resolved = !!parsed.resolved;
      summary = (parsed.summary as string) || null;
      faq_category = (parsed.faq_category as string) || 'general';
      sales_signal = !!parsed.sales_signal;

      const extracted = (parsed.extracted_lead_info || {}) as Record<
        string,
        unknown
      >;
      interested_service = (extracted.interested_service as string) || null;
      budget = (extracted.budget as string) || null;
      timeline = (extracted.timeline as string) || null;
      next_action = (extracted.next_action as string) || null;

      hospital_patient_info =
        (parsed.hospital_patient_info as Record<string, unknown>) || null;
      hospital_booking =
        (parsed.hospital_booking as Record<string, unknown>) || null;
      hospital_profile_update =
        (parsed.hospital_profile_update as Record<string, unknown>) || null;
      hospital_report_send =
        (parsed.hospital_report_send as Record<string, unknown>) || null;
      coaching_student_update =
        (parsed.coaching_student_update as Record<string, unknown>) || null;
      emergency_detected = !!parsed.emergency_detected;
    } else if (parsedResponse.isStructured) {
      console.warn(
        '[AI Assistant] Structured AI response could not be parsed; sending only its recovered reply.'
      );
    }

    // Update the conversation's AI insights in the database
    const { error: updateError } = await db
      .from('conversations')
      .update({
        ai_intent: intent,
        ai_lead_score: lead_score,
        ai_sentiment: sentiment,
        ai_summary: summary,
        ai_handoff_required: handoff_required,
        ai_resolved: resolved,
        ai_faq_category: faq_category,
      })
      .eq('id', conversationId);

    if (updateError) {
      console.error(
        '[AI Assistant] Failed to update conversation AI insights:',
        updateError
      );
    }

    // AI Pipeline Automation
    try {
      const { data: existingDeal } = await db
        .from('deals')
        .select('*')
        .eq('contact_id', contactId)
        .eq('account_id', accountId)
        .maybeSingle();

      if (existingDeal) {
        // Update existing Pipeline card
        const { error: dealUpdateErr } = await db
          .from('deals')
          .update({
            ai_lead_score: lead_score,
            ai_buying_intent: intent,
            ai_budget: budget || existingDeal.ai_budget,
            ai_timeline: timeline || existingDeal.ai_timeline,
            ai_summary: summary || existingDeal.ai_summary,
            ai_next_action: next_action || existingDeal.ai_next_action,
            ai_product_service:
              interested_service || existingDeal.ai_product_service,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingDeal.id);

        if (dealUpdateErr) {
          console.error(
            '[AI Pipeline] Failed to update existing deal:',
            dealUpdateErr
          );
        } else {
          console.log(
            '[AI Pipeline] Successfully updated existing Pipeline card:',
            existingDeal.id
          );
        }
      } else if (sales_signal) {
        // Create new Pipeline card in default stage of default pipeline
        const { data: pipelines } = await db
          .from('pipelines')
          .select('id')
          .eq('account_id', accountId)
          .order('created_at', { ascending: true });

        if (pipelines && pipelines.length > 0) {
          const pipelineId = pipelines[0].id;
          const { data: stages } = await db
            .from('pipeline_stages')
            .select('id, name')
            .eq('pipeline_id', pipelineId)
            .order('position', { ascending: true });

          if (stages && stages.length > 0) {
            const newLeadStage =
              stages.find(
                (s: { name: string }) =>
                  s.name.toLowerCase() === 'new inquiry' ||
                  s.name.toLowerCase() === 'new lead'
              ) || stages[0];

            const stageId = newLeadStage.id;

            const contactName =
              contact?.name || contact?.phone || 'Unknown Client';
            const cardTitle = interested_service
              ? `${contactName} - ${interested_service}`
              : `${contactName} - WhatsApp Lead`;

            const { error: dealInsertErr } = await db.from('deals').insert({
              account_id: accountId,
              user_id: userId,
              pipeline_id: pipelineId,
              stage_id: stageId,
              contact_id: contactId,
              conversation_id: conversationId,
              title: cardTitle,
              ai_lead_score: lead_score,
              ai_buying_intent: intent,
              ai_budget: budget,
              ai_timeline: timeline,
              ai_summary: summary,
              ai_next_action: next_action,
              ai_product_service: interested_service,
            });

            if (dealInsertErr) {
              console.error(
                '[AI Pipeline] Failed to create new deal:',
                dealInsertErr
              );
            } else {
              console.log(
                '[AI Pipeline] Successfully created new Pipeline card for contact:',
                contactId
              );
            }
          }
        }
      }
    } catch (pipelineErr) {
      console.error(
        '[AI Pipeline] Error during pipeline synchronization:',
        pipelineErr
      );
    }

    // Hospital & Clinic Action Processing
    if (isHospitalEnabled) {
      // 1. Emergency Interception
      if (emergency_detected) {
        handoff_required = true;
        reply = `🚨 *EMERGENCY DETECTED:* A human receptionist may review this conversation. For immediate help, call your local emergency service or go to the nearest emergency department. AI autopilot has been paused for this chat.`;
        await db.from('audit_logs').insert({
          account_id: accountId,
          actor_id: userId,
          action: 'emergency.escalation_created',
          resource_type: 'conversations',
          resource_id: conversationId,
          metadata: {
            severity: 'high',
            safety_classification: 'emergency',
            created_at: new Date().toISOString(),
          },
        });
      }

      // Resolve the patient by name and number. Family members can share a
      // WhatsApp number, so a different name receives a separate contact.
      let targetContactId = contactId;
      const patientNameProvided = (hospital_patient_info?.name ||
        hospital_booking?.patient_name) as string | undefined;
      const patientPhoneProvided = (hospital_patient_info?.phone ||
        contact?.phone) as string | undefined;

      if (patientNameProvided && patientPhoneProvided) {
        try {
          // Find a matching patient identity for this phone number.
          const basePhone = patientPhoneProvided.trim();
          const normalizedName = patientNameProvided.trim().toLocaleLowerCase();
          const { data: existingContacts, error: existingContactsError } =
            await db
              .from('contacts')
              .select('id, name')
              .eq('account_id', accountId)
              .eq('phone', basePhone);

          if (existingContactsError) throw existingContactsError;

          const existingContact =
            existingContacts?.find(
              (candidate: { name?: string }) =>
                candidate.name?.trim().toLocaleLowerCase() === normalizedName
            ) ||
            existingContacts?.find(
              (candidate: { id: string; name?: string }) =>
                candidate.id === contactId && !candidate.name
            );

          if (existingContact) {
            targetContactId = existingContact.id;
            if (!existingContact.name && patientNameProvided) {
              await db
                .from('contacts')
                .update({ name: patientNameProvided.trim() })
                .eq('id', existingContact.id);
            }
          } else {
            // A different family member can use the same mobile number.
            const { data: newContact } = await db
              .from('contacts')
              .insert({
                account_id: accountId,
                user_id: userId,
                phone: basePhone,
                name: patientNameProvided.trim(),
                industry: 'hospital_clinic',
                entity_type: 'Patient',
                metadata: {},
              })
              .select('id')
              .single();

            if (newContact) {
              targetContactId = newContact.id;

              // Also create conversation for new contact so it can be viewed in CRM
              await db.from('conversations').insert({
                account_id: accountId,
                contact_id: targetContactId,
                status: 'open',
                last_message_text: `Registered automatically via WhatsApp AI`,
                last_message_at: new Date().toISOString(),
              });
            }
          }
        } catch (e) {
          console.error('[AI Assistant] Error resolving target contact:', e);
        }
      }

      // 2. Profile Creation / Update in Contacts Metadata & Patients table
      if (hospital_patient_info) {
        const pName = hospital_patient_info.name;
        const pGender = hospital_patient_info.gender;
        const pDob = hospital_patient_info.dob;
        const pBg = hospital_patient_info.blood_group;
        const pEc = hospital_patient_info.emergency_contact;

        if (pName || pGender || pDob || pBg || pEc) {
          try {
            const { data: extContact } = await db
              .from('contacts')
              .select('name, address, notes, metadata')
              .eq('id', targetContactId)
              .single();

            const existingMetadata =
              extContact?.metadata && typeof extContact.metadata === 'object'
                ? extContact.metadata
                : {};

            // Check if patient details already exist in patients table
            const { data: extPatient } = await db
              .from('patients')
              .select('*')
              .eq('id', targetContactId)
              .maybeSingle();

            let seq = extPatient?.patient_seq_id || null;
            const patientData = {
              id: targetContactId,
              account_id: accountId,
              gender:
                pGender ||
                extPatient?.gender ||
                existingMetadata.gender ||
                null,
              date_of_birth:
                pDob ||
                extPatient?.date_of_birth ||
                existingMetadata.dob ||
                null,
              blood_group:
                pBg ||
                extPatient?.blood_group ||
                existingMetadata.blood_group ||
                null,
              emergency_contact:
                pEc ||
                extPatient?.emergency_contact ||
                existingMetadata.emergency_contact ||
                null,
              updated_at: new Date().toISOString(),
            };

            if (extPatient) {
              await db
                .from('patients')
                .update(patientData)
                .eq('id', targetContactId);
            } else {
              const { data: createdPatient, error: createPatientError } =
                await db
                  .from('patients')
                  .insert(patientData)
                  .select('patient_seq_id')
                  .single();
              if (createPatientError || !createdPatient?.patient_seq_id) {
                throw (
                  createPatientError ||
                  new Error('Could not assign a Patient ID')
                );
              }
              seq = createdPatient.patient_seq_id;
            }

            if (!seq) throw new Error('Patient ID is missing');

            const updatedMetadata = {
              ...existingMetadata,
              patient_id: seq,
              gender:
                pGender ||
                extPatient?.gender ||
                existingMetadata.gender ||
                null,
              dob:
                pDob ||
                extPatient?.date_of_birth ||
                existingMetadata.dob ||
                null,
              blood_group:
                pBg ||
                extPatient?.blood_group ||
                existingMetadata.blood_group ||
                null,
              emergency_contact:
                pEc ||
                extPatient?.emergency_contact ||
                existingMetadata.emergency_contact ||
                null,
            };

            await db
              .from('contacts')
              .update({
                name: pName || extContact?.name || null,
                metadata: updatedMetadata,
                updated_at: new Date().toISOString(),
              })
              .eq('id', targetContactId);

            console.log(
              '[AI Hospital] Profile successfully updated in contacts metadata and patients table'
            );
          } catch (patErr) {
            console.error(
              '[AI Hospital] Error updating patient demographics:',
              patErr
            );
          }
        }
      }

      // 5. Patient Profile self-update via WhatsApp
      if (hospital_profile_update && hospital_profile_update.patient_id) {
        try {
          const pId = String(hospital_profile_update.patient_id)
            .trim()
            .toUpperCase();
          console.log('[AI Hospital] Patient self-edit requested for ID:', pId);

          // 1. Try finding the patient in the patients table
          const { data: targetPatient } = await db
            .from('patients')
            .select('id, patient_seq_id')
            .eq('account_id', accountId)
            .eq('patient_seq_id', pId)
            .maybeSingle();

          let targetContactId = targetPatient?.id;
          let targetContact: Record<string, unknown> | null = null;

          if (targetContactId) {
            const { data: extContact } = await db
              .from('contacts')
              .select('id, name, address, notes, metadata')
              .eq('id', targetContactId)
              .single();
            targetContact = extContact as Record<string, unknown> | null;
          } else {
            // Fallback: search in contacts table metadata
            const { data: extContact } = await db
              .from('contacts')
              .select('id, name, address, notes, metadata')
              .eq('account_id', accountId)
              .filter('metadata->>patient_id', 'eq', pId)
              .maybeSingle();

            targetContact = extContact as Record<string, unknown> | null;
            targetContactId = extContact?.id;
          }

          if (targetContactId && targetContact && hospital_profile_update) {
            const tc = targetContact as Record<string, unknown>;
            const existingMetadata = (
              tc.metadata && typeof tc.metadata === 'object' ? tc.metadata : {}
            ) as Record<string, unknown>;
            const newMeta: Record<string, unknown> = {
              ...existingMetadata,
              patient_id: pId,
            };
            const contactUpdates: Record<string, unknown> = {
              metadata: newMeta,
            };
            if (hospital_profile_update.name)
              contactUpdates.name = String(hospital_profile_update.name).trim();
            if (hospital_profile_update.email)
              contactUpdates.email = String(
                hospital_profile_update.email
              ).trim();
            if (hospital_profile_update.phone)
              contactUpdates.phone = String(
                hospital_profile_update.phone
              ).trim();
            if (hospital_profile_update.address)
              contactUpdates.address = String(
                hospital_profile_update.address
              ).trim();

            if (hospital_profile_update.gender)
              newMeta.gender = hospital_profile_update.gender;
            if (hospital_profile_update.dob)
              newMeta.dob = hospital_profile_update.dob;
            if (hospital_profile_update.blood_group)
              newMeta.blood_group = String(
                hospital_profile_update.blood_group
              ).trim();
            if (hospital_profile_update.emergency_contact)
              newMeta.emergency_contact = String(
                hospital_profile_update.emergency_contact
              ).trim();

            // 1. Update contacts
            await db
              .from('contacts')
              .update(contactUpdates)
              .eq('id', targetContactId);

            // 2. Upsert patients table
            const { data: extPatient } = await db
              .from('patients')
              .select('*')
              .eq('id', targetContactId)
              .maybeSingle();

            const patientData = {
              id: targetContactId,
              account_id: accountId,
              patient_seq_id: pId,
              gender:
                hospital_profile_update.gender ||
                extPatient?.gender ||
                existingMetadata.gender ||
                null,
              date_of_birth:
                hospital_profile_update.dob ||
                extPatient?.date_of_birth ||
                existingMetadata.dob ||
                null,
              blood_group:
                (hospital_profile_update.blood_group as string)?.trim() ||
                extPatient?.blood_group ||
                existingMetadata.blood_group ||
                null,
              emergency_contact:
                (hospital_profile_update.emergency_contact as string)?.trim() ||
                extPatient?.emergency_contact ||
                existingMetadata.emergency_contact ||
                null,
              updated_at: new Date().toISOString(),
            };

            if (extPatient) {
              await db
                .from('patients')
                .update(patientData)
                .eq('id', targetContactId);
            } else {
              await db.from('patients').insert(patientData);
            }

            console.log(
              '[AI Hospital] Profile successfully updated in contacts & patients for patient ID:',
              pId
            );
          }
        } catch (profileErr) {
          console.error(
            '[AI Hospital] Error updating patient profile self-edit:',
            profileErr
          );
        }
      }

      // 5.5 Student target exam self-update via WhatsApp
      if (coaching_student_update) {
        try {
          const sId = coaching_student_update.student_id
            ? String(coaching_student_update.student_id).trim().toUpperCase()
            : null;
          const targetExam = coaching_student_update.target_exam
            ? String(coaching_student_update.target_exam).trim()
            : null;

          if (targetExam) {
            let targetContactIdToUpdate: string | null = null;

            if (sId) {
              const { data: targetContact } = await db
                .from('contacts')
                .select('id')
                .eq('account_id', accountId)
                .filter('metadata->>student_id', 'eq', sId)
                .maybeSingle();
              if (targetContact) {
                targetContactIdToUpdate = targetContact.id;
              }
            } else {
              // If student ID is not specified, lookup student(s) linked to this phone number
              const { data: studentList } = await db
                .from('contacts')
                .select('id')
                .eq('account_id', accountId)
                .in('id', contactIds);
              if (studentList && studentList.length === 1) {
                targetContactIdToUpdate = studentList[0].id;
              }
            }

            if (targetContactIdToUpdate) {
              console.log(
                '[AI Coaching] Updating student exam preparation in metadata for ID:',
                targetContactIdToUpdate,
                'to:',
                targetExam
              );
              const { data: extContact } = await db
                .from('contacts')
                .select('metadata')
                .eq('id', targetContactIdToUpdate)
                .single();
              const existingMetadata =
                extContact?.metadata && typeof extContact.metadata === 'object'
                  ? extContact.metadata
                  : {};

              await db
                .from('contacts')
                .update({
                  metadata: {
                    ...existingMetadata,
                    parent_name: targetExam,
                  },
                  updated_at: new Date().toISOString(),
                })
                .eq('id', targetContactIdToUpdate);
            }
          }
        } catch (coachingErr) {
          console.error(
            '[AI Coaching] Error updating student target exam:',
            coachingErr
          );
        }
      }

      // 3. Appointment Booking via Chat
      if (hospital_booking && hospital_booking.action === 'book') {
        const { doctor_name, department, date, time } = hospital_booking;

        // Fetch existing patient details to verify if we already have Gender and DOB from metadata & patients table
        const { data: extContact } = await db
          .from('contacts')
          .select('name, phone, metadata')
          .eq('id', targetContactId)
          .single();

        const existingMetadata =
          extContact?.metadata && typeof extContact.metadata === 'object'
            ? extContact.metadata
            : {};

        const { data: extPatient } = await db
          .from('patients')
          .select('*')
          .eq('id', targetContactId)
          .maybeSingle();

        const pName =
          hospital_patient_info?.name ||
          patientNameProvided ||
          extContact?.name ||
          contact?.name;
        const pGender =
          hospital_patient_info?.gender ||
          extPatient?.gender ||
          existingMetadata.gender;
        const pDob =
          hospital_patient_info?.dob ||
          extPatient?.date_of_birth ||
          existingMetadata.dob;
        const pBg =
          hospital_patient_info?.blood_group ||
          extPatient?.blood_group ||
          existingMetadata.blood_group;
        const pEc =
          hospital_patient_info?.emergency_contact ||
          extPatient?.emergency_contact ||
          existingMetadata.emergency_contact;

        if (!pName) {
          reply =
            "I'm ready to schedule your appointment, but I need your full name first. Could you please reply with your name?";
        } else if (!pGender) {
          reply =
            "I'm ready to schedule your appointment, but I need to know your gender first (Male/Female/Other). Could you please let me know?";
        } else if (!pDob) {
          reply =
            "I'm ready to schedule your appointment, but I need your Date of Birth first (YYYY-MM-DD). Could you please provide it?";
        } else if (!doctor_name && !department) {
          reply =
            "I'm ready to schedule your appointment. Could you please let me know which department you'd like to visit (e.g. Cardiology, Orthopedics, General Medicine)?";
        } else if (department && !doctor_name) {
          // Department given but no doctor — look up doctors in that department and list them
          const { data: deptDoctors } = await db
            .from('hospital_doctors')
            .select('name, consultation_fee, available_days, working_hours')
            .eq('account_id', accountId)
            .eq('status', 'active')
            .ilike('department', `%${department}%`);

          if (deptDoctors && deptDoctors.length > 0) {
            let doctorList = `Here are the available doctors in *${department}*:\n\n`;
            deptDoctors.forEach((doc: Record<string, unknown>, idx: number) => {
              const days = Array.isArray(doc.available_days)
                ? doc.available_days.join(', ')
                : 'All days';
              const workingHours = doc.working_hours as
                { start?: string; end?: string } | null | undefined;
              const start = workingHours?.start || '09:00';
              const end = workingHours?.end || '17:00';
              const fee = doc.consultation_fee || 0;
              const nameStr =
                typeof doc.name === 'string' ? doc.name : 'Doctor';
              doctorList += `${idx + 1}️⃣ *Dr. ${nameStr.replace(/^Dr\.\s+/i, '')}* — Fee: ₹${fee} — ${days} (${start}–${end})\n`;
            });
            doctorList += `\nPlease reply with the doctor's name to proceed with your appointment booking.`;
            reply = doctorList;
          } else {
            reply = `I couldn't find any doctors in the *${department}* department. Could you please check the department name or tell me which doctor you'd like to book with?`;
          }
        } else if (date && time) {
          try {
            let doctorId: string | null = null;
            let actualDocName = doctor_name || 'On-Duty Physician';
            let actualSpecialization = '';

            if (doctor_name) {
              const { data: doc } = await db
                .from('hospital_doctors')
                .select('id, name, specialization')
                .eq('account_id', accountId)
                .ilike(
                  'name',
                  `%${String(doctor_name).replace('Dr.', '').trim()}%`
                )
                .maybeSingle();
              if (doc) {
                doctorId = doc.id;
                actualDocName = doc.name;
                actualSpecialization = doc.specialization || '';
              }
            }

            // Campaign attribution: find last campaign received in last 7 days
            let campaignIdToAttribute: string | null = null;
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const { data: recentCampaignRec } = await db
              .from('broadcast_recipients')
              .select('broadcast_id')
              .eq('contact_id', targetContactId)
              .gte('created_at', sevenDaysAgo.toISOString())
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (recentCampaignRec) {
              campaignIdToAttribute = recentCampaignRec.broadcast_id;
            }

            const { data: newAppt, error: insertError } = await db
              .from('appointments')
              .insert({
                account_id: accountId,
                patient_id: targetContactId,
                doctor_id: doctorId,
                department: department || 'General Medicine',
                appointment_date: date,
                appointment_time: time,
                status: 'pending',
                campaign_id: campaignIdToAttribute,
              })
              .select('id, booking_id, token_number, queue_position')
              .maybeSingle();

            if (insertError) throw insertError;

            if (newAppt) {
              // Ensure the patient record is created or updated in both patients table and contacts metadata
              let seq = extPatient?.patient_seq_id || null;
              const patientData = {
                id: targetContactId,
                account_id: accountId,
                gender: pGender || null,
                date_of_birth: pDob || null,
                blood_group: pBg || null,
                emergency_contact: pEc || null,
                updated_at: new Date().toISOString(),
              };

              if (extPatient) {
                await db
                  .from('patients')
                  .update(patientData)
                  .eq('id', targetContactId);
              } else {
                const { data: createdPatient, error: createPatientError } =
                  await db
                    .from('patients')
                    .insert(patientData)
                    .select('patient_seq_id')
                    .single();
                if (createPatientError || !createdPatient?.patient_seq_id) {
                  throw (
                    createPatientError ||
                    new Error('Could not assign a Patient ID')
                  );
                }
                seq = createdPatient.patient_seq_id;
              }

              if (!seq) throw new Error('Patient ID is missing');

              const updatedMetadata = {
                ...existingMetadata,
                patient_id: seq,
                gender: pGender || null,
                dob: pDob || null,
                blood_group: pBg || null,
                emergency_contact: pEc || null,
              };

              await db
                .from('contacts')
                .update({
                  name: pName || null,
                  metadata: updatedMetadata,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', targetContactId);
              const siteUrl =
                process.env.NEXT_PUBLIC_APP_URL ||
                process.env.NEXT_PUBLIC_SITE_URL ||
                'https://helpa.studio';
              const pdfUrl = `${siteUrl}/api/appointments/${newAppt.id}/pdf`;
              const bookingIdStr =
                newAppt.booking_id ||
                `APT-2026-${newAppt.id.slice(0, 5).toUpperCase()}`;

              // Generate Ticket Serial Number (daily count for this account on this date)
              const { count: dailyCount } = await db
                .from('appointments')
                .select('id', { count: 'exact', head: true })
                .eq('account_id', accountId)
                .eq('appointment_date', date);
              const ticketSerial = `TKT-${String(dailyCount || 1).padStart(3, '0')}`;

              const displayDoc = String(actualDocName).startsWith('Dr.')
                ? String(actualDocName)
                : 'Dr. ' + String(actualDocName);
              const displaySpec = actualSpecialization
                ? ` (${actualSpecialization})`
                : '';

              reply = `✅ *APPOINTMENT CONFIRMED!*

📋 *Booking ID:* ${bookingIdStr}
🎫 *Ticket Serial:* ${ticketSerial}
🔢 *Token Number:* #${newAppt.token_number || 1}
📍 *Queue Position:* ${newAppt.queue_position || 1}
👨‍⚕️ *Doctor:* ${displayDoc}${displaySpec}
🏥 *Department:* ${department || 'General Medicine'}
📅 *Date & Time:* ${date} at ${time}

📄 Download your digital OPD ticket PDF:
${pdfUrl}

Please arrive 15 minutes before your time slot. Thank you!`;

              // Automatically send the PDF slip to the patient via WhatsApp
              engineSendDocument({
                accountId,
                userId,
                conversationId,
                contactId,
                documentUrl: pdfUrl,
                filename: `appointment-${bookingIdStr}.pdf`,
                caption: `Digital Appointment Ticket for ${displayDoc}`,
              }).catch((e: unknown) =>
                console.error(
                  '[AI Hospital] Failed to auto-send appointment PDF:',
                  e instanceof Error ? e.message : String(e)
                )
              );
            }
          } catch (apptErr) {
            console.error(
              '[AI Hospital] Error booking appointment via AI:',
              apptErr
            );
          }
        }
      }

      // 4. Lab Report Smart Status Assistant
      if (labReports && labReports.length > 0) {
        const rawReportSend = hospital_report_send as {
          send_report?: boolean;
          report_id?: string;
          test_name?: string;
        } | null;
        const lowercaseMsg = (latestMessage?.content_text || '').toLowerCase();
        const reportKeywords = [
          'report',
          'test',
          'blood',
          'result',
          'status',
          'রিপোর্ট',
          'রিপোট',
          'টেস্ট',
          'পরীক্ষা',
          'রক্ত',
          'ব্লাড',
          'পাঠাও',
          'পাঠান',
          'দেবেন',
          'চাই',
          'পাব',
          'দেখব',
          'dao',
          'din',
          'pathan',
          'pathao',
          'deben',
          'chai',
          'pabo',
          'paabo',
          'dekhte',
          'bhejo',
          'bhejiye',
          'chahiye',
          'do',
          'रिपोर्ट',
          'जांच',
          'खून',
          'ब्लड',
          'रिजल्ट',
          'lab',
          'x-ray',
          'xray',
          'mri',
          'ct scan',
          'cbc',
          'ecg',
          'usg',
          'ultrasound',
          'pathology',
          'urine',
          'sugar',
          'glucose',
          'lipid',
          'thyroid',
          'lft',
          'kft',
          'hemoglobin',
          'haemoglobin',
          'platelet',
          'pdf',
          'download',
        ];
        const isReportQuery =
          rawReportSend?.send_report === true ||
          reportKeywords.some((kw) => lowercaseMsg.includes(kw));

        if (isReportQuery) {
          const reportsWithPdf = labReports.filter(
            (r) =>
              Boolean(r.report_pdf_url) &&
              (!r.status ||
                [
                  'ready',
                  'delivered',
                  'completed',
                  'generated',
                  'done',
                ].includes(r.status.toLowerCase()))
          );

          let targetReport: LabReportRow | null = null;

          // 1. If LLM provided report_id
          if (rawReportSend?.report_id) {
            targetReport =
              reportsWithPdf.find((r) => r.id === rawReportSend.report_id) ||
              null;
          }

          // 2. If LLM provided test_name
          if (!targetReport && rawReportSend?.test_name) {
            const reqNameLower = rawReportSend.test_name.toLowerCase();
            targetReport =
              reportsWithPdf.find((r) =>
                (r.test_name || '').toLowerCase().includes(reqNameLower)
              ) || null;
          }

          // 3. Test specific matching based on user keywords (e.g. Blood / CBC / Sugar)
          if (!targetReport) {
            const isBloodQuery =
              lowercaseMsg.includes('blood') ||
              lowercaseMsg.includes('রক্ত') ||
              lowercaseMsg.includes('ব্লাড') ||
              lowercaseMsg.includes('खून') ||
              lowercaseMsg.includes('cbc') ||
              lowercaseMsg.includes('hemoglobin') ||
              lowercaseMsg.includes('haemoglobin');

            if (isBloodQuery) {
              targetReport =
                reportsWithPdf.find((r) => {
                  const tName = (r.test_name || '').toLowerCase();
                  const dept = (r.department || '').toLowerCase();
                  return (
                    tName.includes('blood') ||
                    tName.includes('cbc') ||
                    tName.includes('hemoglobin') ||
                    tName.includes('haemoglobin') ||
                    tName.includes('platelet') ||
                    tName.includes('sugar') ||
                    tName.includes('glucose') ||
                    tName.includes('lipid') ||
                    tName.includes('thyroid') ||
                    tName.includes('lft') ||
                    tName.includes('kft') ||
                    dept.includes('pathology') ||
                    dept.includes('hematology') ||
                    dept.includes('blood')
                  );
                }) || null;
            }
          }

          // 4. Test specific matching for X-Ray
          if (!targetReport) {
            if (
              lowercaseMsg.includes('x-ray') ||
              lowercaseMsg.includes('xray') ||
              lowercaseMsg.includes('এক্সরে')
            ) {
              targetReport =
                reportsWithPdf.find(
                  (r) =>
                    (r.test_name || '').toLowerCase().includes('x-ray') ||
                    (r.test_name || '').toLowerCase().includes('xray') ||
                    (r.department || '').toLowerCase().includes('radiology')
                ) || null;
            }
          }

          // 5. Test specific matching for Urine
          if (!targetReport) {
            if (
              lowercaseMsg.includes('urine') ||
              lowercaseMsg.includes('ইউরিন')
            ) {
              targetReport =
                reportsWithPdf.find((r) =>
                  (r.test_name || '').toLowerCase().includes('urine')
                ) || null;
            }
          }

          // 6. Default to single ready report if only one is available
          if (!targetReport && reportsWithPdf.length === 1) {
            targetReport = reportsWithPdf[0];
          }

          if (targetReport && targetReport.report_pdf_url) {
            console.log(
              '[AI Hospital] Auto-sending lab report PDF:',
              targetReport.test_name
            );
            engineSendDocument({
              accountId,
              userId,
              conversationId,
              contactId,
              documentUrl: targetReport.report_pdf_url,
              filename: `${targetReport.test_name.replace(/\s+/g, '_')}_Report.pdf`,
              caption: `Here is your completed ${targetReport.test_name} report.`,
            }).catch((e: unknown) =>
              console.error(
                '[AI Hospital] Failed to auto-send lab report PDF:',
                e instanceof Error ? e.message : String(e)
              )
            );
          } else if (reportsWithPdf.length > 1) {
            console.log(
              '[AI Hospital] Multiple ready reports, sending selection buttons'
            );
            const buttons = reportsWithPdf.slice(0, 3).map((r) => ({
              id: `report_download_${r.id}`,
              title: r.test_name.substring(0, 20),
            }));
            engineSendButtons({
              accountId,
              userId,
              conversationId,
              contactId,
              bodyText:
                'I found multiple reports ready for you. Which one would you like to receive?',
              buttons,
            }).catch((e: unknown) =>
              console.error(
                '[AI Hospital] Failed to send report buttons:',
                e instanceof Error ? e.message : String(e)
              )
            );
          }
        }
      }
    }

    // If human handoff is requested, insert system message alert
    if (handoff_required) {
      const { error: systemMsgError } = await db.from('messages').insert({
        conversation_id: conversationId,
        sender_type: 'bot',
        content_type: 'text',
        content_text:
          '[System Handoff] AI auto-pilot disabled. Human agent takeover requested.',
        message_id: `system-handoff-${conversationId}-${Date.now()}`,
        status: 'delivered',
        created_at: new Date().toISOString(),
      });

      if (systemMsgError) {
        console.error(
          '[AI Assistant] Failed to insert handoff system message:',
          systemMsgError
        );
      }
    }

    // 6. Send the generated text back to the customer via WhatsApp and insert it into the DB
    if (isHospitalEnabled && intent === 'booking') {
      const { engineSendButtons } = await import('@/lib/automations/meta-send');
      await engineSendButtons({
        accountId,
        userId,
        conversationId,
        contactId,
        bodyText: reply,
        buttons: [
          { id: 'hospital_btn_book', title: '📅 Book Now' },
          { id: 'hospital_btn_docs', title: '👨‍⚕️ View Doctors' },
          { id: 'hospital_btn_branches', title: '📍 Clinic Sites' },
        ],
      });
    } else {
      await engineSendText({
        accountId,
        userId,
        conversationId,
        contactId,
        text: reply,
      });
    }
    console.log(
      `[AI Assistant] Successfully sent AI reply to conversation ${conversationId}`
    );

    // 7. Track successful AI request usage
    await incrementUsage(accountId, 'ai_requests');
  } catch (err) {
    console.error('[AI Assistant] Error handling AI response:', err);
  }
}
