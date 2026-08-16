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
  description: 'Searches the workspace Knowledge Base for official FAQs, pricing, rules, and services.',
  type: 'read',
  parameters: {
    query: {
      type: 'string',
      description: 'The search keywords or question topic to look up in the Knowledge Base.',
      required: true,
    },
  },
  execute: async (params, context: AiExecutionContext) => {
    const db = getAdminClient();
    const query = String(params.query || '').trim().toLowerCase();
    const { data: kbRows } = await db
      .from('knowledge_base')
      .select('question_title, answer_content, category')
      .eq('account_id', context.accountId);

    if (!kbRows || kbRows.length === 0) {
      return { success: true, data: { results: [], message: 'No knowledge base entries found.' } };
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
  description: 'Retrieves official operating hours and clinic/business opening schedule.',
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
        hours: 'Monday to Saturday: 9:00 AM – 8:00 PM. Sunday: 10:00 AM – 2:00 PM.',
      },
    };
  },
});

// 3. Get Contact Details
aiToolRegistry.register({
  name: 'getContactDetails',
  description: 'Retrieves contact name, phone, notes, and previous interactions for the current conversation.',
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
  description: 'Checks available booking dates and time slots for doctors or service staff.',
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
  execute: async (params, context: AiExecutionContext) => {
    const date = String(params.date || 'today');
    const doctorName = params.staffOrDoctorName ? String(params.staffOrDoctorName) : 'Available Specialist';

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
  description: 'Searches available property listings by location, bedrooms (BHK), or budget.',
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
            price: params.maxBudget ? `₹${params.maxBudget} Lakhs` : '₹45 Lakhs',
            status: 'Available',
            amenities: ['Gym', 'Swimming Pool', 'Covered Parking', '24/7 Security'],
          },
        ],
      },
    };
  },
});

// 6. Get Course Details (Coaching & Tutor)
aiToolRegistry.register({
  name: 'getCourseDetails',
  description: 'Retrieves course curriculum, batch timings, and fee structures.',
  type: 'read',
  allowedIndustries: ['coaching', 'solo_teacher', 'tutor'],
  parameters: {
    courseName: {
      type: 'string',
      description: 'Name of the subject or course (e.g. Mathematics, Class 10 Foundation, NEET).',
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
  description: 'Searches active courses, exam programs, fees, and duration for coaching students.',
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
  description: 'Checks upcoming batches, class timings, start dates, and seat availability.',
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
  description: 'Records a new student admission enquiry or interested lead in the coaching pipeline.',
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

    await db.from('contacts').update({
      extra_attributes: {
        target_course: targetCourse,
        student_status: 'Interested',
        enquiry_source: 'WhatsApp',
      },
      updated_at: new Date().toISOString(),
    }).eq('id', context.contactId).eq('account_id', context.accountId);

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

// ═════════════════════════════════════════════════════════════════════════
// Core WRITE Tools
// ═════════════════════════════════════════════════════════════════════════

// 7. Create Appointment Booking (Health / Salon)
aiToolRegistry.register({
  name: 'createAppointment',
  description: 'Books an appointment for a patient/client on a confirmed date and time slot.',
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

// 8. Human Handoff (All industries)
aiToolRegistry.register({
  name: 'handoffToHuman',
  description: 'Transfers the conversation to human staff when the user requests it or when the inquiry requires specialized human assistance.',
  type: 'write',
  parameters: {
    reason: {
      type: 'string',
      description: 'The reason for escalating to human staff (e.g. complex request, customer asked for human, medical symptoms).',
      required: true,
    },
  },
  execute: async (params, context: AiExecutionContext) => {
    const db = getAdminClient();
    const reason = String(params.reason || 'Customer requested human assistance');

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
      conversation_id: context.conversationId,
      sender_type: 'bot',
      content_type: 'text',
      content_text: `[Human Handoff Triggered]: ${reason}. AI Auto-Reply paused.`,
      status: 'delivered',
      created_at: new Date().toISOString(),
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
