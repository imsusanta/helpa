import { IndustryModule } from '../types';
import { sidebarConfig } from './sidebar';
import { dashboardConfig } from './dashboard';
import { systemPromptConfig } from './system-prompt';
import { knowledgeTemplateConfig } from './knowledge-template';
import { campaignTemplateConfig } from './campaign-template';
import { copilotConfig } from './copilot';
import { workflowsConfig } from './workflows';

export const hospitalModule: IndustryModule = {
  id: 'hospital_clinic',
  name: 'Hospital & Clinic',
  description: 'AI Hospital Receptionist',
  sidebar: sidebarConfig,
  dashboardMetrics: dashboardConfig,
  systemPrompt: systemPromptConfig,
  kbTemplates: knowledgeTemplateConfig,
  campaignTemplates: campaignTemplateConfig,
  copilotConfig: copilotConfig,
  workflows: workflowsConfig,
  pipelineStages: [
    { name: 'New Patient Registration', position: 1, color: '#3b82f6' },
    { name: 'Doctor Consultation Triage', position: 2, color: '#f59e0b' },
    { name: 'Diagnostic Testing / Labs', position: 3, color: '#ec4899' },
    { name: 'Treatment & Pharmacy', position: 4, color: '#8b5cf6' },
    { name: 'Discharged / Checked Out', position: 5, color: '#10b981' }
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
