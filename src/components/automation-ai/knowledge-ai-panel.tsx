'use client';

import { Sparkles, BookOpen, HelpCircle, Bot, ArrowRight } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/hooks/use-workspace';
import { getIndustryAiPreset } from '@/lib/ai/industry-ai-presets';
import type { KnowledgeBaseTab } from '@/lib/knowledge-base/tabs';

import { AiStatCard } from './ai-stat-card';
import { useAiStats } from './use-ai-stats';

/**
 * A compact, real-data panel that explains how the knowledge base powers the
 * AI, shown above the knowledge-base editor. Every figure comes from the live
 * /api/ai/stats endpoint — nothing is fabricated.
 */
export function KnowledgeAiPanel({
  onOpenTab,
}: {
  onOpenTab?: (tab: KnowledgeBaseTab) => void;
}) {
  const { currentIndustry } = useWorkspace();
  const preset = getIndustryAiPreset(currentIndustry);
  const { ai, loading } = useAiStats();

  return (
    <Card className="border-emerald-100 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/10">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          <CardTitle className="text-base">Powering your AI</CardTitle>
          {ai ? (
            <Badge variant={ai.chatbot_enabled ? 'default' : 'secondary'}>
              {ai.chatbot_enabled ? 'Auto-reply on' : 'Auto-reply off'}
            </Badge>
          ) : null}
        </div>
        <CardDescription>
          Every entry below is used by your WhatsApp {preset.assistantRole} to
          answer customers. Keep it accurate and complete for the best replies.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <AiStatCard
            icon={BookOpen}
            label="Total entries"
            value={ai ? ai.knowledge_base_entries.toLocaleString() : '—'}
            loading={loading}
            accent="emerald"
          />
          <AiStatCard
            icon={HelpCircle}
            label="FAQ answers"
            value={ai ? ai.faq_entries.toLocaleString() : '—'}
            loading={loading}
            accent="blue"
          />
          <AiStatCard
            icon={Bot}
            label="AI requests this month"
            value={ai ? ai.ai_requests_used.toLocaleString() : '—'}
            sublabel={
              ai ? `of ${ai.ai_requests_limit.toLocaleString()}` : undefined
            }
            loading={loading}
            accent="violet"
          />
        </div>
        {onOpenTab ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenTab('faq')}
            >
              Manage FAQ answers
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenTab('receptionist')}
            >
              {preset.assistantRole} settings
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
