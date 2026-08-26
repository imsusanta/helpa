import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { resolveSystemPrompt } from '@/modules/registry';
import { applyAiSafety } from '@/lib/ai/safety';
import { executeAiCompletionWithFallback } from '@/core/ai/resolver';
import { checkPlanLimits, incrementUsage } from '@/lib/saas/subscription';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    // AI Assistant actions generate content and consume AI quota, so they
    // require at least the 'agent' role — viewers are read-only and cannot
    // invoke them. account_members is the canonical membership source, and
    // requireRole resolves the effective account role from it.
    const ctx = await requireRole('agent');
    const appwrite = ctx.appwrite;

    if (!appwrite) {
      throw new Error('Account data client is unavailable.');
    }

    const accountId = ctx.accountId;

    // Per-user rate limit (shared 'send' budget: 60/min) to bound AI spend.
    const rl = await checkRateLimit(
      `ai-features:${ctx.userId}`,
      RATE_LIMITS.send
    );
    if (!rl.success) return rateLimitResponse(rl);

    // Enforce the plan's AI request quota (same policy as the WhatsApp
    // AI pipeline): block when the limit is reached, continue on limit
    // infrastructure errors.
    try {
      const limitCheck = await checkPlanLimits(
        ctx.accountId,
        'max_ai_requests'
      );
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            error: 'AI_QUOTA_EXCEEDED',
            message:
              limitCheck.reason ||
              'Your monthly AI request limit has been reached. Please upgrade your plan.',
          },
          { status: 429 }
        );
      }
    } catch (err) {
      console.warn(
        '[AI Features] Limit check warning, continuing:',
        err instanceof Error ? err.message : String(err)
      );
    }

    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Action parameter is required.' },
        { status: 400 }
      );
    }

    // Fetch account settings
    const { data: account } = await appwrite
      .from('accounts')
      .select('ai_system_prompt, industry')
      .eq('id', accountId)
      .single();

    if (action === 'suggest') {
      const { conversationId } = body;
      if (!conversationId) {
        return NextResponse.json(
          { error: 'conversationId is required for suggest.' },
          { status: 400 }
        );
      }

      // Check if conversation belongs to account
      const { data: conversation, error: convError } = await appwrite
        .from('conversations')
        .select('account_id')
        .eq('id', conversationId)
        .single();

      if (convError || !conversation || conversation.account_id !== accountId) {
        return NextResponse.json(
          { error: 'Conversation not found or unauthorized.' },
          { status: 404 }
        );
      }

      // Fetch Knowledge Base
      const { data: kbEntries } = await appwrite
        .from('knowledge_base')
        .select('question_title, answer_content, category')
        .eq('account_id', accountId);

      let kbContext = '';
      if (kbEntries && kbEntries.length > 0) {
        kbContext =
          'Knowledge Base Context:\n' +
          kbEntries
            .map(
              (entry) =>
                `Category: ${entry.category}\nTitle: ${entry.question_title}\nContent: ${entry.answer_content}`
            )
            .join('\n\n');
      }

      // Fetch conversation context (latest 15 messages)
      const { data: messages, error: msgError } = await appwrite
        .from('messages')
        .select('sender_type, content_type, content_text, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(15);

      if (msgError || !messages || messages.length === 0) {
        return NextResponse.json(
          { error: 'No messages found in conversation.' },
          { status: 400 }
        );
      }

      messages.reverse();

      const latestMessage = messages[messages.length - 1];

      // AI Safety & Healthcare Guardrails Evaluation
      const safety = applyAiSafety(latestMessage.content_text || '');
      if (safety.isEmergency) {
        return NextResponse.json({
          result:
            '⚠️ EMERGENCY NOTICE: Emergency symptoms detected. Please direct the patient to immediate hotline (108/112) or the nearest emergency room.',
        });
      }
      if (safety.isDiagnostic) {
        return NextResponse.json({
          result:
            '🩺 MEDICAL NOTICE: As an AI receptionist, I cannot evaluate clinical symptoms or provide medical diagnoses. Please consult a registered doctor.',
        });
      }
      if (safety.containsInjection) {
        latestMessage.content_text = safety.safeText;
      }

      // Formulate prompt messages
      const basePrompt = resolveSystemPrompt(
        account?.industry,
        account?.ai_system_prompt
      );

      let systemPromptContent = basePrompt;
      if (kbContext) {
        systemPromptContent += `\n\n${kbContext}`;
      }

      systemPromptContent += `\n\n═══════════════════════════════════════════════════════════════════════════
CRITICAL MANDATORY MULTILINGUAL RULE:
The customer's latest message is: "${latestMessage.content_text || ''}".
You MUST detect the language and write the suggested reply in the EXACT SAME LANGUAGE and script/dialect as this message (e.g. if Bengali/Banglish, reply in Bengali; if Hindi/Hinglish, reply in Hindi/Hinglish; if English, reply in English; if another regional or world language, reply in that exact language). Never default to English when the customer messaged in another language.
═══════════════════════════════════════════════════════════════════════════`;

      systemPromptContent += `\n\nCRITICAL INSTRUCTION: You are suggesting a reply to the customer for a human agent to send. Respond ONLY with the direct text of the suggestion. Do not wrap in quotes, do not output any explanations or labels, and do not use JSON. Write it in an organized format with line breaks and friendly emojis.`;

      const apiMessages = [
        { role: 'system' as const, content: systemPromptContent },
        ...messages
          .map((m) => {
            let content = m.content_text || '';
            if (!content && m.content_type) {
              content = `[${m.content_type}]`;
            }
            return {
              role: (m.sender_type === 'customer' ? 'user' : 'assistant') as
                'user' | 'assistant',
              content,
            };
          })
          .filter((m) => m.content !== ''),
      ];

      const res = await executeAiCompletionWithFallback({
        messages: apiMessages,
        resolutionParams: {
          accountId,
          feature: 'AI_SUGGESTED_REPLY',
          conversationId,
        },
      });

      const result = res.content.trim();
      if (!result) {
        return NextResponse.json(
          { error: 'AI provider returned an empty reply. Please try again.' },
          { status: 502 }
        );
      }

      await incrementUsage(accountId, 'ai_requests');
      return NextResponse.json({ result });
    } else if (action === 'rewrite') {
      const { text, tone } = body;
      if (!text) {
        return NextResponse.json(
          { error: 'text parameter is required for rewrite.' },
          { status: 400 }
        );
      }

      const promptContent = `You are an expert copywriter. Rewrite the following text to make it sound ${tone || 'professional and friendly'}. 
Maintain the same language. 
Respond ONLY with the rewritten text. Do not add quotes, do not add comments, and do not explain the changes.
Text to rewrite:
"${text}"`;

      const res = await executeAiCompletionWithFallback({
        messages: [{ role: 'user', content: promptContent }],
        resolutionParams: {
          accountId,
          feature: 'AI_AGENT',
        },
      });

      const result = res.content.trim();
      if (!result) {
        return NextResponse.json(
          { error: 'AI provider returned an empty reply. Please try again.' },
          { status: 502 }
        );
      }

      await incrementUsage(accountId, 'ai_requests');
      return NextResponse.json({ result });
    } else if (action === 'translate') {
      const { text, targetLanguage } = body;
      if (!text || !targetLanguage) {
        return NextResponse.json(
          {
            error:
              'text and targetLanguage parameters are required for translate.',
          },
          { status: 400 }
        );
      }

      const promptContent = `Translate the following text into ${targetLanguage}.
Respond ONLY with the exact translation. Do not add explanations, quotes, or other text.
Text to translate:
"${text}"`;

      const res = await executeAiCompletionWithFallback({
        messages: [{ role: 'user', content: promptContent }],
        resolutionParams: {
          accountId,
          feature: 'AI_AGENT',
        },
      });

      const result = res.content.trim();
      if (!result) {
        return NextResponse.json(
          { error: 'AI provider returned an empty reply. Please try again.' },
          { status: 502 }
        );
      }

      await incrementUsage(accountId, 'ai_requests');
      return NextResponse.json({ result });
    } else if (
      action === 'summarize' ||
      action === 'follow_up' ||
      action === 'analyze_lead'
    ) {
      const { conversationId } = body;
      if (!conversationId) {
        return NextResponse.json(
          { error: `conversationId is required for ${action}.` },
          { status: 400 }
        );
      }

      // Verify the conversation belongs to the authenticated account.
      const { data: conversation, error: convError } = await appwrite
        .from('conversations')
        .select('account_id')
        .eq('id', conversationId)
        .single();

      if (convError || !conversation || conversation.account_id !== accountId) {
        return NextResponse.json(
          { error: 'Conversation not found or unauthorized.' },
          { status: 404 }
        );
      }

      const { data: messages, error: msgError } = await appwrite
        .from('messages')
        .select('sender_type, content_type, content_text, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (msgError || !messages || messages.length === 0) {
        return NextResponse.json(
          { error: 'No messages found in conversation.' },
          { status: 400 }
        );
      }

      messages.reverse();

      const transcript = messages
        .map((m) => {
          const who = m.sender_type === 'customer' ? 'Customer' : 'Agent';
          const text = m.content_text || `[${m.content_type || 'message'}]`;
          return `${who}: ${text}`;
        })
        .join('\n');

      let promptContent: string;
      if (action === 'summarize') {
        promptContent = `Summarize the following customer conversation in 3-5 concise bullet points capturing the customer's goal, key details, and current status. Respond ONLY with the summary bullets, written in the same language as the conversation.\n\nConversation:\n${transcript}`;
      } else if (action === 'follow_up') {
        promptContent = `Based on the following customer conversation, draft a short, friendly follow-up message the agent can send to re-engage the customer or move things forward. Match the language of the conversation. Respond ONLY with the message text — no quotes, labels, or explanations.\n\nConversation:\n${transcript}`;
      } else {
        promptContent = `Analyze the following customer conversation for lead qualification. Respond ONLY with a raw, valid JSON object (no markdown fences, no extra text) in exactly this shape:
{
  "lead_score": "hot" | "warm" | "cold",
  "intent": "sales" | "support" | "booking" | "complaint" | "other",
  "sentiment": "positive" | "neutral" | "negative",
  "interested_in": "short string or null",
  "next_action": "one short recommended next step for the agent"
}

Conversation:\n${transcript}`;
      }

      const res = await executeAiCompletionWithFallback({
        messages: [{ role: 'system', content: promptContent }],
        options: {
          temperature: 0.3,
          ...(action === 'analyze_lead'
            ? { responseFormat: { type: 'json_object' as const } }
            : {}),
        },
        resolutionParams: {
          accountId,
          feature: 'AI_AGENT',
          conversationId,
        },
      });

      const result = res.content.trim();
      if (!result) {
        return NextResponse.json(
          { error: 'AI provider returned an empty reply. Please try again.' },
          { status: 502 }
        );
      }

      await incrementUsage(accountId, 'ai_requests');
      return NextResponse.json({ result });
    }

    return NextResponse.json(
      { error: `Invalid action: ${action}` },
      { status: 400 }
    );
  } catch (err: unknown) {
    console.error('[AI API] Server Error:', err);
    return toErrorResponse(err);
  }
}
