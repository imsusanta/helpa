/** A provider-reported error attached to a change or an individual message. */
export interface WhatsAppProviderError {
  code?: number;
  title?: string;
  message?: string;
  error_data?: { details?: string };
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  video?: { id: string; mime_type: string; caption?: string };
  document?: {
    id: string;
    mime_type: string;
    filename?: string;
    caption?: string;
  };
  audio?: { id: string; mime_type: string };
  sticker?: { id: string; mime_type: string };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  reaction?: { message_id: string; emoji: string };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  /**
   * Quick-reply button on a *template* message. Distinct from `interactive`:
   * Meta sends `type: 'button'` with this shape when a customer taps a button
   * on a template (which is how appointment reminders are delivered), and
   * `type: 'interactive'` for buttons on a free-form interactive message.
   */
  button?: { text?: string; payload?: string };
  /** Product enquiry / cart submission from a WhatsApp catalog. */
  order?: {
    catalog_id?: string;
    text?: string;
    product_items?: Array<{
      product_retailer_id?: string;
      quantity?: number;
      item_price?: number;
      currency?: string;
    }>;
  };
  /** Shared vCard(s). */
  contacts?: Array<{
    name?: { formatted_name?: string };
    phones?: Array<{ phone?: string; wa_id?: string }>;
  }>;
  /** Group/number-change notifications. */
  system?: { body?: string; type?: string; wa_id?: string };
  /** Present on `type: 'unsupported'` and on partially-failed messages. */
  errors?: WhatsAppProviderError[];
  context?: { id: string };
}

export interface WhatsAppStatusUpdate {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
}

export interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile: { name: string };
        wa_id: string;
      }>;
      messages?: WhatsAppMessage[];
      statuses?: WhatsAppStatusUpdate[];
      errors?: WhatsAppProviderError[];
    };
    field: string;
  }>;
}

export interface ParsedMessageContent {
  contentText: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  interactiveReplyId: string | null;
}
