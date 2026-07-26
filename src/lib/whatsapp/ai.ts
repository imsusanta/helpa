import { decrypt } from '@/lib/whatsapp/encryption'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { engineSendText } from '@/lib/automations/meta-send'
import { checkPlanLimits, incrementUsage } from '@/lib/saas/subscription'
import { getIndustryModule, resolveSystemPrompt } from '@/modules/registry'
import { parseAiResponse } from '@/lib/whatsapp/ai-response'

interface TriggerAiResponseArgs {
  accountId: string
  userId: string
  conversationId: string
  contactId: string
}

export async function triggerAiResponse(args: TriggerAiResponseArgs): Promise<void> {
  const { accountId, userId, conversationId, contactId } = args
  
  // Check SaaS subscription limits before running any AI requests
  try {
    await checkPlanLimits(accountId, 'max_ai_requests')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[AI Assistant] Limit check failed, skipping response:', msg)
    return
  }

  const db = supabaseAdmin()

  // Fetch contact details (name, phone, address, notes, metadata)
  const { data: contact } = await db
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .maybeSingle();

  // Fetch all contacts sharing the same phone number (family/siblings)
  const { data: siblingContacts } = await db
    .from('contacts')
    .select('id')
    .eq('phone', contact?.phone || '');
  const contactIds = siblingContacts && siblingContacts.length > 0 ? siblingContacts.map(c => c.id) : [contactId];

  // 1. Fetch OpenRouter configuration from accounts
  let account: any = null;
  let { data: accData, error: accError } = await db
    .from('accounts')
    .select('openrouter_api_key, openrouter_model, ai_system_prompt, welcome_message, industry')
    .eq('id', accountId)
    .single()

  if (accError && (accError.message?.includes('welcome_message') || accError.code === '42703')) {
    // Fallback if welcome_message column is missing in database table
    const fallback = await db
      .from('accounts')
      .select('openrouter_api_key, openrouter_model, ai_system_prompt, industry')
      .eq('id', accountId)
      .single()
    accData = fallback.data as any
    accError = fallback.error
  }

  account = accData

  if (accError || !account?.openrouter_api_key) {
    console.warn('[AI Assistant] OpenRouter credentials not configured for account:', accountId, accError?.message || '')
    return
  }

  // 2. Decrypt API key
  let apiKey: string
  try {
    apiKey = decrypt(account.openrouter_api_key)
  } catch (err) {
    console.error('[AI Assistant] Failed to decrypt saved OpenRouter API Key:', err)
    if (process.env.OPENROUTER_API_KEY) {
      apiKey = process.env.OPENROUTER_API_KEY
    } else {
      return
    }
  }

  const model = account.openrouter_model || 'google/gemini-2.5-flash'

  // 3. Fetch conversation context (latest 15 messages)
  const { data: messages, error: msgError } = await db
    .from('messages')
    .select('sender_type, content_type, content_text, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(15)

  if (msgError || !messages || messages.length === 0) {
    console.error('[AI Assistant] Failed to fetch message history or no messages found:', msgError)
    return
  }

  // Guard: Only respond if the latest message is from the customer
  const latestMessage = messages[0]
  if (latestMessage.sender_type !== 'customer') {
    console.warn('[AI Assistant] Latest message is not from customer. Skipping AI response. Latest sender:', latestMessage.sender_type)
    return
  }

  // Reverse messages to restore chronological order (ascending) for the LLM
  messages.reverse()

  // 3.5 Fetch Knowledge Base for Tenant Context
  const { data: kbEntries } = await db
    .from('knowledge_base')
    .select('category, question_title, answer_content')
    .eq('account_id', accountId)

  let kbContext = ""
  if (kbEntries && kbEntries.length > 0) {
    kbContext = "Here is the verified knowledge base and pricing information for our company:\n\n"
    kbEntries.forEach((entry) => {
      kbContext += `[${entry.category.toUpperCase()}] ${entry.question_title}: ${entry.answer_content}\n`
    })
  }

  const industryModuleForContext = getIndustryModule(account?.industry);
  const isHospitalEnabled = industryModuleForContext.id === 'hospital_clinic';
  const isCoachingEnabled = industryModuleForContext.id === 'coaching';
  const isSoloTeacherEnabled = industryModuleForContext.id === 'solo_teacher';
  let hospitalContext = "";
  let coachingContext = "";
  let labReports: any[] | null = null;

  // Build Contact profile context dynamically using active industry entity config
  const contactConfigForContext = industryModuleForContext.entityConfigs?.contacts;
  const entityLabelForContext = contactConfigForContext?.label || 'Contact';
  const customFieldsForContext = contactConfigForContext?.fields || [];

  if (isCoachingEnabled || isSoloTeacherEnabled) {
    const { data: coachingStudents } = await db
      .from('contacts')
      .select('name, phone, metadata')
      .in('id', contactIds);

    if (coachingStudents && coachingStudents.length > 0) {
      coachingContext += `Registered ${entityLabelForContext}s under this WhatsApp/Phone Number:\n`;
      coachingStudents.forEach((s: any) => {
        const meta = s.metadata && typeof s.metadata === 'object' ? s.metadata : {};
        coachingContext += `- Name: ${s.name}, Student ID: ${meta.student_id || 'N/A'}, Exam Preparation (Target Exam): ${meta.parent_name || 'Not set'}\n`;
      });
      coachingContext += "\n";
    }
  }

  if (isHospitalEnabled) {
    const { data: doctors } = await db
      .from('hospital_doctors')
      .select('name, department, specialization, consultation_fee, available_days, working_hours')
      .eq('account_id', accountId)
      .eq('status', 'active');

    const { data: branches } = await db
      .from('hospital_branches')
      .select('name, address, phone')
      .eq('account_id', accountId);

    const { data: appts } = await db
      .from('appointments')
      .select('*, doctor:hospital_doctors(name), patient:contacts(name)')
      .in('patient_id', contactIds)
      .order('appointment_date', { ascending: false })
      .limit(3);

    const { data: labReportsData } = await db
      .from('hospital_lab_reports')
      .select('id, test_name, status, expected_delivery_date, report_pdf_url, notes, department, doctor:hospital_doctors(name), patient:contacts(name)')
      .in('patient_id', contactIds)
      .order('created_at', { ascending: false })
      .limit(10);
    labReports = labReportsData;

    const { data: registeredPatients } = await db
      .from('patients')
      .select('patient_seq_id, gender, date_of_birth, blood_group, emergency_contact, contact:contacts(name, phone)')
      .in('id', contactIds);

    if (registeredPatients && registeredPatients.length > 0) {
      hospitalContext += "Registered Patients under this WhatsApp/Phone Number:\n";
      registeredPatients.forEach((p: any) => {
        const contactData = p.contact as any;
        const name = (Array.isArray(contactData) ? contactData[0]?.name : contactData?.name) || 'Unknown';
        const phone = (Array.isArray(contactData) ? contactData[0]?.phone : contactData?.phone) || 'N/A';
        hospitalContext += `- Name: ${name}, Patient ID: ${p.patient_seq_id}, Gender: ${p.gender || 'N/A'}, DOB: ${p.date_of_birth || 'N/A'}, Blood Group: ${p.blood_group || 'N/A'}, Phone: ${phone}, Emergency Contact: ${p.emergency_contact || 'N/A'}\n`;
      });
      hospitalContext += "\n";
    }

    // Fetch last campaign details
    const { data: lastCampaignRec } = await db
      .from('broadcast_recipients')
      .select('id, broadcast_id, broadcasts(*)')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastCampaignRec && lastCampaignRec.broadcasts) {
      const camp = lastCampaignRec.broadcasts as any;
      hospitalContext += `Last Sent Campaign to Patient (within last 7 days):\n`;
      hospitalContext += `- Campaign ID: ${camp.id}\n`;
      hospitalContext += `- Name: ${camp.name}\n`;
      hospitalContext += `- Category: ${camp.category || 'General Announcement'}\n`;
      hospitalContext += `- Message Content: "${camp.message_body || ''}"\n`;
      hospitalContext += `- CTA Configured: ${camp.cta_type || 'none'}\n\n`;
    }

    if (doctors && doctors.length > 0) {
      hospitalContext += "Available Doctors & Clinic Schedules:\n";
      doctors.forEach((d: any) => {
        const days = Array.isArray(d.available_days) ? d.available_days.join(', ') : '';
        const start = d.working_hours?.start || '09:00';
        const end = d.working_hours?.end || '17:00';
        hospitalContext += `- Dr. ${d.name.replace(/^Dr\.\s+/i, '')} (${d.department} - ${d.specialization || 'General'}): Fee: ₹${d.consultation_fee}, Working Days: ${days}, Working Hours: ${start} to ${end}\n`;
      });
    }
    if (branches && branches.length > 0) {
      hospitalContext += "\nClinic Branches Locations:\n";
      branches.forEach((b: any) => {
        hospitalContext += `- ${b.name}: ${b.address || ''} (Phone: ${b.phone || ''})\n`;
      });
    }
    if (appts && appts.length > 0) {
      hospitalContext += "\nPatient's Recent/Upcoming Appointments:\n";
      appts.forEach((a: any) => {
        const patientData = a.patient as any;
        const pName = (Array.isArray(patientData) ? patientData[0]?.name : patientData?.name) || 'Unknown';
        hospitalContext += `- Patient: ${pName}, Date: ${a.appointment_date}, Time: ${a.appointment_time}, Doctor: ${a.doctor?.name || 'Unassigned'}, Status: ${a.status}, Token: #${a.token_number || 'N/A'}, Queue Pos: ${a.queue_position || 'N/A'}\n`;
      });
    }
    if (labReports && labReports.length > 0) {
      hospitalContext += "\nPatient's Lab/Diagnostic Reports:\n";
      labReports.forEach((r: any) => {
        const docData = r.doctor as any;
        const docName = (Array.isArray(docData) ? docData[0]?.name : docData?.name) || 'Doctor';
        const patientData = r.patient as any;
        const pName = (Array.isArray(patientData) ? patientData[0]?.name : patientData?.name) || 'Unknown';
        hospitalContext += `- Patient: ${pName}, Report Name: ${r.test_name}, Department: ${r.department || 'General'}, Referred By: Dr. ${docName.replace(/^Dr\.\s+/i, '')}, Status: ${r.status}, Expected Delivery: ${r.expected_delivery_date || 'N/A'}, Notes: ${r.notes || 'None'}, PDF Available: ${r.report_pdf_url ? 'Yes' : 'No'}\n`;
      });
    }
  }

  // 4. Formulate prompt messages
  const basePrompt = resolveSystemPrompt(
    account.industry,
    account.ai_system_prompt,
  );

  const businessName = account.name || 'Siliguri Nursing Home';

  // Inject system-level rules override to ensure database values override conversation history for patient profiles and actions
  const overrideRules = `

[CRITICAL INSTRUCTION - BUSINESS & SYSTEM OVERRIDE]:
1. BUSINESS IDENTITY: You are the official AI assistant representing "${businessName}". When welcoming a new patient/customer or starting a conversation, you MUST explicitly mention "${businessName}" by name (e.g. "Welcome to *${businessName}*!"). Never use generic phrases like "our Hospital & Clinic" without mentioning "${businessName}".
2. The "Registered Patients under this WhatsApp/Phone Number" list in the Hospital Context contains the absolute, real-time database records for patient registrations.
3. If the name, ID, or details of a patient in the Hospital Context differs from what was mentioned in previous chat history, you MUST ignore the chat history name and use the database name/details from the Hospital Context (e.g. if database says PAT-90325 is "Susanta Lohar", you must output "Susanta Lohar" and NEVER output any other name like "Puja Namata").
4. When asked for the name of a Patient ID (e.g. "PAT-90325"), lookup the ID in the Hospital Context and output the associated name.
5. If a patient wants to correct/edit their profile details (Name, DOB, Mobile, Gender, Blood Group), they must specify their Patient ID (e.g. PAT-90325). Once provided, extract the corrections into "hospital_profile_update" with the fields to update.
6. Never diagnose, recommend treatments/medicines, or interpret report values.
7. SHARED WHATSAPP NUMBER DISAMBIGUATION: Multiple family members (e.g. Father, Mother, Child) may share the exact same WhatsApp number. Each patient has a unique Patient ID (e.g. PAT-000021, PAT-000022). If multiple registered patients exist under this phone number and you cannot confidently identify which patient the user is asking about or booking for, ask: "I found multiple patient profiles linked to this WhatsApp number. Could you please tell me the patient's name?" Once the user specifies the name, switch to that patient profile and continue.`;

  let systemPromptContent = basePrompt + overrideRules;

  if (account.welcome_message && account.welcome_message.trim().length > 0) {
    systemPromptContent += `\n\n[OPTIONAL CUSTOM WELCOME MESSAGE GREETING]:\nIf greeting a new customer or starting a conversation, you may optionally adapt this welcome greeting template:\n"${account.welcome_message.trim()}"\nOtherwise, respond directly according to the customer query and AI System Instructions & Guidelines below.\n`;
  }

  if (kbContext) {
    systemPromptContent += `\n\n${kbContext}`
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

  // Always enforce that the AI responds in the language of the latest customer message
  systemPromptContent += `\n\nCRITICAL LANGUAGE RULE: Always respond in the EXACT same language that the customer used in their latest message (e.g., if they message in Bengali, respond in Bengali; if in Hindi, respond in Hindi; if in English, respond in English). Under no circumstances should you reply in English if the customer's latest message is in another language.`;

  if (latestMessage && latestMessage.content_text) {
    systemPromptContent += `\n\nLanguage Instruction: The customer's latest message is: "${latestMessage.content_text}". You must write your "reply" in the EXACT same language as this message.`;
  }

  // Enforce organized and beautiful formatting with WhatsApp markdown support
  systemPromptContent += `\n\nCRITICAL REPLY FORMATTING RULE: Write the "reply" in a highly organized, clean, and beautiful format.
  - Present lists of options, prices, services, or details in bullet points (using - or *) or numbered lists.
  - Use clear line breaks (\\n) to separate greetings, main details, lists, and the closing call-to-action.
  - Use WhatsApp markdown formatting where helpful (e.g., *bold* for key terms, headings, or pricing; _italics_ for emphasis).
  - Use relevant friendly emojis (like 👋, 😊, 🚀, 💬, ✅, etc.) naturally in the conversation to make the response feel warm, friendly, and visually engaging.
  - Never output walls of plain, unformatted text. Keep it neat, spaced, and easy to read.`;

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
- Set "sales_signal" to true if you detect genuine buying intent, service inquiry, quotation request, booking intent, or any strong sales signal from the customer.
- Under "extracted_lead_info", populate only the fields mentioned by the customer. Use null for any details not mentioned or unknown.`;

  const systemPrompt = {
    role: 'system',
    content: systemPromptContent
  }

  const apiMessages = [
    systemPrompt,
    ...messages
      .map(m => {
        let content = m.content_text || '';
        if (!content && m.content_type) {
          content = `[${m.content_type}]`;
        }
        return {
          role: m.sender_type === 'customer' ? 'user' : 'assistant',
          content: content,
        };
      })
      .filter(m => m.content !== '')
  ]

  // 5. Send request to OpenRouter
  let response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second timeout

    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://wacrm.tech',
        'X-Title': 'wacrm',
      },
      body: JSON.stringify({
        model,
        messages: apiMessages,
        response_format: { type: 'json_object' }, // Ask OpenRouter for JSON format if supported
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    console.warn(`[AI Assistant] Request with model ${model} failed or timed out. Trying fallback model 'google/gemini-2.5-flash'...`, err);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://wacrm.tech',
          'X-Title': 'wacrm',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: apiMessages,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fallbackErr) {
      console.error('[AI Assistant] Both primary model and fallback model failed:', fallbackErr);
      return;
    }
  }

  try {
    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`OpenRouter API error (status ${response.status}): ${errText}`)
    }

    const resJson = await response.json()
    const aiText = resJson.choices?.[0]?.message?.content?.trim()

    if (!aiText) {
      console.warn('[AI Assistant] OpenRouter returned empty response')
      return
    }

    const parsedResponse = parseAiResponse(aiText);
    let reply = parsedResponse.reply || (
      parsedResponse.isStructured
        ? "Sorry, I could not process that response. Please try again."
        : aiText
    );
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

    let hospital_patient_info: any = null;
    let hospital_booking: any = null;
    let hospital_profile_update: any = null;
    let coaching_student_update: any = null;
    let emergency_detected = false;

    if (parsedResponse.payload) {
      const parsed = parsedResponse.payload as Record<string, any>;
      intent = parsed.intent || 'other';
      lead_score = parsed.lead_score || 'cold';
      sentiment = parsed.sentiment || 'neutral';
      handoff_required = !!parsed.handoff_required;
      resolved = !!parsed.resolved;
      summary = parsed.summary || null;
      faq_category = parsed.faq_category || 'general';
      sales_signal = !!parsed.sales_signal;

      const extracted = parsed.extracted_lead_info || {};
      interested_service = extracted.interested_service || null;
      budget = extracted.budget || null;
      timeline = extracted.timeline || null;
      next_action = extracted.next_action || null;

      hospital_patient_info = parsed.hospital_patient_info || null;
      hospital_booking = parsed.hospital_booking || null;
      hospital_profile_update = parsed.hospital_profile_update || null;
      coaching_student_update = parsed.coaching_student_update || null;
      emergency_detected = !!parsed.emergency_detected;
    } else if (parsedResponse.isStructured) {
      console.warn('[AI Assistant] Structured AI response could not be parsed; sending only its recovered reply.');
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
      .eq('id', conversationId)

    if (updateError) {
      console.error('[AI Assistant] Failed to update conversation AI insights:', updateError)
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
            ai_product_service: interested_service || existingDeal.ai_product_service,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingDeal.id);

        if (dealUpdateErr) {
          console.error('[AI Pipeline] Failed to update existing deal:', dealUpdateErr);
        } else {
          console.log('[AI Pipeline] Successfully updated existing Pipeline card:', existingDeal.id);
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
            const newLeadStage = stages.find(s => s.name.toLowerCase() === 'new inquiry' || s.name.toLowerCase() === 'new lead') || stages[0];
            const stageId = newLeadStage.id;



            const contactName = contact?.name || contact?.phone || 'Unknown Client';
            const cardTitle = interested_service ? `${contactName} - ${interested_service}` : `${contactName} - WhatsApp Lead`;

            const { error: dealInsertErr } = await db
              .from('deals')
              .insert({
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
              console.error('[AI Pipeline] Failed to create new deal:', dealInsertErr);
            } else {
              console.log('[AI Pipeline] Successfully created new Pipeline card for contact:', contactId);
            }
          }
        }
      }
    } catch (pipelineErr) {
      console.error('[AI Pipeline] Error during pipeline synchronization:', pipelineErr);
    }

    // Hospital & Clinic Action Processing
    if (isHospitalEnabled) {
      // 1. Emergency Interception
      if (emergency_detected) {
        handoff_required = true;
        reply = `🚨 *EMERGENCY DETECTED:* Please call our emergency clinic staff immediately or go to the nearest ER. We have disabled the AI autopilot for this chat so our agents can step in.`;
      }

      // Resolve the patient by name and number. Family members can share a
      // WhatsApp number, so a different name receives a separate contact.
      let targetContactId = contactId;
      const patientNameProvided = hospital_patient_info?.name || hospital_booking?.patient_name;
      const patientPhoneProvided = hospital_patient_info?.phone || contact?.phone;

      if (patientNameProvided) {
        try {
          // Find a matching patient identity for this phone number.
          const basePhone = patientPhoneProvided.trim();
          const normalizedName = patientNameProvided.trim().toLocaleLowerCase();
          const { data: existingContacts, error: existingContactsError } = await db
            .from('contacts')
            .select('id, name')
            .eq('account_id', accountId)
            .eq('phone', basePhone);

          if (existingContactsError) throw existingContactsError;

          const existingContact = existingContacts?.find((candidate) =>
            candidate.name?.trim().toLocaleLowerCase() === normalizedName,
          ) || existingContacts?.find((candidate) =>
            candidate.id === contactId && !candidate.name,
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
                last_message_at: new Date().toISOString()
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

            const existingMetadata = extContact?.metadata && typeof extContact.metadata === 'object' ? extContact.metadata : {};
            
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
              gender: pGender || extPatient?.gender || existingMetadata.gender || null,
              date_of_birth: pDob || extPatient?.date_of_birth || existingMetadata.dob || null,
              blood_group: pBg || extPatient?.blood_group || existingMetadata.blood_group || null,
              emergency_contact: pEc || extPatient?.emergency_contact || existingMetadata.emergency_contact || null,
              updated_at: new Date().toISOString()
            };

            if (extPatient) {
              await db.from('patients').update(patientData).eq('id', targetContactId);
            } else {
              const { data: createdPatient, error: createPatientError } = await db
                .from('patients')
                .insert(patientData)
                .select('patient_seq_id')
                .single();
              if (createPatientError || !createdPatient?.patient_seq_id) {
                throw createPatientError || new Error('Could not assign a Patient ID');
              }
              seq = createdPatient.patient_seq_id;
            }

            if (!seq) throw new Error('Patient ID is missing');

            const updatedMetadata = {
              ...existingMetadata,
              patient_id: seq,
              gender: pGender || extPatient?.gender || existingMetadata.gender || null,
              dob: pDob || extPatient?.date_of_birth || existingMetadata.dob || null,
              blood_group: pBg || extPatient?.blood_group || existingMetadata.blood_group || null,
              emergency_contact: pEc || extPatient?.emergency_contact || existingMetadata.emergency_contact || null,
            };

            await db.from('contacts').update({
              name: pName || extContact?.name || null,
              metadata: updatedMetadata,
              updated_at: new Date().toISOString()
            }).eq('id', targetContactId);

            console.log('[AI Hospital] Profile successfully updated in contacts metadata and patients table');
          } catch (patErr) {
            console.error('[AI Hospital] Error updating patient demographics:', patErr);
          }
        }
      }

      // 5. Patient Profile self-update via WhatsApp
      if (hospital_profile_update && hospital_profile_update.patient_id) {
        try {
          const pId = hospital_profile_update.patient_id.trim().toUpperCase();
          console.log('[AI Hospital] Patient self-edit requested for ID:', pId);

          // 1. Try finding the patient in the patients table
          const { data: targetPatient } = await db
            .from('patients')
            .select('id, patient_seq_id')
            .eq('account_id', accountId)
            .eq('patient_seq_id', pId)
            .maybeSingle();

          let targetContactId = targetPatient?.id;
          let targetContact = null;

          if (targetContactId) {
            const { data: extContact } = await db
              .from('contacts')
              .select('id, name, address, notes, metadata')
              .eq('id', targetContactId)
              .single();
            targetContact = extContact;
          } else {
            // Fallback: search in contacts table metadata
            const { data: extContact } = await db
              .from('contacts')
              .select('id, name, address, notes, metadata')
              .eq('account_id', accountId)
              .filter('metadata->>patient_id', 'eq', pId)
              .maybeSingle();
            
            targetContact = extContact;
            targetContactId = extContact?.id;
          }

          if (targetContactId && targetContact) {
            const existingMetadata = targetContact.metadata && typeof targetContact.metadata === 'object' ? targetContact.metadata : {};
            const contactUpdates: any = {
              metadata: {
                ...existingMetadata,
                patient_id: pId
              }
            };
            if (hospital_profile_update.name) contactUpdates.name = hospital_profile_update.name.trim();
            if (hospital_profile_update.email) contactUpdates.email = hospital_profile_update.email.trim();
            if (hospital_profile_update.phone) contactUpdates.phone = hospital_profile_update.phone.trim();
            if (hospital_profile_update.address) contactUpdates.address = hospital_profile_update.address.trim();

            if (hospital_profile_update.gender) contactUpdates.metadata.gender = hospital_profile_update.gender;
            if (hospital_profile_update.dob) contactUpdates.metadata.dob = hospital_profile_update.dob;
            if (hospital_profile_update.blood_group) contactUpdates.metadata.blood_group = hospital_profile_update.blood_group.trim();
            if (hospital_profile_update.emergency_contact) contactUpdates.metadata.emergency_contact = hospital_profile_update.emergency_contact.trim();

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
              gender: hospital_profile_update.gender || extPatient?.gender || existingMetadata.gender || null,
              date_of_birth: hospital_profile_update.dob || extPatient?.date_of_birth || existingMetadata.dob || null,
              blood_group: hospital_profile_update.blood_group?.trim() || extPatient?.blood_group || existingMetadata.blood_group || null,
              emergency_contact: hospital_profile_update.emergency_contact?.trim() || extPatient?.emergency_contact || existingMetadata.emergency_contact || null,
              updated_at: new Date().toISOString()
            };

            if (extPatient) {
              await db.from('patients').update(patientData).eq('id', targetContactId);
            } else {
              await db.from('patients').insert(patientData);
            }

            console.log('[AI Hospital] Profile successfully updated in contacts & patients for patient ID:', pId);
          }
        } catch (profileErr) {
          console.error('[AI Hospital] Error updating patient profile self-edit:', profileErr);
        }
      }

      // 5.5 Student target exam self-update via WhatsApp
      if (coaching_student_update) {
        try {
          const sId = coaching_student_update.student_id ? coaching_student_update.student_id.trim().toUpperCase() : null;
          const targetExam = coaching_student_update.target_exam ? coaching_student_update.target_exam.trim() : null;

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
              console.log('[AI Coaching] Updating student exam preparation in metadata for ID:', targetContactIdToUpdate, 'to:', targetExam);
              const { data: extContact } = await db
                .from('contacts')
                .select('metadata')
                .eq('id', targetContactIdToUpdate)
                .single();
              const existingMetadata = extContact?.metadata && typeof extContact.metadata === 'object' ? extContact.metadata : {};

              await db
                .from('contacts')
                .update({
                  metadata: {
                    ...existingMetadata,
                    parent_name: targetExam
                  },
                  updated_at: new Date().toISOString()
                })
                .eq('id', targetContactIdToUpdate);
            }
          }
        } catch (coachingErr) {
          console.error('[AI Coaching] Error updating student target exam:', coachingErr);
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

        const existingMetadata = extContact?.metadata && typeof extContact.metadata === 'object' ? extContact.metadata : {};
        
        const { data: extPatient } = await db
          .from('patients')
          .select('*')
          .eq('id', targetContactId)
          .maybeSingle();

        const pName = hospital_patient_info?.name || patientNameProvided || extContact?.name || contact?.name;
        const pGender = hospital_patient_info?.gender || extPatient?.gender || existingMetadata.gender;
        const pDob = hospital_patient_info?.dob || extPatient?.date_of_birth || existingMetadata.dob;
        const pBg = hospital_patient_info?.blood_group || extPatient?.blood_group || existingMetadata.blood_group;
        const pEc = hospital_patient_info?.emergency_contact || extPatient?.emergency_contact || existingMetadata.emergency_contact;

        if (!pName) {
          reply = "I'm ready to schedule your appointment, but I need your full name first. Could you please reply with your name?";
        } else if (!pGender) {
          reply = "I'm ready to schedule your appointment, but I need to know your gender first (Male/Female/Other). Could you please let me know?";
        } else if (!pDob) {
          reply = "I'm ready to schedule your appointment, but I need your Date of Birth first (YYYY-MM-DD). Could you please provide it?";
        } else if (!doctor_name && !department) {
          reply = "I'm ready to schedule your appointment. Could you please let me know which department you'd like to visit (e.g. Cardiology, Orthopedics, General Medicine)?";
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
            deptDoctors.forEach((doc: any, idx: number) => {
              const days = Array.isArray(doc.available_days) ? doc.available_days.join(', ') : 'All days';
              const start = doc.working_hours?.start || '09:00';
              const end = doc.working_hours?.end || '17:00';
              const fee = doc.consultation_fee || 0;
              doctorList += `${idx + 1}️⃣ *Dr. ${doc.name.replace(/^Dr\.\s+/i, '')}* — Fee: ₹${fee} — ${days} (${start}–${end})\n`;
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
                .ilike('name', `%${doctor_name.replace('Dr.', '').trim()}%`)
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
                campaign_id: campaignIdToAttribute
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
                updated_at: new Date().toISOString()
              };

              if (extPatient) {
                await db.from('patients').update(patientData).eq('id', targetContactId);
              } else {
                const { data: createdPatient, error: createPatientError } = await db
                  .from('patients')
                  .insert(patientData)
                  .select('patient_seq_id')
                  .single();
                if (createPatientError || !createdPatient?.patient_seq_id) {
                  throw createPatientError || new Error('Could not assign a Patient ID');
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

              await db.from('contacts').update({
                name: pName || null,
                metadata: updatedMetadata,
                updated_at: new Date().toISOString()
              }).eq('id', targetContactId);
              const siteUrl = 'https://helpa.studio';
              const pdfUrl = `${siteUrl}/api/appointments/${newAppt.id}/pdf`;
              const bookingIdStr = newAppt.booking_id || `APT-2026-${newAppt.id.slice(0, 5).toUpperCase()}`;

              const displayDoc = actualDocName.startsWith('Dr.') ? actualDocName : 'Dr. ' + actualDocName;
              const displaySpec = actualSpecialization ? ` (${actualSpecialization})` : '';

              reply = `✅ *APPOINTMENT CONFIRMED!*

*Booking ID:* ${bookingIdStr}
*Token Number:* #${newAppt.token_number || 1}
*Queue Position:* ${newAppt.queue_position || 1}
*Doctor:* ${displayDoc}${displaySpec}
*Department:* ${department || 'General Medicine'}
*Date & Time:* ${date} at ${time}

Download your digital ticket PDF:
${pdfUrl}

Please arrive 15 minutes before your time slot. Thank you!`;

              // Automatically send the PDF slip to the patient via WhatsApp
              const { engineSendDocument } = require('@/lib/automations/meta-send');
              engineSendDocument({
                accountId,
                userId,
                conversationId,
                contactId,
                documentUrl: pdfUrl,
                filename: `appointment-${bookingIdStr}.pdf`,
                caption: `Digital Appointment Ticket for ${displayDoc}`
              }).catch((e: any) => console.error('[AI Hospital] Failed to auto-send appointment PDF:', e));
            }
          } catch (apptErr) {
            console.error('[AI Hospital] Error booking appointment via AI:', apptErr);
          }
        }
      }

      // 4. Lab Report Smart Status Assistant
      if (labReports && labReports.length > 0) {
        const lowercaseMsg = (latestMessage?.content_text || '').toLowerCase();
        const reportKeywords = ['report', 'test', 'blood', 'result', 'report status', 'রিপোর্ট', 'रिपोर्ट', 'lab', 'x-ray', 'xray', 'mri', 'ct scan', 'cbc', 'ecg', 'usg', 'ultrasound'];
        const isReportQuery = reportKeywords.some(kw => lowercaseMsg.includes(kw));

        if (isReportQuery) {
          const readyReportsWithPdf = labReports.filter((r: any) => r.status === 'ready' && r.report_pdf_url);
          
          if (readyReportsWithPdf.length === 1) {
            const readyReport = readyReportsWithPdf[0];
            console.log('[AI Hospital] Auto-sending lab report PDF:', readyReport.test_name);
            const { engineSendDocument } = require('@/lib/automations/meta-send');
            engineSendDocument({
              accountId,
              userId,
              conversationId,
              contactId,
              documentUrl: readyReport.report_pdf_url,
              filename: `${readyReport.test_name.replace(/\s+/g, '_')}_Report.pdf`,
              caption: `Here is your completed ${readyReport.test_name} report.`
            }).catch((e: any) => console.error('[AI Hospital] Failed to auto-send lab report PDF:', e));
          } else if (readyReportsWithPdf.length > 1) {
            console.log('[AI Hospital] Multiple ready reports, sending selection buttons');
            const { engineSendButtons } = require('@/lib/automations/meta-send');
            const buttons = readyReportsWithPdf.slice(0, 3).map((r: any) => ({
              id: `report_download_${r.id}`,
              title: r.test_name.substring(0, 20),
            }));
            engineSendButtons({
              accountId,
              userId,
              conversationId,
              contactId,
              bodyText: 'I found multiple reports ready for you. Which one would you like to receive?',
              buttons,
            }).catch((e: any) => console.error('[AI Hospital] Failed to send report buttons:', e));
          }
        }
      }
    }

    // If human handoff is requested, insert system message alert
    if (handoff_required) {
      const { error: systemMsgError } = await db
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_type: 'bot',
          content_type: 'text',
          content_text: '[System Handoff] AI auto-pilot disabled. Human agent takeover requested.',
          message_id: `system-handoff-${conversationId}-${Date.now()}`,
          status: 'delivered',
          created_at: new Date().toISOString(),
        })

      if (systemMsgError) {
        console.error('[AI Assistant] Failed to insert handoff system message:', systemMsgError)
      }
    }

    // 6. Send the generated text back to the customer via WhatsApp and insert it into the DB
    if (isHospitalEnabled && intent === 'booking') {
      const { engineSendButtons } = await import('@/lib/automations/meta-send')
      await engineSendButtons({
        accountId,
        userId,
        conversationId,
        contactId,
        bodyText: reply,
        buttons: [
          { id: 'hospital_btn_book', title: '📅 Book Now' },
          { id: 'hospital_btn_docs', title: '👨‍⚕️ View Doctors' },
          { id: 'hospital_btn_branches', title: '📍 Clinic Sites' }
        ]
      })
    } else {
      await engineSendText({
        accountId,
        userId,
        conversationId,
        contactId,
        text: reply,
      })
    }
    console.log(`[AI Assistant] Successfully sent AI reply to conversation ${conversationId}`)

    // 7. Track successful AI request usage
    await incrementUsage(accountId, 'ai_requests')
  } catch (err) {
    console.error('[AI Assistant] Error calling OpenRouter completions API:', err)
  }
}
