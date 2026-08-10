'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/appwrite-compat';
import { useAuth } from '@/hooks/use-auth';
import {
  Brain,
  Flame,
  ShieldAlert,
  TrendingUp,
  Loader2,
  Sparkles,
  Calendar,
  Smile,
  PieChart as PieIcon,
  HelpCircle,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const COLORS = {
  sales: '#10b981', // green
  support: '#0ea5e9', // sky blue
  booking: '#10b981', // emerald green theme
  complaint: '#f43f5e', // rose
  other: '#64748b', // slate

  hot: '#ef4444', // red
  warm: '#f59e0b', // amber
  cold: '#3b82f6', // blue

  positive: '#10b981',
  neutral: '#64748b',
  negative: '#ef4444',
};

interface AiMetrics {
  totalConversations: number;
  aiEnabledCount: number;
  leadHotCount: number;
  leadWarmCount: number;
  leadColdCount: number;
  intentSalesCount: number;
  intentSupportCount: number;
  intentBookingCount: number;
  intentComplaintCount: number;
  intentOtherCount: number;
  sentimentPositive: number;
  sentimentNeutral: number;
  sentimentNegative: number;
  handoffCount: number;
  resolvedCount: number;
  faqPricing: number;
  faqDelivery: number;
  faqRefund: number;
  faqDemo: number;
  faqGeneral: number;
  botMessagesCount: number;
  humanMessagesCount: number;
  newLeadsToday: number;
  hotLeadsToday: number;
  handoffsToday: number;
  botRepliesToday: number;
}

export default function AiAnalyticsPage() {
  useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<AiMetrics | null>(null);

  const fetchAiMetrics = async () => {
    setLoading(true);
    const appwrite = createClient();

    try {
      // 1. Fetch conversations
      const { data: conversations, error: convError } = await appwrite
        .from('conversations')
        .select(
          'ai_intent, ai_lead_score, ai_sentiment, ai_resolved, ai_handoff_required, ai_faq_category, created_at, ai_chat_enabled'
        );

      if (convError) throw convError;

      // 2. Fetch messages to count AI (bot) vs Human (agent) messages
      const { data: messages, error: msgError } = await appwrite
        .from('messages')
        .select('sender_type, created_at');

      if (msgError) throw msgError;

      // Compute statistics
      const totalConversations = conversations?.length || 0;
      let aiEnabledCount = 0;
      let leadHotCount = 0;
      let leadWarmCount = 0;
      let leadColdCount = 0;
      let intentSalesCount = 0;
      let intentSupportCount = 0;
      let intentBookingCount = 0;
      let intentComplaintCount = 0;
      let intentOtherCount = 0;
      let sentimentPositive = 0;
      let sentimentNeutral = 0;
      let sentimentNegative = 0;
      let handoffCount = 0;
      let resolvedCount = 0;
      let faqPricing = 0;
      let faqDelivery = 0;
      let faqRefund = 0;
      let faqDemo = 0;
      let faqGeneral = 0;

      // Today filter setup
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayIso = todayStart.toISOString();

      let newLeadsToday = 0;
      let hotLeadsToday = 0;
      let handoffsToday = 0;

      conversations?.forEach((c) => {
        if (c.ai_chat_enabled) aiEnabledCount++;
        if (c.ai_resolved) resolvedCount++;
        if (c.ai_handoff_required) {
          handoffCount++;
          if (c.created_at >= todayIso) handoffsToday++;
        }

        // Lead scoring
        if (c.ai_lead_score === 'hot') {
          leadHotCount++;
          if (c.created_at >= todayIso) hotLeadsToday++;
        } else if (c.ai_lead_score === 'warm') {
          leadWarmCount++;
        } else if (c.ai_lead_score === 'cold') {
          leadColdCount++;
        }

        // Today leads count
        if (
          c.created_at >= todayIso &&
          (c.ai_lead_score === 'hot' || c.ai_lead_score === 'warm')
        ) {
          newLeadsToday++;
        }

        // Intents
        if (c.ai_intent === 'sales') intentSalesCount++;
        else if (c.ai_intent === 'support') intentSupportCount++;
        else if (c.ai_intent === 'booking') intentBookingCount++;
        else if (c.ai_intent === 'complaint') intentComplaintCount++;
        else if (c.ai_intent === 'other') intentOtherCount++;

        // Sentiment
        if (c.ai_sentiment === 'positive') sentimentPositive++;
        else if (c.ai_sentiment === 'neutral') sentimentNeutral++;
        else if (c.ai_sentiment === 'negative') sentimentNegative++;

        // FAQs
        if (c.ai_faq_category === 'pricing') faqPricing++;
        else if (c.ai_faq_category === 'delivery') faqDelivery++;
        else if (c.ai_faq_category === 'refund') faqRefund++;
        else if (c.ai_faq_category === 'demo') faqDemo++;
        else if (c.ai_faq_category === 'general') faqGeneral++;
      });

      // Message performance stats
      let botMessagesCount = 0;
      let humanMessagesCount = 0;
      let botRepliesToday = 0;

      messages?.forEach((m) => {
        if (m.sender_type === 'bot') {
          botMessagesCount++;
          if (m.created_at >= todayIso) botRepliesToday++;
        } else if (m.sender_type === 'agent') {
          humanMessagesCount++;
        }
      });

      setMetrics({
        totalConversations,
        aiEnabledCount,
        leadHotCount,
        leadWarmCount,
        leadColdCount,
        intentSalesCount,
        intentSupportCount,
        intentBookingCount,
        intentComplaintCount,
        intentOtherCount,
        sentimentPositive,
        sentimentNeutral,
        sentimentNegative,
        handoffCount,
        resolvedCount,
        faqPricing,
        faqDelivery,
        faqRefund,
        faqDemo,
        faqGeneral,
        botMessagesCount,
        humanMessagesCount,
        newLeadsToday,
        hotLeadsToday,
        handoffsToday,
        botRepliesToday,
      });
    } catch (err) {
      console.error('Failed to load AI analytics metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAiMetrics();
  }, []);

  // Compute chart datasets memoized
  const intentData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: 'Sales', value: metrics.intentSalesCount, fill: COLORS.sales },
      {
        name: 'Support',
        value: metrics.intentSupportCount,
        fill: COLORS.support,
      },
      {
        name: 'Booking',
        value: metrics.intentBookingCount,
        fill: COLORS.booking,
      },
      {
        name: 'Complaint',
        value: metrics.intentComplaintCount,
        fill: COLORS.complaint,
      },
      { name: 'Other', value: metrics.intentOtherCount, fill: COLORS.other },
    ].filter((d) => d.value > 0);
  }, [metrics]);

  const leadScoreData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: 'High', count: metrics.leadHotCount, fill: COLORS.hot },
      { name: 'Medium', count: metrics.leadWarmCount, fill: COLORS.warm },
      { name: 'Low', count: metrics.leadColdCount, fill: COLORS.cold },
    ];
  }, [metrics]);

  const sentimentData = useMemo(() => {
    if (!metrics) return [];
    return [
      {
        name: 'Positive 😊',
        value: metrics.sentimentPositive,
        fill: COLORS.positive,
      },
      {
        name: 'Neutral 😐',
        value: metrics.sentimentNeutral,
        fill: COLORS.neutral,
      },
      {
        name: 'Negative 😠',
        value: metrics.sentimentNegative,
        fill: COLORS.negative,
      },
    ].filter((d) => d.value > 0);
  }, [metrics]);

  const faqData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: 'Pricing', count: metrics.faqPricing },
      { name: 'Delivery', count: metrics.faqDelivery },
      { name: 'Refund Policy', count: metrics.faqRefund },
      { name: 'Demo Request', count: metrics.faqDemo },
      { name: 'General / Other', count: metrics.faqGeneral },
    ]
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [metrics]);

  const autopilotRate = useMemo(() => {
    if (!metrics) return 0;
    const total = metrics.botMessagesCount + metrics.humanMessagesCount;
    return total > 0 ? Math.round((metrics.botMessagesCount / total) * 100) : 0;
  }, [metrics]);

  const resolutionRate = useMemo(() => {
    if (!metrics) return 0;
    const total = metrics.resolvedCount + metrics.handoffCount;
    return total > 0 ? Math.round((metrics.resolvedCount / total) * 100) : 0;
  }, [metrics]);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-emerald-500" />
          <p className="text-muted-foreground text-sm">
            Aggregating AI Insights...
          </p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <p className="text-muted-foreground text-sm">
          Failed to compile AI insights database.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in space-y-6 duration-300">
      {/* Header */}
      <div className="via-background to-background relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 p-6 shadow-sm transition-all duration-300 sm:flex-row sm:items-center sm:justify-between">
        <div className="z-10">
          <h1 className="text-foreground flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            <Brain className="size-8 text-emerald-600 dark:text-emerald-400" />
            AI Assistant Analytics
          </h1>
          <p className="text-muted-foreground mt-1 max-w-xl text-xs leading-relaxed">
            Real-time intent detection, sentiment trends, inquiry priority
            qualification, and automated receptionist metrics.
          </p>
        </div>
        <Button
          onClick={fetchAiMetrics}
          variant="outline"
          size="sm"
          className="border-border text-foreground hover:bg-muted cursor-pointer font-semibold transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
        >
          Refresh Data
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* AI Resolution Card */}
        <Card className="border-border bg-card transition-all duration-300 hover:scale-[1.02] hover:border-emerald-500/20 hover:shadow-[0_8px_30px_rgba(16,185,129,0.06)] active:scale-[0.99]">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                AI Resolution Rate
              </span>
              <Sparkles className="size-4 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-foreground text-2xl font-black tracking-tight">
                {resolutionRate}%
              </span>
              <span className="text-muted-foreground text-xs font-medium">
                handled on auto
              </span>
            </div>
            <div className="text-muted-foreground mt-2 text-xs font-medium">
              {metrics.resolvedCount} resolved • {metrics.handoffCount} handoffs
            </div>
          </CardContent>
        </Card>

        {/* High Priority Inquiries Card */}
        <Card className="border-border bg-card transition-all duration-300 hover:scale-[1.02] hover:border-red-500/20 hover:shadow-[0_8px_30px_rgba(239,68,68,0.06)] active:scale-[0.99]">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                High Priority Inquiries
              </span>
              <Flame className="size-4 animate-pulse text-red-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black tracking-tight text-red-600 dark:text-red-400">
                {metrics.leadHotCount}
              </span>
              <span className="text-xs font-semibold text-red-500/80">
                action required
              </span>
            </div>
            <div className="text-muted-foreground mt-2 text-xs font-medium">
              {metrics.leadWarmCount} medium priority • {metrics.leadColdCount}{' '}
              low priority
            </div>
          </CardContent>
        </Card>

        {/* AI Autopilot Share Card */}
        <Card className="border-border bg-card transition-all duration-300 hover:scale-[1.02] hover:border-blue-500/20 hover:shadow-[0_8px_30px_rgba(59,130,246,0.06)] active:scale-[0.99]">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                AI Autopilot Share
              </span>
              <TrendingUp className="size-4 text-blue-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-foreground text-2xl font-black tracking-tight">
                {autopilotRate}%
              </span>
              <span className="text-muted-foreground text-xs font-medium">
                of total replies
              </span>
            </div>
            <div className="text-muted-foreground mt-2 text-xs font-medium">
              {metrics.botMessagesCount.toLocaleString()} AI •{' '}
              {metrics.humanMessagesCount.toLocaleString()} human
            </div>
          </CardContent>
        </Card>

        {/* Human Handoffs Card */}
        <Card className="border-border bg-card transition-all duration-300 hover:scale-[1.02] hover:border-amber-500/20 hover:shadow-[0_8px_30px_rgba(245,158,11,0.06)] active:scale-[0.99]">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                Human Handoffs
              </span>
              <ShieldAlert className="size-4 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400">
                {metrics.handoffCount}
              </span>
              <span className="text-muted-foreground text-xs font-medium">
                escalated cases
              </span>
            </div>
            <div className="text-muted-foreground mt-2 text-xs font-medium">
              {metrics.aiEnabledCount} of {metrics.totalConversations} chats
              have AI active
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Intent Detection Breakdown */}
        <Card className="border-border bg-card shadow-sm transition-all duration-300 hover:scale-[1.01] hover:border-emerald-500/10">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-1.5 text-sm font-extrabold">
              <PieIcon className="size-4 text-emerald-500" />
              Customer Intent Analysis
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              Detected topics and context of incoming customer messages.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex h-64 items-center justify-center">
            {intentData.length === 0 ? (
              <p className="text-muted-foreground text-xs italic">
                No intent data registered yet.
              </p>
            ) : (
              <div className="flex h-full w-full items-center">
                <ResponsiveContainer width="60%" height="100%">
                  <PieChart>
                    <Pie
                      data={intentData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      {intentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--card)',
                        borderColor: 'var(--border)',
                        color: 'var(--foreground)',
                        fontSize: '11px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-[40%] space-y-2.5 pl-4 text-[11px]">
                  {intentData.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: d.fill }}
                      />
                      <span className="text-foreground truncate font-semibold">
                        {d.name}
                      </span>
                      <span className="text-muted-foreground ml-auto font-bold">
                        {d.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sentiment breakdown */}
        <Card className="border-border bg-card shadow-sm transition-all duration-300 hover:scale-[1.01] hover:border-emerald-500/10">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-1.5 text-sm font-extrabold">
              <Smile className="size-4 text-emerald-500" />
              Customer Sentiment Breakdown
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              Atmosphere and attitude of conversations handled by the bot.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex h-64 items-center justify-center">
            {sentimentData.length === 0 ? (
              <p className="text-muted-foreground text-xs italic">
                No sentiment data registered yet.
              </p>
            ) : (
              <div className="flex h-full w-full items-center">
                <ResponsiveContainer width="60%" height="100%">
                  <PieChart>
                    <Pie
                      data={sentimentData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={0}
                      outerRadius={80}
                    >
                      {sentimentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--card)',
                        borderColor: 'var(--border)',
                        color: 'var(--foreground)',
                        fontSize: '11px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-[40%] space-y-2.5 pl-4 text-[11px]">
                  {sentimentData.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: d.fill }}
                      />
                      <span className="text-foreground truncate font-semibold">
                        {d.name}
                      </span>
                      <span className="text-muted-foreground ml-auto font-bold">
                        {d.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* FAQ Analytics */}
        <Card className="border-border bg-card shadow-sm transition-all duration-300 hover:scale-[1.01] hover:border-emerald-500/10 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-1.5 text-sm font-extrabold">
              <HelpCircle className="size-4 text-emerald-500" />
              Top FAQ Analytics
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              Most frequently queried topics from customers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {faqData.length === 0 ? (
              <p className="text-muted-foreground pt-4 text-center text-xs italic">
                No FAQ data captured yet.
              </p>
            ) : (
              faqData.map((faq, i) => {
                const totalFaqs = faqData.reduce(
                  (acc, curr) => acc + curr.count,
                  0
                );
                const percent =
                  totalFaqs > 0 ? Math.round((faq.count / totalFaqs) * 100) : 0;
                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-foreground font-semibold">
                        {i + 1}. {faq.name}
                      </span>
                      <span className="text-muted-foreground">
                        {faq.count} ({percent}%)
                      </span>
                    </div>
                    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Inquiry priority metrics */}
        <Card className="border-border bg-card shadow-sm transition-all duration-300 hover:scale-[1.01] hover:border-emerald-500/10 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-1.5 text-sm font-extrabold">
              <Activity className="size-4 text-emerald-500" />
              Inquiry Priority Metrics
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              High, Medium, and Low priority inquiry distribution.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex h-[260px] items-center justify-center">
            {metrics.leadHotCount +
              metrics.leadWarmCount +
              metrics.leadColdCount ===
            0 ? (
              <p className="text-muted-foreground text-xs italic">
                No inquiries qualified by AI yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={leadScoreData}
                  layout="vertical"
                  margin={{ left: -10, right: 10, top: 10, bottom: 5 }}
                >
                  <XAxis type="number" stroke="#64748b" fontSize={10} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#64748b"
                    fontSize={10}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{
                      background: 'var(--card)',
                      borderColor: 'var(--border)',
                      fontSize: '11px',
                      color: 'var(--foreground)',
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                    {leadScoreData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Daily AI Report Card */}
        <Card className="border-emerald-500/25 bg-emerald-500/5 shadow-sm transition-all duration-300 hover:scale-[1.01] lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
              <Calendar className="size-4 text-emerald-500" />
              Today&apos;s AI Assistant Summary
            </CardTitle>
            <CardDescription className="text-xs font-semibold text-emerald-600/75 dark:text-emerald-400/75">
              Aggregated automated operations summary for today.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5">
                <span className="text-[10px] font-bold tracking-wider text-emerald-700 uppercase dark:text-emerald-400">
                  New Inquiries
                </span>
                <p className="text-foreground mt-0.5 text-lg font-black">
                  {metrics.newLeadsToday}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5">
                <span className="text-[10px] font-bold tracking-wider text-emerald-700 uppercase dark:text-emerald-400">
                  High Priority
                </span>
                <p className="mt-0.5 text-lg font-black text-red-500 dark:text-red-400">
                  {metrics.hotLeadsToday}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5">
                <span className="text-[10px] font-bold tracking-wider text-emerald-700 uppercase dark:text-emerald-400">
                  AI Replies
                </span>
                <p className="text-foreground mt-0.5 text-lg font-black">
                  {metrics.botRepliesToday}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5">
                <span className="text-[10px] font-bold tracking-wider text-emerald-700 uppercase dark:text-emerald-400">
                  Handoffs
                </span>
                <p className="mt-0.5 text-lg font-black text-amber-500">
                  {metrics.handoffsToday}
                </p>
              </div>
            </div>

            <div className="text-muted-foreground space-y-2 border-t border-emerald-500/15 pt-3.5 text-xs leading-relaxed">
              <p className="text-[10px] font-extrabold tracking-wider text-emerald-700 uppercase dark:text-emerald-400">
                Today&apos;s Summary:
              </p>
              <ul className="text-muted-foreground list-disc space-y-1 pl-4 font-semibold">
                <li>
                  Captured{' '}
                  <strong className="text-foreground">
                    {metrics.newLeadsToday} new patient inquiries
                  </strong>{' '}
                  in workspace.
                </li>
                <li>
                  Identified{' '}
                  <strong className="text-red-500 dark:text-red-400">
                    {metrics.hotLeadsToday} high priority patient inquiries
                  </strong>
                  .
                </li>
                <li>
                  AI assistant automatically handled{' '}
                  <strong className="text-foreground">
                    {metrics.botRepliesToday} patient queries
                  </strong>
                  .
                </li>
                <li>
                  Human handoffs were requested{' '}
                  <strong className="text-amber-500">
                    {metrics.handoffsToday} times
                  </strong>{' '}
                  for escalations.
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
