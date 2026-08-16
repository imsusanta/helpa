import { IndustryModule } from '../types';
import { sidebarConfig } from './sidebar';
import { dashboardConfig } from './dashboard';
import { systemPromptConfig } from './system-prompt';
import { knowledgeTemplateConfig } from './knowledge-template';
import { campaignTemplateConfig } from './campaign-template';
import { copilotConfig } from './copilot';
import { workflowsConfig } from './workflows';

export const realEstateModule: IndustryModule = {
  id: 'real_estate',
  name: 'Real Estate',
  description: 'AI Property Assistant for Real Estate Agencies',
  aiRole: 'AI Property Assistant',
  terminology: {
    contact: 'Lead',
    contacts: 'Leads',
    booking: 'Site Visit',
    bookings: 'Site Visits',
    staff: 'Agent',
    staffMembers: 'Agents',
    service: 'Property',
    services: 'Properties',
  },
  features: {
    leads: true,
    properties: true,
    agents: true,
    site_visits: true,
    patients: false,
    doctors: false,
    courses: false,
    services: false,
  },
  allowedRoutes: [
    '/dashboard',
    '/inbox',
    '/leads',
    '/contacts',
    '/properties',
    '/agents',
    '/site-visits',
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
    { name: 'Inbound Property Lead', position: 1, color: '#3b82f6' },
    { name: 'Site Visit Scheduled', position: 2, color: '#f59e0b' },
    { name: 'Offer / Token Submitted', position: 3, color: '#ec4899' },
    { name: 'Closed Won / Handed Over', position: 4, color: '#10b981' },
  ],
  entityConfigs: {
    contacts: {
      tableName: 'contacts',
      label: 'Lead',
      pluralLabel: 'Leads',
      fields: [
        { key: 'budget', label: 'Budget', type: 'number' },
        {
          key: 'interested_property',
          label: 'Interested Property',
          type: 'text',
        },
        {
          key: 'preferred_location',
          label: 'Preferred Location',
          type: 'text',
        },
        {
          key: 'property_type',
          label: 'Property Type',
          type: 'select',
          options: ['Apartment', 'Villa', 'Plot', 'Commercial', 'Other'],
        },
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
