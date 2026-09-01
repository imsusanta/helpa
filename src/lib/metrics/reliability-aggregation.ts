import type { OutcomeEventRecord } from '@/lib/metrics/outcome-aggregation';

const MINIMUM_SAFE_COHORT_SIZE = 10;

export interface ReliabilityCounts {
  inboundReceived: number;
  outboundSent: number;
  firstResponses: number;
  deliveryFailures: number;
  webhookFailures: number;
  aiFailures: number;
  workerFailures: number;
  integrationFailures: number;
  automationErrors: number;
}

export interface ReliabilityRates {
  deliveryFailureRatePercent: number | null;
  webhookFailureRatePercent: number | null;
  aiFailureRatePercent: number | null;
  sampleSize: number;
  isSuppressed: boolean;
}

const RELIABILITY_EVENTS = new Set([
  'inbound_message_received',
  'outbound_message_sent',
  'first_response_sent',
  'message_delivery_failed',
  'webhook_failed',
  'ai_failed',
  'worker_failed',
  'integration_failed',
  'automation_error',
]);

function eligible(events: OutcomeEventRecord[]): OutcomeEventRecord[] {
  return events.filter((event) => !event.is_synthetic && !event.is_test_tenant);
}

function countName(events: OutcomeEventRecord[], name: string): number {
  return events.filter((event) => event.event_name === name).length;
}

export function calculateReliabilityCounts(
  events: OutcomeEventRecord[]
): ReliabilityCounts {
  const rows = eligible(events);
  return {
    inboundReceived: countName(rows, 'inbound_message_received'),
    outboundSent: countName(rows, 'outbound_message_sent'),
    firstResponses: countName(rows, 'first_response_sent'),
    deliveryFailures: countName(rows, 'message_delivery_failed'),
    webhookFailures: countName(rows, 'webhook_failed'),
    aiFailures: countName(rows, 'ai_failed'),
    workerFailures: countName(rows, 'worker_failed'),
    integrationFailures: countName(rows, 'integration_failed'),
    automationErrors: countName(rows, 'automation_error'),
  };
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function calculateReliabilityRates(
  events: OutcomeEventRecord[]
): ReliabilityRates {
  const rows = eligible(events).filter((event) =>
    RELIABILITY_EVENTS.has(event.event_name)
  );
  const counts = calculateReliabilityCounts(events);
  const attempts = counts.inboundReceived + counts.outboundSent;

  if (rows.length < MINIMUM_SAFE_COHORT_SIZE) {
    return {
      deliveryFailureRatePercent: null,
      webhookFailureRatePercent: null,
      aiFailureRatePercent: null,
      sampleSize: rows.length,
      isSuppressed: true,
    };
  }

  return {
    deliveryFailureRatePercent: rate(counts.deliveryFailures, attempts),
    webhookFailureRatePercent: rate(counts.webhookFailures, attempts),
    aiFailureRatePercent: rate(counts.aiFailures, attempts),
    sampleSize: rows.length,
    isSuppressed: false,
  };
}
