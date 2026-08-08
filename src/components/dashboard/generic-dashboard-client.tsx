'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getIndustryModule } from '@/modules/registry';
import {
  Calendar,
  Users,
  MessageSquare,
  FileText,
  UserCheck,
  Megaphone,
  Brain,
  Settings,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Loader2,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/dashboard/skeleton';
import { toast } from 'sonner';

const ICON_COMPONENTS: Record<string, any> = {
  LayoutDashboard: Calendar,
  Calendar,
  Users,
  MessageSquare,
  FileText,
  UserCheck,
  Megaphone,
  Brain,
  Settings,
};

export function GenericDashboardClient() {
  const { account, accountId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('Welcome back');
  const [metrics, setMetrics] = useState<Record<string, number>>({});

  const activeModule = getIndustryModule(account?.industry);

  useEffect(() => {
    const hr = new Date().getHours();
    if (hr < 12) setGreeting('Good Morning');
    else if (hr < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  useEffect(() => {
    if (!accountId) return;

    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/dashboard/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ industry: account?.industry }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setMetrics(data.metrics || {});
        } else {
          console.error('Failed to load dashboard metrics');
        }
      } catch (err) {
        console.error('Metrics fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [accountId, account?.industry]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-muted h-8 w-48 animate-pulse rounded" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {greeting}, {account?.name || 'Workspace'}
            <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium">
              <Sparkles className="h-3 w-3 animate-spin" />
              {activeModule.name}
            </span>
          </h1>
          <p className="text-muted-foreground mt-1 text-xs">
            Overview of your AI communication hub and operations.
          </p>
        </div>
      </div>

      {/* Dynamic Metrics Widgets Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeModule.dashboardMetrics.map((widget) => {
          const Icon = ICON_COMPONENTS[widget.iconName] || FileText;
          const count = metrics[widget.key] || 0;

          return (
            <div
              key={widget.key}
              className="border-border bg-card group relative overflow-hidden rounded-xl border p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  {widget.label}
                </p>
                <div className="bg-primary/10 text-primary rounded-lg p-2 transition-transform group-hover:scale-110">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-foreground text-3xl font-bold tracking-tight">
                  {count}
                </span>
                <span className="text-muted-foreground flex items-center gap-0.5 text-[10px] font-medium">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  Live count
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Assistant & Copilot Quick Actions */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="border-border bg-card space-y-4 rounded-xl border p-6 md:col-span-2">
          <h3 className="text-foreground flex items-center gap-2 font-bold">
            <Brain className="h-4 w-4 text-indigo-500" />
            AI Assistant Configuration
          </h3>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Your WhatsApp automated inbox is driven by a state-of-the-art AI
            assistant preloaded with customized settings for the{' '}
            {activeModule.name} industry.
          </p>

          <div className="bg-muted/30 border-border/50 space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-foreground text-xs font-semibold">
                Active Industry Model
              </span>
              <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                Gemini 2.5 Flash
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground text-[10px] font-bold uppercase">
                Current system instructions:
              </span>
              <p className="text-muted-foreground bg-card border-border/30 line-clamp-3 rounded border p-2 text-xs italic">
                {activeModule.systemPrompt}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Link href="/settings">
              <Button
                size="sm"
                variant="outline"
                className="flex cursor-pointer items-center gap-1 text-xs"
              >
                Configure AI Agent <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="border-border bg-card space-y-4 rounded-xl border p-6">
          <h3 className="text-foreground font-bold">Quick Action Shortcuts</h3>
          <p className="text-muted-foreground text-xs">
            Configure templates, contacts, or initialize dynamic actions.
          </p>

          <div className="space-y-2">
            <Link href="/inbox">
              <Button
                className="w-full justify-start text-xs font-semibold"
                variant="outline"
              >
                <MessageSquare className="mr-2 h-3.5 w-3.5 text-indigo-500" />
                Go to Inbox Chats
              </Button>
            </Link>

            <Link href="/broadcasts">
              <Button
                className="w-full justify-start text-xs font-semibold"
                variant="outline"
              >
                <Megaphone className="mr-2 h-3.5 w-3.5 text-indigo-500" />
                Launch Campaign Campaign
              </Button>
            </Link>

            <Link href="/knowledge-base">
              <Button
                className="w-full justify-start text-xs font-semibold"
                variant="outline"
              >
                <FileText className="mr-2 h-3.5 w-3.5 text-indigo-500" />
                Add FAQ Article
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
