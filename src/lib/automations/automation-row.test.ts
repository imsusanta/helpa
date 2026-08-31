import { describe, expect, it, vi } from 'vitest';

import { automationAuthorId, insertAutomationRow } from './automation-row';

describe('automationAuthorId', () => {
  it('prefers user_id, then created_by, then fallback', () => {
    expect(automationAuthorId({ user_id: 'u1', created_by: 'c1' }, 'f1')).toBe(
      'u1'
    );
    expect(automationAuthorId({ created_by: 'c1' }, 'f1')).toBe('c1');
    expect(automationAuthorId({}, 'f1')).toBe('f1');
    expect(automationAuthorId({})).toBeNull();
  });
});

describe('insertAutomationRow', () => {
  it('writes created_by on the production schema', async () => {
    const insert = vi.fn(() => ({
      select: () => ({
        single: async () => ({
          data: { id: 'auto-1', created_by: 'user-1' },
          error: null,
        }),
      }),
    }));
    const admin = { from: () => ({ insert }) };
    const result = await insertAutomationRow(admin as never, {
      accountId: 'acct-1',
      userId: 'user-1',
      name: 'Booking Confirm',
      triggerType: 'keyword_match',
      isActive: true,
    });
    expect(result.data?.id).toBe('auto-1');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: 'acct-1',
        created_by: 'user-1',
        name: 'Booking Confirm',
      })
    );
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('retries with user_id when created_by is missing from the schema cache', async () => {
    const insert = vi
      .fn()
      .mockImplementationOnce(() => ({
        select: () => ({
          single: async () => ({
            data: null,
            error: {
              message:
                "Could not find the 'created_by' column of 'automations' in the schema cache",
            },
          }),
        }),
      }))
      .mockImplementationOnce(() => ({
        select: () => ({
          single: async () => ({
            data: { id: 'auto-2', user_id: 'user-1' },
            error: null,
          }),
        }),
      }));
    const admin = { from: () => ({ insert }) };
    const result = await insertAutomationRow(admin as never, {
      accountId: 'acct-1',
      userId: 'user-1',
      name: 'Traveler Intake Greeting',
      triggerType: 'first_inbound_message',
    });
    expect(result.data?.id).toBe('auto-2');
    expect(insert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ user_id: 'user-1' })
    );
  });
});
