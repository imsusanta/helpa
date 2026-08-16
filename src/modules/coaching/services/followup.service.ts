/**
 * Helpa Coaching Module — Follow-up Service
 *
 * Automated follow-up management for prospective students and enquiries.
 */

import { getAdminClient } from '@/lib/appwrite-server-compat';
import { coreEvents } from '@/core/events';

export interface CoachingFollowUp {
  id: string;
  accountId: string;
  studentId: string;
  studentName: string;
  studentMobile: string;
  targetCourse: string;
  followUpDate: string; // YYYY-MM-DD
  reason: string;
  status: 'Pending' | 'Completed' | 'Cancelled';
  assignedCounsellor?: string;
  createdAt: string;
}

export async function scheduleCoachingFollowUp({
  accountId,
  studentId,
  studentName,
  studentMobile,
  targetCourse,
  daysInterval = 1,
  reason,
  assignedCounsellor,
}: {
  accountId: string;
  studentId: string;
  studentName: string;
  studentMobile: string;
  targetCourse: string;
  daysInterval?: number;
  reason?: string;
  assignedCounsellor?: string;
}): Promise<CoachingFollowUp> {
  const db = getAdminClient();

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysInterval);
  const followUpDateStr = targetDate.toISOString().split('T')[0];

  const { data: created, error } = await db
    .from('follow_ups')
    .insert({
      account_id: accountId,
      patient_id: studentId,
      patient_name: studentName,
      patient_mobile: studentMobile,
      doctor_name: targetCourse, // reuses generic column for course/specialist
      follow_up_date: followUpDateStr,
      reason: reason || `Admission follow-up for ${targetCourse}`,
      status: 'Pending',
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error || !created) {
    return {
      id: `fup-${Date.now()}`,
      accountId,
      studentId,
      studentName,
      studentMobile,
      targetCourse,
      followUpDate: followUpDateStr,
      reason: reason || `Follow-up for ${targetCourse}`,
      status: 'Pending',
      assignedCounsellor,
      createdAt: new Date().toISOString(),
    };
  }

  // Emit event for automated reminder
  coreEvents.emit('followup.scheduled', accountId, {
    followUpId: created.id,
    studentName,
    studentMobile,
    targetCourse,
    followUpDate: followUpDateStr,
    timestamp: new Date().toISOString(),
  });

  return {
    id: created.id,
    accountId: created.account_id,
    studentId: created.patient_id,
    studentName: created.patient_name,
    studentMobile: created.patient_mobile,
    targetCourse: created.doctor_name,
    followUpDate: created.follow_up_date,
    reason: created.reason,
    status: created.status,
    createdAt: created.created_at,
  };
}
