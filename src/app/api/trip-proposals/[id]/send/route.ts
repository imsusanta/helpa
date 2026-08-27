import { NextRequest, NextResponse } from 'next/server';
import {
  requireRole,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import { sendTextMessage } from '@/lib/whatsapp/meta-api';
import { decrypt } from '@/lib/whatsapp/encryption';
import {
  sanitizePhoneForMeta,
  phoneVariants,
} from '@/lib/whatsapp/phone-utils';
import { findOrCreateConversation } from '@/app/api/whatsapp/webhook/conversation-service';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

function requestId(request: NextRequest): string {
  return request.headers.get('x-request-id') ?? crypto.randomUUID();
}

function errorResponse(
  status: number,
  code: string,
  correlationId: string,
  message?: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: code,
      message: message || code,
      requestId: correlationId,
    },
    { status, headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
  );
}

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: Params
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    const ctx = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json().catch(() => ({}));

    // 1. Fetch Trip Proposal
    const { data: proposal, error: propErr } = await supabase
      .from('trip_proposals')
      .select('*, contacts(id, name, phone, email), accounts(name)')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (propErr || !proposal) {
      return errorResponse(
        404,
        'PROPOSAL_NOT_FOUND',
        correlationId,
        'Trip proposal not found.'
      );
    }

    const contact = proposal.contacts as {
      id: string;
      name?: string;
      phone?: string;
      email?: string;
    } | null;
    const recipientPhone = body.phone || contact?.phone;

    if (!recipientPhone) {
      return errorResponse(
        400,
        'PHONE_REQUIRED',
        correlationId,
        'Recipient phone number is required to send proposal via WhatsApp.'
      );
    }

    // 2. Fetch active WhatsApp Configuration
    const { data: config } = await supabase
      .from('whatsapp_configs')
      .select('*')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!config || !config.phone_number_id) {
      return errorResponse(
        400,
        'WHATSAPP_NOT_CONFIGURED',
        correlationId,
        'Active WhatsApp business configuration not found for this account. Please connect WhatsApp in Settings.'
      );
    }

    const rawEncryptedToken = String(
      config.access_token_encrypted ||
        config.encrypted_access_token ||
        config.accessTokenEncrypted ||
        config.access_token ||
        ''
    );

    let accessToken = rawEncryptedToken;
    try {
      if (rawEncryptedToken.includes(':')) {
        accessToken = decrypt(rawEncryptedToken);
      }
    } catch {
      // use raw token if not encrypted
    }

    if (!accessToken) {
      return errorResponse(
        400,
        'TOKEN_INVALID',
        correlationId,
        'WhatsApp access token could not be decrypted or is missing.'
      );
    }

    // 3. Build WhatsApp Message Body
    const agencyName =
      (proposal.accounts as { name?: string })?.name || 'Helpa Travel';
    const travelerName = contact?.name || 'Traveler';
    const destination = proposal.destination || 'Tour Destination';
    const duration = `${proposal.duration_days || 1} Days / ${proposal.duration_nights || 0} Nights`;
    const dates = proposal.start_date
      ? proposal.end_date
        ? `${proposal.start_date} to ${proposal.end_date}`
        : `Starting ${proposal.start_date}`
      : 'Flexible Dates';
    const guests = `${proposal.adults_count || 1} Adults${proposal.children_count ? `, ${proposal.children_count} Children` : ''}`;
    const totalPrice = Number(proposal.total_price || 0).toLocaleString(
      'en-IN'
    );

    const appBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.headers.get('origin') ||
      'https://www.helpa.studio';
    const proposalUrl = `${appBaseUrl.replace(/\/$/, '')}/proposals/${proposal.id}`;

    let customText = body.custom_message;
    if (!customText) {
      const inclusionsList = (proposal.inclusions || [])
        .slice(0, 4)
        .map((inc: string) => `  • ${inc}`)
        .join('\n');

      customText =
        `✈️ *TRIP PROPOSAL: ${proposal.title.toUpperCase()}*\n_${agencyName}_\n\n` +
        `Hello *${travelerName}*! Here is your custom tour proposal for *${destination}*:\n\n` +
        `📍 *Destination:* ${destination}\n` +
        `⏱️ *Duration:* ${duration}\n` +
        `📅 *Travel Dates:* ${dates}\n` +
        `👥 *Guests:* ${guests}\n` +
        (proposal.hotel_details
          ? `🏨 *Accommodation:* ${proposal.hotel_details}\n`
          : '') +
        (proposal.transport_details
          ? `🚗 *Transport:* ${proposal.transport_details}\n`
          : '') +
        `\n💰 *Total Package Price:* ₹${totalPrice} (All Inclusive)\n\n` +
        (inclusionsList ? `✨ *Key Inclusions:*\n${inclusionsList}\n\n` : '') +
        `📄 *View Full Itinerary & Details Online:*\n${proposalUrl}\n\n` +
        `_Reply *YES* to confirm your booking, or let us know if you would like any customizations!_`;
    }

    // 4. Send Message via Meta WhatsApp Cloud API
    const sanitized = sanitizePhoneForMeta(recipientPhone);
    const variants = phoneVariants(sanitized);
    let metaMessageId: string | null = null;
    let lastSendError: Error | null = null;

    for (const variant of variants) {
      try {
        const result = await sendTextMessage({
          phoneNumberId: config.phone_number_id,
          accessToken,
          to: variant,
          text: customText,
        });
        metaMessageId = result.messageId;
        break;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        lastSendError = err instanceof Error ? err : new Error(msg);
      }
    }

    if (!metaMessageId) {
      console.warn('[trip-proposals/send] Meta send error:', lastSendError);
      return errorResponse(
        502,
        'WHATSAPP_SEND_FAILED',
        correlationId,
        lastSendError?.message ||
          'Meta WhatsApp API was unable to deliver message to recipient phone.'
      );
    }

    // 5. Persist Outbound Message in Conversation & Messages table
    let conversationId: string | null = null;
    if (contact?.id) {
      try {
        const conv = await findOrCreateConversation(
          ctx.accountId,
          ctx.userId,
          contact.id,
          'whatsapp'
        );
        conversationId = (conv?.id as string) || null;
      } catch {
        // continue
      }
    }

    const nowIso = new Date().toISOString();

    if (conversationId) {
      try {
        await supabase.from('messages').insert({
          account_id: ctx.accountId,
          conversation_id: conversationId,
          direction: 'outbound',
          sender_type: 'agent',
          content_type: 'text',
          content_text: customText,
          status: 'sent',
          message_id: metaMessageId,
          provider_message_id: metaMessageId,
          created_at: nowIso,
          updated_at: nowIso,
        });

        await supabase
          .from('conversations')
          .update({
            last_message_text: `[Trip Proposal] ${proposal.title}`,
            last_message_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', conversationId);
      } catch (msgErr) {
        console.error(
          '[trip-proposals/send] Failed to record message row:',
          msgErr
        );
      }
    }

    // 6. Update Proposal Status
    await supabase
      .from('trip_proposals')
      .update({
        status: 'sent',
        sent_at: nowIso,
        sent_channel: 'whatsapp',
        updated_at: nowIso,
      })
      .eq('id', id);

    return NextResponse.json(
      {
        success: true,
        message: 'Trip proposal sent via WhatsApp successfully.',
        data: {
          proposal_id: id,
          proposal_number: proposal.proposal_number,
          whatsapp_message_id: metaMessageId,
          recipient_phone: recipientPhone,
          proposal_url: proposalUrl,
          sent_at: nowIso,
        },
      },
      { status: 200, headers: PRIVATE_HEADERS }
    );
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(
        401,
        'UNAUTHORIZED',
        correlationId,
        'Authentication required'
      );
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'FORBIDDEN', correlationId, error.message);
    }
    console.error('[trip-proposals/send] Unexpected error:', error);
    return errorResponse(
      500,
      'INTERNAL_SERVER_ERROR',
      correlationId,
      'Failed to send trip proposal via WhatsApp.'
    );
  }
}
