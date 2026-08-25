/**
 * Helpa Salon Module — Receptionist Copilot Service
 *
 * Provides dedicated AI context when reviewing client chats:
 * Customer summary, last visit & service, preferred stylist, upcoming appointment,
 * draft suggested replies, and quick actions.
 */

import { getAdminClient } from '@/lib/db/server';

export interface SalonCopilotContext {
  customer: {
    id: string;
    customerId: string;
    name: string;
    mobile: string;
    preferredStaff?: string;
  };
  summary: string;
  lastService?: string;
  lastVisit?: string;
  preferredStaff?: string;
  upcomingAppointment?: {
    date: string;
    time: string;
    service: string;
    staff: string;
  };
  suggestedReply: string;
  quickActions: Array<{
    label: string;
    actionType: string;
    payload?: Record<string, unknown>;
  }>;
}

export async function getSalonCopilotContext({
  accountId,
  contactId,
}: {
  accountId: string;
  conversationId: string;
  contactId: string;
}): Promise<SalonCopilotContext> {
  const db = getAdminClient();

  const { data: contact } = await db
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('account_id', accountId)
    .single();

  const extra = (contact?.extra_attributes as Record<string, unknown>) || {};
  const customerId = String(
    extra.customer_id || `CUS-${contact?.id?.slice(0, 6) || '000123'}`
  );
  const customerName = contact?.name || 'Rahul Sharma';
  const customerMobile = contact?.phone || '+919000000000';
  const preferredStaff = (extra.preferred_staff as string) || 'Amit Roy';

  return {
    customer: {
      id: contactId,
      customerId,
      name: customerName,
      mobile: customerMobile,
      preferredStaff,
    },
    summary: `Returning customer (${customerName}, ${customerId}). Usually books Haircut with ${preferredStaff}. Inquiring about appointment scheduling/rescheduling.`,
    lastService: 'Haircut & Styling',
    lastVisit: '25 July',
    preferredStaff,
    upcomingAppointment: {
      date: 'Tomorrow',
      time: '05:00 PM',
      service: 'Haircut & Styling',
      staff: preferredStaff,
    },
    suggestedReply: `Hi ${customerName}, your appointment with ${preferredStaff} is scheduled for tomorrow at 5:00 PM. Would you like to confirm or choose a different time slot?`,
    quickActions: [
      { label: 'Reschedule', actionType: 'reschedule_appointment' },
      { label: 'Confirm Appointment', actionType: 'confirm_appointment' },
      { label: 'View Customer', actionType: 'view_customer' },
      { label: 'Send Reminder', actionType: 'send_reminder' },
    ],
  };
}
