import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findExistingContact, getAdminClient } = vi.hoisted(() => ({
  findExistingContact: vi.fn(),
  getAdminClient: vi.fn(),
}));

vi.mock('@/lib/contacts/dedupe', () => ({
  findExistingContact,
  isUniqueViolation: (error: unknown) =>
    Boolean(
      error &&
      typeof error === 'object' &&
      (error as { code?: string }).code === '23505'
    ),
}));

vi.mock('@/lib/supabase/server', () => ({ getAdminClient }));

import { findOrCreateContact } from './contact-service';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CONTACT = {
  id: 'contact-winner',
  account_id: ACCOUNT_ID,
  phone: '+15551234567',
  name: 'Existing patient',
};

function installDb(options: {
  canonicalError?: { code: string; message: string };
  legacyError?: { code: string; message: string };
}) {
  const calls: string[] = [];
  const db = {
    from(table: string) {
      calls.push(table);
      return {
        insert(payload: Record<string, unknown>) {
          calls.push(
            `insert:${table}:${Object.keys(payload).sort().join(',')}`
          );
          return {
            select() {
              return {
                single: async () => {
                  if (table !== 'contacts') return { data: null, error: null };
                  const legacy = Object.hasOwn(payload, 'accountId');
                  const error = legacy
                    ? options.legacyError
                    : options.canonicalError;
                  return { data: error ? null : CONTACT, error: error || null };
                },
              };
            },
          };
        },
      };
    },
  };
  getAdminClient.mockReturnValue(db);
  return calls;
}

describe('findOrCreateContact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adopts the canonical winner after a unique-violation race', async () => {
    const calls = installDb({
      canonicalError: {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      },
    });
    findExistingContact
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(CONTACT);

    const result = await findOrCreateContact(
      ACCOUNT_ID,
      'owner-1',
      '+15551234567',
      'Patient'
    );

    expect(result).toEqual({ contact: CONTACT, wasCreated: false });
    expect(
      calls.filter((call) => call.startsWith('insert:contacts'))
    ).toHaveLength(1);
    expect(findExistingContact).toHaveBeenCalledTimes(2);
  });

  it('re-reads after a legacy unique-violation instead of reporting a false failure', async () => {
    const calls = installDb({
      canonicalError: {
        code: '42703',
        message: 'column account_id does not exist',
      },
      legacyError: {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      },
    });
    findExistingContact
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(CONTACT);

    const result = await findOrCreateContact(
      ACCOUNT_ID,
      'owner-1',
      '+15551234567',
      'Patient'
    );

    expect(result).toEqual({ contact: CONTACT, wasCreated: false });
    expect(
      calls.filter((call) => call.startsWith('insert:contacts'))
    ).toHaveLength(2);
    expect(findExistingContact).toHaveBeenCalledTimes(2);
  });
});
