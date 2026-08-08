import { CampaignTemplateItem } from '../types';

export const campaignTemplateConfig: CampaignTemplateItem[] = [
  {
    name: 'Free Cardiology Health Camp',
    category: 'Health Camp',
    messageBody:
      'Hello {{PatientName}}, we are organizing a free Cardiac Health Camp this Sunday with top cardiologists. Free ECG & blood sugar checks will be provided. Reply BOOK to register.',
    ctaType: 'appointment',
  },
  {
    name: 'Pediatric Vaccination Drive',
    category: 'Vaccination Campaign',
    messageBody:
      'Protect your little ones! Dynamic pediatric vaccination drive this Saturday. Free consultations for children. Reply BOOK to save your slot.',
    ctaType: 'appointment',
  },
  {
    name: 'Doctor Appointment Review Request',
    category: 'Review Request',
    messageBody:
      'Hi {{PatientName}}, thank you for visiting us yesterday. Please share your experience and leave us a review to help us improve.',
    ctaType: 'review',
    ctaText: 'Rate Us',
    ctaUrl: 'https://g.page/hospital/review',
  },
];
