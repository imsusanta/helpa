/**
 * Helpa Core Platform — AI Engine Types
 *
 * Reusable type definitions for AI roles, request pipelines, tool registries,
 * human handoff, and copilot capabilities across all Helpa industries.
 */

import type { AiMessage } from './provider';

export type AiRole =
  | 'AI Receptionist'
  | 'AI Admission Assistant'
  | 'AI Teaching Assistant'
  | 'AI Property Assistant'
  | 'AI Business Assistant';

export interface IndustryAiConfig {
  role: AiRole;
  systemPrompt: string;
  terminology: Record<string, string>;
  availableTools: string[];
  safetyRules: string[];
  welcomeMessageTemplate?: string;
}

export type ToolType = 'read' | 'write';

export interface AiToolParameter {
  type: string;
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface AiToolDefinition {
  name: string;
  description: string;
  type: ToolType;
  parameters: Record<string, AiToolParameter>;
  requiresConfirmation?: boolean;
  allowedIndustries?: string[];
  execute: (
    params: Record<string, unknown>,
    context: AiExecutionContext
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
}

export interface AiExecutionContext {
  accountId: string;
  userId: string;
  conversationId: string;
  contactId: string;
  industry?: string;
  contactName?: string;
  contactPhone?: string;
}

export interface AiContextBundle {
  systemPrompt: string;
  messages: AiMessage[];
  contactName?: string;
  contactPhone?: string;
  industry: string;
  role: AiRole;
  knowledgeSnippets: string[];
  availableTools: AiToolDefinition[];
  businessName?: string;
}

export interface AiExecutionResult {
  replyText: string;
  role: AiRole;
  model: string;
  provider: string;
  tokensUsed?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  toolCallsExecuted?: Array<{
    toolName: string;
    input: Record<string, unknown>;
    output: unknown;
  }>;
  needsHumanHandoff: boolean;
  handoffReason?: string;
  timestamp: string;
}

export interface CopilotSuggestions {
  summary: string;
  intent: string;
  suggestedReply: string;
  suggestedAction?: {
    label: string;
    actionType: string;
    payload?: Record<string, unknown>;
  };
  confidence: number;
}
