import { describe, expect, it } from 'vitest';
import { automationAuthorId, insertAutomationRow } from './insert-row';

function fakeAdmin(options: {
  rejectColumn?: string;
  store: Array<Record<string, unknown>>;
}) {
  return {
    from: () => ({
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            if (
              options.rejectColumn &&
              row[options.rejectColumn] !== undefined
            ) {
              return {
                data: null,
                error: {
                  message: `Could not find the '${options.rejectColumn}' column of 'automations' in the schema cache`,
                },
              };
            }
            const created = { id: `auto-${options.store.length + 1}`, ...row };
            options.store.push(created);
            return { data: created, error: null };
          },
        }),
      }),
    }),
  };
}

describe('insertAutomationRow', () => {
  it('writes created_by when that column exists', async () => {
    const store: Array<Record<string, unknown>> = [];
    const result = await insertAutomationRow(fakeAdmin({ store }), {
      accountId: 'acct-1',
      userId: 'user-1',
      name: 'Booking Confirm',
      triggerType: 'keyword_match',
      isActive: true,
    });
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      account_id: 'acct-1',
      created_by: 'user-1',
      name: 'Booking Confirm',
    });
    expect(store[0]).not.toHaveProperty('user_id');
  });

  it('falls back to user_id when created_by is missing', async () => {
    const store: Array<Record<string, unknown>> = [];
    const result = await insertAutomationRow(
      fakeAdmin({ store, rejectColumn: 'created_by' }),
      {
        accountId: 'acct-1',
        userId: 'user-1',
        name: 'Booking Confirm',
        triggerType: 'keyword_match',
      }
    );
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      account_id: 'acct-1',
      user_id: 'user-1',
    });
  });

  it('does not retry when the first insert fails for another reason', async () => {
    const admin = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({
              data: null,
              error: { message: 'duplicate key value' },
            }),
          }),
        }),
      }),
    };
    const result = await insertAutomationRow(admin, {
      accountId: 'acct-1',
      userId: 'user-1',
      name: 'Booking Confirm',
      triggerType: 'keyword_match',
    });
    expect(result.error?.message).toBe('duplicate key value');
  });
});

describe('automationAuthorId', () => {
  it('prefers user_id and falls back to created_by', () => {
    expect(automationAuthorId({ user_id: 'u1', created_by: 'u2' })).toBe('u1');
    expect(automationAuthorId({ created_by: 'u2' })).toBe('u2');
    expect(automationAuthorId({})).toBeUndefined();
  });
});
