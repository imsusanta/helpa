import { IndustryModule } from '../types';
import { sidebarConfig } from './sidebar';
import { dashboardConfig } from './dashboard';
import { systemPromptConfig } from './system-prompt';
import { knowledgeTemplateConfig } from './knowledge-template';
import { campaignTemplateConfig } from './campaign-template';
import { copilotConfig } from './copilot';
import { workflowsConfig } from './workflows';

export const salonManifest: IndustryModule = {
  id: 'salon',
  name: 'Salon & Spa',
  description: 'AI Salon Receptionist & Appointment Booking',
  sidebar: sidebarConfig,
  dashboardMetrics: dashboardConfig,
  systemPrompt: systemPromptConfig,
  kbTemplates: knowledgeTemplateConfig,
  campaignTemplates: campaignTemplateConfig,
  copilotConfig: copilotConfig,
  workflows: workflowsConfig,
  pipelineStages: [
    { name: 'Service Enquiry', position: 1, color: '#ec4899' },
    { name: 'Slot Reserved', position: 2, color: '#3b82f6' },
    { name: 'Treatment In Progress', position: 3, color: '#f59e0b' },
    { name: 'Completed & Paid', position: 4, color: '#10b981' },
  ],
  entityConfigs: {
    contacts: {
      tableName: 'contacts',
      label: 'Client',
      pluralLabel: 'Clients',
      fields: [
        { key: 'preferred_stylist', label: 'Preferred Stylist', type: 'text' },
        { key: 'hair_skin_type', label: 'Hair / Skin Type', type: 'text' },
        { key: 'allergies', label: 'Allergies / Sensitivities', type: 'text' },
        { key: 'preferred_time_slot', label: 'Preferred Time Slot', type: 'text' },
      ],
    },
  },
};

export const salonModule = salonManifest;
