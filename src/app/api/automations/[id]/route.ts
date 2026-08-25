import { NextResponse } from 'next/server';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import {
  loadStepsTree,
  replaceSteps,
  type BuilderStepInput,
} from '@/lib/automations/steps-tree';
import {
  validateStepsForActivation,
  validateTriggerForActivation,
} from '@/lib/automations/validate';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let context;
  try {
    context = await requireRole('viewer');
  } catch (error) {
    return toErrorResponse(error);
  }

  const admin = appwriteAdmin();
  const { data: automation, error } = await admin
    .from('automations')
    .select('*')
    .eq('id', id)
    .eq('account_id', context.accountId)
    .maybeSingle();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!automation)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const steps = await loadStepsTree(id);
  return NextResponse.json({ automation, steps });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let context;
  try {
    context = await requireRole('agent');
  } catch (error) {
    return toErrorResponse(error);
  }

  const body = await request.json().catch(() => null);
  if (!body)
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const admin = appwriteAdmin();

  // Ownership check before we touch anything. Load the fields we need
  // to compute the post-patch "effective" state for validation.
  const { data: existing } = await admin
    .from('automations')
    .select('id, user_id, is_active, trigger_type, trigger_config')
    .eq('id', id)
    .eq('account_id', context.accountId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const update: Record<string, unknown> = {};
  for (const k of [
    'name',
    'description',
    'trigger_type',
    'trigger_config',
    'is_active',
  ] as const) {
    if (k in body) update[k] = body[k];
  }

  // If this PATCH leaves the automation active (either explicitly
  // activating it OR editing an already-active one), validate the
  // merged configuration first. Activation is the natural gate — drafts
  // are still allowed to be incomplete.
  const willBeActive =
    typeof update.is_active === 'boolean'
      ? update.is_active
      : existing.is_active;
  if (willBeActive) {
    const mergedTriggerType = (update.trigger_type ??
      existing.trigger_type) as string;
    const mergedTriggerConfig =
      update.trigger_config ?? existing.trigger_config;
    const mergedSteps = Array.isArray(body.steps)
      ? (body.steps as {
          step_type: string;
          step_config: Record<string, unknown>;
        }[])
      : await loadStepsTree(id);
    const issues = [
      ...validateTriggerForActivation(mergedTriggerType, mergedTriggerConfig),
      ...validateStepsForActivation(mergedSteps),
    ];
    if (issues.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot keep automation active with invalid configuration',
          issues,
        },
        { status: 400 }
      );
    }
  }

  if (Object.keys(update).length > 0) {
    const { error: updErr } = await admin
      .from('automations')
      .update(update)
      .eq('id', id)
      .eq('account_id', context.accountId);
    if (updErr)
      return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  if (Array.isArray(body.steps)) {
    const err = await replaceSteps(id, body.steps as BuilderStepInput[]);
    if (err) return NextResponse.json({ error: err }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
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

  const admin = appwriteAdmin();
  const { data: existing } = await admin
    .from('automations')
    .select('id')
    .eq('id', id)
    .eq('account_id', context.accountId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { error } = await admin
    .from('automations')
    .delete()
    .eq('id', id)
    .eq('account_id', context.accountId);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
