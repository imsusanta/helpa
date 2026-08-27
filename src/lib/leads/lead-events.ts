import { logger } from '@/lib/observability/logger';
import { LEAD_LAYER_EVENTS, type LeadLayerEvent } from '@/lib/leads/types';

/**
 * Traceable, redacted logging for the lead-detection layer.
 * Never logs access tokens, API keys, or raw customer PII beyond ids.
 */
export function logLeadEvent(
  event: LeadLayerEvent,
  context: {
    accountId: string;
    leadId?: string | null;
    conversationId?: string | null;
    contactId?: string | null;
    correlationId?: string;
    reason?: string;
    [key: string]: unknown;
  }
): void {
  logger.info(event, {
    component: 'lead-detection',
    event,
    accountId: context.accountId,
    leadId: context.leadId ?? undefined,
    conversationId: context.conversationId ?? undefined,
    contactId: context.contactId ?? undefined,
    correlationId: context.correlationId,
    reason: context.reason,
  });
}

export { LEAD_LAYER_EVENTS };
