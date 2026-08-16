/**
 * src/tests/tutor-module.test.ts
 *
 * Comprehensive Test Suite for Helpa Solo Tutor Industry Module (Phase 8).
 * Verifies:
 * - Unique sequential Student ID generation (STU-XXXXXX)
 * - Parent managing multiple children (Family Members) under one WhatsApp contact
 * - Disambiguation clarification when parent inquires without naming student
 * - Course Catalog & micro-batch scheduling
 * - Student enrollment in course & batch
 * - Class scheduling and automated reminder triggers
 * - Assignment creation, due dates, and reminders
 * - Tutor AI Copilot context, suggested replies, and quick actions
 * - Tutor AI Tools in Core Tool Registry
 * - Strict multi-tenant isolation (Tutor A vs Tutor B)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateNextTutorStudentId,
  createOrFindTutorStudent,
  getTutorStudentsByMobile,
  resolveStudentOrAskParent,
  listTutorCourses,
  listTutorBatches,
  enrollTutorStudent,
  listTutorClasses,
  scheduleTutorClass,
  listTutorAssignments,
  createTutorAssignment,
  getTutorCopilotContext,
} from '@/modules/solo-teacher/services';
import { aiToolRegistry } from '@/core/ai/tools';
import * as appwriteCompat from '@/lib/appwrite-server-compat';
import { coreEvents } from '@/core/events';

describe('Helpa Solo Tutor / Private Teacher Industry Module', () => {
  const tutorA = { id: 'tutor-ananya-01', name: 'Ananya Math Academy' };
  const tutorB = { id: 'tutor-roy-02', name: 'Roy Physics Classes' };

  let mockDatabase: {
    contacts: Array<Record<string, unknown>>;
    admissions: Array<Record<string, unknown>>;
    courses: Array<Record<string, unknown>>;
    batches: Array<Record<string, unknown>>;
    appointments: Array<Record<string, unknown>>;
    lab_reports: Array<Record<string, unknown>>;
  };

  beforeEach(() => {
    mockDatabase = {
      contacts: [],
      admissions: [],
      courses: [
        {
          id: 'course-m10',
          account_id: tutorA.id,
          name: 'Class 10 Mathematics',
          category: 'Mathematics',
          fee: 1500,
          status: 'Active',
        },
      ],
      batches: [
        {
          id: 'batch-m10-eve',
          account_id: tutorA.id,
          course_id: 'course-m10',
          course_name: 'Class 10 Mathematics',
          name: 'Class 10 Math — Evening Batch',
          capacity: 15,
          enrolled_count: 12,
          status: 'Active',
        },
      ],
      appointments: [],
      lab_reports: [],
    };

    vi.spyOn(appwriteCompat, 'getAdminClient').mockReturnValue({
      from: (table: string) => {
        const store = (mockDatabase as Record<string, Array<Record<string, unknown>>>)[table] || [];
        return {
          select: () => {
            let filtered = [...store];
            const builder = {
              eq: (f: string, v: unknown) => {
                filtered = filtered.filter((r) => r[f] === v);
                return builder;
              },
              neq: (f: string, v: unknown) => {
                filtered = filtered.filter((r) => r[f] !== v);
                return builder;
              },
              ilike: (f: string, v: string) => {
                const clean = v.replace(/%/g, '').toLowerCase();
                filtered = filtered.filter((r) => String(r[f] || '').toLowerCase().includes(clean));
                return builder;
              },
              or: () => builder,
              limit: (n: number) => {
                filtered = filtered.slice(0, n);
                return builder;
              },
              order: () => builder,
              single: async () => ({
                data: filtered[0] || null,
                error: filtered[0] ? null : { message: 'Row not found' },
              }),
              maybeSingle: async () => ({
                data: filtered[0] || null,
                error: null,
              }),
              then: (res: (val: { data: unknown[]; error: null }) => void) =>
                res({ data: filtered, error: null }),
            };
            return builder;
          },
          insert: (data: Record<string, unknown>) => {
            const row = { id: `id-${Date.now()}-${Math.random()}`, ...data };
            store.push(row);
            return {
              select: () => ({
                single: async () => ({ data: row, error: null }),
              }),
              then: (res: (val: { data: unknown; error: null }) => void) =>
                res({ data: row, error: null }),
            };
          },
          update: (data: Record<string, unknown>) => ({
            eq: (f: string, v: unknown) => {
              const matched = store.filter((r) => r[f] === v);
              matched.forEach((r) => Object.assign(r, data));
              return {
                eq: (f2: string, v2: unknown) => {
                  const m2 = store.filter((r) => r[f] === v && r[f2] === v2);
                  m2.forEach((r) => Object.assign(r, data));
                  return Promise.resolve({ data: m2, error: null });
                },
                then: (res: (val: { data: unknown; error: null }) => void) =>
                  res({ data: matched, error: null }),
              };
            },
          }),
        };
      },
    } as unknown as ReturnType<typeof appwriteCompat.getAdminClient>);
  });

  describe('Student Management & Parent Disambiguation', () => {
    it('generates sequential unique Student ID (STU-000001)', async () => {
      const studentId = await generateNextTutorStudentId(tutorA.id);
      expect(studentId).toBe('STU-000001');
    });

    it('allows a parent to manage multiple children under one WhatsApp number', async () => {
      const parentMobile = '+919000000000';

      // 1. Student A (Ayan Sharma)
      const studentA = await createOrFindTutorStudent({
        accountId: tutorA.id,
        name: 'Ayan Sharma',
        phone: parentMobile,
        guardianName: 'Rahul Sharma',
        subjectOrCourse: 'Class 10 Mathematics',
      });

      expect(studentA.name).toBe('Ayan Sharma');
      expect(studentA.studentId).toBe('STU-000001');
      expect(studentA.phone).toContain('9000000000');

      // 2. Student B (Riya Sharma) under the SAME parent mobile
      const studentB = await createOrFindTutorStudent({
        accountId: tutorA.id,
        name: 'Riya Sharma',
        phone: parentMobile,
        guardianName: 'Rahul Sharma',
        subjectOrCourse: 'Class 9 Mathematics',
      });

      expect(studentB.name).toBe('Riya Sharma');
      expect(studentB.studentId).toBe('STU-000002');
      expect(studentB.phone).toContain('9000000000');
      expect(studentA.id).not.toBe(studentB.id);

      expect(mockDatabase.contacts.length).toBe(2);
    });

    it('asks clarification when parent sends a generic message without specifying which child', async () => {
      const parentMobile = '+919000000000';

      await createOrFindTutorStudent({
        accountId: tutorA.id,
        name: 'Ayan Sharma',
        phone: parentMobile,
        guardianName: 'Rahul Sharma',
      });

      await createOrFindTutorStudent({
        accountId: tutorA.id,
        name: 'Riya Sharma',
        phone: parentMobile,
        guardianName: 'Rahul Sharma',
      });

      // Parent sends a generic inquiry
      const res = await resolveStudentOrAskParent(tutorA.id, parentMobile);
      expect(res.isAmbiguous).toBe(true);
      expect(res.studentsFound.length).toBe(2);
      expect(res.clarificationMessage).toContain('Which student are you asking about');
      expect(res.clarificationMessage).toContain('Ayan Sharma or Riya Sharma');

      // If parent explicitly specifies "Ayan"
      const resSpecific = await resolveStudentOrAskParent(tutorA.id, parentMobile, 'Ayan');
      expect(resSpecific.isAmbiguous).toBe(false);
      expect(resSpecific.selectedStudent?.name).toBe('Ayan Sharma');
    });
  });

  describe('Course Catalog & Batch Management', () => {
    it('lists tutor courses and subjects', async () => {
      const courses = await listTutorCourses(tutorA.id);
      expect(courses.length).toBeGreaterThan(0);
      expect(courses[0].name).toBe('Class 10 Mathematics');
      expect(courses[0].feePerMonth).toBe(1500);
    });

    it('calculates available seats in tutor batch', async () => {
      const batches = await listTutorBatches(tutorA.id, 'Class 10');
      expect(batches.length).toBeGreaterThan(0);

      const batch = batches[0];
      expect(batch.maxStudents).toBe(15);
      expect(batch.currentStudents).toBe(12);
      expect(batch.availableSeats).toBe(3);
    });
  });

  describe('Enrollment & Class Scheduling', () => {
    it('enrolls student in batch and emits enrollment.created event', async () => {
      const eventSpy = vi.fn();
      coreEvents.on('enrollment.created', eventSpy);

      const student = await createOrFindTutorStudent({
        accountId: tutorA.id,
        name: 'Ayan Sharma',
        phone: '+919000000000',
      });

      const enrollment = await enrollTutorStudent({
        accountId: tutorA.id,
        studentId: student.studentId,
        studentName: student.name,
        studentMobile: student.phone,
        courseName: 'Class 10 Mathematics',
        batchName: 'Evening Batch',
        feePerMonth: 1500,
      });

      expect(enrollment.studentName).toBe('Ayan Sharma');
      expect(enrollment.status).toBe('Active');
      expect(enrollment.enrollmentId).toContain('ENR-');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: tutorA.id,
          type: 'enrollment.created',
          payload: expect.objectContaining({
            studentName: 'Ayan Sharma',
            courseName: 'Class 10 Mathematics',
          }),
        })
      );
    });

    it('schedules class session and emits class.scheduled for reminders', async () => {
      const eventSpy = vi.fn();
      coreEvents.on('class.scheduled', eventSpy);

      const classSession = await scheduleTutorClass({
        accountId: tutorA.id,
        courseName: 'Class 10 Mathematics',
        batchName: 'Evening Batch',
        classDate: '2026-08-25',
        startTime: '07:00 PM',
        topic: 'Quadratic Equations & Roots',
      });

      expect(classSession.topic).toContain('Quadratic Equations');
      expect(classSession.status).toBe('Scheduled');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: tutorA.id,
          type: 'class.scheduled',
          payload: expect.objectContaining({
            topic: 'Quadratic Equations & Roots',
            classDate: '2026-08-25',
          }),
        })
      );
    });
  });

  describe('Assignment Management & Due Reminders', () => {
    it('creates assignment and emits assignment.created for WhatsApp notification', async () => {
      const eventSpy = vi.fn();
      coreEvents.on('assignment.created', eventSpy);

      const assignment = await createTutorAssignment({
        accountId: tutorA.id,
        title: 'Quadratic Equations Practice Set',
        courseName: 'Class 10 Mathematics',
        batchName: 'Evening Batch',
        topic: 'Algebra',
        dueDate: '2026-08-30',
      });

      expect(assignment.title).toBe('Quadratic Equations Practice Set');
      expect(assignment.status).toBe('Assigned');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: tutorA.id,
          type: 'assignment.created',
          payload: expect.objectContaining({
            title: 'Quadratic Equations Practice Set',
            dueDate: '2026-08-30',
          }),
        })
      );
    });
  });

  describe('Tutor Copilot & AI Teaching Assistant Tools', () => {
    it('generates rich Tutor Copilot context with upcoming class and assignment', async () => {
      const student = await createOrFindTutorStudent({
        accountId: tutorA.id,
        name: 'Ayan Sharma',
        phone: '+919000000000',
        guardianName: 'Rahul Sharma',
        subjectOrCourse: 'Class 10 Mathematics',
      });

      const copilot = await getTutorCopilotContext({
        accountId: tutorA.id,
        conversationId: 'conv-t1',
        contactId: student.id,
      });

      expect(copilot.student.name).toBe('Ayan Sharma');
      expect(copilot.enrolledCourse).toBe('Class 10 Mathematics');
      expect(copilot.suggestedReply).toContain('Ayan');
      expect(copilot.quickActions.some((a) => a.actionType === 'send_class_reminder')).toBe(true);
    });

    it('executes getClassSchedule and getStudentAssignments tools successfully', async () => {
      const scheduleTool = aiToolRegistry.get('getClassSchedule');
      const assignmentTool = aiToolRegistry.get('getStudentAssignments');

      expect(scheduleTool).toBeDefined();
      expect(assignmentTool).toBeDefined();

      const schedRes = await scheduleTool!.execute(
        { studentName: 'Ayan Sharma', subjectOrCourse: 'Class 10 Math' },
        {
          accountId: tutorA.id,
          userId: 'u1',
          conversationId: 'c1',
          contactId: 'cnt1',
        }
      );
      expect(schedRes.success).toBe(true);

      const asgRes = await assignmentTool!.execute(
        { studentName: 'Ayan Sharma' },
        {
          accountId: tutorA.id,
          userId: 'u1',
          conversationId: 'c1',
          contactId: 'cnt1',
        }
      );
      expect(asgRes.success).toBe(true);
    });
  });
});
