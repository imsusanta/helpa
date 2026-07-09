import { decrypt } from '@/lib/whatsapp/encryption'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { engineSendText } from '@/lib/automations/meta-send'
import { checkPlanLimits, incrementUsage } from '@/lib/saas/subscription'

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

  // 1. Fetch OpenRouter configuration from accounts
  const { data: account, error: accError } = await db
    .from('accounts')
    .select('openrouter_api_key, openrouter_model, ai_system_prompt, industry')
    .eq('id', accountId)
    .single()

  if (accError || !account?.openrouter_api_key) {
    console.warn('[AI Assistant] OpenRouter credentials not configured for account:', accountId)
    return
  }

  // 2. Decrypt API key
  let apiKey: string
  try {
    apiKey = decrypt(account.openrouter_api_key)
  } catch (err) {
    console.error('[AI Assistant] Failed to decrypt OpenRouter API Key:', err)
    return
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

  const isHospitalEnabled = true;
  let hospitalContext = "";
  let labReports: any[] | null = null;
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
      .select('*, doctor:hospital_doctors(name)')
      .eq('patient_id', contactId)
      .order('appointment_date', { ascending: false })
      .limit(3);

    const { data: labReportsData } = await db
      .from('hospital_lab_reports')
      .select('id, test_name, status, expected_delivery_date, report_pdf_url, notes, department, doctor:hospital_doctors(name)')
      .eq('patient_id', contactId)
      .order('created_at', { ascending: false })
      .limit(10);
    labReports = labReportsData;

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
        hospitalContext += `- Dr. ${d.name.replace(/^Dr\.\s+/i, '')} (${d.department} - ${d.specialization || 'General'}): Fee: $${d.consultation_fee / 100}, Working Days: ${days}, Working Hours: ${start} to ${end}\n`;
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
        hospitalContext += `- Date: ${a.appointment_date}, Time: ${a.appointment_time}, Doctor: ${a.doctor?.name || 'Unassigned'}, Status: ${a.status}, Token: #${a.token_number || 'N/A'}, Queue Pos: ${a.queue_position || 'N/A'}\n`;
      });
    }
    if (labReports && labReports.length > 0) {
      hospitalContext += "\nPatient's Lab/Diagnostic Reports:\n";
      labReports.forEach((r: any) => {
        const docData = r.doctor as any;
        const docName = (Array.isArray(docData) ? docData[0]?.name : docData?.name) || 'Doctor';
        hospitalContext += `- Report Name: ${r.test_name}, Department: ${r.department || 'General'}, Referred By: Dr. ${docName.replace(/^Dr\.\s+/i, '')}, Status: ${r.status}, Expected Delivery: ${r.expected_delivery_date || 'N/A'}, Notes: ${r.notes || 'None'}, PDF Available: ${r.report_pdf_url ? 'Yes' : 'No'}\n`;
      });
    }
  }

  // 4. Formulate prompt messages
  const { getIndustryModule } = require('@/modules/registry');
  const activeModule = getIndustryModule(account?.industry);
  
  const basePrompt = account.ai_system_prompt || activeModule.systemPrompt ||
    `Use the System Message, Knowledge Base, and Conversation History as your primary sources of information.

Always remember and maintain context from previous messages in the conversation. Use the Conversation History to understand the customer's intent, preferences, and previous interactions.

When business-related information is available in the System Message or Knowledge Base, use that information to answer the customer accurately.

For general conversations such as greetings, thank-you messages, small talk, follow-ups, acknowledgements, or casual interactions, respond naturally using your own conversational abilities without requiring information from the Knowledge Base.

If the requested business information is not available in the System Message, Knowledge Base, or Conversation History, do not make up information. Instead, politely inform the customer that the information is unavailable and suggest contacting a human representative.

Your goal is to provide helpful, natural, context-aware, and human-like conversations while accurately representing the business.`;

  let systemPromptContent = basePrompt
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
     - *Gender:* [Male/Female/Other]
     - *Date of Birth:* [YYYY-MM-DD]
     - *Blood Group:* [e.g. O+, A-]
     - *Emergency Contact:* [Name & Phone]
     
     (You can also specify your preferred Doctor or Department, and preferred Date & Time in your reply)
   - Do NOT confirm the appointment booking until you have collected at least their Name, Gender, and DOB.
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
    "gender": "Male | Female | Other | null",
    "dob": "YYYY-MM-DD string or null",
    "blood_group": "string or null",
    "emergency_contact": "string or null"
  },
  "hospital_booking": {
    "action": "book | reschedule | cancel | null",
    "doctor_name": "string or null",
    "department": "string or null",
    "date": "YYYY-MM-DD string or null",
    "time": "HH:MM string or null"
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

    // Sanitize LLM response from potential markdown code fences
    let cleanedText = aiText;
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```(json)?/, '').trim();
      cleanedText = cleanedText.replace(/```$/, '').trim();
    }

    let reply = cleanedText;
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
    let emergency_detected = false;

    try {
      const parsed = JSON.parse(cleanedText);
      reply = parsed.reply || cleanedText;
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
      emergency_detected = !!parsed.emergency_detected;
    } catch (err) {
      console.warn('[AI Assistant] Failed to parse structured JSON from response, falling back to plain text reply:', err);
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

            const { data: contact } = await db
              .from('contacts')
              .select('name, phone')
              .eq('id', contactId)
              .single();

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

      // 2. Patient Profile Creation / Update
      if (hospital_patient_info) {
        const pName = hospital_patient_info.name;
        const pGender = hospital_patient_info.gender;
        const pDob = hospital_patient_info.dob;
        const pBg = hospital_patient_info.blood_group;
        const pEc = hospital_patient_info.emergency_contact;

        if (pName || pGender || pDob || pBg || pEc) {
          try {
            const { data: extPatient } = await db
              .from('patients')
              .select('patient_seq_id, gender, date_of_birth, blood_group, emergency_contact')
              .eq('id', contactId)
              .maybeSingle();

            const seq = extPatient?.patient_seq_id || `PAT-${Date.now().toString().slice(-5)}`;

            await db.from('patients').upsert({
              id: contactId,
              account_id: accountId,
              patient_seq_id: seq,
              gender: pGender || extPatient?.gender || null,
              date_of_birth: pDob || extPatient?.date_of_birth || null,
              blood_group: pBg || extPatient?.blood_group || null,
              emergency_contact: pEc || extPatient?.emergency_contact || null,
              ai_summary: summary,
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' });
          } catch (patErr) {
            console.error('[AI Hospital] Error updating patient demographics:', patErr);
          }
        }
      }

      // 3. Appointment Booking via Chat
      if (hospital_booking && hospital_booking.action === 'book') {
        const { doctor_name, department, date, time } = hospital_booking;
        if (date && time) {
          try {
            let doctorId: string | null = null;
            if (doctor_name) {
              const { data: doc } = await db
                .from('hospital_doctors')
                .select('id')
                .eq('account_id', accountId)
                .ilike('name', `%${doctor_name.replace('Dr.', '').trim()}%`)
                .maybeSingle();
              doctorId = doc?.id || null;
            }

            // Campaign attribution: find last campaign received in last 7 days
            let campaignIdToAttribute: string | null = null;
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            const { data: recentCampaignRec } = await db
              .from('broadcast_recipients')
              .select('broadcast_id')
              .eq('contact_id', contactId)
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
                patient_id: contactId,
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
              const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://wacrmsusanta.vercel.app';
              const pdfUrl = `${siteUrl}/api/appointments/${newAppt.id}/pdf`;
              const bookingIdStr = newAppt.booking_id || `APT-2026-${newAppt.id.slice(0, 5).toUpperCase()}`;

              reply = `✅ *APPOINTMENT CONFIRMED!*

*Booking ID:* ${bookingIdStr}
*Token Number:* #${newAppt.token_number || 1}
*Queue Position:* ${newAppt.queue_position || 1}
*Doctor:* ${doctor_name || 'On-Duty'}
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
                caption: `Digital Appointment Ticket for ${doctor_name || 'Clinic'}`
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
