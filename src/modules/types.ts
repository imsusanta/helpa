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
    value: string | number | boolean | string[] | null;
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
export interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  options?: string[];
  required?: boolean;
}

export interface EntityConfig {
  tableName: string;
  label: string;
  pluralLabel: string;
  fields: FieldConfig[];
}

export interface WorkflowSeed {
  seedKey: string;
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  is_active: boolean;
  steps: Array<Record<string, unknown>>;
}

/**
 * Industry terminology contract is owned by the Core industry module
 * (`src/core/modules/terminology.ts`) and re-exported here for
 * backwards compatibility with existing UI consumers.
 */
export type { IndustryTerminology } from '@/core/modules/terminology';
import type { IndustryTerminology } from '@/core/modules/terminology';

export type IndustryStatus = 'ACTIVE' | 'COMING_SOON';

export type IndustryFeatures = Record<string, boolean>;

export interface IndustryModule {
  id: string;
  name: string;
  description: string;
  status: IndustryStatus;
  aiRole?: string;
  terminology?: Partial<IndustryTerminology>;
  features?: IndustryFeatures;
  allowedRoutes?: string[];
  sidebar: ModuleNavItem[];
  dashboardMetrics: DashboardMetricWidget[];
  systemPrompt: string;
  kbTemplates: KbTemplateItem[];
  campaignTemplates: CampaignTemplateItem[];
  copilotConfig: CopilotConfig;
  pipelineStages: PipelineStageSeed[];
  workflows: WorkflowSeed[];
  entityConfigs?: Record<string, EntityConfig>;
  aiTools?: string[];
  permissions?: Record<string, string[]>;
  safetyKeywords?: string[];
  safetyResponse?: string;
}
