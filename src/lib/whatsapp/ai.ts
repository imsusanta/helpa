import {
  isEmergencyQuery,
  isDiagnosticRequest,
  containsPromptInjection,
  sanitizeAiInput,
} from '@/lib/ai/safety';
import { logger } from '@/lib/observability/logger';
import { getAdminClient } from '@/lib/db/server';
import {
  engineSendText,
  engineSendDocument,
  engineSendButtons,
} from '@/lib/automations/meta-send';
import { checkPlanLimits, incrementUsage } from '@/lib/saas/subscription';
import { getIndustryModule } from '@/modules/registry';
import { parseAiResponse } from '@/lib/whatsapp/ai-response';
import { buildReceptionistSystemPrompt } from '@/lib/whatsapp/ai-prompt';
import {
  buildContactPhoneVariants,
  extractStructuredInsights,
  formatKnowledgeBaseContext,
  isHospitalIndustryEnabled,
  unansweredCustomerTurn,
  shouldSkipAiConversation,
  unwrapNestedReply,
  type HistoryMessage,
} from '@/lib/whatsapp/ai-pipeline';
import {
  buildIndustryAiContext,
  type LabReportRow,
} from '@/lib/whatsapp/ai-context';
import {
  syncDealPipeline,
  updateConversationInsights,
} from '@/lib/whatsapp/ai-crm-sync';
import { applyDetectionToLead } from '@/lib/leads/inbound-lead-layer';
import { getAccountChatbotSettings } from '@/core/ai/chatbot-settings';
import {
  retrievePackagesForAi,
  formatPackagesForAiContext,
  revalidatePackageForProposal,
  generateProposalSnapshot,
} from '@/modules/travel/package-service';

import {
  executeAiCompletionWithFallback,
  resolveAccountAiConfig,
} from '@/core/ai/resolver';

interface TriggerAiResponseArgs {
  accountId: string;
  userId: string;
  conversationId: string;
  contactId: string;
  inboundMessageId?: string | null;
}

export async function triggerAiResponse(
  args: TriggerAiResponseArgs
): Promise<void> {
  const { accountId, userId, conversationId, contactId, inboundMessageId } =
    args;

  // Check SaaS subscription limits before running any AI requests
  try {
    const limitCheck = await checkPlanLimits(accountId, 'max_ai_requests');
    if (!limitCheck.allowed) {
      console.warn(
        '[AI Assistant] Limit check reached for account:',
        accountId,
        limitCheck.reason
      );
      return;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[AI Assistant] Limit check warning, continuing:', msg);
  }

  const db = getAdminClient();

  // ═══════ PHASE 1: Parallel fetch all independent data in one shot ═══════
  const [contactRes, accRes, convRes, messagesRes, kbRes] = await Promise.all([
    db.from('contacts').select('*').eq('id', contactId).maybeSingle(),
    db
      .from('accounts')
      .select(
        'ai_provider, ai_fallback_provider, openrouter_api_key, openrouter_model, orcarouter_api_key, orcarouter_model, ai_system_prompt, welcome_message, industry, name'
      )
      .eq('id', accountId)
      .single(),
    db.from('conversations').select('*').eq('id', conversationId).maybeSingle(),
    db
      .from('messages')
      .select(
        'id, sender_type, content_type, content_text, created_at, reply_to_message_id'
      )
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(50),
    db
      .from('knowledge_base')
      .select('category, question_title, answer_content')
      .eq('account_id', accountId),
  ]);

  const conversation = convRes.data as Record<string, unknown> | null;
  const skipDecision = shouldSkipAiConversation(conversation);
  if (skipDecision.skip) {
    if (skipDecision.reason === 'assigned') {
      console.log(
        `[AI Assistant] Conversation ${conversationId} is assigned to a human agent. Skipping AI response.`
      );
    } else if (skipDecision.reason === 'disabled') {
      console.log(
        `[AI Assistant] AI auto-reply is disabled for conversation ${conversationId}. Skipping AI response.`
      );
    } else {
      console.warn(
        `[AI Assistant] Conversation ${conversationId} reached AI reply cap. Skipping AI response.`
      );
    }
    return;
  }

  // Account-level master switch for the AI chatbot (auto-reply). Stored in
  // system_settings (see src/core/ai/chatbot-settings.ts); a missing/unset
  // value defaults to enabled, so existing workspaces are unaffected until
  // they explicitly turn the bot off from the Chatbot page.
  const chatbotSettings = await getAccountChatbotSettings(accountId, db);
  if (!chatbotSettings.enabled) {
    console.log(
      `[AI Assistant] Chatbot master switch is OFF for account ${accountId}. Skipping AI response.`
    );
    return;
  }

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

  // 3. Normalize pre-fetched messages with fallback if empty or error
  let rawMessages = messagesRes.data as Array<Record<string, unknown>> | null;
  const msgError = messagesRes.error;

  if (msgError || !rawMessages || rawMessages.length === 0) {
    try {
      const fallbackMsg = await db
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (fallbackMsg.data && fallbackMsg.data.length > 0) {
        rawMessages = fallbackMsg.data as Array<Record<string, unknown>>;
      }
    } catch {
      // ignore
    }
  }

  const mapHistoryMessage = (m: Record<string, unknown>): HistoryMessage => ({
    id: String(m.id || ''),
    sender_type: String(m.sender_type || m.senderType || 'customer'),
    content_type: String(m.content_type || m.contentType || 'text'),
    content_text: String(m.content_text || m.contentText || ''),
    created_at: String(m.created_at || m.createdAt || new Date().toISOString()),
    reply_to_message_id: String(
      m.reply_to_message_id || m.replyToMessageId || ''
    ),
  });

  const messages = (rawMessages || []).map(mapHistoryMessage);

  if (messages.length === 0 && !inboundMessageId) {
    console.error(
      '[AI Assistant] Failed to fetch message history or no messages found:',
      msgError
    );
    return;
  }

  let turn = unansweredCustomerTurn(messages, inboundMessageId);
  if (turn.missingInbound && inboundMessageId) {
    try {
      let inboundRow: Record<string, unknown> | null = null;
      const byId = await db
        .from('messages')
        .select(
          'id, sender_type, content_type, content_text, created_at, reply_to_message_id'
        )
        .eq('id', inboundMessageId)
        .maybeSingle();
      if (byId.data) inboundRow = byId.data as Record<string, unknown>;
      if (!inboundRow) {
        const byStar = await db
          .from('messages')
          .select('*')
          .eq('id', inboundMessageId)
          .maybeSingle();
        if (byStar.data) inboundRow = byStar.data as Record<string, unknown>;
      }
      if (inboundRow) {
        messages.unshift(mapHistoryMessage(inboundRow));
        turn = unansweredCustomerTurn(messages, inboundMessageId);
      }
    } catch {
      turn = unansweredCustomerTurn(messages);
    }
  }

  const unansweredCustomer = turn.message;
  if (!unansweredCustomer) {
    console.warn(
      '[AI Assistant] No unanswered customer message in recent history. Skipping AI response. Newest sender:',
      messages[0]?.sender_type
    );
    return;
  }

  // Answer this inbound turn, not whichever row happens to have the newest
  // created_at. Persist with server time so the bubble lands at the bottom
  // of the inbox thread (inbound uses WhatsApp timestamps).
  const latestMessage = unansweredCustomer;

  const aiSendBase = {
    accountId,
    userId,
    conversationId,
    contactId,
    replyToMessageId: unansweredCustomer.id || null,
  };

  const rawUserText = unansweredCustomer.content_text || '';

  // 🛡️ AI SAFETY & HEALTHCARE GUARDRAILS (Production Module: src/lib/ai/safety.ts)
  if (isEmergencyQuery(rawUserText)) {
    logger.warn('Emergency intent detected', {
      component: 'ai-safety',
      accountId,
      correlationId: conversationId,
      classification: 'emergency',
    });
    await engineSendText({
      ...aiSendBase,
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
      ...aiSendBase,
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
  const phoneVariants = buildContactPhoneVariants(rawPhone);

  let siblingContacts: { id: string }[] | null = null;
  if (phoneVariants.length > 0) {
    try {
      const res = await db
        .from('contacts')
        .select('id')
        .in('phone', phoneVariants);
      siblingContacts = Array.isArray(res.data)
        ? (res.data as { id: string }[])
        : [];
    } catch {
      // ignore
    }
  }

  const contactIds = Array.from(
    new Set(
      [
        contactId,
        ...(Array.isArray(siblingContacts) ? siblingContacts : []).map(
          (c: { id: string }) => c.id
        ),
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
  const kbEntries = kbRes.data as Array<{
    category: string;
    question_title: string;
    answer_content: string;
  }> | null;
  const kbContext = formatKnowledgeBaseContext(kbEntries);

  const industryModuleForContext = getIndustryModule(account?.industry);
  const isHospitalEnabled = isHospitalIndustryEnabled(
    account?.industry,
    industryModuleForContext.id
  );
  const isCoachingEnabled = industryModuleForContext.id === 'coaching';
  const isSoloTeacherEnabled = industryModuleForContext.id === 'solo_teacher';
  const entityLabelForContext =
    industryModuleForContext.entityConfigs?.contacts?.label || 'Contact';

  const { hospitalContext, coachingContext, labReports } =
    await buildIndustryAiContext(db, {
      accountId,
      contactId,
      contactIds,
      allPatientAndContactIds,
      isHospitalEnabled,
      isCoachingEnabled,
      isSoloTeacherEnabled,
      entityLabel: entityLabelForContext,
    });

  let travelContext = '';
  let travelPackageFallbackMessage: string | null = null;
  const currentIndustry = (account?.industry || '').toLowerCase().trim();
  const isTravelEnabled =
    industryModuleForContext.id === 'travel' ||
    currentIndustry === 'travel' ||
    currentIndustry === 'tour' ||
    currentIndustry === 'tourism';

  if (isTravelEnabled) {
    try {
      const userText = latestMessage?.content_text || '';
      const structuredPackages = await retrievePackagesForAi(
        accountId,
        userText
      );
      const { context: pkgContext, fallbackMessage } =
        formatPackagesForAiContext(structuredPackages, userText);
      if (pkgContext) {
        travelContext += pkgContext;
      }
      travelPackageFallbackMessage = fallbackMessage;
    } catch (pkgErr) {
      console.warn('[AI Travel] Structured package retrieval error:', pkgErr);
    }
  }

  // 4. Formulate prompt messages
  let systemPromptContent = buildReceptionistSystemPrompt({
    industry: account?.industry,
    customSystemPrompt: account?.ai_system_prompt,
    businessName: account?.name || 'our Business',
    welcomeMessage: account?.welcome_message,
    responseStyle: chatbotSettings.responseStyle,
    kbContext,
    hospitalContext,
    coachingContext,
    isHospitalEnabled,
    isCoachingEnabled,
    latestCustomerText: latestMessage?.content_text || null,
  });

  if (isTravelEnabled && travelContext) {
    systemPromptContent += `\n\n=== TRAVEL AGENCY & TOUR PACKAGES SYSTEM CONTEXT ===\n${travelContext}
${travelPackageFallbackMessage ? `[NO-MATCH FALLBACK]: ${travelPackageFallbackMessage}\n` : ''}
You are acting as the official AI Travel Receptionist and Tour Consultant for "${account?.name || 'our Business'}".
Your primary role is to answer traveler inquiries 24/7, quote tour packages, explain itineraries, duration, hotel accommodations, pricing in ₹, transport options, and help travelers book active trips.

AI RULES & TRAVEL CONSULTATION PROTOCOLS:
1. **STRICT PACKAGE GROUNDING (CRITICAL)**:
   - The "STRUCTURED TOUR PACKAGE DATABASE" section above is the SINGLE SOURCE OF TRUTH for all company-specific package facts.
   - When asked about packages, prices, itineraries, inclusions, or durations, you MUST ONLY quote information that exists in the database above.
   - If a specific package or destination appears in the "Day-by-Day Itinerary" section, include those itinerary details in your response.
   - If the database section includes "Upcoming Departures", mention available dates and remaining seats.
   - NEVER fabricate, assume, or invent any package names, prices, itineraries, hotel names, or durations that are not explicitly listed in the database above.
   - If a requested destination is NOT in the database, use the exact NO-MATCH FALLBACK message and offer to connect them with a human travel specialist. Do NOT make up a package.
2. **ACCURATE PACKAGE & PRICING REPRESENTATION**:
   - Always reply with genuine package details (Destination, Duration in Days, Price in ₹ per person, and Inclusions) from the structured database above.
   - When asked about packages (e.g. "What packages do you have?", "Darjeeling package price?", "Kashmir tour details"), list matching packages clearly with their Name, Destination, Duration, Price, Inclusions, and Itinerary highlights.
3. **CONFIRM TOUR BOOKING & PROPOSAL**:
   - When the traveler expresses interest in a package, provide the package summary. When they explicitly confirm booking, extract travel_booking with action "book".
4. **MULTILINGUAL COMMUNICATION**:
   - Always reply in the exact language and script/style the traveler messages in (Bengali / বাংলা, Banglish, Hindi / हिंदी, Hinglish, English, etc.).`;
  }

  const systemPrompt: { role: 'system'; content: string } = {
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
            role: (m.sender_type === 'customer' ? 'user' : 'assistant') as
              'user' | 'assistant',
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
        maxTokens: 1200,
        responseFormat: { type: 'json_object' },
      },
      resolutionParams: {
        accountId,
        feature: 'AI_REPLY',
        conversationId,
      },
    });
  } catch (err) {
    console.warn(
      '[AI Assistant] Structured JSON completion failed, retrying with raw text completion:',
      err
    );
    try {
      completion = await executeAiCompletionWithFallback({
        messages: apiMessages,
        options: {
          temperature: 0.2,
          maxTokens: 1200,
        },
        resolutionParams: {
          accountId,
          feature: 'AI_REPLY',
          conversationId,
        },
      });
    } catch (rawErr) {
      console.error(
        '[AI Assistant] Both structured and raw AI completion failed:',
        rawErr
      );
      return;
    }
  }

  const aiText = (
    completion.content ||
    (completion as unknown as { text?: string }).text ||
    ''
  ).trim();
  if (!aiText) {
    console.warn('[AI Assistant] AI Engine returned empty response');
    return;
  }

  try {
    const parsedResponse = parseAiResponse(aiText);
    let reply =
      parsedResponse.reply ||
      (!parsedResponse.isStructured ? aiText : '') ||
      aiText;
    reply = unwrapNestedReply(reply);

    const insights = extractStructuredInsights(parsedResponse.payload);
    const travel_booking =
      (parsedResponse.payload?.travel_booking as Record<string, unknown>) ||
      null;
    const travel_package_selection =
      (parsedResponse.payload?.travel_package_selection as Record<
        string,
        unknown
      >) || null;
    const realestate_visit =
      (parsedResponse.payload?.realestate_visit as Record<string, unknown>) ||
      null;
    if (!parsedResponse.payload && parsedResponse.isStructured) {
      console.warn(
        '[AI Assistant] Structured AI response could not be parsed; sending only its recovered reply.'
      );
    }

    const intent = insights.intent;
    let handoff_required = insights.handoffRequired;
    const hospital_patient_info = insights.hospitalPatientInfo;
    const hospital_booking = insights.hospitalBooking;
    const hospital_profile_update = insights.hospitalProfileUpdate;
    const hospital_report_send = insights.hospitalReportSend;
    const coaching_student_update = insights.coachingStudentUpdate;
    const emergency_detected = insights.emergencyDetected;

    await updateConversationInsights(db, { conversationId, insights });
    await syncDealPipeline(db, {
      accountId,
      userId,
      conversationId,
      contactId,
      contact,
      insights,
    });
    try {
      const latestInbound = messages.find((m) => m.sender_type === 'customer');
      await applyDetectionToLead(
        {
          accountId,
          userId,
          conversationId,
          contactId,
          messageId:
            latestInbound?.id ||
            `ai:${conversationId}:${latestInbound?.created_at || 'latest'}`,
          messageText: latestInbound?.content_text || '',
          contactName: contact?.name ?? null,
          contactPhone: contact?.phone ?? null,
          industry: account?.industry ?? accData?.industry ?? null,
          assignedAgentId:
            (conversation?.assigned_agent_id as string | null) || null,
          aiDisabled:
            conversation?.ai_chat_enabled === false ||
            conversation?.ai_autoreply_disabled === true,
        },
        insights,
        db
      );
    } catch (leadErr) {
      console.error('[AI Assistant] lead detection layer failed:', leadErr);
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
                ...aiSendBase,
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
              ...aiSendBase,
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
              ...aiSendBase,
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

    // Travel Package Automation (Structured Grounding & Proposal / Booking)
    const travelAction = (travel_package_selection?.action ||
      travel_booking?.action) as string | undefined;
    if (
      travelAction &&
      ['book', 'quote', 'inquire', 'select'].includes(travelAction)
    ) {
      try {
        const tName =
          (travel_package_selection?.traveler_name as string) ||
          (travel_booking?.traveler_name as string) ||
          contact?.name;
        const requestedPkgId =
          (travel_package_selection?.package_id as string) || undefined;
        const requestedDepId =
          (travel_package_selection?.departure_id as string) || undefined;
        const pNameOrDest = String(
          travel_booking?.package_name ||
            travel_booking?.destination ||
            travel_package_selection?.destination ||
            ''
        ).trim();
        const travelDate =
          (travel_package_selection?.travel_date as string) ||
          (travel_booking?.travel_date as string) ||
          new Date().toISOString().split('T')[0];
        const guestsCount =
          Number(
            travel_package_selection?.guests_count ||
              travel_booking?.guests_count
          ) || 1;

        let verifiedPkg: Record<string, unknown> | null = null;

        // 1. Try finding package by exact ID if provided
        if (requestedPkgId) {
          const { data: pkgById } = await db
            .from('travel_packages')
            .select('*')
            .eq('id', requestedPkgId)
            .eq('account_id', accountId)
            .maybeSingle();
          if (pkgById) {
            verifiedPkg = pkgById as Record<string, unknown>;
          }
        }

        // 2. If not found by ID, search by name / destination
        if (!verifiedPkg && pNameOrDest) {
          const { data: matchedPackages } = await db
            .from('travel_packages')
            .select('*')
            .eq('account_id', accountId)
            .eq('status', 'published')
            .or(
              `name.ilike.%${pNameOrDest}%,destination.ilike.%${pNameOrDest}%,package_code.ilike.%${pNameOrDest}%`
            )
            .limit(1);

          if (matchedPackages && matchedPackages.length > 0) {
            verifiedPkg = matchedPackages[0] as Record<string, unknown>;
          }
        }

        if (verifiedPkg) {
          const packageId = String(verifiedPkg.id);
          let unitPrice =
            Number(verifiedPkg.base_price ?? verifiedPkg.price) || 0;

          // If departure batch requested, re-validate price and availability
          if (requestedDepId) {
            const { data: dep } = await db
              .from('tour_package_departures')
              .select('*')
              .eq('id', requestedDepId)
              .eq('account_id', accountId)
              .maybeSingle();
            if (
              dep &&
              dep.departure_price !== null &&
              dep.departure_price !== undefined
            ) {
              unitPrice = Number(dep.departure_price);
            }
          }

          // A. Proposal / Quotation Generation
          if (
            travelAction === 'quote' ||
            intent === 'sales' ||
            intent === 'booking'
          ) {
            const fullPkgDetails = await revalidatePackageForProposal(
              accountId,
              packageId
            );
            if (fullPkgDetails) {
              const snapshot = generateProposalSnapshot(
                fullPkgDetails,
                requestedDepId
              );
              const propNum = `PROP-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
              const basePrice = unitPrice * guestsCount;
              const { data: newProposal, error: propErr } = await db
                .from('trip_proposals')
                .insert({
                  account_id: accountId,
                  contact_id: contactId,
                  package_id: packageId,
                  proposal_number: propNum,
                  title: `${fullPkgDetails.name} - ${fullPkgDetails.destination}`,
                  destination: fullPkgDetails.destination,
                  duration_days: fullPkgDetails.duration_days,
                  duration_nights:
                    fullPkgDetails.duration_nights ||
                    Math.max(1, fullPkgDetails.duration_days - 1),
                  adults_count: guestsCount,
                  base_price: basePrice,
                  total_price: basePrice,
                  currency: fullPkgDetails.currency || 'INR',
                  inclusions: Array.isArray(fullPkgDetails.inclusions)
                    ? fullPkgDetails.inclusions
                    : [],
                  exclusions: Array.isArray(fullPkgDetails.exclusions)
                    ? fullPkgDetails.exclusions
                    : [],
                  itinerary: fullPkgDetails.itinerary || [],
                  hotel_details: fullPkgDetails.hotel_details
                    ? typeof fullPkgDetails.hotel_details === 'string'
                      ? fullPkgDetails.hotel_details
                      : JSON.stringify(fullPkgDetails.hotel_details)
                    : null,
                  transport_details: fullPkgDetails.transport_details
                    ? typeof fullPkgDetails.transport_details === 'string'
                      ? fullPkgDetails.transport_details
                      : JSON.stringify(fullPkgDetails.transport_details)
                    : null,
                  terms: fullPkgDetails.terms_and_conditions || null,
                  status: 'draft',
                  start_date: (snapshot.departure_date as string) || travelDate,
                  end_date: (snapshot.departure_end_date as string) || null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .select('id, proposal_number')
                .maybeSingle();

              if (propErr) {
                console.warn('[AI Travel] Proposal generation note:', propErr);
              } else if (newProposal) {
                console.log(
                  '[AI Travel] Successfully created trip proposal from DB snapshot:',
                  newProposal.proposal_number
                );
              }
            }
          }

          // B. Deterministic Booking Confirmation Guard (State Machine)
          const userRawText = (latestMessage?.content_text || '')
            .trim()
            .toLowerCase();
          const enConfirm =
            /\b(confirm|yes confirm|please confirm|proceed with booking|proceed|book it|book this|book now|book this package|confirm booking)\b/i.test(
              userRawText
            );
          const bnConfirm =
            /(হ্যাঁ কনফার্ম|হাঁ কনফার্ম|কনফার্ম করুন|বুক করুন|বুক করে দিন|বুকিং কনফার্ম)/.test(
              userRawText
            );
          const isExplicitConfirmation = enConfirm || bnConfirm;

          // Check if there is an existing proposal or pending quote for this contact & package
          const { data: existingProposals } = await db
            .from('trip_proposals')
            .select('id, base_price, total_price, status')
            .eq('account_id', accountId)
            .eq('contact_id', contactId)
            .eq('package_id', packageId)
            .order('created_at', { ascending: false })
            .limit(1);

          const hasPendingProposal =
            existingProposals && existingProposals.length > 0;

          if (
            travelAction === 'book' &&
            isExplicitConfirmation &&
            hasPendingProposal &&
            travelDate
          ) {
            // Check departure availability if departureId is supplied
            let departureAvailable = true;
            if (requestedDepId) {
              const { data: depCheck } = await db
                .from('tour_package_departures')
                .select('available_seats, status')
                .eq('id', requestedDepId)
                .eq('account_id', accountId)
                .maybeSingle();

              if (
                !depCheck ||
                depCheck.status !== 'scheduled' ||
                (depCheck.available_seats !== null &&
                  depCheck.available_seats < guestsCount)
              ) {
                departureAvailable = false;
                console.warn(
                  '[AI Travel] Booking rejected: Departure batch is sold out, cancelled, or has insufficient seats.'
                );
              }
            }

            if (departureAvailable) {
              const totalPrice = unitPrice * guestsCount;
              const { data: newBooking, error: bookErr } = await db
                .from('travel_bookings')
                .insert({
                  account_id: accountId,
                  package_id: packageId,
                  contact_id: contactId,
                  travel_date: travelDate,
                  guests_count: guestsCount,
                  total_price: totalPrice,
                  status: 'Pending',
                  idempotency_key: `booking_${contactId}_${packageId}_${travelDate}`,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .select('id')
                .single();

              if (bookErr) {
                console.error('[AI Travel] Booking insert error:', bookErr);
              } else {
                console.log(
                  '[AI Travel] Successfully created pending booking upon customer confirmation:',
                  newBooking?.id
                );
              }
            }
          }

          if (tName && !contact?.name) {
            await db
              .from('contacts')
              .update({ name: tName })
              .eq('id', contactId)
              .eq('account_id', accountId);
          }
        } else {
          console.warn(
            '[AI Travel] No verified package found in DB for query:',
            pNameOrDest || requestedPkgId
          );
        }
      } catch (travelErr) {
        console.error('[AI Travel] Error handling travel action:', travelErr);
      }
    }

    // Real Estate Site Visit Automation
    if (realestate_visit && realestate_visit.action === 'schedule') {
      try {
        const propName = String(
          realestate_visit.property_name || 'Property Visit'
        );
        const vDate =
          (realestate_visit.visit_date as string) ||
          new Date().toISOString().split('T')[0];
        const vTime = (realestate_visit.visit_time as string) || '11:00 AM';
        const bName = (realestate_visit.buyer_name as string) || contact?.name;

        await db.from('appointments').insert({
          account_id: accountId,
          patient_id: contactId,
          department_name: propName,
          appointment_date: vDate,
          appointment_time: vTime,
          status: 'Confirmed',
          notes: `Site visit: ${propName} for ${bName || 'Buyer'}`,
          created_at: new Date().toISOString(),
        });
      } catch (reErr) {
        console.error('[AI RealEstate] Error scheduling site visit:', reErr);
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
      try {
        const { engineSendButtons } =
          await import('@/lib/automations/meta-send');
        await engineSendButtons({
          ...aiSendBase,
          bodyText: reply.substring(0, 1024),
          buttons: [
            { id: 'hospital_btn_book', title: '📅 Book Now' },
            { id: 'hospital_btn_docs', title: '👨‍⚕️ View Doctors' },
            { id: 'hospital_btn_branches', title: '📍 Clinic Sites' },
          ],
        });
      } catch (btnErr) {
        console.warn(
          '[AI Assistant] Button dispatch failed, falling back to text:',
          btnErr
        );
        await engineSendText({
          ...aiSendBase,
          text: reply,
        });
      }
    } else {
      await engineSendText({
        ...aiSendBase,
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
