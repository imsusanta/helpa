import { IndustryModule } from '../types';
import { sidebarConfig } from './sidebar';
import { dashboardConfig } from './dashboard';
import { systemPromptConfig } from './system-prompt';
import { knowledgeTemplateConfig } from './knowledge-template';
import { campaignTemplateConfig } from './campaign-template';
import { copilotConfig } from './copilot';
import { workflowsConfig } from './workflows';

export const coachingModule: IndustryModule = {
  id: 'coaching',
  name: 'Coaching Institute',
  description: 'AI Admission Assistant',
  sidebar: sidebarConfig,
  dashboardMetrics: dashboardConfig,
  systemPrompt: systemPromptConfig,
  kbTemplates: knowledgeTemplateConfig,
  campaignTemplates: campaignTemplateConfig,
  copilotConfig: copilotConfig,
  workflows: workflowsConfig,
  pipelineStages: [
    { name: 'Admission Lead Inbound', position: 1, color: '#3b82f6' },
    { name: 'Demo Session Scheduled', position: 2, color: '#f59e0b' },
    { name: 'Mock Test / Interview', position: 3, color: '#ec4899' },
    { name: 'Fees Paid / Active Student', position: 4, color: '#10b981' }
  ],
  entityConfigs: {
    contacts: {
      tableName: 'contacts',
      label: 'Student',
      pluralLabel: 'Students',
      fields: [
        { key: 'student_id', label: 'Student ID', type: 'text' },
        { key: 'parent_name', label: 'Parent Name', type: 'text' },
        { key: 'parent_mobile', label: 'Parent Mobile', type: 'text' },
        { key: 'course', label: 'Course', type: 'text' },
        { key: 'batch', label: 'Batch', type: 'text' },
        { key: 'roll_number', label: 'Roll Number', type: 'text' }
      ]
    }
  }
};
export * from './sidebar';
export * from './dashboard';
export * from './entities';
export * from './system-prompt';
export * from './knowledge-template';
export * from './campaign-template';
export * from './copilot';
export * from './workflows';
