export interface OutcomeEventRecord {
  id?: string;
  account_id: string;
  event_name: string;
  event_version: number;
  occurred_at: string;
  source_id: string;
  subject_hash: string | null;
  is_synthetic: boolean;
  is_test_tenant: boolean;
  attributes: Record<string, unknown>;
  recorded_at?: string;
}

export interface FirstResponseTimeResult {
  medianSeconds: number | null;
  sampleSize: number;
  automatedCount: number;
  humanCount: number;
  isSuppressed: boolean;
}

export interface BookingsHandledResult {
  totalConfirmedBookings: number;
  whatsappAttributed: number;
  sampleSize: number;
  isSuppressed: boolean;
}

export interface AutomationSuccessResult {
  successRatePercent: number | null;
  eligibleStarted: number;
  completedWithoutTakeover: number;
  takeoverCount: number;
  errorCount: number;
  isSuppressed: boolean;
}

export interface PatientReturnResult {
  returnRatePercent: number | null;
  uniqueCohortSize: number;
  returningPatientCount: number;
  isSuppressed: boolean;
}

export interface ObservationReadinessReport {
  status: 'BLOCKED_BY_OBSERVATION_WINDOW' | 'READY_FOR_CALCULATION';
  observationStartDate: string;
  evaluationDate: string;
  elapsedDays: number;
  requiredDays: number;
  earliestValidPublicationDate: string;
  totalEligibleEvents: number;
  totalExcludedSyntheticEvents: number;
  isProductionObservationComplete: boolean;
}

const MINIMUM_SAFE_COHORT_SIZE = 10;
const MAX_FIRST_RESPONSE_SECONDS = 7 * 24 * 60 * 60;

/**
 * Opaque conversation id from a first-response source_id or attributes.
 * source_id format: `first-response:{accountId}:{conversationId}`
 */
export function conversationIdFromFirstResponse(
  event: Pick<OutcomeEventRecord, 'source_id' | 'attributes'>
): string | null {
  const fromAttr = event.attributes?.conversation_id;
  if (typeof fromAttr === 'string' && fromAttr) return fromAttr;
  const match = /^first-response:[^:]+:(.+)$/.exec(event.source_id);
  return match?.[1] || null;
}

/**
 * Seconds between two ISO timestamps. Returns null for invalid, negative,
 * or stale (>7 day) deltas so a leftover inbound cannot invent a latency.
 */
export function latencySecondsBetween(
  inboundAt: string,
  outboundAt: string
): number | null {
  const inboundMs = Date.parse(inboundAt);
  const outboundMs = Date.parse(outboundAt);
  if (!Number.isFinite(inboundMs) || !Number.isFinite(outboundMs)) return null;
  const seconds = (outboundMs - inboundMs) / 1000;
  if (seconds < 0 || seconds > MAX_FIRST_RESPONSE_SECONDS) return null;
  return Math.round(seconds * 10) / 10;
}

function numericAttribute(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Prefer a persist-time latency attribute; otherwise pair the first-response
 * event with the latest inbound for the same conversation that occurred
 * at or before the reply. Conversation ids are UUIDs, not patient content.
 */
export function pairFirstResponseLatencySeconds(
  event: OutcomeEventRecord,
  inboundEvents: OutcomeEventRecord[]
): number | null {
  const fromSeconds = numericAttribute(event.attributes?.response_time_seconds);
  if (fromSeconds !== null && fromSeconds >= 0) return fromSeconds;
  const fromMs = numericAttribute(event.attributes?.response_time_ms);
  if (fromMs !== null && fromMs >= 0)
    return Math.round((fromMs / 1000) * 10) / 10;

  const conversationId = conversationIdFromFirstResponse(event);
  if (!conversationId) return null;

  let latestInboundAt: string | null = null;
  for (const inbound of inboundEvents) {
    if (inbound.event_name !== 'inbound_message_received') continue;
    if (inbound.attributes?.conversation_id !== conversationId) continue;
    if (inbound.occurred_at > event.occurred_at) continue;
    if (!latestInboundAt || inbound.occurred_at > latestInboundAt) {
      latestInboundAt = inbound.occurred_at;
    }
  }
  if (!latestInboundAt) return null;
  return latencySecondsBetween(latestInboundAt, event.occurred_at);
}

/**
 * Calculates the Median First-Response Time over eligible rolling window events.
 */
export function calculateMedianFirstResponseTime(
  events: OutcomeEventRecord[]
): FirstResponseTimeResult {
  const eligible = events.filter(
    (e) =>
      !e.is_synthetic &&
      !e.is_test_tenant &&
      e.event_name === 'first_response_sent'
  );
  const inboundEvents = events.filter(
    (e) =>
      !e.is_synthetic &&
      !e.is_test_tenant &&
      e.event_name === 'inbound_message_received'
  );

  if (eligible.length < MINIMUM_SAFE_COHORT_SIZE) {
    return {
      medianSeconds: null,
      sampleSize: eligible.length,
      automatedCount: 0,
      humanCount: 0,
      isSuppressed: true,
    };
  }

  let automatedCount = 0;
  let humanCount = 0;
  const latencies: number[] = [];

  for (const event of eligible) {
    const isAuto = Boolean(event.attributes?.is_automated);
    if (isAuto) automatedCount++;
    else humanCount++;

    const latency = pairFirstResponseLatencySeconds(event, inboundEvents);

    if (latency !== null && latency >= 0) {
      latencies.push(latency);
    }
  }

  if (latencies.length === 0) {
    return {
      medianSeconds: null,
      sampleSize: eligible.length,
      automatedCount,
      humanCount,
      isSuppressed: false,
    };
  }

  latencies.sort((a, b) => a - b);
  const mid = Math.floor(latencies.length / 2);
  const median =
    latencies.length % 2 !== 0
      ? latencies[mid]
      : (latencies[mid - 1] + latencies[mid]) / 2;

  return {
    medianSeconds: Math.round(median * 10) / 10,
    sampleSize: latencies.length,
    automatedCount,
    humanCount,
    isSuppressed: false,
  };
}

/**
 * Calculates Bookings Handled initiated via WhatsApp journeys.
 */
export function calculateBookingsHandled(
  events: OutcomeEventRecord[]
): BookingsHandledResult {
  const eligible = events.filter(
    (e) =>
      !e.is_synthetic &&
      !e.is_test_tenant &&
      e.event_name === 'booking_confirmed'
  );

  if (eligible.length < MINIMUM_SAFE_COHORT_SIZE) {
    return {
      totalConfirmedBookings: eligible.length,
      whatsappAttributed: 0,
      sampleSize: eligible.length,
      isSuppressed: true,
    };
  }

  let whatsappAttributed = 0;
  for (const event of eligible) {
    if (
      event.attributes?.channel === 'whatsapp' ||
      event.attributes?.is_whatsapp === true
    ) {
      whatsappAttributed++;
    }
  }

  return {
    totalConfirmedBookings: eligible.length,
    whatsappAttributed,
    sampleSize: eligible.length,
    isSuppressed: false,
  };
}

/**
 * Calculates Automation Success Rate (completed without staff takeover / eligible started).
 */
export function calculateAutomationSuccessRate(
  events: OutcomeEventRecord[]
): AutomationSuccessResult {
  const eligible = events.filter((e) => !e.is_synthetic && !e.is_test_tenant);

  const started = eligible.filter(
    (e) => e.event_name === 'automation_eligible'
  ).length;
  const completed = eligible.filter(
    (e) => e.event_name === 'automation_completed'
  ).length;
  const takeover = eligible.filter(
    (e) => e.event_name === 'staff_takeover'
  ).length;
  const errors = eligible.filter(
    (e) => e.event_name === 'automation_error'
  ).length;

  if (started < MINIMUM_SAFE_COHORT_SIZE) {
    return {
      successRatePercent: null,
      eligibleStarted: started,
      completedWithoutTakeover: completed,
      takeoverCount: takeover,
      errorCount: errors,
      isSuppressed: true,
    };
  }

  const rate = Math.round((completed / started) * 1000) / 10;

  return {
    successRatePercent: Math.min(100, Math.max(0, rate)),
    eligibleStarted: started,
    completedWithoutTakeover: completed,
    takeoverCount: takeover,
    errorCount: errors,
    isSuppressed: false,
  };
}

/**
 * Calculates Patient Return Rate within 90 days using one-way subject hashes.
 */
export function calculatePatientReturnRate(
  events: OutcomeEventRecord[]
): PatientReturnResult {
  const eligible = events.filter(
    (e) =>
      !e.is_synthetic &&
      !e.is_test_tenant &&
      (e.event_name === 'appointment_completed' ||
        e.event_name === 'patient_return_completed') &&
      e.subject_hash
  );

  const uniqueSubjects = new Set<string>();
  const returningSubjects = new Set<string>();

  for (const event of eligible) {
    const hash = event.subject_hash!;
    if (event.event_name === 'patient_return_completed') {
      returningSubjects.add(hash);
    }
    uniqueSubjects.add(hash);
  }

  if (uniqueSubjects.size < MINIMUM_SAFE_COHORT_SIZE) {
    return {
      returnRatePercent: null,
      uniqueCohortSize: uniqueSubjects.size,
      returningPatientCount: returningSubjects.size,
      isSuppressed: true,
    };
  }

  const rate =
    Math.round((returningSubjects.size / uniqueSubjects.size) * 1000) / 10;

  return {
    returnRatePercent: Math.min(100, Math.max(0, rate)),
    uniqueCohortSize: uniqueSubjects.size,
    returningPatientCount: returningSubjects.size,
    isSuppressed: false,
  };
}

/**
 * Generates an Observation-Readiness Report validating whether 30 complete production days
 * have elapsed before any scorecard publication is authorized.
 */
export function generateObservationReadinessReport(
  events: OutcomeEventRecord[],
  observationStartDate: Date | string,
  evaluationDate: Date | string = new Date()
): ObservationReadinessReport {
  const start = new Date(observationStartDate);
  const now = new Date(evaluationDate);

  const msPerDay = 1000 * 60 * 60 * 24;
  const elapsedDays = Math.max(
    0,
    Math.floor((now.getTime() - start.getTime()) / msPerDay)
  );
  const requiredDays = 30;

  const validPublicationDate = new Date(
    start.getTime() + requiredDays * msPerDay
  );

  const totalEligible = events.filter(
    (e) => !e.is_synthetic && !e.is_test_tenant
  ).length;
  const totalSynthetic = events.filter(
    (e) => e.is_synthetic || e.is_test_tenant
  ).length;

  const isComplete =
    elapsedDays >= requiredDays && totalEligible >= MINIMUM_SAFE_COHORT_SIZE;

  return {
    status: isComplete
      ? 'READY_FOR_CALCULATION'
      : 'BLOCKED_BY_OBSERVATION_WINDOW',
    observationStartDate: start.toISOString().split('T')[0],
    evaluationDate: now.toISOString().split('T')[0],
    elapsedDays,
    requiredDays,
    earliestValidPublicationDate: validPublicationDate
      .toISOString()
      .split('T')[0],
    totalEligibleEvents: totalEligible,
    totalExcludedSyntheticEvents: totalSynthetic,
    isProductionObservationComplete: isComplete,
  };
}
