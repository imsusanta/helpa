'use client';

import { useCallback, useEffect, useState } from 'react';

/** Real AI overview metrics returned by GET /api/ai/stats. */
export interface AiStats {
  ai_requests_used: number;
  ai_requests_limit: number;
  ai_requests_remaining: number;
  ai_requests_percent: number;
  knowledge_base_entries: number;
  faq_entries: number;
  conversations: number;
  chatbot_enabled: boolean;
  response_style: 'concise' | 'balanced' | 'detailed';
}

/** Real automation metrics returned by GET /api/automations/stats. */
export interface AutomationStats {
  total: number;
  active: number;
  inactive: number;
  limit: number;
  remaining: number;
}

export interface UseAiStatsResult {
  ai: AiStats | null;
  automations: AutomationStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches the module's real overview metrics from the two viewer-readable
 * stats endpoints. Nothing here is fabricated — the endpoints return live
 * counts and SaaS usage figures scoped to the authenticated account.
 */
export function useAiStats(): UseAiStatsResult {
  const [ai, setAi] = useState<AiStats | null>(null);
  const [automations, setAutomations] = useState<AutomationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [aiRes, autoRes] = await Promise.all([
        fetch('/api/ai/stats').catch(() => null),
        fetch('/api/automations/stats').catch(() => null),
      ]);

      if (aiRes && aiRes.ok) {
        setAi((await aiRes.json()) as AiStats);
      } else {
        setAi(null);
      }

      if (autoRes && autoRes.ok) {
        setAutomations((await autoRes.json()) as AutomationStats);
      } else {
        setAutomations(null);
      }

      if ((!aiRes || !aiRes.ok) && (!autoRes || !autoRes.ok)) {
        setError('Unable to load AI metrics.');
      }
    } catch {
      setError('Unable to load AI metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ai, automations, loading, error, refresh };
}
