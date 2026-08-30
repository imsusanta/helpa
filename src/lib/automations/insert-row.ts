type InsertResult = {
  data: Record<string, unknown> | null;
  error: { message?: string } | null;
};

type ThenableInsert = {
  then: (
    onfulfilled?: ((value: InsertResult) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null
  ) => unknown;
};

type AutomationInsertClient = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => {
      select: (columns?: string) => {
        single: () => ThenableInsert;
      };
    };
  };
};

export type AutomationInsertInput = {
  accountId: string;
  userId: string;
  name: string;
  description?: string | null;
  triggerType: string;
  triggerConfig?: Record<string, unknown>;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
};

function isMissingColumnError(
  error: { message?: string } | null,
  column: string
) {
  const message = error?.message ?? '';
  return (
    message.includes(`'${column}'`) ||
    message.includes(`"${column}"`) ||
    message.toLowerCase().includes(`the ${column} column`)
  );
}

function basePayload(input: AutomationInsertInput): Record<string, unknown> {
  return {
    account_id: input.accountId,
    name: input.name,
    description: input.description ?? null,
    trigger_type: input.triggerType,
    trigger_config: input.triggerConfig ?? {},
    is_active: !!input.isActive,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

/**
 * Production automations use `created_by`. Older local snapshots still have
 * `user_id`. Try the live column first, then fall back.
 */
export async function insertAutomationRow(
  admin: AutomationInsertClient,
  input: AutomationInsertInput
): Promise<{
  data: ({ id: string } & Record<string, unknown>) | null;
  error: { message?: string } | null;
}> {
  const base = basePayload(input);
  const createdByResult = await admin
    .from('automations')
    .insert({ ...base, created_by: input.userId })
    .select()
    .single();

  if (!createdByResult.error && createdByResult.data) {
    return asInsertResult(createdByResult);
  }

  if (!isMissingColumnError(createdByResult.error, 'created_by')) {
    return asInsertResult(createdByResult);
  }

  return asInsertResult(
    await admin
      .from('automations')
      .insert({ ...base, user_id: input.userId })
      .select()
      .single()
  );
}

function asInsertResult(result: {
  data: { id?: string } | Record<string, unknown> | null;
  error: { message?: string } | null;
}): {
  data: ({ id: string } & Record<string, unknown>) | null;
  error: { message?: string } | null;
} {
  const id =
    result.data && typeof result.data === 'object' && 'id' in result.data
      ? result.data.id
      : undefined;
  return {
    data:
      typeof id === 'string'
        ? ({ ...(result.data as Record<string, unknown>), id } as {
            id: string;
          } & Record<string, unknown>)
        : null,
    error: result.error,
  };
}

export function automationAuthorId(row: {
  user_id?: string | null;
  created_by?: string | null;
}): string | undefined {
  return row.user_id || row.created_by || undefined;
}
