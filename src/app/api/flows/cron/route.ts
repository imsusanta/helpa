import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db/server';
import { authorizeCronRequest } from '@/lib/cron/security';
import { resolveFallbackPolicy } from '@/lib/flows/fallback';

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

/**
 * Sweep abandoned active flow runs.
 *
 * Reads each active run's parent-flow `fallback_policy.on_timeout_hours`
 * to compute the staleness cutoff (default 24h), then marks any run
 * past its cutoff as `timed_out`. Writes a matching `flow_run_events`
 * row for the audit trail.
 *
 * Without this sweep, a customer who abandons a flow mid-conversation
 * keeps a row in `idx_one_active_run_per_contact` (the partial unique
 * index on `flow_runs WHERE status='active'`) forever — blocking any
 * new triggers for them. The cron is therefore not optional.
 *
 * Auth: delegated to the shared cron authorizer, which accepts either
 * `AUTOMATION_CRON_SECRET` or `CRON_SECRET`, reads the secret from
 * `x-cron-secret` or `Authorization: Bearer`, compares in constant
 * time, and fails closed when nothing is configured. The two endpoints
 * (`/api/automations/cron` and this one) are independent operations; we
 * keep them on separate URLs so one failing doesn't block the other.
 *
 * Hosting: hit on a schedule (appwrite-sites Cron / GitHub Actions / external
 * pinger). A 5-minute interval is more than enough for a 24h timeout
 * default; once per hour would also be acceptable for low-volume
 * tenants.
 */
export async function GET(request: Request) {
  const authorization = authorizeCronRequest(request, [
    'AUTOMATION_CRON_SECRET',
    'CRON_SECRET',
  ]);
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.message },
      { status: authorization.status, headers: NO_STORE_HEADERS }
    );
  }

  const admin = getAdminClient();
  const now = new Date();

  // Pull all currently-active runs along with their parent flow's
  // fallback_policy. Joined in one query — the small set of active
  // runs per tenant keeps this cheap.
  const { data: runs, error } = await admin
    .from('flow_runs')
    .select(
      'id, flow_id, user_id, contact_id, last_advanced_at, flows ( fallback_policy )'
    )
    .eq('status', 'active');

  if (error) {
    console.error('[flows-cron] active-run scan failed:', error.message);
    return NextResponse.json(
      { error: 'Flow run sweep failed' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
  if (!runs?.length)
    return NextResponse.json({ swept: 0 }, { headers: NO_STORE_HEADERS });

  type Row = {
    id: string;
    flow_id: string;
    user_id: string;
    contact_id: string | null;
    last_advanced_at: string;
    flows: { fallback_policy: unknown } | { fallback_policy: unknown }[] | null;
  };

  const timedOutRuns: { id: string; ageHours: number; policyHours: number }[] =
    [];

  for (const r of runs as Row[]) {
    const flowsField = Array.isArray(r.flows) ? r.flows[0] : r.flows;
    const policy = resolveFallbackPolicy(flowsField?.fallback_policy ?? null);
    const lastAdvanced = new Date(r.last_advanced_at);
    const ageHours =
      (now.getTime() - lastAdvanced.getTime()) / (1000 * 60 * 60);
    if (ageHours >= policy.on_timeout_hours) {
      timedOutRuns.push({
        id: r.id,
        ageHours: Math.round(ageHours * 10) / 10,
        policyHours: policy.on_timeout_hours,
      });
    }
  }

  if (timedOutRuns.length === 0) {
    return NextResponse.json({ swept: 0 }, { headers: NO_STORE_HEADERS });
  }

  const timedOutIds = timedOutRuns.map((r) => r.id);

  // Batch mark timed_out in a single query — guarded by status='active'
  const { data: updated } = await admin
    .from('flow_runs')
    .update({
      status: 'timed_out',
      ended_at: now.toISOString(),
      end_reason: 'stale_sweep',
    })
    .in('id', timedOutIds)
    .eq('status', 'active')
    .select('id');

  const updatedIds = new Set(
    Array.isArray(updated) ? updated.map((u) => u.id) : []
  );

  // Batch insert matching audit events
  const events = timedOutRuns
    .filter((r) => updatedIds.has(r.id))
    .map((r) => ({
      flow_run_id: r.id,
      event_type: 'timeout',
      payload: {
        age_hours: r.ageHours,
        policy_hours: r.policyHours,
      },
    }));

  if (events.length > 0) {
    await admin.from('flow_run_events').insert(events);
  }

  return NextResponse.json(
    { swept: updatedIds.size },
    { headers: NO_STORE_HEADERS }
  );
}
