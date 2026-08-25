import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db/server';
import { authorizeCronRequest } from '@/lib/cron/security';
import { resumePendingExecution } from '@/lib/automations/engine';
import type { AutomationContext } from '@/lib/automations/engine';

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

/**
 * Drain due `automation_pending_executions` rows. Meant to be hit
 * on a schedule (external cron / Vercel Cron / pinger) — authorized
 * by the shared cron authorizer, which accepts the secret in either
 * `x-cron-secret` or `Authorization: Bearer` and fails closed when no
 * secret is configured.
 *
 * The claim step (status = 'running') serves as a simple lock so
 * overlapping invocations don't double-process rows. Best-effort
 * only; expensive SELECT ... FOR UPDATE is avoided in favor of a
 * two-step UPDATE-by-id.
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
  const { data: due, error } = await admin
    .from('automation_pending_executions')
    .select('*')
    .eq('status', 'pending')
    .lte('run_at', new Date().toISOString())
    .order('run_at', { ascending: true })
    .limit(50);

  if (error)
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  if (!due || due.length === 0)
    return NextResponse.json({ processed: 0 }, { headers: NO_STORE_HEADERS });

  let processed = 0;
  for (const row of due) {
    const { data: claim } = await admin
      .from('automation_pending_executions')
      .update({ status: 'running' })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (!claim) continue;

    await resumePendingExecution({
      id: row.id as string,
      automation_id: row.automation_id as string,
      // account_id is NOT NULL on automation_pending_executions
      // post-017; the engine uses it for tenant-scoped lookups.
      account_id: row.account_id as string,
      user_id: row.user_id as string,
      contact_id: (row.contact_id as string | null) ?? null,
      log_id: (row.log_id as string | null) ?? null,
      parent_step_id: (row.parent_step_id as string | null) ?? null,
      branch: (row.branch as 'yes' | 'no' | null) ?? null,
      next_step_position: row.next_step_position as number,
      context: (row.context as AutomationContext) ?? {},
    });
    processed++;
  }

  return NextResponse.json({ processed }, { headers: NO_STORE_HEADERS });
}
