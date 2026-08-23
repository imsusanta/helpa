import { IndustryModule } from '../types';
import { sidebarConfig } from './sidebar';
import { dashboardConfig } from './dashboard';
import { systemPromptConfig } from './system-prompt';
import { knowledgeTemplateConfig } from './knowledge-template';
import { campaignTemplateConfig } from './campaign-template';
import { copilotConfig } from './copilot';
import { workflowsConfig } from './workflows';
import { getIndustryTerminology } from '../terminology';

export const restaurantModule: IndustryModule = {
  id: 'restaurant',
  name: 'Restaurant',
  description: 'AI Reservation Assistant',
  status: 'COMING_SOON',
  aiRole: 'AI Reservation Assistant',
  terminology: getIndustryTerminology('restaurant'),
  sidebar: sidebarConfig,
  dashboardMetrics: dashboardConfig,
  systemPrompt: systemPromptConfig,
  kbTemplates: knowledgeTemplateConfig,
  campaignTemplates: campaignTemplateConfig,
  copilotConfig: copilotConfig,
  workflows: workflowsConfig,
  pipelineStages: [
    { name: 'Reservation Pending', position: 1, color: '#f59e0b' },
    { name: 'Table Seated', position: 2, color: '#10b981' },
  ],
  entityConfigs: {
    contacts: {
      tableName: 'contacts',
      label: 'Guest',
      pluralLabel: 'Guests',
      fields: [
        { key: 'preferred_table', label: 'Preferred Table', type: 'text' },
        {
          key: 'food_preference',
          label: 'Food Preference',
          type: 'select',
          options: ['Veg', 'Non-Veg', 'Vegan', 'Other'],
        },
        { key: 'allergies', label: 'Allergies', type: 'text' },
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
