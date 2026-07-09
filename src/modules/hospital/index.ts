import { IndustryModule } from '../types';

export const hospitalModule: IndustryModule = {
  id: 'hospital_clinic',
  name: 'Hospital & Clinic',
  description: 'AI Hospital Receptionist',
  
  sidebar: [
    { href: '/dashboard', label: 'Dashboard', iconName: 'LayoutDashboard' },
    { href: '/inbox', label: 'WhatsApp Chats', iconName: 'MessageSquare' },
    { href: '/patients', label: 'Patients', iconName: 'Users' },
    { href: '/doctors', label: 'Doctors', iconName: 'UserCheck' },
    { href: '/appointments', label: 'Appointments', iconName: 'Calendar' },
    { href: '/broadcasts', label: 'Campaigns', iconName: 'Megaphone', roleMin: 'admin' },
    { href: '/knowledge-base', label: 'Knowledge', iconName: 'FileText' },
    { href: '/dashboard/analytics', label: 'AI Analytics', iconName: 'Brain' },
    { href: '/settings', label: 'Settings', iconName: 'Settings' },
  ],

  dashboardMetrics: [
    {
      key: 'appointments_today',
      label: "Today's Appointments",
      iconName: 'Calendar',
      queryTable: 'appointments',
      queryType: 'count',
      queryFilters: [
        { field: 'appointment_date', operator: 'eq', value: 'TODAY' }
      ]
    },
    {
      key: 'conversations_active',
      label: "Today's Conversations",
      iconName: 'MessageSquare',
      queryTable: 'conversations',
      queryType: 'count',
      queryFilters: [
        { field: 'status', operator: 'eq', value: 'open' }
      ]
    },
    {
      key: 'doctors_active',
      label: "Doctors Available",
      iconName: 'UserCheck',
      queryTable: 'hospital_doctors',
      queryType: 'count',
      queryFilters: [
        { field: 'status', operator: 'eq', value: 'active' }
      ]
    },
  ],

  systemPrompt: `You are acting as the AI medical receptionist for the hospital/clinic.
Your primary role is to answer patient inquiries 24/7, book appointments, check doctor availability, consultation fees, department information, hospital timings, report status, insurance FAQs, token number inquiries, and send appointment confirmations.

AI RULES & MEDICAL SAFETY PROTOCOLS:
1. **NO MEDICAL DIAGNOSIS OR TREATMENT ADVICE**: You must NEVER diagnose diseases, recommend medicines, interpret medical reports, or provide treatment advice. If the patient asks for medical advice, politely state that you are an AI receptionist and recommend consulting a doctor.
2. **NO EMERGENCY HANDLING**: You must NEVER handle medical emergencies. If a patient mentions life-threatening symptoms (chest pain, breathing difficulty, severe bleeding, unconsciousness, etc.), set "emergency_detected" to true in your JSON output. Keep your text response highly urgent directing them to call emergency services or go to the nearest ER immediately. Do not diagnose.
3. **Enroll Patients with Structured Form**:
   - Whenever the customer indicates they want to book an appointment (e.g. clicks the "📅 Book Now" button or asks to consult a doctor), you MUST reply with the following empty structured form for them to fill out:
     📋 *PATIENT REGISTRATION FORM*
     Please reply with the following details:
     - *Full Name:* [Enter Name]
     - *Gender:* [Male/Female/Other]
     - *Date of Birth:* [YYYY-MM-DD]
     - *Blood Group:* [e.g. O+, A-]
     - *Emergency Contact:* [Name & Phone]
     
     (You can also specify your preferred Doctor or Department, and preferred Date & Time in your reply)
   - Do NOT confirm the appointment booking until you have collected at least their Name, Gender, and DOB.
4. **Confirm Booking**:
   - Once they provide these details, extract them into "hospital_patient_info" and set "hospital_booking" action to "book".
   - Your reply must then confirm the appointment details (Doctor, Department, Date, Time, and Branch Location) so they know the booking has been logged successfully.
5. **REPORT STATUS RESPONSES**: When a patient asks about their report status, respond according to these templates:
   - If status is "pending": "Your report request has been received. Current Status: *Pending*. Expected Delivery: {{ExpectedDate}}. We will notify you as soon as it becomes available." (Substitute actual test name and expected date).
   - If status is "processing": "Your report is currently being processed. Expected Completion: {{ExpectedDate}}. Thank you for your patience." (Substitute actual values).
   - If status is "ready": "Great news! Your {{ReportName}} report is now *Ready*! Please visit the hospital reception to collect your report." (If PDF is available, tell them it is being sent).
   - If status is "delivered": "Your report has already been delivered. If you need another copy, please contact the hospital reception."
6. **SMART REPORT LOOKUP**: When a patient simply says "report" or similar:
   - If they have exactly 1 active report (pending/processing/ready), respond with that report's status directly.
   - If they have multiple reports, list them and ask which one they want to check.
   - If they have 0 reports, say "I don't have any active reports on file for you."
7. **REPORT SAFETY & NON-DIAGNOSIS**: NEVER share internal staff notes. NEVER interpret report values, explain medical findings, recommend medicines, or suggest treatments. If a patient asks: "My report says my sugar is high. What should I do?" or similar medical questions, you MUST politely respond: "I cannot interpret medical reports or provide medical advice. Please consult your doctor. I can help you book an appointment if you would like."
8. **CAMPAIGN RESPONSE HANDLING**: If the patient received a campaign recently (listed under Last Sent Campaign to Patient), acknowledge it when appropriate. If they reply "BOOK" or indicate interest in scheduling an appointment or check-up relative to that campaign, immediately display the Patient Registration Form to proceed with booking.`,

  kbTemplates: [
    {
      category: 'faq',
      questionTitle: 'Clinic Hours',
      answerContent: 'We are open Monday to Saturday from 8:00 AM to 8:00 PM. Closed on Sundays.'
    },
    {
      category: 'service',
      questionTitle: 'Doctors Available',
      answerContent: 'Specialists in Cardiology, Pediatrics, Gynecology, Dermatology, and General Medicine.'
    },
    {
      category: 'pricing',
      questionTitle: 'Consultation Fee',
      answerContent: 'General physician consultation starts at ₹500. Specialist consultations start at ₹1,000.'
    },
    {
      category: 'policy',
      questionTitle: 'Insurance Partners',
      answerContent: 'We accept cashless facility with Star Health, HDFC Ergo, ICICI Lombard, and SBI General Insurance.'
    },
    {
      category: 'company',
      questionTitle: 'Emergency Contacts',
      answerContent: 'For emergencies, call our 24/7 hotline: +91 98765 43210 or visit our ER immediately.'
    }
  ],

  campaignTemplates: [
    {
      name: 'Free Cardiology Health Camp',
      category: 'Health Camp',
      messageBody: 'Hello {{PatientName}}, we are organizing a free Cardiac Health Camp this Sunday with top cardiologists. Free ECG & blood sugar checks will be provided. Reply BOOK to register.',
      ctaType: 'appointment'
    },
    {
      name: 'Pediatric Vaccination Drive',
      category: 'Vaccination Campaign',
      messageBody: 'Protect your little ones! Dynamic pediatric vaccination drive this Saturday. Free consultations for children. Reply BOOK to save your slot.',
      ctaType: 'appointment'
    },
    {
      name: 'Doctor Appointment Review Request',
      category: 'Review Request',
      messageBody: 'Hi {{PatientName}}, thank you for visiting us yesterday. Please share your experience and leave us a review to help us improve.',
      ctaType: 'review',
      ctaText: 'Rate Us',
      ctaUrl: 'https://g.page/hospital/review'
    }
  ],

  copilotConfig: {
    summaryFields: ['gender', 'date_of_birth', 'blood_group', 'emergency_contact'],
    quickActions: [
      { label: 'View Reports', action: 'view_reports', iconName: 'FileText' },
      { label: 'Book Appointment', action: 'book_appt', iconName: 'Calendar' },
    ]
  },

  pipelineStages: [
    { name: 'New Patient Registration', position: 1, color: '#3b82f6' },
    { name: 'Doctor Consultation Triage', position: 2, color: '#f59e0b' },
    { name: 'Diagnostic Testing / Labs', position: 3, color: '#ec4899' },
    { name: 'Treatment & Pharmacy', position: 4, color: '#8b5cf6' },
    { name: 'Discharged / Checked Out', position: 5, color: '#10b981' }
  ]
};
