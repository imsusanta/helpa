/**
 * Helpa Core Platform — AI Usage & Cost Tracker
 *
 * Tracks AI consumption across OpenRouter and OrcaRouter for reporting,
 * auditing, subscription limit enforcement, and cost optimization.
 */

import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import type { AiFeatureType, AiProviderName } from './types';

export interface AiUsageRecord {
  workspaceId: string;
  conversationId?: string;
  provider: AiProviderName;
  model: string;
  feature: AiFeatureType;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  status: 'success' | 'failed';
  errorType?: string;
  estimatedCost?: number;
}

/**
 * Calculates estimated cost per 1k tokens if model pricing is known.
 * Returns undefined if model pricing is unavailable rather than guessing.
 */
export function calculateEstimatedCost(
  provider: AiProviderName,
  model: string,
  promptTokens: number = 0,
  completionTokens: number = 0
): number | undefined {
  const normModel = model.toLowerCase();

  if (provider === 'orcarouter' && normModel.includes('auto')) {
    // OrcaRouter auto routing estimated average
    return (promptTokens * 0.00015 + completionTokens * 0.0006) / 1000;
  }

  if (
    normModel.includes('gemini-2.5-flash') ||
    normModel.includes('gemini-2.0-flash')
  ) {
    return (promptTokens * 0.000075 + completionTokens * 0.0003) / 1000;
  }

  if (normModel.includes('claude-3.5-sonnet')) {
    return (promptTokens * 0.003 + completionTokens * 0.015) / 1000;
  }

  if (normModel.includes('llama-3.3-70b')) {
    return (promptTokens * 0.0004 + completionTokens * 0.0004) / 1000;
  }

  return undefined;
}

/**
 * Persists AI usage logs to database asynchronously without blocking application response pipeline.
 */
export async function trackAiUsage(record: AiUsageRecord): Promise<void> {
  try {
    const db = appwriteAdmin();
    const cost =
      record.estimatedCost !== undefined
        ? record.estimatedCost
        : calculateEstimatedCost(
            record.provider,
            record.model,
            record.promptTokens,
            record.completionTokens
          );

    await db.from('audit_logs').insert({
      account_id: record.workspaceId,
      actor_id: 'system-ai-engine',
      action: 'ai.usage_logged',
      resource_type: 'ai_engine',
      resource_id: record.conversationId || record.workspaceId,
      metadata: {
        workspace_id: record.workspaceId,
        conversation_id: record.conversationId || null,
        provider: record.provider,
        model: record.model,
        feature: record.feature,
        input_tokens: record.promptTokens || 0,
        output_tokens: record.completionTokens || 0,
        total_tokens: record.totalTokens || 0,
        latency_ms: record.latencyMs || 0,
        status: record.status,
        error_type: record.errorType || null,
        estimated_cost: cost !== undefined ? cost : null,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    // Non-blocking logger error fallback
    console.warn(
      '[AI Usage Tracker] Log failed:',
      err instanceof Error ? err.message : err
    );
  }
}
