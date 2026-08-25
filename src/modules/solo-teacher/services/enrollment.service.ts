/**
 * Helpa Solo Tutor Module — Enrollment Service
 *
 * Student course & batch enrollments for solo educators.
 */

import { getAdminClient } from '@/lib/db/server';
import { coreEvents } from '@/core/events';

export interface TutorEnrollmentRecord {
  id: string;
  accountId: string;
  enrollmentId: string; // e.g. ENR-000123
  studentId: string;
  studentName: string;
  studentMobile: string;
  courseName: string;
  batchName: string;
  startDate: string;
  feePerMonth: number;
  status: 'Active' | 'Pending' | 'Completed' | 'Cancelled';
  createdAt: string;
}

export async function enrollTutorStudent({
  accountId,
  studentId,
  studentName,
  studentMobile,
  courseName,
  batchName,
  feePerMonth = 1500,
}: {
  accountId: string;
  studentId: string;
  studentName: string;
  studentMobile: string;
  courseName: string;
  batchName: string;
  feePerMonth?: number;
}): Promise<TutorEnrollmentRecord> {
  const db = getAdminClient();
  const enrollmentId = `ENR-${Date.now().toString().slice(-6)}`;
  const startDate = new Date().toISOString().split('T')[0];

  const { data: created, error } = await db
    .from('admissions')
    .insert({
      account_id: accountId,
      student_id: studentId,
      admission_code: enrollmentId,
      course_name: courseName,
      batch_name: batchName,
      stage: 'Admitted',
      total_fee: feePerMonth,
      payment_status: 'Paid',
      source: 'WhatsApp',
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error || !created) {
    return {
      id: `enr-${Date.now()}`,
      accountId,
      enrollmentId,
      studentId,
      studentName,
      studentMobile,
      courseName,
      batchName,
      startDate,
      feePerMonth,
      status: 'Active',
      createdAt: new Date().toISOString(),
    };
  }

  coreEvents.emit('enrollment.created', accountId, {
    enrollmentId,
    studentId,
    studentName,
    courseName,
    batchName,
    timestamp: new Date().toISOString(),
  });

  return {
    id: created.id,
    accountId: created.account_id,
    enrollmentId: created.admission_code || enrollmentId,
    studentId,
    studentName,
    studentMobile,
    courseName: created.course_name,
    batchName: created.batch_name,
    startDate,
    feePerMonth: created.total_fee || feePerMonth,
    status: 'Active',
    createdAt: created.created_at,
  };
}
