import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import {
  calculateAutomationSuccessRate,
  calculateBookingsHandled,
  calculateMedianFirstResponseTime,
  calculatePatientReturnRate,
  generateObservationReadinessReport,
  type OutcomeEventRecord,
} from '@/lib/metrics/outcome-aggregation';
import {
  calculateReliabilityCounts,
  calculateReliabilityRates,
} from '@/lib/metrics/reliability-aggregation';
import { getAdminClient } from '@/lib/supabase/server';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

function asOutcomeRecords(rows: unknown): OutcomeEventRecord[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row): row is OutcomeEventRecord => {
    if (!row || typeof row !== 'object') return false;
    const candidate = row as Record<string, unknown>;
    return (
      typeof candidate.account_id === 'string' &&
      typeof candidate.event_name === 'string' &&
      typeof candidate.occurred_at === 'string'
    );
  });
}

export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await requireRole('viewer');
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('product_outcome_events')
      .select(
        'account_id, event_name, event_version, occurred_at, source_id, subject_hash, is_synthetic, is_test_tenant, attributes'
      )
      .eq('account_id', ctx.accountId)
      .order('occurred_at', { ascending: true })
      .limit(5000);

    if (error) {
      return NextResponse.json(
        { error: 'Observation events are unavailable' },
        { status: 503, headers: PRIVATE_HEADERS }
      );
    }

    const events = asOutcomeRecords(data).filter(
      (event) => event.account_id === ctx.accountId
    );
    const eligible = events.filter(
      (event) => !event.is_synthetic && !event.is_test_tenant
    );
    const earliest = eligible[0]?.occurred_at || null;
    const readiness = generateObservationReadinessReport(
      events,
      earliest || new Date().toISOString(),
      new Date()
    );
    if (!earliest) {
      readiness.observationStartDate = '';
      readiness.elapsedDays = 0;
      readiness.status = 'BLOCKED_BY_OBSERVATION_WINDOW';
      readiness.isProductionObservationComplete = false;
    }

    const firstResponse = calculateMedianFirstResponseTime(events);
    const bookings = calculateBookingsHandled(events);
    const automation = calculateAutomationSuccessRate(events);
    const patientReturn = calculatePatientReturnRate(events);
    const reliabilityCounts = calculateReliabilityCounts(events);
    const reliabilityRates = calculateReliabilityRates(events);

    return NextResponse.json(
      {
        accountId: ctx.accountId,
        publication: {
          allowed: false,
          reason: readiness.isProductionObservationComplete
            ? 'Window elapsed; publication still requires consent, sample validation, and operator sign-off'
            : readiness.status,
        },
        slo: {
          note: 'Targets are goals, not achieved results. Observed values are null or suppressed until a valid production window exists.',
          targets: {
            medianFirstResponseSeconds: 60,
            automationSuccessPercent: 80,
            deliveryFailurePercent: 2,
            readyHttpSuccess: true,
          },
          observed: {
            medianFirstResponseSeconds: firstResponse.medianSeconds,
            automationSuccessPercent: automation.successRatePercent,
            deliveryFailurePercent: reliabilityRates.deliveryFailureRatePercent,
            readyHttpSuccess: null,
            sampleSuppressed: {
              firstResponse: firstResponse.isSuppressed,
              automation: automation.isSuppressed,
              reliability: reliabilityRates.isSuppressed,
            },
          },
        },
        readiness,
        product: {
          firstResponse,
          bookings,
          automation,
          patientReturn,
        },
        reliability: {
          counts: reliabilityCounts,
          rates: reliabilityRates,
        },
        events: {
          eligible: eligible.length,
          excludedSyntheticOrTest: events.length - eligible.length,
        },
      },
      { headers: PRIVATE_HEADERS }
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
