import { IndustryModule } from '../types';

export const coachingModule: IndustryModule = {
  id: 'coaching',
  name: 'Coaching Institute',
  description: 'AI Admission Assistant',

  sidebar: [
    { href: '/dashboard', label: 'Dashboard', iconName: 'LayoutDashboard' },
    { href: '/inbox', label: 'WhatsApp Chats', iconName: 'MessageSquare' },
    { href: '/students', label: 'Students', iconName: 'Users' },
    { href: '/teachers', label: 'Teachers', iconName: 'UserCheck' },
    { href: '/courses', label: 'Courses', iconName: 'FileText' },
    { href: '/admissions', label: 'Admissions', iconName: 'Calendar' },
    { href: '/broadcasts', label: 'Campaigns', iconName: 'Megaphone', roleMin: 'admin' },
    { href: '/knowledge-base', label: 'Knowledge', iconName: 'FileText' },
    { href: '/dashboard/analytics', label: 'AI Analytics', iconName: 'Brain' },
    { href: '/settings', label: 'Settings', iconName: 'Settings' },
  ],

  dashboardMetrics: [
    {
      key: 'admissions_total',
      label: 'New Admissions',
      iconName: 'Calendar',
      queryTable: 'coaching_admissions',
      queryType: 'count',
      queryFilters: [
        { field: 'status', operator: 'eq', value: 'active' }
      ]
    },
    {
      key: 'student_leads',
      label: 'Student Enquiries',
      iconName: 'MessageSquare',
      queryTable: 'coaching_students',
      queryType: 'count',
      queryFilters: [
        { field: 'status', operator: 'eq', value: 'active' }
      ]
    },
    {
      key: 'courses_active',
      label: 'Course Enquiries',
      iconName: 'FileText',
      queryTable: 'coaching_courses',
      queryType: 'count'
    }
  ],

  systemPrompt: `You are acting as the AI Admission Counselor for our Coaching Institute.
Your primary role is to answer parent and student inquiries 24/7, explain course options, fees, timings, batches, teacher profiles, eligibility rules, mock tests schedules, and assist in registering new students.

AI RULES & STUDENT REGISTRATION SAFETY:
1. **Enroll Students with Structured Form**:
   - Whenever the student indicates they want to register or join a coaching program, you MUST reply with the empty structured form:
     📋 *STUDENT INTAKE FORM*
     Please reply with the following details:
     - *Student Full Name:* [Enter Name]
     - *Gender:* [Male/Female/Other]
     - *Date of Birth:* [YYYY-MM-DD]
     - *Target Exam / Grade:* [e.g. Grade 10, JEE, NEET, SAT]
     - *Parent Full Name & Phone:* [Name & Phone]
     
     (You can specify your preferred Batch Timings and Course in your reply)
   - Do NOT log registration details until Student Name, Target Grade/Exam, and DOB are collected.
2. **Confirm Admission Intake**:
   - Once they complete the details, confirm the course details and tell them their registration has been pre-scheduled successfully! Let them know an advisor will call to finalise their batch enrollment.
3. **DO NOT OFFER UNAUTHORIZED DISCOUNTS**: Only present official pricing and fees structures listed in the Knowledge Base. If asked for discounts, politely state that you cannot issue custom discounts but can schedule a meeting with the administrator.`,

  kbTemplates: [
    {
      category: 'faq',
      questionTitle: 'Class Hours',
      answerContent: 'Morning batches run from 7:00 AM to 9:00 AM. Evening batches run from 4:30 PM to 7:30 PM. Weekend mock tests run on Sundays.'
    },
    {
      category: 'service',
      questionTitle: 'Courses Offered',
      answerContent: 'We offer structured coaching classes for Class 9-12 Science/Math and target exam preparation for JEE Main/Advanced, NEET, and SAT.'
    },
    {
      category: 'pricing',
      questionTitle: 'Tuition Fee Structure',
      answerContent: 'Monthly tuition is ₹3,000 per subject. Full-year course bundle starts at ₹25,000. Installment payment plans are available.'
    },
    {
      category: 'company',
      questionTitle: 'Faculty Profiles',
      answerContent: 'Our core educators have 10+ years experience, with specialists for Physics, Chemistry, Mathematics, and Biology.'
    }
  ],

  campaignTemplates: [
    {
      name: 'JEE/NEET Admission Open',
      category: 'Admission Open',
      messageBody: 'Hello {{PatientName}}, Admissions are open for our target JEE/NEET offline coaching batches starting next Monday. Limited seats. Reply BOOK to claim your free trial class.',
      ctaType: 'appointment'
    },
    {
      name: 'Weekend Demo Batch Announcement',
      category: 'New Batch',
      messageBody: 'Learn from the best! Join our free Math & Physics demonstration class this Saturday morning. Boost your target score. Reply BOOK to save your seat.',
      ctaType: 'appointment'
    },
    {
      name: 'Mock Exam Schedule Reminder',
      category: 'Exam Reminder',
      messageBody: 'Hi {{PatientName}}, this is a reminder that the monthly JEE Mock Test is scheduled for this Sunday at 9:00 AM at the main center. Please arrive 15 mins early.',
      ctaType: 'none'
    }
  ],

  copilotConfig: {
    summaryFields: ['gender', 'date_of_birth', 'parent_name', 'status'],
    quickActions: [
      { label: 'Register Course', action: 'register_course', iconName: 'FileText' },
      { label: 'Select Batch', action: 'select_batch', iconName: 'Calendar' },
    ]
  },

  pipelineStages: [
    { name: 'Admission Lead Inbound', position: 1, color: '#3b82f6' },
    { name: 'Demo Session Scheduled', position: 2, color: '#f59e0b' },
    { name: 'Mock Test / Interview', position: 3, color: '#ec4899' },
    { name: 'Fees Paid / Active Student', position: 4, color: '#10b981' }
  ]
};
