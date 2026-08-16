import { CampaignTemplateItem } from '../types';

export const campaignTemplateConfig: CampaignTemplateItem[] = [
  {
    name: 'Weekend Pamper Package',
    category: 'Promotional Offer',
    messageBody:
      'Hi {{Name}}! ✨ Treat yourself this weekend to our Deluxe Spa & Hair Care Package at an exclusive 20% discount. Reply BOOK to reserve your relaxing slot.',
    ctaType: 'appointment',
    ctaText: 'Book Spa Slot',
  },
  {
    name: 'Festive Beauty & Glow Camp',
    category: 'Festive Season',
    messageBody:
      'Hello {{Name}}, look stunning this festive season! Book your pre-festive skin and hair glow treatments with our senior stylists today.',
    ctaType: 'url',
    ctaText: 'View Service Menu',
    ctaUrl: 'https://helpa.studio',
  },
  {
    name: 'Appointment Reminder',
    category: 'Service Reminder',
    messageBody:
      'Hi {{Name}}, this is a friendly reminder for your appointment tomorrow at {{Time}}. Please reply 1 to Confirm or 2 to Reschedule.',
    ctaType: 'appointment',
    ctaText: 'Confirm Booking',
  },
];
