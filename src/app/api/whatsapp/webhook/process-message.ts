import { getAdminClient } from '@/lib/appwrite-server-compat';
import type { Database } from '@/types/database';
import { normalizePhone } from '@/lib/whatsapp/phone-utils';
import { runAutomationsForTrigger } from '@/lib/automations/engine';
import { dispatchInboundToFlows } from '@/lib/flows/engine';
import { triggerAiResponse } from '@/lib/whatsapp/ai';
import { parseMessageContent } from './parse-event';
import { findOrCreateContact } from './contact-service';
import {
  findOrCreateConversation,
  lookupInternalIdByMetaId,
  flagBroadcastReplyIfAny,
} from './conversation-service';
import { handleReaction } from './process-reaction';
import type { WhatsAppMessage } from './types';

export async function handleReminderReplyAction(
  accountId: string,
  apptId: string,
  action: string,
  conversationId: string,
  contactId: string,
  userId: string
): Promise<boolean> {
  const db = getAdminClient();

  // 1. Fetch appointment details
  const { data: appt, error: apptErr } = await db
    .from('appointments')
    .select(
      'id, appointment_date, appointment_time, doctor:hospital_doctors(id, name, department)'
    )
    .eq('id', apptId)
    .single();

  if (apptErr || !appt) {
    console.error('[Reminder Interceptor] Appointment not found:', apptErr);
    return false;
  }

  const docData = appt.doctor as
    | { name: string; id?: string; department?: string }
    | Array<{ name: string; id?: string; department?: string }>
    | null;
  const docName =
    (Array.isArray(docData) ? docData[0]?.name : docData?.name) || 'Doctor';
  const apptDate = appt.appointment_date || 'N/A';
  const apptTime = appt.appointment_time
    ? appt.appointment_time.substring(0, 5)
    : 'N/A';

  const { engineSendText } = await import('@/lib/automations/meta-send');

  if (action === 'confirm') {
    await db
      .from('appointments')
      .update({ status: 'Confirmed' })
      .eq('id', apptId);

    await db.from('contact_notes').insert({
      account_id: accountId,
      contact_id: contactId,
      note_text: `[Timeline] Patient Confirmed Appointment via WhatsApp for Dr. ${docName} on ${apptDate} at ${apptTime}.`,
    });

    await engineSendText({
      accountId,
      userId,
      conversationId,
      contactId,
      text: `Thank you! Your appointment with Dr. ${docName} on ${apptDate} at ${apptTime} has been successfully confirmed. We look forward to seeing you.`,
    });

    await db.from('messages').insert({
      conversation_id: conversationId,
      sender_type: 'bot',
      content_type: 'text',
      content_text: `[System Alert] Patient confirmed their appointment with Dr. ${docName} on ${apptDate} at ${apptTime}.`,
      status: 'sent',
    });

    return true;
  }

  if (action === 'resched') {
    await db
      .from('appointments')
      .update({ status: 'Reschedule Requested' })
      .eq('id', apptId);

    await db.from('contact_notes').insert({
      account_id: accountId,
      contact_id: contactId,
      note_text: `[Timeline] Patient Requested Reschedule via WhatsApp for appointment with Dr. ${docName} on ${apptDate} at ${apptTime}.`,
    });

    await engineSendText({
      accountId,
      userId,
      conversationId,
      contactId,
      text: `Certainly! I will help you reschedule your appointment with Dr. ${docName}. Please reply with your preferred new date and time, and I will check availability for you.`,
    });

    await db.from('messages').insert({
      conversation_id: conversationId,
      sender_type: 'bot',
      content_type: 'text',
      content_text: `[System Alert] Patient requested a reschedule for their appointment with Dr. ${docName} on ${apptDate} at ${apptTime}.`,
      status: 'sent',
    });

    return true;
  }

  if (action === 'cancel') {
    await db
      .from('appointments')
      .update({ status: 'Cancelled' })
      .eq('id', apptId);

    await db.from('contact_notes').insert({
      account_id: accountId,
      contact_id: contactId,
      note_text: `[Timeline] Patient Cancelled Appointment via WhatsApp for Dr. ${docName} on ${apptDate} at ${apptTime}.`,
    });

    await engineSendText({
      accountId,
      userId,
      conversationId,
      contactId,
      text: `Your appointment with Dr. ${docName} on ${apptDate} at ${apptTime} has been cancelled as requested. If you wish to schedule a new visit in the future, please let us know.`,
    });

    await db.from('messages').insert({
      conversation_id: conversationId,
      sender_type: 'bot',
      content_type: 'text',
      content_text: `[System Alert] Patient cancelled their appointment with Dr. ${docName} on ${apptDate} at ${apptTime}.`,
      status: 'sent',
    });

    return true;
  }

  return false;
}

export async function handleReportButtonReply(
  accountId: string,
  reportId: string,
  action: 'download' | 'status',
  conversationId: string,
  contactId: string,
  userId: string
): Promise<boolean> {
  const db = getAdminClient();

  const { data: report, error } = await db
    .from('hospital_lab_reports')
    .select(
      'id, test_name, status, expected_delivery_date, report_pdf_url, department, doctor:hospital_doctors(name)'
    )
    .eq('id', reportId)
    .single();

  if (error || !report) {
    console.error('[Report Button] Report not found:', error);
    return false;
  }

  const { engineSendText, engineSendDocument } =
    await import('@/lib/automations/meta-send');
  const docData = report.doctor as
    { name: string } | Array<{ name: string }> | null;
  const docName =
    (Array.isArray(docData) ? docData[0]?.name : docData?.name) || 'Doctor';

  if (action === 'download' && report.report_pdf_url) {
    await engineSendDocument({
      accountId,
      userId,
      conversationId,
      contactId,
      documentUrl: report.report_pdf_url,
      filename: `${report.test_name.replace(/\s+/g, '_')}_Report.pdf`,
      caption: `Here is your ${report.test_name} report from Dr. ${docName}.`,
    });
    return true;
  }

  let statusMsg = '';
  switch (report.status) {
    case 'pending':
      statusMsg = `Your *${report.test_name}* report request has been received.\n\n📋 Status: *Pending*\n📅 Expected Delivery: ${report.expected_delivery_date || 'To be determined'}\n\nWe will notify you as soon as it becomes available.`;
      break;
    case 'processing':
      statusMsg = `Your *${report.test_name}* report is currently being processed.\n\n📋 Status: *Processing*\n📅 Expected Completion: ${report.expected_delivery_date || 'To be determined'}\n\nThank you for your patience.`;
      break;
    case 'ready':
      statusMsg = `Great news! Your *${report.test_name}* report is now *Ready*!\n\n🏥 Department: ${report.department || 'General'}\n👨‍⚕️ Doctor: Dr. ${docName}\n\n${report.report_pdf_url ? 'Your report PDF is being sent now.' : 'Please visit the hospital reception to collect your report.'}`;
      if (report.report_pdf_url) {
        engineSendDocument({
          accountId,
          userId,
          conversationId,
          contactId,
          documentUrl: report.report_pdf_url,
          filename: `${report.test_name.replace(/\s+/g, '_')}_Report.pdf`,
          caption: `${report.test_name} Report`,
        }).catch((e) => console.error('[Report Button] PDF send error:', e));
      }
      break;
    case 'delivered':
      statusMsg = `Your *${report.test_name}* report has already been delivered.\n\nIf you need another copy, please contact the hospital reception.`;
      break;
    default:
      statusMsg = `Your *${report.test_name}* report status is: ${report.status}.`;
  }

  await engineSendText({
    accountId,
    userId,
    conversationId,
    contactId,
    text: statusMsg,
  });
  return true;
}

export async function processMessage(
  message: WhatsAppMessage,
  contact: { profile: { name: string }; wa_id: string },
  accountId: string,
  configOwnerUserId: string,
  accessToken: string
) {
  const senderPhone = normalizePhone(message.from);
  const contactName = contact.profile.name;

  // Find or create contact
  const contactOutcome = await findOrCreateContact(
    accountId,
    configOwnerUserId,
    senderPhone,
    contactName
  );
  if (!contactOutcome) return;
  const contactRecord = contactOutcome.contact;

  // Find or create conversation
  const conversation = await findOrCreateConversation(
    accountId,
    configOwnerUserId,
    contactRecord.id
  );
  if (!conversation) return;
  const convId = String(conversation.id);

  // Reactions short-circuit
  if (message.type === 'reaction') {
    await handleReaction(message, convId, contactRecord.id);
    return;
  }

  // Parse message content
  const { contentText, mediaUrl, mediaType, interactiveReplyId } =
    await parseMessageContent(message, accessToken);
  void mediaType;

  // Resolve reply context if present
  let replyToInternalId: string | null = null;
  if (message.context?.id) {
    replyToInternalId = await lookupInternalIdByMetaId(
      message.context.id,
      convId
    );
    if (!replyToInternalId) {
      console.warn(
        '[webhook] reply context parent not found:',
        message.context.id
      );
    }
  }

  const ALLOWED_CONTENT_TYPES = new Set([
    'text',
    'image',
    'document',
    'audio',
    'video',
    'location',
    'template',
    'interactive',
  ]);
  type MessageContentType =
    Database['public']['Tables']['messages']['Row']['content_type'];
  const contentType: MessageContentType = ALLOWED_CONTENT_TYPES.has(
    message.type
  )
    ? (message.type as MessageContentType)
    : message.type === 'sticker'
      ? 'image'
      : 'text';

  // Deduplication check: ignore duplicate webhook deliveries for the same Meta message ID
  const { data: existingMsg } = await getAdminClient()
    .from('messages')
    .select('id')
    .eq('message_id', message.id)
    .limit(1)
    .catch(() => ({ data: null }));

  if (existingMsg && existingMsg.length > 0) {
    console.log(`[webhook] Duplicate messageId ${message.id} ignored.`);
    return;
  }

  const { count: priorCustomerMsgCount } = await getAdminClient()
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', convId)
    .catch(() => ({ count: 0 }));
  const isFirstInboundMessage = (priorCustomerMsgCount ?? 0) === 0;

  const nowIso = new Date(parseInt(message.timestamp) * 1000).toISOString();
  let msgError: unknown = null;

  const insertRes = await getAdminClient()
    .from('messages')
    .insert({
      conversation_id: convId,
      sender_type: 'customer',
      content_type: contentType,
      content_text: contentText || null,
      media_url: mediaUrl || null,
      message_id: message.id,
      status: 'delivered',
      reply_to_message_id: replyToInternalId || null,
      interactive_reply_id: interactiveReplyId || null,
      created_at: nowIso,
      updated_at: nowIso,
    });

  if (insertRes.error) {
    // Fallback to legacy schema
    const legacyRes = await getAdminClient()
      .from('messages')
      .insert({
        conversationId: convId,
        senderType: 'customer',
        contentType: contentType,
        contentText: contentText || null,
        mediaUrl: mediaUrl || null,
        messageId: message.id,
        status: 'delivered',
        replyToMessageId: replyToInternalId || null,
        interactiveReplyId: interactiveReplyId || null,
        createdAt: nowIso,
      });
    msgError = legacyRes.error;
  }

  if (msgError) {
    console.error('Error inserting message:', msgError);
    return;
  }

  // Update conversation
  const messageDate = new Date(parseInt(message.timestamp) * 1000);
  const existingLastMessageAt =
    conversation.lastMessageAt || conversation.last_message_at
      ? new Date(
          (conversation.lastMessageAt || conversation.last_message_at) as string
        )
      : null;
  const shouldUpdatePreview =
    !existingLastMessageAt || messageDate >= existingLastMessageAt;

  const currentUnread = Number(
    conversation.unread_count || conversation.unreadCount || 0
  );

  const convUpdatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    unread_count: currentUnread + 1,
  };

  if (shouldUpdatePreview) {
    convUpdatePayload.last_message_text = contentText || `[${message.type}]`;
    convUpdatePayload.last_message_at = messageDate.toISOString();
  }

  const { error: convError } = await getAdminClient()
    .from('conversations')
    .update(convUpdatePayload)
    .eq('id', convId);

  if (convError) {
    // Legacy fallback
    const legacyPayload: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
      unreadCount: currentUnread + 1,
    };
    if (shouldUpdatePreview) {
      legacyPayload.lastMessageText = contentText || `[${message.type}]`;
      legacyPayload.lastMessageAt = messageDate.toISOString();
    }
    await getAdminClient()
      .from('conversations')
      .update(legacyPayload)
      .eq('id', convId)
      .catch(() => {});
  }

  await flagBroadcastReplyIfAny(accountId, contactRecord.id);

  // Smart Interceptions (Reminders & Reports)
  try {
    let reminderHandled = false;

    if (
      interactiveReplyId &&
      (interactiveReplyId.startsWith('rem_confirm_') ||
        interactiveReplyId.startsWith('rem_resched_') ||
        interactiveReplyId.startsWith('rem_cancel_'))
    ) {
      const parts = interactiveReplyId.split('_');
      const action = parts[1];
      const apptId = parts[2];

      reminderHandled = await handleReminderReplyAction(
        accountId,
        apptId,
        action,
        convId,
        contactRecord.id,
        configOwnerUserId
      );
    } else {
      const cleanedText = (contentText || '').trim().toLowerCase();

      const { data: reminderAppt } = await getAdminClient()
        .from('appointments')
        .select('id, status')
        .eq('account_id', accountId)
        .eq('patient_id', contactRecord.id)
        .eq('status', 'Reminder Sent')
        .order('appointment_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reminderAppt) {
        let matchedAction: 'confirm' | 'resched' | 'cancel' | null = null;
        const isConfirm = [
          '1',
          'confirm',
          'yes',
          'coming',
          "i'll be there",
          'ill be there',
        ].includes(cleanedText);
        const isResched = [
          '2',
          'reschedule',
          'change time',
          'another date',
          'change date',
          'resched',
        ].includes(cleanedText);
        const isCancel = [
          '3',
          'cancel',
          "i can't come",
          'cant come',
          'cannot come',
        ].includes(cleanedText);

        if (isConfirm) matchedAction = 'confirm';
        else if (isResched) matchedAction = 'resched';
        else if (isCancel) matchedAction = 'cancel';

        if (matchedAction) {
          reminderHandled = await handleReminderReplyAction(
            accountId,
            reminderAppt.id,
            matchedAction,
            convId,
            contactRecord.id,
            configOwnerUserId
          );
        }
      }
    }

    if (reminderHandled) return;

    // Report Status button replies
    let reportHandled = false;
    if (
      interactiveReplyId &&
      (interactiveReplyId.startsWith('report_download_') ||
        interactiveReplyId.startsWith('report_status_'))
    ) {
      const reportId = interactiveReplyId.replace(
        /^report_(download|status)_/,
        ''
      );
      reportHandled = await handleReportButtonReply(
        accountId,
        reportId,
        interactiveReplyId.startsWith('report_download_')
          ? 'download'
          : 'status',
        convId,
        contactRecord.id,
        configOwnerUserId
      );
    }

    if (reportHandled) return;
  } catch (err) {
    console.error(
      '[Webhook Interception] Failed to process action safely:',
      err
    );
  }

  // Flow runner, Automations, AI
  try {
    const flowResult = await dispatchInboundToFlows({
      accountId,
      userId: configOwnerUserId,
      contactId: contactRecord.id,
      conversationId: convId,
      message: interactiveReplyId
        ? {
            kind: 'interactive_reply',
            reply_id: interactiveReplyId,
            reply_title: contentText ?? '',
            meta_message_id: message.id,
          }
        : {
            kind: 'text',
            text: contentText ?? message.text?.body ?? '',
            meta_message_id: message.id,
          },
      isFirstInboundMessage,
    });
    const flowConsumed = flowResult.consumed;

    const inboundText = contentText ?? message.text?.body ?? '';
    const automationTriggers: (
      | 'new_contact_created'
      | 'first_inbound_message'
      | 'new_message_received'
      | 'keyword_match'
    )[] = [];

    if (!flowConsumed) {
      automationTriggers.push('new_message_received', 'keyword_match');
    }
    if (contactOutcome.wasCreated)
      automationTriggers.unshift('new_contact_created');
    if (isFirstInboundMessage)
      automationTriggers.unshift('first_inbound_message');

    const automationPromise = (async () => {
      for (const triggerType of automationTriggers) {
        try {
          await runAutomationsForTrigger({
            accountId,
            triggerType,
            contactId: contactRecord.id,
            context: {
              message_text: inboundText,
              conversation_id: convId,
            },
          });
        } catch (err) {
          console.error('[automations] dispatch failed:', err);
        }
      }
    })();

    const aiPromise = (async () => {
      if (conversation.ai_chat_enabled !== false && !flowConsumed) {
        try {
          await triggerAiResponse({
            accountId,
            userId: configOwnerUserId,
            conversationId: convId,
            contactId: contactRecord.id,
          });
        } catch (err) {
          console.error('[AI Assistant] trigger error:', err);
        }
      }
    })();

    await Promise.all([automationPromise, aiPromise]);
  } catch (backgroundErr) {
    console.error('[Webhook Background execution] error:', backgroundErr);
  }
}
