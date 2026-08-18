/**
 * Helpa Core Platform — AI Copilot Engine
 *
 * Core AI Assistant for staff: summarizes conversations, extracts intent,
 * and drafts suggested contextual replies.
 */

import { getAiProvider } from '@/core/ai/provider';
import { getConversationMemory } from '@/core/ai/memory';
import { getRelevantKnowledge, formatKnowledgeForAi } from '@/core/knowledge';

export interface CopilotSummaryResult {
  summary: string;
  intent: string;
  suggestedReply: string;
  keyDetails: Record<string, string>;
}

export async function generateCopilotAssistance(
  accountId: string,
  conversationId: string,
  contactId: string,
  options?: {
    aiRole?: string;
    apiKey?: string;
    model?: string;
  }
): Promise<CopilotSummaryResult> {
  const [memory, knowledge] = await Promise.all([
    getConversationMemory(accountId, conversationId, contactId, 10),
    getRelevantKnowledge(accountId, '', 10),
  ]);

  const kbContext = formatKnowledgeForAi(knowledge);
  const roleName = options?.aiRole || 'AI Business Assistant';

  const systemPrompt = `You are the ${roleName} Copilot. Your role is to assist the human staff member reviewing this conversation.
Analyze the conversation messages and produce a JSON response with:
- "summary": A brief 1-2 sentence overview of what the customer is asking.
- "intent": The primary user intent (e.g. "Booking Inquiry", "Pricing Question", "Support").
- "suggestedReply": A courteous, ready-to-send reply addressing their question based on the Knowledge Base. You MUST write this in the EXACT SAME LANGUAGE and script/dialect used by the customer in their latest message (e.g. Bengali for Bengali, Hindi/Hinglish for Hindi/Hinglish, English for English). Never switch to English if the customer messaged in another language.
- "keyDetails": An object containing extracted details like date, preference, service, or contact info.

Knowledge Base Context:
${kbContext}

Return ONLY valid JSON.`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...memory.messages,
    {
      role: 'user' as const,
      content:
        'Please summarize this conversation and generate a recommended reply for the staff member.',
    },
  ];

  const provider = getAiProvider();
  const res = await provider.generateCompletion(messages, {
    apiKey: options?.apiKey,
    model: options?.model,
    temperature: 0.2,
  });

  try {
    const jsonMatch = res.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || 'Customer inquiry in progress.',
        intent: parsed.intent || 'General Inquiry',
        suggestedReply: parsed.suggestedReply || '',
        keyDetails: parsed.keyDetails || {},
      };
    }
  } catch (err) {
    console.warn('[Copilot] JSON parse error, returning raw fallback:', err);
  }

  return {
    summary: res.content.slice(0, 200),
    intent: 'General Inquiry',
    suggestedReply: res.content,
    keyDetails: {},
  };
}
