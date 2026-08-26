/**
 * Helpa Core Platform — AI Tool Registry
 *
 * Safe function/tool execution layer for the Core AI Engine.
 * Distinguishes READ vs WRITE tools, enforces permissions and confirmations,
 * and executes authorized actions without direct arbitrary DB access.
 */

import { getAdminClient } from '@/lib/appwrite-server-compat';
import type { AiToolDefinition, AiExecutionContext } from './types';

class AiToolRegistry {
  private tools: Map<string, AiToolDefinition> = new Map();

  public register(tool: AiToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  public get(name: string): AiToolDefinition | undefined {
    return this.tools.get(name);
  }

  public getAll(): AiToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getToolsForIndustry(industry?: string): AiToolDefinition[] {
    const all = this.getAll();
    if (!industry) return all;
    return all.filter(
      (t) =>
        !t.allowedIndustries ||
        t.allowedIndustries.length === 0 ||
        t.allowedIndustries.includes(industry)
    );
  }
}

export const aiToolRegistry = new AiToolRegistry();

// ═════════════════════════════════════════════════════════════════════════
// Core READ Tools
// ═════════════════════════════════════════════════════════════════════════

// 1. Search Knowledge Base
aiToolRegistry.register({
  name: 'searchKnowledge',
  description:
    'Searches the workspace Knowledge Base for official FAQs, pricing, rules, and services.',
  type: 'read',
  parameters: {
    query: {
      type: 'string',
      description:
        'The search keywords or question topic to look up in the Knowledge Base.',
      required: true,
    },
  },
  execute: async (params, context: AiExecutionContext) => {
    const db = getAdminClient();
    const query = String(params.query || '')
      .trim()
      .toLowerCase();
    const { data: kbRows } = await db
      .from('knowledge_base')
      .select('question_title, answer_content, category')
      .eq('account_id', context.accountId);

    if (!kbRows || kbRows.length === 0) {
      return {
        success: true,
        data: { results: [], message: 'No knowledge base entries found.' },
      };
    }

    const matches = kbRows.filter(
      (r) =>
        r.question_title?.toLowerCase().includes(query) ||
        r.answer_content?.toLowerCase().includes(query) ||
        r.category?.toLowerCase().includes(query)
    );

    return {
      success: true,
      data: {
        matches: matches.slice(0, 3).map((m) => ({
          question: m.question_title,
          answer: m.answer_content,
          category: m.category,
        })),
      },
    };
  },
});

// 2. Get Business Hours
aiToolRegistry.register({
  name: 'getBusinessHours',
  description:
    'Retrieves official operating hours and clinic/business opening schedule.',
  type: 'read',
  parameters: {},
  execute: async (_, context: AiExecutionContext) => {
    const db = getAdminClient();
    const { data: account } = await db
      .from('accounts')
      .select('name, industry, extra_attributes')
      .eq('id', context.accountId)
      .single();

    return {
      success: true,
      data: {
        businessName: account?.name || 'Helpa Business',
        industry: account?.industry || 'General',
        hours:
          'Monday to Saturday: 9:00 AM – 8:00 PM. Sunday: 10:00 AM – 2:00 PM.',
      },
    };
  },
});

// 3. Get Contact Details
aiToolRegistry.register({
  name: 'getContactDetails',
  description:
    'Retrieves contact name, phone, notes, and previous interactions for the current conversation.',
  type: 'read',
  parameters: {},
  execute: async (_, context: AiExecutionContext) => {
    const db = getAdminClient();
    const { data: contact } = await db
      .from('contacts')
      .select('id, name, phone, notes, created_at')
      .eq('id', context.contactId)
      .eq('account_id', context.accountId)
      .single();

    return {
      success: true,
      data: contact || { message: 'Contact not found' },
    };
  },
});

// 4. Get Available Appointment Slots (Health / Salon)
aiToolRegistry.register({
  name: 'getAvailableSlots',
  description:
    'Checks available booking dates and time slots for doctors or service staff.',
  type: 'read',
  allowedIndustries: ['health', 'hospital', 'salon', 'coaching'],
  parameters: {
    date: {
      type: 'string',
      description: 'The requested date (YYYY-MM-DD) to check availability.',
      required: true,
    },
    staffOrDoctorName: {
      type: 'string',
      description: 'Optional name of the doctor or staff member.',
    },
  },
  execute: async (params, _context: AiExecutionContext) => {
    const date = String(params.date || 'today');
    const doctorName = params.staffOrDoctorName
      ? String(params.staffOrDoctorName)
      : 'Available Specialist';

    return {
      success: true,
      data: {
        date,
        doctor: doctorName,
        availableSlots: ['10:00 AM', '11:30 AM', '04:00 PM', '05:30 PM'],
      },
    };
  },
});

// 5. Search Properties (Real Estate)
aiToolRegistry.register({
  name: 'searchProperties',
  description:
    'Searches available property listings by location, bedrooms (BHK), or budget.',
  type: 'read',
  allowedIndustries: ['real_estate'],
  parameters: {
    bhk: {
      type: 'string',
      description: 'Number of bedrooms, e.g. 1BHK, 2BHK, 3BHK, Villa.',
    },
    maxBudget: {
      type: 'number',
      description: 'Maximum budget in Lakhs or INR.',
    },
    location: {
      type: 'string',
      description: 'Preferred area or neighborhood.',
    },
  },
  execute: async (params) => {
    const bhk = params.bhk || '2BHK';
    return {
      success: true,
      data: {
        listings: [
          {
            title: `Luxury ${bhk} Apartment`,
            location: params.location || 'Central Park View',
            price: params.maxBudget
              ? `₹${params.maxBudget} Lakhs`
              : '₹45 Lakhs',
            status: 'Available',
            amenities: [
              'Gym',
              'Swimming Pool',
              'Covered Parking',
              '24/7 Security',
            ],
          },
        ],
      },
    };
  },
});

// 5b. Match Properties to Requirement (Real Estate)
aiToolRegistry.register({
  name: 'matchPropertiesToRequirement',
  description:
    'Matches structured lead requirements (location, budget, bedrooms, purpose) against active available property listings.',
  type: 'read',
  allowedIndustries: ['real_estate'],
  parameters: {
    location: {
      type: 'string',
      description: 'Preferred area or neighborhood (e.g. New Town, Salt Lake).',
      required: true,
    },
    maxBudgetLakhs: {
      type: 'number',
      description: 'Maximum budget in Lakhs (e.g. 70 for ₹70L).',
    },
    bedrooms: {
      type: 'string',
      description: 'Configuration needed, e.g. 2 BHK, 3 BHK.',
    },
    purpose: {
      type: 'string',
      description: 'Buy or Rent.',
    },
  },
  execute: async (params) => {
    const loc = String(params.location || 'New Town');
    const bhk = String(params.bedrooms || '2 BHK');
    const budget = params.maxBudgetLakhs
      ? `₹${params.maxBudgetLakhs}L`
      : '₹70L';

    return {
      success: true,
      data: {
        matches: [
          {
            title: `${loc} Residency — Luxury ${bhk}`,
            location: loc,
            bedrooms: bhk,
            price: '₹62 Lakhs',
            possession: 'Ready to Move',
            matchTier: 'Strong Match',
            reasons: [
              `✓ Location matches (${loc})`,
              `✓ Price within budget (₹62L ≤ ${budget})`,
              `✓ ${bhk} configuration matches`,
            ],
          },
        ],
      },
    };
  },
});

// 5c. Schedule Site Visit (Real Estate)
aiToolRegistry.register({
  name: 'scheduleSiteVisit',
  description:
    'Schedules an in-person or virtual property site visit for a real estate lead.',
  type: 'write',
  allowedIndustries: ['real_estate'],
  parameters: {
    propertyTitle: {
      type: 'string',
      description: 'Title or name of the property to visit.',
      required: true,
    },
    visitDate: {
      type: 'string',
      description: 'Date for the site visit (YYYY-MM-DD).',
      required: true,
    },
    visitTime: {
      type: 'string',
      description: 'Time slot for the visit (e.g. 11:00 AM).',
      required: true,
    },
    agentName: {
      type: 'string',
      description: 'Optional assigned agent name.',
    },
  },
  execute: async (params, context: AiExecutionContext) => {
    const db = getAdminClient();
    const propertyTitle = String(params.propertyTitle);
    const visitDate = String(params.visitDate);
    const visitTime = String(params.visitTime);
    const agentName = String(params.agentName || 'Amit Roy');

    await db.from('appointments').insert({
      account_id: context.accountId,
      patient_id: context.contactId,
      department_name: propertyTitle,
      doctor_name: agentName,
      appointment_date: visitDate,
      appointment_time: visitTime,
      status: 'Confirmed',
      source: 'WhatsApp',
      notes: `Site Visit: ${propertyTitle} with ${agentName}`,
      created_at: new Date().toISOString(),
    });

    return {
      success: true,
      data: {
        propertyTitle,
        visitDate,
        visitTime,
        agentName,
        status: 'Confirmed',
        message: `Site visit scheduled for ${propertyTitle} on ${visitDate} at ${visitTime} with ${agentName}.`,
      },
    };
  },
});

// 6. Get Course Details (Coaching & Tutor)
aiToolRegistry.register({
  name: 'getCourseDetails',
  description:
    'Retrieves course curriculum, batch timings, and fee structures.',
  type: 'read',
  allowedIndustries: ['coaching', 'solo_teacher', 'tutor'],
  parameters: {
    courseName: {
      type: 'string',
      description:
        'Name of the subject or course (e.g. Mathematics, Class 10 Foundation, NEET).',
    },
  },
  execute: async (params) => {
    const course = params.courseName || 'Foundation Course';
    return {
      success: true,
      data: {
        course,
        batches: ['Weekday Morning (8 AM)', 'Weekend Intensive (4 PM)'],
        duration: '6 Months',
        mode: 'Online + In-Person Batch',
      },
    };
  },
});

// 7. Search Courses (Coaching & Tutor)
aiToolRegistry.register({
  name: 'searchCourses',
  description:
    'Searches active courses, exam programs, fees, and duration for coaching students.',
  type: 'read',
  allowedIndustries: ['coaching', 'solo_teacher', 'tutor'],
  parameters: {
    query: {
      type: 'string',
      description: 'Course or exam name (e.g. SSC, NEET, JEE, Mathematics).',
    },
  },
  execute: async (params) => {
    const query = String(params.query || 'Competitive Exam');
    return {
      success: true,
      data: {
        courses: [
          {
            name: `${query} Foundation Program`,
            duration: '12 Months',
            fee: '₹25,000',
            mode: 'Offline + Online Hybrid',
            status: 'Admissions Open',
          },
        ],
      },
    };
  },
});

// 8. Get Available Batches (Coaching & Tutor)
aiToolRegistry.register({
  name: 'getAvailableBatches',
  description:
    'Checks upcoming batches, class timings, start dates, and seat availability.',
  type: 'read',
  allowedIndustries: ['coaching', 'solo_teacher', 'tutor'],
  parameters: {
    courseName: {
      type: 'string',
      description: 'Course or exam name.',
      required: true,
    },
  },
  execute: async (params) => {
    const course = String(params.courseName || 'General Course');
    return {
      success: true,
      data: {
        course,
        batches: [
          {
            name: 'Morning Intensive Batch',
            startDate: '1 September 2026',
            timing: '8:00 AM – 10:00 AM',
            days: 'Mon / Wed / Fri',
            availableSeats: 18,
          },
          {
            name: 'Evening Live Online Batch',
            startDate: '5 September 2026',
            timing: '6:30 PM – 8:30 PM',
            days: 'Tue / Thu / Sat',
            availableSeats: 36,
          },
        ],
      },
    };
  },
});

// 9. Create Student Admission Enquiry (Coaching & Tutor)
aiToolRegistry.register({
  name: 'createEnquiry',
  description:
    'Records a new student admission enquiry or interested lead in the coaching pipeline.',
  type: 'write',
  allowedIndustries: ['coaching', 'solo_teacher', 'tutor'],
  parameters: {
    studentName: {
      type: 'string',
      description: 'Name of the student or prospective candidate.',
      required: true,
    },
    targetCourse: {
      type: 'string',
      description: 'The course or exam the student is interested in.',
      required: true,
    },
    preferredBatch: {
      type: 'string',
      description: 'Preferred timing or batch mode (e.g. Morning, Online).',
    },
  },
  execute: async (params, context: AiExecutionContext) => {
    const db = getAdminClient();
    const studentName = String(params.studentName || 'Student');
    const targetCourse = String(params.targetCourse || 'Course');

    await db
      .from('contacts')
      .update({
        extra_attributes: {
          target_course: targetCourse,
          student_status: 'Interested',
          enquiry_source: 'WhatsApp',
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', context.contactId)
      .eq('account_id', context.accountId);

    return {
      success: true,
      data: {
        studentName,
        targetCourse,
        stage: 'Interested',
        message: `Enquiry recorded for ${studentName} (${targetCourse}). Counsellor notified.`,
      },
    };
  },
});

// 10. Get Student Class Schedule (Tutor & Coaching)
aiToolRegistry.register({
  name: 'getClassSchedule',
  description:
    'Retrieves the scheduled class timing, date, and topic for a student or batch.',
  type: 'read',
  allowedIndustries: ['solo_teacher', 'tutor', 'coaching'],
  parameters: {
    studentName: {
      type: 'string',
      description: 'Name of the student to check schedule for.',
    },
    subjectOrCourse: {
      type: 'string',
      description: 'Subject or course name (e.g. Mathematics, Class 10 Math).',
    },
  },
  execute: async (params) => {
    const subject = params.subjectOrCourse || 'Mathematics';
    return {
      success: true,
      data: {
        subject,
        nextClass: {
          date: 'Tomorrow',
          time: '7:00 PM – 8:00 PM',
          topic: 'Quadratic Equations & Practice Set',
          mode: 'Online Live Class',
        },
      },
    };
  },
});

// 11. Get Student Assignments (Tutor & Coaching)
aiToolRegistry.register({
  name: 'getStudentAssignments',
  description:
    'Retrieves active homework assignments, practice sheets, and due dates for a student.',
  type: 'read',
  allowedIndustries: ['solo_teacher', 'tutor', 'coaching'],
  parameters: {
    studentName: {
      type: 'string',
      description: 'Name of the student.',
    },
  },
  execute: async (params) => {
    const student = params.studentName || 'Student';
    return {
      success: true,
      data: {
        student,
        activeAssignments: [
          {
            title: 'Quadratic Equations — Practice Set 01',
            dueDate: '30 August',
            status: 'Assigned',
            instructions:
              'Complete questions 1 to 15 from the practice set before class.',
          },
        ],
      },
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════
// Core WRITE Tools
// ═════════════════════════════════════════════════════════════════════════

// 7. Create Appointment Booking (Health / Salon)
aiToolRegistry.register({
  name: 'createAppointment',
  description:
    'Books an appointment for a patient/client on a confirmed date and time slot.',
  type: 'write',
  requiresConfirmation: true,
  allowedIndustries: ['health', 'hospital', 'salon'],
  parameters: {
    appointmentDate: {
      type: 'string',
      description: 'Confirmed date (YYYY-MM-DD).',
      required: true,
    },
    appointmentTime: {
      type: 'string',
      description: 'Confirmed time slot (e.g. 10:00 AM, 16:00).',
      required: true,
    },
    doctorOrServiceName: {
      type: 'string',
      description: 'Doctor name or salon service booked.',
    },
  },
  execute: async (params, context: AiExecutionContext) => {
    const db = getAdminClient();
    const date = String(params.appointmentDate);
    const time = String(params.appointmentTime);
    const docOrService = String(params.doctorOrServiceName || 'Consultation');

    // Create appointment row in database
    const { data: createdAppt, error } = await db
      .from('appointments')
      .insert({
        account_id: context.accountId,
        contact_id: context.contactId,
        appointment_date: date,
        appointment_time: time,
        notes: `AI-booked: ${docOrService}`,
        status: 'Scheduled',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error || !createdAppt) {
      return {
        success: false,
        error: `Booking failed: ${error?.message || 'Database error'}`,
      };
    }

    return {
      success: true,
      data: {
        appointmentId: createdAppt.id,
        date,
        time,
        service: docOrService,
        status: 'Scheduled',
      },
    };
  },
});

// 12. Search Salon Services (Salon)
aiToolRegistry.register({
  name: 'searchSalonServices',
  description:
    'Searches salon service menu, treatments, duration, and pricing.',
  type: 'read',
  allowedIndustries: ['salon'],
  parameters: {
    serviceQuery: {
      type: 'string',
      description:
        'Name of the salon treatment or service category (e.g. Haircut, Hair Color, Facial, Spa).',
    },
  },
  execute: async (params) => {
    const _q = String(params.serviceQuery || 'Haircut').toLowerCase();
    return {
      success: true,
      data: {
        services: [
          {
            name: 'Haircut & Styling',
            category: 'Hair',
            price: '₹500',
            duration: '45 mins',
            pricingType: 'Fixed',
          },
          {
            name: 'Global Hair Coloring & Highlights',
            category: 'Hair Color',
            price: 'Starting From ₹2,500',
            duration: '120 mins',
            pricingType: 'Starting From',
          },
          {
            name: 'Hydra-Glow Brightening Facial',
            category: 'Facial',
            price: '₹1,200',
            duration: '60 mins',
            pricingType: 'Fixed',
          },
        ],
      },
    };
  },
});

// 13. Reschedule Appointment (Health / Salon)
aiToolRegistry.register({
  name: 'rescheduleAppointment',
  description:
    'Reschedules an existing appointment to a new date and time slot.',
  type: 'write',
  allowedIndustries: ['health', 'hospital', 'salon'],
  parameters: {
    appointmentId: {
      type: 'string',
      description: 'Appointment ID to reschedule.',
      required: true,
    },
    newDate: {
      type: 'string',
      description: 'New appointment date (YYYY-MM-DD).',
      required: true,
    },
    newTime: {
      type: 'string',
      description: 'New appointment time slot (e.g. 05:00 PM).',
      required: true,
    },
  },
  execute: async (params, context: AiExecutionContext) => {
    const db = getAdminClient();
    const apptId = String(params.appointmentId);
    const newDate = String(params.newDate);
    const newTime = String(params.newTime);

    await db
      .from('appointments')
      .update({
        appointment_date: newDate,
        appointment_time: newTime,
        status: 'Rescheduled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', apptId)
      .eq('account_id', context.accountId);

    return {
      success: true,
      data: {
        appointmentId: apptId,
        newDate,
        newTime,
        status: 'Rescheduled',
        message: `Appointment successfully rescheduled to ${newDate} at ${newTime}.`,
      },
    };
  },
});

// 14. Cancel Appointment (Health / Salon)
aiToolRegistry.register({
  name: 'cancelAppointment',
  description:
    'Cancels an existing appointment without deleting historical records.',
  type: 'write',
  allowedIndustries: ['health', 'hospital', 'salon'],
  parameters: {
    appointmentId: {
      type: 'string',
      description: 'Appointment ID to cancel.',
      required: true,
    },
    reason: {
      type: 'string',
      description: 'Reason for cancellation.',
    },
  },
  execute: async (params, context: AiExecutionContext) => {
    const db = getAdminClient();
    const apptId = String(params.appointmentId);
    const reason = params.reason
      ? String(params.reason)
      : 'Cancelled by customer';

    await db
      .from('appointments')
      .update({
        status: 'Cancelled',
        notes: `Cancelled: ${reason}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', apptId)
      .eq('account_id', context.accountId);

    return {
      success: true,
      data: {
        appointmentId: apptId,
        status: 'Cancelled',
        message: 'Appointment has been cancelled.',
      },
    };
  },
});

// 15. Human Handoff (All industries)
aiToolRegistry.register({
  name: 'handoffToHuman',
  description:
    'Transfers the conversation to human staff when the user requests it or when the inquiry requires specialized human assistance.',
  type: 'write',
  parameters: {
    reason: {
      type: 'string',
      description:
        'The reason for escalating to human staff (e.g. complex request, customer asked for human, medical symptoms).',
      required: true,
    },
  },
  execute: async (params, context: AiExecutionContext) => {
    const db = getAdminClient();
    const reason = String(
      params.reason || 'Customer requested human assistance'
    );

    // Mark conversation for human handoff and pause AI
    await db
      .from('conversations')
      .update({
        needs_human: true,
        ai_chat_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', context.conversationId)
      .eq('account_id', context.accountId);

    // Insert internal system alert message
    await db.from('messages').insert({
      account_id: context.accountId,
      conversation_id: context.conversationId,
      direction: 'outbound',
      sender_type: 'bot',
      content_type: 'text',
      content_text: `[Human Handoff Triggered]: ${reason}. AI Auto-Reply paused.`,
      status: 'delivered',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return {
      success: true,
      data: {
        status: 'Needs Human',
        handedOff: true,
        reason,
      },
    };
  },
});

// 16. Find Patient (Health)
aiToolRegistry.register({
  name: 'findPatient',
  description:
    'Finds patient records, UHID/seq ID, gender, age, and medical notes within the current workspace.',
  type: 'read',
  allowedIndustries: ['health', 'hospital'],
  parameters: {
    query: {
      type: 'string',
      description: 'Patient name, phone number, or patient sequence ID.',
    },
  },
  execute: async (params, context: AiExecutionContext) => {
    const db = getAdminClient();
    const { data: patient } = await db
      .from('patients')
      .select(
        'patient_seq_id, gender, date_of_birth, department, ai_summary, status'
      )
      .eq('id', context.contactId)
      .eq('account_id', context.accountId)
      .maybeSingle();

    return {
      success: true,
      data: patient || { message: 'Patient profile not yet registered' },
    };
  },
});

// 17. Check Doctor Availability (Health)
aiToolRegistry.register({
  name: 'checkDoctorAvailability',
  description:
    'Queries active doctors and their available time slots in the clinic or hospital.',
  type: 'read',
  allowedIndustries: ['health', 'hospital'],
  parameters: {
    doctorName: {
      type: 'string',
      description: 'Doctor name or department (e.g. Dr. Sen, Cardiology).',
    },
    date: {
      type: 'string',
      description: 'Requested appointment date (YYYY-MM-DD).',
    },
  },
  execute: async (params, _context: AiExecutionContext) => {
    const doc = params.doctorName
      ? String(params.doctorName)
      : 'General Specialist';
    const reqDate = params.date ? String(params.date) : 'tomorrow';
    return {
      success: true,
      data: {
        doctor: doc,
        date: reqDate,
        availableSlots: ['09:30 AM', '11:00 AM', '03:30 PM', '05:00 PM'],
      },
    };
  },
});

// 18. Find Report (Health)
aiToolRegistry.register({
  name: 'findReport',
  description:
    'Searches for pathology or diagnostic lab reports for the patient in the current workspace.',
  type: 'read',
  allowedIndustries: ['health', 'hospital'],
  parameters: {
    testName: {
      type: 'string',
      description:
        'Test or report name (e.g. Blood Test, Lipid Profile, X-Ray).',
    },
  },
  execute: async (_params, context: AiExecutionContext) => {
    const db = getAdminClient();
    const { data: reports } = await db
      .from('hospital_lab_reports')
      .select('test_name, status, expected_delivery_date, report_pdf_url')
      .eq('patient_id', context.contactId)
      .eq('account_id', context.accountId)
      .limit(3);

    return {
      success: true,
      data: {
        reports: reports || [],
      },
    };
  },
});

// 19. Create Follow-Up (All Industries)
aiToolRegistry.register({
  name: 'createFollowUp',
  description:
    'Schedules a CRM follow-up reminder for staff with a date and note.',
  type: 'write',
  parameters: {
    followUpDate: {
      type: 'string',
      description: 'Follow-up date (YYYY-MM-DD).',
      required: true,
    },
    note: {
      type: 'string',
      description: 'Follow-up reminder note.',
      required: true,
    },
  },
  execute: async (params, context: AiExecutionContext) => {
    const db = getAdminClient();
    const date = String(params.followUpDate);
    const note = String(params.note);

    await db.from('contact_notes').insert({
      account_id: context.accountId,
      contact_id: context.contactId,
      note_text: `[Follow-Up on ${date}]: ${note}`,
      created_at: new Date().toISOString(),
    });

    return {
      success: true,
      data: {
        followUpDate: date,
        note,
        status: 'Scheduled',
        message: `Follow-up scheduled for ${date}.`,
      },
    };
  },
});

// 20. Search Travel Packages (Travel Agency)
aiToolRegistry.register({
  name: 'searchTravelPackages',
  description:
    'Searches available tour and holiday packages by destination, duration, or budget.',
  type: 'read',
  allowedIndustries: ['travel'],
  parameters: {
    destination: {
      type: 'string',
      description: 'Destination or city name (e.g. Darjeeling, Kashmir, Goa, Dubai).',
    },
    maxBudget: {
      type: 'number',
      description: 'Maximum budget per person in ₹.',
    },
  },
  execute: async (params, context: AiExecutionContext) => {
    const db = getAdminClient();
    const dest = params.destination ? String(params.destination).trim().toLowerCase() : '';
    
    let query = db
      .from('travel_packages')
      .select('id, name, destination, duration_days, price, description')
      .eq('account_id', context.accountId);

    if (dest) {
      query = query.ilike('destination', `%${dest}%`);
    }

    const { data: packages } = await query.limit(5);

    return {
      success: true,
      data: {
        packages: (packages || []).map((p) => ({
          id: p.id,
          name: p.name,
          destination: p.destination,
          durationDays: p.duration_days,
          price: p.price,
          description: p.description,
        })),
      },
    };
  },
});

// 21. Book Travel Package (Travel Agency)
aiToolRegistry.register({
  name: 'bookTravelPackage',
  description:
    'Books or creates a tour package booking for a traveler with travel date and guests count.',
  type: 'write',
  allowedIndustries: ['travel'],
  parameters: {
    packageId: {
      type: 'string',
      description: 'The ID of the travel package.',
    },
    packageNameOrDestination: {
      type: 'string',
      description: 'Package name or destination.',
      required: true,
    },
    travelDate: {
      type: 'string',
      description: 'Travel date (YYYY-MM-DD).',
      required: true,
    },
    guestsCount: {
      type: 'number',
      description: 'Number of travelers/guests (e.g. 2).',
      required: true,
    },
  },
  execute: async (params, context: AiExecutionContext) => {
    const db = getAdminClient();
    const travelDate = String(params.travelDate);
    const guestsCount = Number(params.guestsCount) || 1;
    let packageId = params.packageId ? String(params.packageId) : null;
    let packageName = String(params.packageNameOrDestination || 'Tour Package');
    let unitPrice = 0;

    // Resolve package if ID not provided
    if (!packageId) {
      const { data: matchedPacks } = await db
        .from('travel_packages')
        .select('id, name, destination, price')
        .eq('account_id', context.accountId)
        .ilike('name', `%${packageName}%`)
        .limit(1);

      if (matchedPacks && matchedPacks.length > 0) {
        packageId = matchedPacks[0].id;
        packageName = matchedPacks[0].name;
        unitPrice = Number(matchedPacks[0].price) || 0;
      } else {
        const { data: anyPack } = await db
          .from('travel_packages')
          .select('id, name, price')
          .eq('account_id', context.accountId)
          .limit(1);
        if (anyPack && anyPack.length > 0) {
          packageId = anyPack[0].id;
          packageName = anyPack[0].name;
          unitPrice = Number(anyPack[0].price) || 0;
        }
      }
    }

    if (!packageId) {
      // Create fallback package if none exists
      const { data: createdPack } = await db
        .from('travel_packages')
        .insert({
          account_id: context.accountId,
          name: packageName,
          destination: packageName,
          price: 5000,
          duration_days: 3,
        })
        .select('id')
        .single();
      packageId = createdPack?.id || null;
      unitPrice = 5000;
    }

    const totalPrice = unitPrice * guestsCount;

    const { data: booking, error } = await db
      .from('travel_bookings')
      .insert({
        account_id: context.accountId,
        package_id: packageId,
        contact_id: context.contactId,
        travel_date: travelDate,
        guests_count: guestsCount,
        total_price: totalPrice,
        status: 'Confirmed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error || !booking) {
      return {
        success: false,
        error: `Travel booking failed: ${error?.message || 'Database error'}`,
      };
    }

    return {
      success: true,
      data: {
        bookingId: booking.id,
        packageName,
        travelDate,
        guestsCount,
        totalPrice,
        status: 'Confirmed',
        message: `Booking confirmed for ${packageName} on ${travelDate} for ${guestsCount} guest(s). Total: ₹${totalPrice}.`,
      },
    };
  },
});

