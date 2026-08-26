import { IndustryModule } from '../types';
import { sidebarConfig } from './sidebar';
import { dashboardConfig } from './dashboard';
import { systemPromptConfig } from './system-prompt';
import { knowledgeTemplateConfig } from './knowledge-template';
import { campaignTemplateConfig } from './campaign-template';
import { copilotConfig } from './copilot';
import { workflowsConfig } from './workflows';

export const travelModule: IndustryModule = {
  id: 'travel',
  name: 'Travel Agency',
  description: 'AI Travel Receptionist & Tour Consultant for Travel Agencies',
  status: 'ACTIVE',
  aiRole: 'AI Travel Receptionist',
  terminology: {
    contact: 'Traveler',
    contacts: 'Travelers',
    booking: 'Tour Booking',
    bookings: 'Tour Bookings',
    staff: 'Travel Agent',
    staffMembers: 'Travel Agents',
    service: 'Tour Package',
    services: 'Tour Packages',
  },
  features: {
    packages: true,
    bookings: true,
    customers: true,
    leads: true,
    patients: false,
    doctors: false,
  },
  allowedRoutes: [
    '/dashboard',
    '/inbox',
    '/contacts',
    '/packages',
    '/bookings',
    '/broadcasts',
    '/knowledge-base',
    '/dashboard/analytics',
    '/settings',
    '/admin',
    '/billing',
    '/automations',
  ],
  sidebar: sidebarConfig,
  dashboardMetrics: dashboardConfig,
  systemPrompt: systemPromptConfig,
  kbTemplates: knowledgeTemplateConfig,
  campaignTemplates: campaignTemplateConfig,
  copilotConfig: copilotConfig,
  workflows: workflowsConfig,
  pipelineStages: [
    { name: 'Travel Lead Inbound', position: 1, color: '#3b82f6' },
    { name: 'Itinerary Custom Scoped', position: 2, color: '#f59e0b' },
    { name: 'Trip Scheduled', position: 3, color: '#10b981' },
  ],
  entityConfigs: {
    contacts: {
      tableName: 'contacts',
      label: 'Customer',
      pluralLabel: 'Customers',
      fields: [
        { key: 'passport_number', label: 'Passport Number', type: 'text' },
        { key: 'nationality', label: 'Nationality', type: 'text' },
        {
          key: 'preferred_destination',
          label: 'Preferred Destination',
          type: 'text',
        },
        { key: 'travel_date', label: 'Travel Date', type: 'date' },
      ],
    },
  },
};
export * from './sidebar';
export * from './dashboard';
export * from './entities';
export * from './system-prompt';
export * from './knowledge-template';
export * from './campaign-template';
export * from './copilot';
export * from './workflows';
