/**
 * Helpa Health Module — Follow-up Service
 *
 * Manages post-consultation patient follow-ups, scheduled intervals (3d, 7d, 30d),
 * and automated WhatsApp follow-up reminders.
 */

import { getAdminClient } from '@/lib/appwrite-server-compat';
import { coreEvents } from '@/core/events';

export interface HealthFollowUp {
  id: string;
  accountId: string;
  patientId: string;
  patientName: string;
  patientMobile: string;
  doctorName: string;
  followUpDate: string; // YYYY-MM-DD
  reason: string;
  status: 'Pending' | 'Completed' | 'Cancelled';
  createdAt: string;
}

export async function scheduleHealthFollowUp({
  accountId,
  patientId,
  patientName,
  patientMobile,
  doctorName,
  daysInterval,
  reason,
}: {
  accountId: string;
  patientId: string;
  patientName: string;
  patientMobile: string;
  doctorName: string;
  daysInterval: number; // e.g. 7, 14, 30
  reason?: string;
}): Promise<HealthFollowUp> {
  const db = getAdminClient();

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysInterval);
  const followUpDateStr = targetDate.toISOString().split('T')[0];

  const { data: created, error } = await db
    .from('follow_ups')
    .insert({
      account_id: accountId,
      patient_id: patientId,
      patient_name: patientName,
      patient_mobile: patientMobile,
      doctor_name: doctorName,
      follow_up_date: followUpDateStr,
      reason: reason || `Routine follow-up after ${daysInterval} days`,
      status: 'Pending',
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error || !created) {
    throw new Error(`Failed to schedule follow-up: ${error?.message || 'Database error'}`);
  }

  // Emit event for automated notification
  coreEvents.emit('followup.scheduled', accountId, {
    followUpId: created.id,
    patientName,
    patientMobile,
    doctorName,
    followUpDate: followUpDateStr,
    timestamp: new Date().toISOString(),
  });

  return {
    id: created.id,
    accountId: created.account_id,
    patientId: created.patient_id,
    patientName: created.patient_name,
    patientMobile: created.patient_mobile,
    doctorName: created.doctor_name,
    followUpDate: created.follow_up_date,
    reason: created.reason,
    status: created.status,
    createdAt: created.created_at,
  };
}

export async function getDueFollowUps(accountId: string): Promise<HealthFollowUp[]> {
  const db = getAdminClient();
  const todayStr = new Date().toISOString().split('T')[0];

  const { data: rows } = await db
    .from('follow_ups')
    .select('*')
    .eq('account_id', accountId)
    .eq('status', 'Pending')
    .lte('follow_up_date', todayStr);

  return (rows || []).map((r) => ({
    id: r.id,
    accountId: r.account_id,
    patientId: r.patient_id,
    patientName: r.patient_name,
    patientMobile: r.patient_mobile,
    doctorName: r.doctor_name,
    followUpDate: r.follow_up_date,
    reason: r.reason,
    status: r.status,
    createdAt: r.created_at,
  }));
}
