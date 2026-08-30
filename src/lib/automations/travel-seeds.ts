import { getAdminClient } from '@/lib/db/server';
import {
  insertSteps,
  type BuilderStepInput,
} from '@/lib/automations/steps-tree';
import { workflowsConfig } from '@/modules/travel/workflows';

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
  for (const workflow of workflowsConfig) {
    if (
      existingKeys.has(workflow.seedKey) ||
      existingNames.has(workflow.name.trim().toLowerCase())
    ) {
      continue;
    }

    const { data: autoRecord, error } = await admin
      .from('automations')
      .insert({
        account_id: opts.accountId,
        user_id: opts.userId,
        name: workflow.name,
        description: workflow.description,
        trigger_type: workflow.trigger_type,
        trigger_config: workflow.trigger_config || {},
        is_active: workflow.is_active,
        metadata: {
          helpa_seeded_workflow: true,
          workflow_seed_key: workflow.seedKey,
          workflow_industry: 'travel',
        },
      })
      .select('id')
      .single();

    if (error || !autoRecord) continue;
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
