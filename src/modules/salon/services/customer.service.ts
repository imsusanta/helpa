/**
 * Helpa Salon Module — Customer Service
 *
 * Customer CRM, unique Customer ID generation (CUS-XXXXXX),
 * preferred stylists/services tracking, visit history, and retention timelines.
 */

import { getAdminClient } from '@/lib/appwrite-server-compat';

export interface SalonCustomerRecord {
  id: string;
  accountId: string;
  customerId: string; // e.g. CUS-000123
  name: string;
  phone: string;
  email?: string;
  gender?: string;
  preferredStaff?: string;
  preferredServices?: string[];
  totalVisits: number;
  cancelledAppointments: number;
  noShows: number;
  lastVisit?: string;
  nextAppointment?: string;
  notes?: string;
  createdAt: string;
}

/**
 * Generates the next sequential unique Customer ID (e.g. CUS-000123) for a salon workspace.
 */
export async function generateNextCustomerId(accountId: string): Promise<string> {
  const db = getAdminClient();
  const { data: contacts } = await db
    .from('contacts')
    .select('extra_attributes')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(50);

  let maxSeq = 0;
  if (contacts && contacts.length > 0) {
    for (const c of contacts) {
      const extra = (c.extra_attributes as Record<string, unknown>) || {};
      const cusId = String(extra.customer_id || extra.customer_seq_id || '');
      const match = cusId.match(/CUS-(\d+)/i);
      if (match && match[1]) {
        const seq = parseInt(match[1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `CUS-${nextSeq.toString().padStart(6, '0')}`;
}

/**
 * Retrieves a salon customer by mobile number or creates one with unique Customer ID.
 */
export async function getOrCreateSalonCustomer({
  accountId,
  name,
  phone,
  email,
  gender,
  preferredStaff,
  preferredServices,
  notes,
}: {
  accountId: string;
  name: string;
  phone: string;
  email?: string;
  gender?: string;
  preferredStaff?: string;
  preferredServices?: string[];
  notes?: string;
}): Promise<SalonCustomerRecord> {
  const db = getAdminClient();
  const cleanPhone = phone.replace(/[^\d+]/g, '');

  // 1. Check existing customer
  const { data: existing } = await db
    .from('contacts')
    .select('*')
    .eq('account_id', accountId)
    .or(`phone.eq.${cleanPhone},phone.eq.${cleanPhone.replace('+', '')}`)
    .maybeSingle();

  if (existing) {
    const extra = (existing.extra_attributes as Record<string, unknown>) || {};
    return {
      id: existing.id,
      accountId: existing.account_id,
      customerId: String(extra.customer_id || `CUS-${existing.id.slice(0, 6)}`),
      name: existing.name,
      phone: existing.phone,
      email: existing.email,
      gender: extra.gender as string,
      preferredStaff: (extra.preferred_staff as string) || preferredStaff,
      preferredServices: (extra.preferred_services as string[]) || preferredServices,
      totalVisits: Number(extra.total_visits || 0),
      cancelledAppointments: Number(extra.cancelled_appointments || 0),
      noShows: Number(extra.no_shows || 0),
      lastVisit: extra.last_visit as string,
      nextAppointment: extra.next_appointment as string,
      notes: existing.notes,
      createdAt: existing.created_at,
    };
  }

  // 2. Create new customer
  const customerId = await generateNextCustomerId(accountId);
  const extraAttributes = {
    customer_id: customerId,
    gender,
    preferred_staff: preferredStaff,
    preferred_services: preferredServices || [],
    total_visits: 0,
    cancelled_appointments: 0,
    no_shows: 0,
    created_via: 'salon_customer_service',
  };

  const { data: created, error } = await db
    .from('contacts')
    .insert({
      account_id: accountId,
      name: name.trim(),
      phone: cleanPhone,
      email,
      notes,
      extra_attributes: extraAttributes,
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error || !created) {
    throw new Error(`Failed to create salon customer: ${error?.message || 'DB error'}`);
  }

  return {
    id: created.id,
    accountId: created.account_id,
    customerId,
    name: created.name,
    phone: created.phone,
    email: created.email,
    gender,
    preferredStaff,
    preferredServices,
    totalVisits: 0,
    cancelledAppointments: 0,
    noShows: 0,
    notes,
    createdAt: created.created_at,
  };
}
