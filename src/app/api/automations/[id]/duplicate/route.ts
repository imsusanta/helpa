import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { insertAutomationRow } from '@/lib/automations/insert-row';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let context;
  try {
    context = await requireRole('agent');
  } catch (error) {
    return toErrorResponse(error);
  }

  const admin = getAdminClient();
  const { data: original, error: origErr } = await admin
    .from('automations')
    .select('*')
    .eq('id', id)
    .eq('account_id', context.accountId)
    .maybeSingle();
  if (origErr)
    return NextResponse.json({ error: origErr.message }, { status: 500 });
  if (!original)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: copy, error: copyErr } = await insertAutomationRow(admin, {
    accountId: context.accountId,
    userId: context.userId,
    name: `${original.name} (Copy)`,
    description: original.description,
    triggerType: original.trigger_type,
    triggerConfig:
      (original.trigger_config as Record<string, unknown> | null) ?? {},
    isActive: false,
  });
  if (copyErr || !copy) {
    return NextResponse.json(
      { error: copyErr?.message ?? 'copy failed' },
      { status: 500 }
    );
  }

  const { data: steps } = await admin
    .from('automation_steps')
    .select('id, parent_step_id, branch, step_type, step_config, position')
    .eq('automation_id', id)
    .order('position', { ascending: true });

  if (steps && steps.length > 0) {
    // Re-map parent_step_id: build old→new id map first so the second
    // pass inserts rows with correct parent references.
    const idMap = new Map<string, string>();
    const uid = () =>
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    for (const row of steps) idMap.set(row.id as string, uid());

    const rows = steps.map((row) => ({
      id: idMap.get(row.id as string)!,
      automation_id: copy.id,
      parent_step_id: row.parent_step_id
        ? idMap.get(row.parent_step_id as string)
        : null,
      branch: row.branch,
      step_type: row.step_type,
      step_config: row.step_config,
      position: row.position,
    }));
    const { error: insErr } = await admin.from('automation_steps').insert(rows);
    if (insErr)
      return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ automation: copy }, { status: 201 });
}
