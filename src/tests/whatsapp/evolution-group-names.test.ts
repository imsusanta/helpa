import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listEvolutionGoGroups,
  listEvolutionGoNewsletters,
  listEvolutionGoContacts,
  getEvolutionGoGroupInfo,
  loadCanonicalWhatsAppConfig,
  decryptProviderToken,
  maybeSingle,
  updateEq,
} = vi.hoisted(() => ({
  listEvolutionGoGroups: vi.fn(),
  listEvolutionGoNewsletters: vi.fn(),
  listEvolutionGoContacts: vi.fn(),
  getEvolutionGoGroupInfo: vi.fn(),
  loadCanonicalWhatsAppConfig: vi.fn(),
  decryptProviderToken: vi.fn(),
  maybeSingle: vi.fn(),
  updateEq: vi.fn(),
}));

vi.mock('@/core/providers/whatsapp/evolution-go-client', () => ({
  listEvolutionGoGroups,
  listEvolutionGoNewsletters,
  listEvolutionGoContacts,
  getEvolutionGoGroupInfo,
}));

vi.mock('@/core/whatsapp/canonical-config', async () => {
  const actual = await vi.importActual<
    typeof import('@/core/whatsapp/canonical-config')
  >('@/core/whatsapp/canonical-config');
  return {
    ...actual,
    loadCanonicalWhatsAppConfig,
    decryptProviderToken,
  };
});

vi.mock('@/lib/db/server', () => ({
  getAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle,
          }),
        }),
      }),
      update: () => ({
        eq: () => ({
          eq: updateEq,
        }),
      }),
    }),
  }),
}));

import { syncEvolutionGroupNamesForInbox } from '@/core/whatsapp/evolution-group-names';

describe('syncEvolutionGroupNamesForInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadCanonicalWhatsAppConfig.mockResolvedValue({
      providerKind: 'evolution',
    });
    decryptProviderToken.mockReturnValue('token');
    maybeSingle.mockResolvedValue({
      data: {
        id: 'contact-1',
        name: '120363111222333444',
        phone: '120363111222333444',
      },
      error: null,
    });
    updateEq.mockResolvedValue({ data: null, error: null });
  });

  it('keeps listed group names and fills leftover placeholders via /group/info', async () => {
    listEvolutionGoGroups.mockResolvedValue([
      { jid: '120363316746745895@g.us', name: 'Helpa Clinic Team' },
      { jid: '120363111222333444@g.us', name: '' },
    ]);
    listEvolutionGoNewsletters.mockResolvedValue([
      { jid: '120363999000111222@newsletter', name: 'Clinic Updates' },
    ]);
    listEvolutionGoContacts.mockResolvedValue([
      {
        jid: '919111222333@s.whatsapp.net',
        name: 'Ravi Kumar',
        saved: true,
      },
    ]);
    getEvolutionGoGroupInfo.mockImplementation(
      async (_token: string, jid: string) => {
        if (jid === '120363111222333444@g.us') {
          return { jid, name: 'OPD Desk' };
        }
        if (jid === '120363555666777888@g.us') {
          return { jid, name: 'Night Shift' };
        }
        return { jid, name: '' };
      }
    );

    const names = await syncEvolutionGroupNamesForInbox('acct-1', [
      {
        phone: '120363555666777888',
        name: '120363555666777888',
        metadata: { whatsapp_jid: '120363555666777888@g.us' },
      },
      {
        phone: '120363999000111222',
        name: '120363999000111222',
        metadata: {
          whatsapp_chat_kind: 'channel',
          whatsapp_jid: '120363999000111222@newsletter',
        },
      },
      {
        phone: '919111222333',
        name: '919111222333',
      },
    ]);

    expect(names.get('120363316746745895')).toBe('Helpa Clinic Team');
    expect(names.get('120363111222333444')).toBe('OPD Desk');
    expect(names.get('120363555666777888')).toBe('Night Shift');
    expect(names.get('120363999000111222')).toBe('Clinic Updates');
    expect(names.get('919111222333')).toBe('Ravi Kumar');
    expect(getEvolutionGoGroupInfo).not.toHaveBeenCalledWith(
      'token',
      '120363999000111222@newsletter'
    );
  });
});
