export interface ModuleNavItem {
  href: string;
  label: string;
  iconName: string; // Dynamic icon component name to avoid react imports in config
  roleMin?: 'viewer' | 'agent' | 'admin' | 'owner';
}

export interface DashboardMetricWidget {
  key: string;
  label: string;
  iconName: string;
  queryTable: string;
  queryType: 'count' | 'sum';
  querySumField?: string;
  queryFilters?: Array<{
    field: string;
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'is';
    value: any;
  }>;
}

export interface KbTemplateItem {
  category: 'faq' | 'service' | 'pricing' | 'policy' | 'company';
  questionTitle: string;
  answerContent: string;
}

export interface CampaignTemplateItem {
  name: string;
  category: string;
  messageBody: string;
  ctaType: 'none' | 'appointment' | 'review' | 'url';
  ctaText?: string;
  ctaUrl?: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'document';
}

export interface CopilotField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'select' | 'boolean';
  options?: string[];
}

export interface CopilotConfig {
  summaryFields: string[]; // Fields to fetch for the main AI context summary
  quickActions: Array<{
    label: string;
    action: string;
    iconName: string;
  }>;
}

export interface PipelineStageSeed {
  name: string;
  position: number;
  color: string;
}

export interface WorkflowSeed {
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: any;
  is_active: boolean;
  steps: any[];
}

export interface IndustryModule {
  id: string;
  name: string;
  description: string;
  sidebar: ModuleNavItem[];
  dashboardMetrics: DashboardMetricWidget[];
  systemPrompt: string;
  kbTemplates: KbTemplateItem[];
  campaignTemplates: CampaignTemplateItem[];
  copilotConfig: CopilotConfig;
  pipelineStages: PipelineStageSeed[];
  workflows: WorkflowSeed[];
}
