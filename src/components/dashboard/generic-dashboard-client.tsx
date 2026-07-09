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
  Plus
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
          body: JSON.stringify({ industry: account?.industry })
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
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            {greeting}, {account?.name || 'Workspace'}
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              <Sparkles className="h-3 w-3 animate-spin" />
              {activeModule.name}
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
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
              className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md group"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{widget.label}</p>
                <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-foreground">
                  {count}
                </span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 font-medium">
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
        <div className="md:col-span-2 rounded-xl border border-border bg-card p-6 space-y-4">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Brain className="h-4 w-4 text-indigo-500" />
            AI Assistant Configuration
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your WhatsApp automated inbox is driven by a state-of-the-art AI assistant preloaded with customized settings for the {activeModule.name} industry.
          </p>

          <div className="rounded-lg bg-muted/30 border border-border/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Active Industry Model</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                Gemini 2.5 Flash
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Current system instructions:</span>
              <p className="text-xs text-muted-foreground line-clamp-3 bg-card p-2 rounded border border-border/30 italic">
                {activeModule.systemPrompt}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Link href="/settings">
              <Button size="sm" variant="outline" className="cursor-pointer text-xs flex items-center gap-1">
                Configure AI Agent <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h3 className="font-bold text-foreground">Quick Action Shortcuts</h3>
          <p className="text-xs text-muted-foreground">
            Configure templates, contacts, or initialize dynamic actions.
          </p>

          <div className="space-y-2">
            <Link href="/inbox">
              <Button className="w-full justify-start text-xs font-semibold" variant="outline">
                <MessageSquare className="h-3.5 w-3.5 mr-2 text-indigo-500" />
                Go to Inbox Chats
              </Button>
            </Link>

            <Link href="/broadcasts">
              <Button className="w-full justify-start text-xs font-semibold" variant="outline">
                <Megaphone className="h-3.5 w-3.5 mr-2 text-indigo-500" />
                Launch Campaign Campaign
              </Button>
            </Link>

            <Link href="/knowledge-base">
              <Button className="w-full justify-start text-xs font-semibold" variant="outline">
                <FileText className="h-3.5 w-3.5 mr-2 text-indigo-500" />
                Add FAQ Article
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
