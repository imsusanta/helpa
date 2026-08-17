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
  Plus,
  ArrowRight,
  Clock,
  Sparkles,
  Bot,
  AlertCircle,
  Building,
  GraduationCap,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SkeletonCard } from '@/components/dashboard/skeleton';

const ICON_COMPONENTS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  LayoutDashboard: Calendar,
  Calendar,
  Users,
  MessageSquare,
  FileText,
  UserCheck,
  Megaphone,
  Building,
  GraduationCap,
  Sparkles,
  Clock,
};

export function GenericDashboardClient() {
  const { account, accountId, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('Good morning');
  const [metrics, setMetrics] = useState<Record<string, number>>({});

  const activeModule = getIndustryModule(account?.industry);
  const userName = profile?.full_name?.split(' ')[0] || account?.name || 'there';

  useEffect(() => {
    const hr = new Date().getHours();
    if (hr < 12) setGreeting('Good morning');
    else if (hr < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  // Determine industry-specific primary entity and quick actions
  const primaryEntityHref = activeModule.sidebar.find((s) => s.href !== '/dashboard' && s.href !== '/inbox')?.href || '/contacts';
  const primaryEntityLabel = activeModule.sidebar.find((s) => s.href === primaryEntityHref)?.label || 'People';

  // Build actionable attention items
  const attentionItems: Array<{ id: string; text: string; href: string; actionLabel: string }> = [];
  const unreadCount = metrics.unread_messages || metrics.new_messages || metrics.conversations || 0;
  const pendingCount = metrics.pending_appointments || metrics.pending_bookings || metrics.pending_enquiries || 0;
  const followupsCount = metrics.followups_due || metrics.follow_ups || 0;

  if (pendingCount > 0) {
    attentionItems.push({
      id: 'pending',
      text: `${pendingCount} item${pendingCount > 1 ? 's' : ''} require your confirmation or review`,
      href: primaryEntityHref,
      actionLabel: 'Review',
    });
  }

  if (unreadCount > 0) {
    attentionItems.push({
      id: 'messages',
      text: `${unreadCount} new customer message${unreadCount > 1 ? 's' : ''} waiting for reply`,
      href: '/inbox',
      actionLabel: 'View',
    });
  }

  if (followupsCount > 0) {
    attentionItems.push({
      id: 'followups',
      text: `${followupsCount} scheduled follow-up${followupsCount > 1 ? 's' : ''} due today`,
      href: '/follow-ups',
      actionLabel: 'Open',
    });
  }

  return (
    <div className="space-y-7 max-w-6xl mx-auto pb-10">
      {/* 1. Header Greeting */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl flex items-center gap-2">
            {greeting}, {userName} 👋
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Here&apos;s what needs your attention today.
          </p>
        </div>

        {/* AI Status Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-medium self-start sm:self-auto">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>AI Assistant is active</span>
        </div>
      </div>

      {/* 2. What Needs Your Attention? (Conditional Alert Card) */}
      {attentionItems.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 shadow-sm overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Needs your attention
              </h2>
            </div>
            <div className="space-y-2">
              {attentionItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 bg-background/80 dark:bg-background/40 p-2.5 rounded-lg border border-amber-500/20 text-xs text-foreground"
                >
                  <span>{item.text}</span>
                  <Link href={item.href}>
                    <Button size="sm" variant="outline" className="h-7 text-xs font-medium">
                      {item.actionLabel}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. Today's Overview (4–6 Summary Cards) */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Today&apos;s Overview
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {activeModule.dashboardMetrics.map((widget) => {
            const Icon = ICON_COMPONENTS[widget.iconName] || FileText;
            const count = metrics[widget.key] || 0;

            return (
              <Card
                key={widget.key}
                className="border-border bg-card shadow-sm hover:shadow-md transition-shadow"
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-xs font-medium">
                      {widget.label}
                    </p>
                    <div className="bg-primary/10 text-primary rounded-lg p-2">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="text-foreground text-3xl font-bold tracking-tight tabular-nums">
                      {count}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 4. Quick Actions & Direct Tasks */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left 2 Cols: Primary Business Shortcuts */}
        <Card className="md:col-span-2 border-border shadow-sm">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Quick Actions
            </h2>
            <p className="text-muted-foreground text-xs">
              Fast shortcuts to manage {activeModule.name.toLowerCase()} operations.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Link href={primaryEntityHref}>
                <Button variant="outline" className="w-full justify-start h-12 text-xs font-medium border-border">
                  <Plus className="mr-2 h-4 w-4 text-primary" />
                  Add {primaryEntityLabel.slice(0, -1) || 'Entry'}
                </Button>
              </Link>

              <Link href="/inbox">
                <Button variant="outline" className="w-full justify-start h-12 text-xs font-medium border-border">
                  <MessageSquare className="mr-2 h-4 w-4 text-emerald-500" />
                  Open Messages
                </Button>
              </Link>

              <Link href="/broadcasts">
                <Button variant="outline" className="w-full justify-start h-12 text-xs font-medium border-border">
                  <Megaphone className="mr-2 h-4 w-4 text-blue-500" />
                  Send Campaign
                </Button>
              </Link>

              <Link href="/knowledge-base">
                <Button variant="outline" className="w-full justify-start h-12 text-xs font-medium border-border">
                  <FileText className="mr-2 h-4 w-4 text-violet-500" />
                  Update Knowledge
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Right Col: AI Business Assistant Card */}
        <Card className="border-border shadow-sm bg-gradient-to-b from-primary/5 to-transparent">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 text-primary p-2 rounded-lg">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">AI Assistant</h2>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Ready to reply</span>
              </div>
            </div>

            <p className="text-muted-foreground text-xs leading-relaxed">
              Helpa automatically replies to repetitive customer inquiries on WhatsApp using your business knowledge.
            </p>

            <div className="pt-2">
              <Link href="/inbox">
                <Button size="sm" className="w-full text-xs font-medium">
                  View Live Chats <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
