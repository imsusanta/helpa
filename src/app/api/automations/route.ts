import { NextResponse } from 'next/server';
import { createClient } from '@/lib/appwrite-server-compat';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { getTemplate } from '@/lib/automations/templates';
import {
  insertSteps,
  type BuilderStepInput,
} from '@/lib/automations/steps-tree';
import {
  validateStepsForActivation,
  validateTriggerForActivation,
} from '@/lib/automations/validate';
import { checkPlanLimits } from '@/lib/saas/subscription';

function normalizeAppointmentTrigger(
  name: unknown,
  triggerType: unknown,
  triggerConfig: unknown
): { triggerType: string; triggerConfig: Record<string, unknown> } {
  const normalizedName =
    typeof name === 'string' ? name.trim().toLowerCase() : '';
  const config =
    triggerConfig && typeof triggerConfig === 'object'
      ? { ...(triggerConfig as Record<string, unknown>) }
      : {};

  // Dashboard templates created before the trigger hardening release used
  // `new_message_received` for appointment reminders. Normalize those legacy
  // payloads at the API boundary so existing clients cannot create an
  // automation that claims to be time-based but actually waits for a message.
  if (
    normalizedName === 'appointment reminder' ||
    normalizedName === 'reservation reminder' ||
    normalizedName === 'site visit reminder'
  ) {
    const beforeMinutes =
      normalizedName === 'reservation reminder' ? 120 : 1440;
    return {
      triggerType: 'appointment_reminder',
      triggerConfig: {
        before_minutes:
          Number.isFinite(Number(config.before_minutes)) &&
          Number(config.before_minutes) > 0
            ? Number(config.before_minutes)
            : beforeMinutes,
        timezone:
          typeof config.timezone === 'string' && config.timezone.trim()
            ? config.timezone
            : process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata',
      },
    };
  }

  return {
    triggerType: String(triggerType ?? ''),
    triggerConfig: config,
  };
}

export async function GET() {
  const appwrite = await createClient();
  const {
    data: { user },
  } = await appwrite.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await appwrite
    .from('automations')
    .select('*')
    .order('created_at', { ascending: false });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ automations: data ?? [] });
}

export async function POST(request: Request) {
  const appwrite = await createClient();
  const {
    data: { user },
  } = await appwrite.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Resolve the caller's account_id — `automations.account_id` is NOT
  // NULL post-017, so an INSERT without it trips the not-null constraint
  // even though the admin client bypasses RLS.
  const { data: profile } = await appwrite
    .from('profiles')
    .select('account_id')
    .eq('user_id', user.id)
    .single();
  const accountId = profile?.account_id as string | undefined;
  if (!accountId) {
    return NextResponse.json(
      { error: 'Your profile is not linked to an account.' },
      { status: 403 }
    );
  }

  const autoLimit = await checkPlanLimits(accountId, 'automations');
  if (!autoLimit.allowed) {
    return NextResponse.json(
      {
        code: 'PLAN_LIMIT_REACHED',
        error:
          autoLimit.reason ||
          'Automation limit reached for your current plan.',
        feature: 'automations',
        current: autoLimit.currentUsage,
        limit: autoLimit.limit,
        upgrade_required: true,
      },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body)
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const {
    name,
    description,
    trigger_type,
    trigger_config,
    is_active,
    steps,
    template,
  } = body;

  let effectiveSteps: BuilderStepInput[] | undefined = steps;
  let effectiveName = name;
  let effectiveDescription = description;
  let effectiveTriggerType = trigger_type;
  let effectiveTriggerConfig = trigger_config;

  if (template && (!steps || steps.length === 0)) {
    const t = getTemplate(template);
    if (t) {
      effectiveName = effectiveName ?? t.name;
      effectiveDescription = effectiveDescription ?? t.description;
      effectiveTriggerType = effectiveTriggerType ?? t.trigger_type;
      effectiveTriggerConfig =
        effectiveTriggerConfig ?? t.trigger_config;
      effectiveSteps = t.steps as unknown as BuilderStepInput[];
    }
  }

  const normalized = normalizeAppointmentTrigger(
    effectiveName,
    effectiveTriggerType,
    effectiveTriggerConfig
  );
  effectiveTriggerType = normalized.triggerType;
  effectiveTriggerConfig = normalized.triggerConfig;

  if (!effectiveName || !effectiveTriggerType) {
    return NextResponse.json(
      { error: 'name and trigger_type are required' },
      { status: 400 }
    );
  }

  if (effectiveTriggerType === 'appointment_reminder') {
    const beforeMinutes = Number(
      (effectiveTriggerConfig as Record<string, unknown>).before_minutes
    );
    if (!Number.isFinite(beforeMinutes) || beforeMinutes <= 0) {
      return NextResponse.json(
        {
          error:
            'appointment_reminder requires before_minutes greater than 0',
        },
        { status: 400 }
      );
    }
  }

  // Block activation of a clearly broken automation up-front instead of
  // letting every trigger silently produce a failed log row. Drafts
  // (is_active=false) are allowed to be incomplete so users can save
  // progress mid-build.
  if (is_active) {
    const issues = [
      ...validateTriggerForActivation(
        effectiveTriggerType,
        effectiveTriggerConfig ?? {}
      ),
      ...validateStepsForActivation(
        (effectiveSteps ?? []) as unknown as {
          step_type: string;
          step_config: Record<string, unknown>;
        }[]
      ),
    ];
    if (issues.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot activate automation with invalid configuration',
          issues,
        },
        { status: 400 }
      );
    }
  }

  const admin = appwriteAdmin();
  const { data: automation, error: insertErr } = await admin
    .from('automations')
    .insert({
      user_id: user.id,
      account_id: accountId,
      name: effectiveName,
      description: effectiveDescription ?? null,
      trigger_type: effectiveTriggerType,
      trigger_config: effectiveTriggerConfig ?? {},
      is_active: !!is_active,
    })
    .select()
    .single();

  if (insertErr || !automation) {
    return NextResponse.json(
      { error: insertErr?.message ?? 'insert failed' },
      { status: 500 }
    );
  }

  if (effectiveSteps && effectiveSteps.length > 0) {
    const err = await insertSteps(automation.id, effectiveSteps);
    if (err) return NextResponse.json({ error: err }, { status: 500 });
  }

  return NextResponse.json({ automation }, { status: 201 });
}
