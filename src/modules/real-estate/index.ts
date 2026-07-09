import { IndustryModule } from '../types';

export const realEstateModule: IndustryModule = {
  id: 'real_estate',
  name: 'Real Estate',
  description: 'AI Property Consultant',

  sidebar: [
    { href: '/dashboard', label: 'Dashboard', iconName: 'LayoutDashboard' },
    { href: '/inbox', label: 'WhatsApp Chats', iconName: 'MessageSquare' },
    { href: '/leads', label: 'Leads', iconName: 'Users' },
    { href: '/properties', label: 'Properties', iconName: 'FileText' },
    { href: '/agents', label: 'Agents', iconName: 'UserCheck' },
    { href: '/site-visits', label: 'Site Visits', iconName: 'Calendar' },
    { href: '/broadcasts', label: 'Campaigns', iconName: 'Megaphone', roleMin: 'admin' },
    { href: '/knowledge-base', label: 'Knowledge', iconName: 'FileText' },
    { href: '/dashboard/analytics', label: 'AI Analytics', iconName: 'Brain' },
    { href: '/settings', label: 'Settings', iconName: 'Settings' },
  ],

  dashboardMetrics: [
    {
      key: 'leads_new',
      label: 'New Leads',
      iconName: 'Users',
      queryTable: 'realestate_leads',
      queryType: 'count'
    },
    {
      key: 'visits_scheduled',
      label: 'Site Visits',
      iconName: 'Calendar',
      queryTable: 'realestate_visits',
      queryType: 'count',
      queryFilters: [
        { field: 'status', operator: 'eq', value: 'scheduled' }
      ]
    },
    {
      key: 'deals_open',
      label: 'Open Deals',
      iconName: 'FileText',
      queryTable: 'deals',
      queryType: 'count',
      queryFilters: [
        { field: 'status', operator: 'eq', value: 'open' }
      ]
    }
  ],

  systemPrompt: `You are acting as the AI Property Consultant for our Real Estate agency.
Your primary role is to qualify buyers, recommend matching property listings, explain pricing, configurations (bedrooms/bathrooms), amenities, project locations, payment structures, and coordinate site tours/visit bookings.

AI RULES & LEADS QUALIFICATION PROTOCOLS:
1. **Qualify Buyers with Structured Form**:
   - Whenever the customer indicates they are interested in buying, renting, or viewing a property, you MUST reply with the empty structured intake form:
     📋 *LEAD PROPERTY PREFERENCES*
     Please reply with the following details:
     - *Buyer Full Name:* [Enter Name]
     - *Target Budget:* [e.g. ₹50 Lakhs, ₹2 Crores]
     - *Preferred Location:* [Specify Neighborhoods]
     - *Required Configuration:* [e.g. 2 BHK, 3 BHK Villa]
     
     (You can specify your preferred visit date and time in your reply)
   - Do NOT confirm any property matches or site bookings until Name, Budget, and Location are collected.
2. **Confirm Site Visit**:
   - Once they provide these details, verify slot schedules and tell them their site visit has been registered! Let them know a senior relationship manager will call them to coordinate transport or gate access.
3. **ACCURATE LISTING REPRESENTATION**: Only share prices, sizes, and amenities that are officially logged in the Knowledge Base. Never manufacture listings, mock discounts, or guarantee negotiations.`,

  kbTemplates: [
    {
      category: 'faq',
      questionTitle: 'Listing Documents',
      answerContent: 'Required documents: Government ID card, PAN card, address verification, and a 10% booking token deposit.'
    },
    {
      category: 'service',
      questionTitle: 'Active Projects',
      answerContent: 'Currently listing luxury premium apartments in Green Valley, eco-villas in Palm Groves, and commercial office units in Downtown Heights.'
    },
    {
      category: 'pricing',
      questionTitle: 'Standard Commissions',
      answerContent: 'Standard real estate buyer brokerage is 1% to 2% of the total transaction value. Rental fee is 1 month rent equivalent.'
    },
    {
      category: 'company',
      questionTitle: 'About Our Agency',
      answerContent: 'We have been serving real estate buyers since 2012, specializing in premium residential and commercial spaces.'
    }
  ],

  campaignTemplates: [
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
  ],

  copilotConfig: {
    summaryFields: ['budget', 'preferred_location', 'status'],
    quickActions: [
      { label: 'Schedule Visit', action: 'schedule_visit', iconName: 'Calendar' },
      { label: 'View Properties', action: 'view_properties', iconName: 'FileText' },
    ]
  },

  pipelineStages: [
    { name: 'Inbound Property Lead', position: 1, color: '#3b82f6' },
    { name: 'Site Visit Scheduled', position: 2, color: '#f59e0b' },
    { name: 'Offer / Token Submitted', position: 3, color: '#ec4899' },
    { name: 'Closed Won / Handed Over', position: 4, color: '#10b981' }
  ]
};
