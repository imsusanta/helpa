'use client';

import Link from 'next/link';
import { Sparkles, BookOpen, HelpCircle, Bot, ArrowRight } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { AiStatCard } from './ai-stat-card';
import { useAiStats } from './use-ai-stats';

/**
 * A compact, real-data panel that explains how the knowledge base powers the
 * AI, shown above the knowledge-base editor. Every figure comes from the live
 * /api/ai/stats endpoint — nothing is fabricated.
 */
export function KnowledgeAiPanel() {
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
          Every entry below is used by your WhatsApp AI to answer customers.
          Keep it accurate and complete for the best replies.
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
        <div className="flex flex-wrap gap-2">
          <Link
            href="/faq-bot"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Manage FAQ answers
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
          <Link
            href="/chatbot"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Chatbot settings
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
