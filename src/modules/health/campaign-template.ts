import { CampaignTemplateItem } from '../types';

export const campaignTemplateConfig: CampaignTemplateItem[] = [
  {
    name: 'Annual Health Checkup Camp',
    category: 'Preventive Health',
    messageBody:
      'Dear {{Name}}, prioritize your well-being with our comprehensive Full Body Health Checkup package at 30% off this month. Reply BOOK to reserve your morning slot.',
    ctaType: 'appointment',
    ctaText: 'Book Checkup',
  },
  {
    name: 'Appointment Reminder & Token',
    category: 'Clinical Reminder',
    messageBody:
      'Dear {{Name}}, your consultation with Dr. {{Doctor}} is scheduled for tomorrow at {{Time}}. Token #{{Token}}. Reply 1 to Confirm or 2 to Reschedule.',
    ctaType: 'appointment',
    ctaText: 'Confirm Appointment',
  },
  {
    name: 'Diagnostic Report Ready Alert',
    category: 'Lab Report Notification',
    messageBody:
      'Dear {{Name}}, your recent pathology test results are ready. Download your secure verified report via the link below.',
    ctaType: 'url',
    ctaText: 'View Report',
    ctaUrl: 'https://helpa.studio/lab-reports',
  },
];
