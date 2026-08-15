import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { resolveFallbackPolicy } from '@/lib/flows/fallback';

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
 * Auth: re-uses `AUTOMATION_CRON_SECRET` so operators only have one
 * secret to provision. The two endpoints (`/api/automations/cron`
 * and this one) are independent operations; we keep them on separate
 * URLs so one failing doesn't block the other.
 *
 * Hosting: hit on a schedule (appwrite-sites Cron / GitHub Actions / external
 * pinger). A 5-minute interval is more than enough for a 24h timeout
 * default; once per hour would also be acceptable for low-volume
 * tenants.
 */
export async function GET(request: Request) {
  const expected = process.env.AUTOMATION_CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 });
  }
  // Constant-time compare so an attacker who can hit the endpoint
  // can't recover the secret byte-by-byte from response-time deltas.
  // Length pre-check is required by timingSafeEqual (throws otherwise)
  // and leaks only the length itself, which isn't sensitive.
  const supplied = request.headers.get('x-cron-secret') ?? '';
  const suppliedBuf = Buffer.from(supplied);
  const expectedBuf = Buffer.from(expected);
  if (
    suppliedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(suppliedBuf, expectedBuf)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = appwriteAdmin();
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!runs?.length) return NextResponse.json({ swept: 0 });

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
    return NextResponse.json({ swept: 0 });
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

  return NextResponse.json({ swept: updatedIds.size });
}
