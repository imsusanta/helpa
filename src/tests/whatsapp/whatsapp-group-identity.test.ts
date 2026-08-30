import { describe, expect, it } from 'vitest';
import {
  WHATSAPP_GROUP_FALLBACK_NAME,
  extractWhatsAppGroupSubject,
  formatGroupInboundText,
  inboundWhatsAppContactName,
  isHiddenWhatsAppInboxChat,
  isPlaceholderContactName,
  isWhatsAppChannelJid,
  isWhatsAppCollectiveAddress,
  isWhatsAppGroupAddress,
  isWhatsAppGroupJid,
  parseWhatsAppSenderPreview,
  resolvedWhatsAppContactName,
  whatsappChatKind,
  formatWhatsAppDisplayPhone,
  whatsappChatKindLabel,
  whatsappContactDisplayName,
} from '@/core/whatsapp/group-identity';

const GROUP_ID = '120363316746745895';
const GROUP_JID = `${GROUP_ID}@g.us`;

describe('WhatsApp group identity', () => {
  it('detects group JIDs and stored group keys', () => {
    expect(isWhatsAppGroupJid(GROUP_JID)).toBe(true);
    expect(isWhatsAppGroupJid('919111222333@s.whatsapp.net')).toBe(false);
    expect(isWhatsAppGroupAddress(GROUP_JID)).toBe(true);
    expect(isWhatsAppGroupAddress(GROUP_ID)).toBe(true);
    expect(isWhatsAppGroupAddress('919111222333')).toBe(false);
    expect(isWhatsAppGroupAddress('+919111222333')).toBe(false);
    expect(isWhatsAppGroupAddress('120363999@newsletter')).toBe(false);
  });

  it('detects WhatsApp channels and classifies chat kind', () => {
    const channelJid = '120363999000111222@newsletter';
    expect(isWhatsAppChannelJid(channelJid)).toBe(true);
    expect(isWhatsAppChannelJid('status@broadcast')).toBe(false);
    expect(isWhatsAppCollectiveAddress(channelJid)).toBe(true);
    expect(whatsappChatKind(channelJid)).toBe('channel');
    expect(whatsappChatKind(GROUP_JID)).toBe('group');
    expect(whatsappChatKind('919111222333')).toBe('direct');
    expect(whatsappChatKind(GROUP_ID, { whatsapp_chat_kind: 'channel' })).toBe(
      'channel'
    );
    expect(whatsappChatKindLabel('group')).toBe('Group');
    expect(whatsappChatKindLabel('channel')).toBe('Channel');
    expect(isHiddenWhatsAppInboxChat(channelJid)).toBe(false);
    expect(
      isHiddenWhatsAppInboxChat(GROUP_ID, { whatsapp_chat_kind: 'channel' })
    ).toBe(false);
    expect(isHiddenWhatsAppInboxChat(GROUP_JID)).toBe(false);
    expect(isHiddenWhatsAppInboxChat('919111222333')).toBe(false);
  });

  it('parses WhatsApp-style sender: body list previews', () => {
    expect(parseWhatsAppSenderPreview('Ravi: hello')).toEqual({
      sender: 'Ravi',
      body: 'hello',
    });
    expect(parseWhatsAppSenderPreview('plain message')).toEqual({
      sender: '',
      body: 'plain message',
    });
    expect(parseWhatsAppSenderPreview('https://example.com: 80')).toEqual({
      sender: '',
      body: 'https://example.com: 80',
    });
    expect(parseWhatsAppSenderPreview('120363316746745895: hi')).toEqual({
      sender: '',
      body: '120363316746745895: hi',
    });
  });

  it('treats raw group ids as placeholder names', () => {
    expect(isPlaceholderContactName(GROUP_ID, GROUP_ID)).toBe(true);
    expect(
      isPlaceholderContactName(WHATSAPP_GROUP_FALLBACK_NAME, GROUP_ID)
    ).toBe(true);
    expect(isPlaceholderContactName('Clinic Team', GROUP_ID)).toBe(false);
    expect(isPlaceholderContactName('Alice', '919111222333')).toBe(false);
  });

  it('does not use sender pushName as a group title', () => {
    expect(resolvedWhatsAppContactName('', GROUP_JID, 'Ravi')).toBe('');
    expect(
      inboundWhatsAppContactName(
        {
          event: 'Message',
          data: {
            key: { remoteJid: GROUP_JID, fromMe: false, id: 'm1' },
            pushName: 'Ravi',
            message: { conversation: 'hello' },
          },
        },
        GROUP_ID
      )
    ).toBe('');
  });

  it('extracts a group subject from GroupInfo and JoinedGroup payloads', () => {
    expect(
      extractWhatsAppGroupSubject({
        JID: GROUP_JID,
        Name: { Name: 'Helpa Clinic Team' },
      })
    ).toBe('Helpa Clinic Team');
    expect(
      extractWhatsAppGroupSubject({
        JID: GROUP_JID,
        GroupName: { Name: 'Joined Clinic Group' },
      })
    ).toBe('Joined Clinic Group');
    expect(
      inboundWhatsAppContactName(
        {
          event: 'Message',
          data: {
            key: { remoteJid: GROUP_JID, id: 'm2', fromMe: false },
            Info: { Chat: GROUP_JID, Name: { Name: 'OPD Updates' } },
            pushName: 'Sender',
          },
        },
        GROUP_ID
      )
    ).toBe('OPD Updates');
    expect(
      extractWhatsAppGroupSubject({
        id: '120363999000111222@newsletter',
        thread_metadata: { name: { text: 'Clinic Updates' } },
      })
    ).toBe('Clinic Updates');
  });

  it('keeps 1:1 pushName titles', () => {
    expect(
      inboundWhatsAppContactName(
        {
          event: 'Message',
          data: {
            key: {
              remoteJid: '919111222333@s.whatsapp.net',
              id: 'm3',
              fromMe: false,
            },
            pushName: 'Patient',
          },
        },
        '919111222333'
      )
    ).toBe('Patient');
  });

  it('shows the real group name and never the WhatsApp group label', () => {
    expect(whatsappContactDisplayName(GROUP_ID, GROUP_ID)).toBe('');
    expect(
      whatsappContactDisplayName(WHATSAPP_GROUP_FALLBACK_NAME, GROUP_ID)
    ).toBe('');
    expect(whatsappContactDisplayName('Helpa Clinic Team', GROUP_ID)).toBe(
      'Helpa Clinic Team'
    );
    expect(whatsappContactDisplayName('Alice', '919111222333')).toBe('Alice');
    expect(whatsappContactDisplayName('919609200394', '919609200394')).toBe(
      '+919609200394'
    );
    expect(whatsappContactDisplayName('', '919609200394')).toBe(
      '+919609200394'
    );
  });

  it('writes country-coded WhatsApp numbers with a leading +', () => {
    expect(formatWhatsAppDisplayPhone('919609200394')).toBe('+919609200394');
    expect(formatWhatsAppDisplayPhone('+919609200394')).toBe('+919609200394');
    expect(formatWhatsAppDisplayPhone('+91 96092 00394')).toBe('+919609200394');
    expect(formatWhatsAppDisplayPhone(GROUP_ID)).toBe('');
    expect(formatWhatsAppDisplayPhone(`${GROUP_ID}@g.us`)).toBe('');
  });

  it('labels group messages with the sender so the thread stays readable', () => {
    expect(formatGroupInboundText('Ravi', 'hello')).toBe('Ravi: hello');
    expect(formatGroupInboundText('Ravi', '', 'image')).toBe('Ravi: [image]');
    expect(formatGroupInboundText('Ravi', 'Ravi: already labeled')).toBe(
      'Ravi: already labeled'
    );
  });
});
