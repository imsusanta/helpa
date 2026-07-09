import { CampaignTemplateItem } from '../types';

export const campaignTemplateConfig: CampaignTemplateItem[] = [
  {
    name: 'Weekend Dining Special Offer',
    category: 'Menu Announcement',
    messageBody: 'Hello {{PatientName}}, We are featuring a fresh Truffle Salmon dinner menu this weekend. Reserve a table. Reply BOOK to save your seats.',
    ctaType: 'appointment'
  }
];
