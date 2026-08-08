import { IndustryModule } from '../types';
import { sidebarConfig } from './sidebar';
import { dashboardConfig } from './dashboard';
import { systemPromptConfig } from './system-prompt';
import { knowledgeTemplateConfig } from './knowledge-template';
import { campaignTemplateConfig } from './campaign-template';
import { copilotConfig } from './copilot';
import { workflowsConfig } from './workflows';

export const gymModule: IndustryModule = {
  id: 'gym',
  name: 'Gym & Fitness',
  description: 'AI Membership Assistant',
  sidebar: sidebarConfig,
  dashboardMetrics: dashboardConfig,
  systemPrompt: systemPromptConfig,
  kbTemplates: knowledgeTemplateConfig,
  campaignTemplates: campaignTemplateConfig,
  copilotConfig: copilotConfig,
  workflows: workflowsConfig,
  pipelineStages: [
    { name: 'Trial Lead Inbound', position: 1, color: '#3b82f6' },
    { name: 'Active Membership', position: 2, color: '#10b981' },
  ],
  entityConfigs: {
    contacts: {
      tableName: 'contacts',
      label: 'Member',
      pluralLabel: 'Members',
      fields: [
        { key: 'member_id', label: 'Member ID', type: 'text' },
        {
          key: 'membership_plan',
          label: 'Membership Plan',
          type: 'select',
          options: ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'],
        },
        { key: 'trainer_name', label: 'Trainer Name', type: 'text' },
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
