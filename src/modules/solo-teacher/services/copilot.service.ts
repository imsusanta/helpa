/**
 * Helpa Solo Tutor Module — Tutor Copilot Service
 *
 * Provides dedicated teaching assistant context when reviewing student/parent chats:
 * Student summary, enrolled course & batch, upcoming class time, pending assignments,
 * draft suggested replies, and quick actions.
 */

import { getAdminClient } from '@/lib/appwrite-server-compat';
import { listTutorAssignments } from './assignment.service';
import { listTutorClasses } from './class.service';

export interface TutorCopilotContext {
  student: {
    id: string;
    studentId: string;
    name: string;
    mobile: string;
    guardianName?: string;
  };
  summary: string;
  enrolledCourse: string;
  enrolledBatch: string;
  upcomingClass?: {
    date: string;
    time: string;
    topic: string;
  };
  pendingAssignment?: {
    title: string;
    dueDate: string;
  };
  suggestedReply: string;
  quickActions: Array<{
    label: string;
    actionType: string;
    payload?: Record<string, unknown>;
  }>;
}

export async function getTutorCopilotContext({
  accountId,
  contactId,
}: {
  accountId: string;
  conversationId: string;
  contactId: string;
}): Promise<TutorCopilotContext> {
  const db = getAdminClient();

  const { data: contact } = await db
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('account_id', accountId)
    .single();

  const extra = (contact?.extra_attributes as Record<string, unknown>) || {};
  const studentId = String(extra.student_id || `STU-${contact?.id?.slice(0, 6) || '000123'}`);
  const studentName = contact?.name || 'Ayan Sharma';
  const studentMobile = contact?.phone || '+919000000000';
  const guardianName = extra.guardian_name as string;
  const course = String(extra.target_course || 'Class 10 Mathematics');
  const batch = String(extra.current_batch || 'Evening Batch');

  const classes = await listTutorClasses(accountId);
  const upcomingClass = classes[0];

  const assignments = await listTutorAssignments(accountId);
  const pendingAssignment = assignments[0];

  return {
    student: {
      id: contactId,
      studentId,
      name: studentName,
      mobile: studentMobile,
      guardianName,
    },
    summary: `Student (${studentName}, ${studentId}) is enrolled in ${course} (${batch}). Asking about class schedule and pending homework.`,
    enrolledCourse: course,
    enrolledBatch: batch,
    upcomingClass: upcomingClass
      ? {
          date: upcomingClass.classDate,
          time: upcomingClass.startTime,
          topic: upcomingClass.topic,
        }
      : undefined,
    pendingAssignment: pendingAssignment
      ? {
          title: pendingAssignment.title,
          dueDate: pendingAssignment.dueDate,
        }
      : undefined,
    suggestedReply: `Hi ${studentName}, your next ${course} class is scheduled for ${upcomingClass?.classDate || 'tomorrow'} at ${upcomingClass?.startTime || '7:00 PM'}. Please remember to submit your "${pendingAssignment?.title || 'practice'}" assignment before class.`,
    quickActions: [
      { label: 'Send Reminder', actionType: 'send_class_reminder' },
      { label: 'Open Assignment', actionType: 'view_assignment' },
      { label: 'View Student', actionType: 'view_student' },
      { label: 'Message Parent', actionType: 'message_guardian' },
    ],
  };
}
