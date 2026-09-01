import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseMessageContent } from './parse-event';
import type { WhatsAppMessage } from './types';

const { getMediaUrlMock } = vi.hoisted(() => ({
  getMediaUrlMock: vi.fn(),
}));

vi.mock('@/lib/whatsapp/meta-api', () => ({
  getMediaUrl: getMediaUrlMock,
}));

const ACCESS_TOKEN = 'tok';

function msg(partial: Partial<WhatsAppMessage>): WhatsAppMessage {
  return {
    id: 'wamid.1',
    from: '919999999999',
    timestamp: '1700000000',
    type: 'text',
    ...partial,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getMediaUrlMock.mockResolvedValue(undefined);
});

describe('parseMessageContent', () => {
  it('parses text bodies', async () => {
    const r = await parseMessageContent(
      msg({ type: 'text', text: { body: 'hello' } }),
      ACCESS_TOKEN
    );
    expect(r.contentText).toBe('hello');
    expect(r.mediaUrl).toBeNull();
  });

  it('returns null text when a text message has no body', async () => {
    const r = await parseMessageContent(
      msg({ type: 'text', text: { body: '' } }),
      ACCESS_TOKEN
    );
    expect(r.contentText).toBeNull();
  });

  it('builds a verified media URL for images with caption', async () => {
    const r = await parseMessageContent(
      msg({
        type: 'image',
        image: { id: 'img1', mime_type: 'image/jpeg', caption: 'photo' },
      }),
      ACCESS_TOKEN
    );
    expect(getMediaUrlMock).toHaveBeenCalledWith({
      mediaId: 'img1',
      accessToken: ACCESS_TOKEN,
    });
    expect(r.contentText).toBe('photo');
    expect(r.mediaUrl).toBe('/api/whatsapp/media/img1');
    expect(r.mediaType).toBe('image/jpeg');
  });

  it('returns empty for image without an id', async () => {
    const r = await parseMessageContent(
      msg({ type: 'image', image: undefined }),
      ACCESS_TOKEN
    );
    expect(r.mediaUrl).toBeNull();
    expect(getMediaUrlMock).not.toHaveBeenCalled();
  });

  it('returns null mediaUrl when media verification fails', async () => {
    getMediaUrlMock.mockRejectedValue(new Error('404'));
    const r = await parseMessageContent(
      msg({
        type: 'video',
        video: { id: 'v1', mime_type: 'video/mp4', caption: 'clip' },
      }),
      ACCESS_TOKEN
    );
    expect(r.contentText).toBe('clip');
    expect(r.mediaUrl).toBeNull();
  });

  it('uses caption then filename for documents', async () => {
    const r = await parseMessageContent(
      msg({
        type: 'document',
        document: {
          id: 'd1',
          mime_type: 'application/pdf',
          filename: 'report.pdf',
        },
      }),
      ACCESS_TOKEN
    );
    expect(r.contentText).toBe('report.pdf');
    expect(r.mediaUrl).toBe('/api/whatsapp/media/d1');
  });

  it('prefers caption over filename for documents', async () => {
    const r = await parseMessageContent(
      msg({
        type: 'document',
        document: {
          id: 'd1',
          mime_type: 'application/pdf',
          filename: 'report.pdf',
          caption: 'my report',
        },
      }),
      ACCESS_TOKEN
    );
    expect(r.contentText).toBe('my report');
  });

  it('parses audio and sticker without caption', async () => {
    const a = await parseMessageContent(
      msg({ type: 'audio', audio: { id: 'a1', mime_type: 'audio/ogg' } }),
      ACCESS_TOKEN
    );
    expect(a.mediaUrl).toBe('/api/whatsapp/media/a1');
    expect(a.contentText).toBeNull();

    const s = await parseMessageContent(
      msg({ type: 'sticker', sticker: { id: 's1', mime_type: 'image/webp' } }),
      ACCESS_TOKEN
    );
    expect(s.mediaUrl).toBe('/api/whatsapp/media/s1');
  });

  it('formats location with name, address and coordinates', async () => {
    const r = await parseMessageContent(
      msg({
        type: 'location',
        location: {
          latitude: 12.34,
          longitude: 56.78,
          name: 'Clinic',
          address: 'Main St',
        },
      }),
      ACCESS_TOKEN
    );
    expect(r.contentText).toBe('Clinic - Main St - 12.34,56.78');
  });

  it('formats location with only coordinates', async () => {
    const r = await parseMessageContent(
      msg({
        type: 'location',
        location: { latitude: 12.34, longitude: 56.78 },
      }),
      ACCESS_TOKEN
    );
    expect(r.contentText).toBe('12.34,56.78');
  });

  it('parses reactions into contentText', async () => {
    const r = await parseMessageContent(
      msg({ type: 'reaction', reaction: { message_id: 'm1', emoji: '👍' } }),
      ACCESS_TOKEN
    );
    expect(r.contentText).toBe('👍');
  });

  it('parses interactive button replies with title', async () => {
    const r = await parseMessageContent(
      msg({
        type: 'interactive',
        interactive: {
          type: 'button_reply',
          button_reply: { id: 'b1', title: 'Confirm' },
        },
      }),
      ACCESS_TOKEN
    );
    expect(r.contentText).toBe('Confirm');
    expect(r.interactiveReplyId).toBe('b1');
  });

  it('falls back to id for interactive replies without title', async () => {
    const r = await parseMessageContent(
      msg({
        type: 'interactive',
        interactive: {
          type: 'list_reply',
          list_reply: { id: 'l1', title: '' },
        },
      }),
      ACCESS_TOKEN
    );
    expect(r.contentText).toBe('l1');
    expect(r.interactiveReplyId).toBe('l1');
  });

  it('returns a placeholder for interactive with no reply', async () => {
    const r = await parseMessageContent(
      msg({ type: 'interactive', interactive: { type: 'button_reply' } }),
      ACCESS_TOKEN
    );
    expect(r.contentText).toBe('[Interactive reply]');
    expect(r.interactiveReplyId).toBeNull();
  });

  it('parses template button replies with payload', async () => {
    const r = await parseMessageContent(
      msg({
        type: 'button',
        button: { text: 'Confirm appointment', payload: 'confirm_123' },
      }),
      ACCESS_TOKEN
    );
    expect(r.contentText).toBe('Confirm appointment');
    expect(r.interactiveReplyId).toBe('confirm_123');
  });

  it('uses label when payload is absent for buttons', async () => {
    const r = await parseMessageContent(
      msg({ type: 'button', button: { text: 'Reschedule' } }),
      ACCESS_TOKEN
    );
    expect(r.contentText).toBe('Reschedule');
    expect(r.interactiveReplyId).toBeNull();
  });

  it('returns a placeholder for empty buttons', async () => {
    const r = await parseMessageContent(msg({ type: 'button' }), ACCESS_TOKEN);
    expect(r.contentText).toBe('[Button reply]');
  });

  it('summarises orders with and without text', async () => {
    const withText = await parseMessageContent(
      msg({ type: 'order', order: { text: '2 x Paracetamol' } }),
      ACCESS_TOKEN
    );
    expect(withText.contentText).toBe('2 x Paracetamol');

    const withoutText = await parseMessageContent(
      msg({
        type: 'order',
        order: { product_items: [{}, {}, {}] },
      }),
      ACCESS_TOKEN
    );
    expect(withoutText.contentText).toBe('[Order: 3 items]');

    const single = await parseMessageContent(
      msg({ type: 'order', order: { product_items: [{}] } }),
      ACCESS_TOKEN
    );
    expect(single.contentText).toBe('[Order: 1 item]');
  });

  it('formats shared contacts', async () => {
    const r = await parseMessageContent(
      msg({
        type: 'contacts',
        contacts: [
          { name: { formatted_name: 'Alice' } },
          { name: { formatted_name: 'Bob' } },
        ],
      }),
      ACCESS_TOKEN
    );
    expect(r.contentText).toBe('[Shared contact: Alice, Bob]');
  });

  it('handles empty contacts list', async () => {
    const r = await parseMessageContent(
      msg({ type: 'contacts' }),
      ACCESS_TOKEN
    );
    expect(r.contentText).toBe('[Shared contact]');
  });

  it('formats system notifications with and without body', async () => {
    const withBody = await parseMessageContent(
      msg({ type: 'system', system: { body: 'customer changed number' } }),
      ACCESS_TOKEN
    );
    expect(withBody.contentText).toBe('[customer changed number]');

    const noBody = await parseMessageContent(
      msg({ type: 'system' }),
      ACCESS_TOKEN
    );
    expect(noBody.contentText).toBe('[System notification]');
  });

  it('handles request_welcome', async () => {
    const r = await parseMessageContent(
      msg({ type: 'request_welcome' }),
      ACCESS_TOKEN
    );
    expect(r.contentText).toBe('[Conversation started]');
  });

  it('formats unsupported messages with error detail', async () => {
    const withTitle = await parseMessageContent(
      msg({
        type: 'unsupported',
        errors: [{ title: 'Unsupported type' }],
      }),
      ACCESS_TOKEN
    );
    expect(withTitle.contentText).toBe(
      '[Unsupported message: Unsupported type]'
    );

    const withMessage = await parseMessageContent(
      msg({
        type: 'unsupported',
        errors: [{ message: 'cannot render' }],
      }),
      ACCESS_TOKEN
    );
    expect(withMessage.contentText).toBe(
      '[Unsupported message: cannot render]'
    );

    const none = await parseMessageContent(
      msg({ type: 'unsupported' }),
      ACCESS_TOKEN
    );
    expect(none.contentText).toBe('[Unsupported message]');
  });

  it('falls back to the type name for unknown types', async () => {
    const r = await parseMessageContent(
      msg({ type: 'totally_unknown' }),
      ACCESS_TOKEN
    );
    expect(r.contentText).toBe('[Unsupported message type: totally_unknown]');
  });
});
