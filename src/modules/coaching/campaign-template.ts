import { CampaignTemplateItem } from '../types';

export const campaignTemplateConfig: CampaignTemplateItem[] = [
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
];
