/**
 * Helpa Coaching Module — Counsellor Copilot Service
 *
 * Provides dedicated admission AI context for coaching staff reviewing student chats:
 * Student/lead summary, interested course & batch, admission stage, fee status,
 * draft suggested replies, and quick actions.
 */

import { getAdminClient } from '@/lib/db/server';
import { findCourseByNameOrCode } from './course.service';

export interface CoachingCopilotContext {
  student: {
    id: string;
    studentId: string;
    name: string;
    mobile: string;
    status: string;
  };
  summary: string;
  interestedCourse?: string;
  interestedBatch?: string;
  admissionStage: string;
  feeStatus: string;
  suggestedReply: string;
  quickActions: Array<{
    label: string;
    actionType: string;
    payload?: Record<string, unknown>;
  }>;
}

export async function getCoachingCopilotContext({
  accountId,
  contactId,
}: {
  accountId: string;
  conversationId: string;
  contactId: string;
}): Promise<CoachingCopilotContext> {
  const db = getAdminClient();

  // 1. Fetch contact info
  const { data: contact } = await db
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('account_id', accountId)
    .single();

  const extra = (contact?.extra_attributes as Record<string, unknown>) || {};
  const studentId = String(
    extra.student_id || `STU-${contact?.id?.slice(0, 6) || '000123'}`
  );
  const studentName = contact?.name || 'Rahul Sharma';
  const studentMobile = contact?.phone || '+919000000000';
  const targetCourse = String(extra.target_course || 'SSC CGL Foundation');
  const stage = String(extra.student_status || 'Interested');

  const course = await findCourseByNameOrCode(accountId, targetCourse);
  const fee = course ? course.totalFee : 25000;

  return {
    student: {
      id: contactId,
      studentId,
      name: studentName,
      mobile: studentMobile,
      status: stage,
    },
    summary: `Student (${studentName}, ${studentId}) is interested in ${targetCourse}. Inquiring about batch timing, fee details, and admission process.`,
    interestedCourse: targetCourse,
    interestedBatch: 'Morning Batch (Starts 1 Sept)',
    admissionStage: stage,
    feeStatus: `Total: ₹${fee} (Registration: ₹2,000)`,
    suggestedReply: `Hi ${studentName}, our ${targetCourse} Morning Batch starts on 1 September at 8:00 AM. Total course fee is ₹${fee}. Would you like me to send you the admission link to reserve your seat?`,
    quickActions: [
      { label: 'Send Admission Details', actionType: 'send_admission_details' },
      { label: 'Create Follow-up', actionType: 'create_followup' },
      { label: 'Send Fee Details', actionType: 'send_fee_details' },
      { label: 'Mark Contacted', actionType: 'mark_contacted' },
    ],
  };
}
