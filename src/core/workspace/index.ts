/**
 * Helpa Core Platform — Workspace Model & Resolver
 *
 * Primary multi-tenant business container and settings model.
 */

export interface CoreWorkspace {
  id: string;
  name: string;
  industry: string;
  owner_id?: string;
  country?: string;
  timezone?: string;
  logo?: string | null;
  ai_system_prompt?: string | null;
  welcome_message?: string | null;
  settings?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  industry: string;
  timezone: string;
  hasWhatsApp: boolean;
  hasOpenRouterKey: boolean;
}
