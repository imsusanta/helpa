import { getAdminClient } from '@/lib/db/server';
import { insertAutomationRow } from '@/lib/automations/automation-row';
import {
  insertSteps,
  type BuilderStepInput,
} from '@/lib/automations/steps-tree';
import { AUTOMATION_TEMPLATES, type TemplateSlug } from './templates';

const TRAVEL_SEED_SLUGS: TemplateSlug[] = [
  'traveler_intake_greeting',
  'travel_package_enquiry',
  'travel_booking_confirm',
  'travel_payment_followup',
  'travel_documents_reminder',
];

export async function ensureTravelWorkflowsSeeded(opts: {
  accountId: string;
  userId: string;
}): Promise<number> {
  const admin = getAdminClient();
  const { data: existing } = await admin
    .from('automations')
    .select('id, name, metadata')
    .eq('account_id', opts.accountId);

  const existingKeys = new Set<string>();
  const existingNames = new Set<string>();
  for (const row of existing ?? []) {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    if (typeof metadata.workflow_seed_key === 'string') {
      existingKeys.add(metadata.workflow_seed_key);
    }
    if (typeof row.name === 'string' && row.name.trim()) {
      existingNames.add(row.name.trim().toLowerCase());
    }
  }

  let created = 0;
  for (const slug of TRAVEL_SEED_SLUGS) {
    const workflow = AUTOMATION_TEMPLATES[slug];
    if (!workflow) continue;
    if (
      existingKeys.has(slug) ||
      existingNames.has(workflow.name.trim().toLowerCase())
    ) {
      continue;
    }

    const { data: autoRecord, error } = await insertAutomationRow(admin, {
      accountId: opts.accountId,
      userId: opts.userId,
      name: workflow.name,
      description: workflow.description,
      triggerType: workflow.trigger_type,
      triggerConfig:
        (workflow.trigger_config as Record<string, unknown>) || {},
      isActive: true,
      metadata: {
        helpa_seeded_workflow: true,
        workflow_seed_key: slug,
        workflow_industry: 'travel',
      },
    });

    if (error || !autoRecord) {
      console.warn('[travel-seeds] failed to insert', slug, error?.message);
      continue;
    }
    if (workflow.steps?.length) {
      await insertSteps(
        autoRecord.id,
        workflow.steps as unknown as BuilderStepInput[]
      );
    }
    created += 1;
  }

  return created;
}
