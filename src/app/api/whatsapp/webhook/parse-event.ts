import { getMediaUrl } from '@/lib/whatsapp/meta-api';
import type { WhatsAppMessage, ParsedMessageContent } from './types';

/**
 * Parses message payload content based on WhatsApp message type
 * (text, image, video, document, audio, sticker, location, reaction,
 * interactive, button, order, contacts, system, request_welcome, unsupported).
 */
export async function parseMessageContent(
  message: WhatsAppMessage,
  accessToken: string
): Promise<ParsedMessageContent> {
  const verifyAndBuildUrl = async (mediaId: string): Promise<string | null> => {
    try {
      await getMediaUrl({ mediaId, accessToken });
      return `/api/whatsapp/media/${mediaId}`;
    } catch (error) {
      console.error(
        `Failed to verify media ${mediaId} with Meta:`,
        error instanceof Error ? error.message : error
      );
      return null;
    }
  };

  const empty: ParsedMessageContent = {
    contentText: null,
    mediaUrl: null,
    mediaType: null,
    interactiveReplyId: null,
  };

  switch (message.type) {
    case 'text':
      return { ...empty, contentText: message.text?.body || null };

    case 'image':
      if (message.image?.id) {
        return {
          ...empty,
          contentText: message.image.caption || null,
          mediaUrl: await verifyAndBuildUrl(message.image.id),
          mediaType: message.image.mime_type,
        };
      }
      return empty;

    case 'video':
      if (message.video?.id) {
        return {
          ...empty,
          contentText: message.video.caption || null,
          mediaUrl: await verifyAndBuildUrl(message.video.id),
          mediaType: message.video.mime_type,
        };
      }
      return empty;

    case 'document':
      if (message.document?.id) {
        return {
          ...empty,
          contentText:
            message.document.caption || message.document.filename || null,
          mediaUrl: await verifyAndBuildUrl(message.document.id),
          mediaType: message.document.mime_type,
        };
      }
      return empty;

    case 'audio':
      if (message.audio?.id) {
        return {
          ...empty,
          mediaUrl: await verifyAndBuildUrl(message.audio.id),
          mediaType: message.audio.mime_type,
        };
      }
      return empty;

    case 'sticker':
      if (message.sticker?.id) {
        return {
          ...empty,
          mediaUrl: await verifyAndBuildUrl(message.sticker.id),
          mediaType: message.sticker.mime_type,
        };
      }
      return empty;

    case 'location':
      if (message.location) {
        const loc = message.location;
        const locationText = [
          loc.name,
          loc.address,
          `${loc.latitude},${loc.longitude}`,
        ]
          .filter(Boolean)
          .join(' - ');
        return { ...empty, contentText: locationText };
      }
      return empty;

    case 'reaction':
      return { ...empty, contentText: message.reaction?.emoji || null };

    case 'interactive': {
      const reply =
        message.interactive?.button_reply ?? message.interactive?.list_reply;
      if (reply?.id) {
        return {
          ...empty,
          contentText: reply.title || reply.id,
          interactiveReplyId: reply.id,
        };
      }
      return { ...empty, contentText: '[Interactive reply]' };
    }

    // A quick-reply tap on a *template* message. Meta uses `type: 'button'`
    // here — NOT `type: 'interactive'` — and puts the developer-defined value
    // in `button.payload`. This is how appointment-reminder confirmations
    // arrive, so the payload must reach `interactiveReplyId` for the reminder
    // handler in process-message.ts to recognise them.
    case 'button': {
      const payload = message.button?.payload ?? null;
      const label = message.button?.text ?? null;
      if (payload || label) {
        return {
          ...empty,
          contentText: label || payload,
          interactiveReplyId: payload || null,
        };
      }
      return { ...empty, contentText: '[Button reply]' };
    }

    case 'order': {
      const items = message.order?.product_items ?? [];
      const summary = message.order?.text
        ? message.order.text
        : `[Order: ${items.length} item${items.length === 1 ? '' : 's'}]`;
      return { ...empty, contentText: summary };
    }

    case 'contacts': {
      const names = (message.contacts ?? [])
        .map((c) => c.name?.formatted_name)
        .filter(Boolean);
      return {
        ...empty,
        contentText: names.length
          ? `[Shared contact: ${names.join(', ')}]`
          : '[Shared contact]',
      };
    }

    case 'system':
      return {
        ...empty,
        contentText: message.system?.body
          ? `[${message.system.body}]`
          : '[System notification]',
      };

    // Customer tapped a "call to action" / opted into messaging. Carries no
    // body, but must still land in the thread so the agent sees the contact.
    case 'request_welcome':
      return { ...empty, contentText: '[Conversation started]' };

    // Meta itself could not render the message (e.g. an unsupported type on
    // the sender's client). It ships the reason in `errors`.
    case 'unsupported': {
      const detail =
        message.errors?.[0]?.title ?? message.errors?.[0]?.message ?? null;
      return {
        ...empty,
        contentText: detail
          ? `[Unsupported message: ${detail}]`
          : '[Unsupported message]',
      };
    }

    default:
      return {
        ...empty,
        contentText: `[Unsupported message type: ${message.type}]`,
      };
  }
}
