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
  description: 'AI Property Consultant',
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
    { name: 'Closed Won / Handed Over', position: 4, color: '#10b981' }
  ]
};
export * from './sidebar';
export * from './dashboard';
export * from './entities';
export * from './system-prompt';
export * from './knowledge-template';
export * from './campaign-template';
export * from './copilot';
export * from './workflows';
