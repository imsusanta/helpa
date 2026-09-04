import { getIndustryAdapter } from '@/core/industry';

export const INTENT_FULFILLMENT_POLICY_MARKER =
  '[MANDATORY INTENT FULFILLMENT POLICY]';

const UNIVERSAL_POLICY = `${INTENT_FULFILLMENT_POLICY_MARKER}
1. Understand the customer's latest goal from the full conversation, then give the most useful direct answer or perform the supported action. Do not send a generic acknowledgement when the request can be completed.
2. Follow the customer's requested outcome and reuse already-confirmed details from the conversation or trusted workspace data. Ask only for the next missing detail that is required to continue; do not repeatedly ask for information the customer already supplied.
3. Use the workspace's configured terminology and respond in the same language, script, and conversational style as the customer's latest message.
4. Use available tools or structured action fields for bookings, updates, follow-ups, and other supported operations. Never claim that an action is completed until the backend confirms success.
5. If a requested action is unsupported, unsafe, or lacks trusted business data, explain the limitation briefly and offer the closest safe next step or a human handoff. Never invent prices, schedules, availability, records, or completion status.
6. Keep the reply concise but complete: answer the actual question, state what happened or what is needed next, and avoid unrelated menus or repetitive introductions.`;

/**
 * Adds the non-negotiable response/action contract to a resolved workspace
 * prompt. The marker keeps this idempotent when a resolved prompt is later
 * saved back as a workspace override.
 */
export function withIntentFulfillmentPolicy(
  prompt: string,
  industry: string | null | undefined
): string {
  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.includes(INTENT_FULFILLMENT_POLICY_MARKER)) {
    return trimmedPrompt;
  }

  const adapter = getIndustryAdapter(industry);
  const domainPolicy = adapter.getIntentPolicy();

  return [trimmedPrompt, UNIVERSAL_POLICY, domainPolicy]
    .filter(Boolean)
    .join('\n\n');
}
