/**
 * Helpa Real Estate Module — Follow-up Service
 *
 * Automated post-inquiry & post-site visit follow-up management.
 */

import { getAdminClient } from '@/lib/db/server';
import { coreEvents } from '@/core/events';

export interface RealEstateFollowUp {
  id: string;
  accountId: string;
  leadId: string;
  leadName: string;
  leadMobile: string;
  propertyTitle?: string;
  followUpDate: string; // YYYY-MM-DD
  reason: string;
  assignedAgent?: string;
  status: 'Pending' | 'Completed' | 'Cancelled' | 'Overdue';
  createdAt: string;
}

export async function scheduleRealEstateFollowUp({
  accountId,
  leadId,
  leadName,
  leadMobile,
  propertyTitle,
  daysInterval = 2,
  reason,
  assignedAgent,
}: {
  accountId: string;
  leadId: string;
  leadName: string;
  leadMobile: string;
  propertyTitle?: string;
  daysInterval?: number;
  reason?: string;
  assignedAgent?: string;
}): Promise<RealEstateFollowUp> {
  const db = getAdminClient();

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysInterval);
  const followUpDateStr = targetDate.toISOString().split('T')[0];

  const { data: created, error } = await db
    .from('follow_ups')
    .insert({
      account_id: accountId,
      patient_id: leadId,
      patient_name: leadName,
      patient_mobile: leadMobile,
      doctor_name: assignedAgent || propertyTitle || 'Agent',
      follow_up_date: followUpDateStr,
      reason: reason || `Follow-up for ${propertyTitle || 'Property inquiry'}`,
      status: 'Pending',
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error || !created) {
    return {
      id: `fup-re-${Date.now()}`,
      accountId,
      leadId,
      leadName,
      leadMobile,
      propertyTitle,
      followUpDate: followUpDateStr,
      reason: reason || `Follow-up for ${propertyTitle || 'Property inquiry'}`,
      assignedAgent,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };
  }

  coreEvents.emit('followup.scheduled', accountId, {
    followUpId: created.id,
    leadName,
    leadMobile,
    propertyTitle,
    followUpDate: followUpDateStr,
    timestamp: new Date().toISOString(),
  });

  return {
    id: created.id,
    accountId: created.account_id,
    leadId: created.patient_id,
    leadName: created.patient_name,
    leadMobile: created.patient_mobile,
    propertyTitle,
    followUpDate: created.follow_up_date,
    reason: created.reason,
    assignedAgent: created.doctor_name,
    status: created.status,
    createdAt: created.created_at,
  };
}
