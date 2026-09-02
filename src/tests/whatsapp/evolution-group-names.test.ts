import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listEvolutionGoGroups,
  listEvolutionGoNewsletters,
  listEvolutionGoContacts,
  getEvolutionGoGroupInfo,
  getEvolutionGoAvatar,
  loadCanonicalWhatsAppConfig,
  decryptProviderToken,
  maybeSingle,
  updateEq,
} = vi.hoisted(() => ({
  listEvolutionGoGroups: vi.fn(),
  listEvolutionGoNewsletters: vi.fn(),
  listEvolutionGoContacts: vi.fn(),
  getEvolutionGoGroupInfo: vi.fn(),
  getEvolutionGoAvatar: vi.fn(),
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
  getEvolutionGoAvatar,
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

import {
  getCachedInboxWhatsAppIdentity,
  overlayInboxWhatsAppIdentity,
  resetInboxWhatsAppIdentityCacheForTests,
  scheduleInboxGroupNameSync,
  syncEvolutionGroupNamesForInbox,
} from '@/core/whatsapp/evolution-group-names';

describe('syncEvolutionGroupNamesForInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetInboxWhatsAppIdentityCacheForTests();
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
    getEvolutionGoAvatar.mockResolvedValue('');
  });

  it('keeps listed group names and fills leftover placeholders via /group/info', async () => {
    listEvolutionGoGroups.mockResolvedValue([
      {
        jid: '120363316746745895@g.us',
        name: 'Helpa Clinic Team',
        avatar: 'https://pps.whatsapp.net/group.jpg',
      },
      { jid: '120363111222333444@g.us', name: '' },
    ]);
    listEvolutionGoNewsletters.mockResolvedValue([
      {
        jid: '120363999000111222@newsletter',
        name: 'Clinic Updates',
        avatar: 'https://pps.whatsapp.net/channel.jpg',
      },
    ]);
    listEvolutionGoContacts.mockResolvedValue([
      {
        jid: '919111222333@s.whatsapp.net',
        name: 'Ravi Kumar',
        saved: true,
      },
    ]);
    getEvolutionGoAvatar.mockImplementation(
      async (_token: string, number: string) => {
        if (
          number === '919111222333' ||
          number === '919111222333@s.whatsapp.net'
        ) {
          return 'https://pps.whatsapp.net/ravi.jpg';
        }
        return '';
      }
    );
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

    const { names, avatars } = await syncEvolutionGroupNamesForInbox('acct-1', [
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
    expect(avatars.get('120363316746745895')).toBe(
      'https://pps.whatsapp.net/group.jpg'
    );
    expect(avatars.get('120363999000111222')).toBe(
      'https://pps.whatsapp.net/channel.jpg'
    );
    expect(avatars.get('919111222333')).toBe(
      'https://pps.whatsapp.net/ravi.jpg'
    );
    expect(getEvolutionGoGroupInfo).not.toHaveBeenCalledWith(
      'token',
      '120363999000111222@newsletter'
    );
    expect(getEvolutionGoAvatar).toHaveBeenCalledWith(
      'token',
      '919111222333',
      true
    );
  });

  it('overlays WhatsApp names and profile pictures onto inbox contacts', () => {
    const contact = overlayInboxWhatsAppIdentity(
      {
        phone: '919111222333',
        name: '919111222333',
        avatar_url: undefined as string | undefined,
      },
      {
        names: new Map([['919111222333', 'Ravi Kumar']]),
        avatars: new Map([
          ['919111222333', 'https://pps.whatsapp.net/ravi.jpg'],
        ]),
      }
    );
    expect(contact.name).toBe('Ravi Kumar');
    expect(contact.avatar_url).toBe('https://pps.whatsapp.net/ravi.jpg');
  });

  it('caches inbox identity and skips a second Evolution sync during cooldown', async () => {
    listEvolutionGoGroups.mockResolvedValue([
      {
        jid: '120363316746745895@g.us',
        name: 'Helpa Clinic Team',
        avatar: 'https://pps.whatsapp.net/group.jpg',
      },
    ]);
    listEvolutionGoNewsletters.mockResolvedValue([]);
    listEvolutionGoContacts.mockResolvedValue([]);

    expect(getCachedInboxWhatsAppIdentity('acct-1').names.size).toBe(0);

    scheduleInboxGroupNameSync('acct-1', [
      { phone: '120363316746745895', name: '120363316746745895' },
    ]);
    scheduleInboxGroupNameSync('acct-1', [
      { phone: '120363316746745895', name: '120363316746745895' },
    ]);

    await vi.waitFor(() => {
      expect(
        getCachedInboxWhatsAppIdentity('acct-1').names.get('120363316746745895')
      ).toBe('Helpa Clinic Team');
    });

    expect(listEvolutionGoGroups).toHaveBeenCalledTimes(1);

    scheduleInboxGroupNameSync('acct-1', [
      { phone: '120363316746745895', name: '120363316746745895' },
    ]);
    expect(listEvolutionGoGroups).toHaveBeenCalledTimes(1);
  });
});
