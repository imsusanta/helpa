import { CampaignTemplateItem } from '../types';

export const campaignTemplateConfig: CampaignTemplateItem[] = [
  {
    name: 'Eco-Villa Launch Event',
    category: 'New Project',
    messageBody: 'Hello {{PatientName}}, We are launching "Palm Groves Eco-Villas" this Sunday. Starting at ₹1.5 Cr, featuring solar panels and smart automation. Reply BOOK for an exclusive launch invitation.',
    ctaType: 'appointment'
  },
  {
    name: 'Apartment Price Drop Warning',
    category: 'Price Drop',
    messageBody: 'Alert! Direct price drop on 2 BHK premium apartments in Green Valley for the next 48 hours. Save up to ₹5 Lakhs. Reply BOOK to tour the sample flat today.',
    ctaType: 'appointment'
  },
  {
    name: 'Open House Registration invite',
    category: 'Open House',
    messageBody: 'Hi {{PatientName}}, You are invited to our Open House tour at Horizon Tower this Saturday from 11:00 AM to 4:00 PM. Experience luxury living. Reply BOOK to RSVP.',
    ctaType: 'appointment'
  }
];
