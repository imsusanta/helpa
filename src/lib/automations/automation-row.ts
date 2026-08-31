import type { AdminClient } from '@/lib/db/server';

export type AutomationOwnerRow = {
  user_id?: string | null;
  created_by?: string | null;
};

/** Production automations use `created_by`; older local snapshots still have `user_id`. */
export function automationAuthorId(
  row: AutomationOwnerRow,
  fallback?: string | null
): string | null {
  return row.user_id || row.created_by || fallback || null;
}

export async function insertAutomationRow(
  admin: AdminClient,
  input: {
    accountId: string;
    userId: string;
    name: string;
    description?: string | null;
    triggerType: string;
    triggerConfig?: Record<string, unknown>;
    isActive?: boolean;
    metadata?: Record<string, unknown>;
  }
) {
  const base = {
    account_id: input.accountId,
    name: input.name,
    description: input.description ?? null,
    trigger_type: input.triggerType,
    trigger_config: input.triggerConfig ?? {},
    is_active: !!input.isActive,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };

  const createdByResult = await admin
    .from('automations')
    .insert({ ...base, created_by: input.userId })
    .select()
    .single();

  if (!createdByResult.error && createdByResult.data) {
    return createdByResult;
  }

  const message = createdByResult.error?.message ?? '';
  if (!/user_id|created_by|schema cache|column/i.test(message)) {
    return createdByResult;
  }

  return admin
    .from('automations')
    .insert({ ...base, user_id: input.userId } as never)
    .select()
    .single();
}
