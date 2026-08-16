/**
 * Helpa Salon Module — Follow-up & Retention Service
 *
 * Post-visit rebooking reminders and retention workflows.
 */

import { getAdminClient } from '@/lib/appwrite-server-compat';
import { coreEvents } from '@/core/events';

export interface SalonFollowUp {
  id: string;
  accountId: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  serviceName: string;
  lastVisitDate: string; // YYYY-MM-DD
  followUpDate: string; // YYYY-MM-DD
  status: 'Pending' | 'Completed' | 'Cancelled';
  assignedStaff?: string;
  notes?: string;
  createdAt: string;
}

export async function scheduleSalonFollowUp({
  accountId,
  customerId,
  customerName,
  customerMobile,
  serviceName,
  daysInterval = 30,
  assignedStaff,
}: {
  accountId: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  serviceName: string;
  daysInterval?: number;
  assignedStaff?: string;
}): Promise<SalonFollowUp> {
  const db = getAdminClient();

  const todayStr = new Date().toISOString().split('T')[0];
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysInterval);
  const followUpDateStr = targetDate.toISOString().split('T')[0];

  const { data: created, error } = await db
    .from('follow_ups')
    .insert({
      account_id: accountId,
      patient_id: customerId,
      patient_name: customerName,
      patient_mobile: customerMobile,
      doctor_name: assignedStaff || serviceName,
      follow_up_date: followUpDateStr,
      reason: `Salon retention reminder for ${serviceName}`,
      status: 'Pending',
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error || !created) {
    return {
      id: `fup-sal-${Date.now()}`,
      accountId,
      customerId,
      customerName,
      customerMobile,
      serviceName,
      lastVisitDate: todayStr,
      followUpDate: followUpDateStr,
      status: 'Pending',
      assignedStaff,
      createdAt: new Date().toISOString(),
    };
  }

  coreEvents.emit('followup.scheduled', accountId, {
    followUpId: created.id,
    customerName,
    customerMobile,
    serviceName,
    followUpDate: followUpDateStr,
    timestamp: new Date().toISOString(),
  });

  return {
    id: created.id,
    accountId: created.account_id,
    customerId: created.patient_id,
    customerName: created.patient_name,
    customerMobile: created.patient_mobile,
    serviceName,
    lastVisitDate: todayStr,
    followUpDate: created.follow_up_date,
    status: created.status,
    assignedStaff: created.doctor_name,
    createdAt: created.created_at,
  };
}
