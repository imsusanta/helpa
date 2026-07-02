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
    .select('openrouter_api_key, openrouter_model, ai_system_prompt')
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

  // 4. Formulate prompt messages
  const basePrompt = account.ai_system_prompt || 
    `Use the System Message, Knowledge Base, and Conversation History as your primary sources of information.

Always remember and maintain context from previous messages in the conversation. Use the Conversation History to understand the customer's intent, preferences, and previous interactions.

When business-related information is available in the System Message or Knowledge Base, use that information to answer the customer accurately.

For general conversations such as greetings, thank-you messages, small talk, follow-ups, acknowledgements, or casual interactions, respond naturally using your own conversational abilities without requiring information from the Knowledge Base.

Examples include:
* Hello
* Hi
* Good Morning
* Good Evening
* Thank You
* Okay
* Sounds Good
* Bye
* How are you?

If the requested business information is not available in the System Message, Knowledge Base, or Conversation History, do not make up information. Instead, politely inform the customer that the information is unavailable and suggest contacting a human representative.

Your goal is to provide helpful, natural, context-aware, and human-like conversations while accurately representing the business.`;

  let systemPromptContent = basePrompt
  if (kbContext) {
    systemPromptContent += `\n\n${kbContext}`
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
    "interested_service": "string or null (e.g. 'YouTube SEO', 'E-commerce Website', 'Portfolio Website')",
    "budget": "string or null (e.g. '₹20,000', '$500', or null if not mentioned)",
    "timeline": "string or null (e.g. '2 weeks', 'immediate', or null if not mentioned)",
    "next_action": "string or null (e.g. 'Send quotation', 'Schedule 15-min call', or null)"
  }
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
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
    })

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
        ...(handoff_required ? { ai_chat_enabled: false } : {}),
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
            const newLeadStage = stages.find(s => s.name.toLowerCase() === 'new lead') || stages[0];
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
    await engineSendText({
      accountId,
      userId,
      conversationId,
      contactId,
      text: reply,
    })
    console.log(`[AI Assistant] Successfully sent AI reply to conversation ${conversationId}`)

    // 7. Track successful AI request usage
    await incrementUsage(accountId, 'ai_requests')
  } catch (err) {
    console.error('[AI Assistant] Error calling OpenRouter completions API:', err)
  }
}
