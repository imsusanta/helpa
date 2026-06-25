"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
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
} from "lucide-react";
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
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const COLORS = {
  sales: "#10b981",     // green
  support: "#0ea5e9",   // sky blue
  booking: "#8b5cf6",   // purple
  complaint: "#f43f5e", // rose
  other: "#64748b",     // slate

  hot: "#ef4444",       // red
  warm: "#f59e0b",      // amber
  cold: "#3b82f6",      // blue

  positive: "#10b981",
  neutral: "#e2e8f0",
  negative: "#ef4444",
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
    const supabase = createClient();

    try {
      // 1. Fetch conversations
      const { data: conversations, error: convError } = await supabase
        .from("conversations")
        .select("ai_intent, ai_lead_score, ai_sentiment, ai_resolved, ai_handoff_required, ai_faq_category, created_at, ai_chat_enabled");

      if (convError) throw convError;

      // 2. Fetch messages to count AI (bot) vs Human (agent) messages
      const { data: messages, error: msgError } = await supabase
        .from("messages")
        .select("sender_type, created_at");

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
        if (c.ai_lead_score === "hot") {
          leadHotCount++;
          if (c.created_at >= todayIso) hotLeadsToday++;
        } else if (c.ai_lead_score === "warm") {
          leadWarmCount++;
        } else if (c.ai_lead_score === "cold") {
          leadColdCount++;
        }

        // Today leads count
        if (c.created_at >= todayIso && (c.ai_lead_score === "hot" || c.ai_lead_score === "warm")) {
          newLeadsToday++;
        }

        // Intents
        if (c.ai_intent === "sales") intentSalesCount++;
        else if (c.ai_intent === "support") intentSupportCount++;
        else if (c.ai_intent === "booking") intentBookingCount++;
        else if (c.ai_intent === "complaint") intentComplaintCount++;
        else if (c.ai_intent === "other") intentOtherCount++;

        // Sentiment
        if (c.ai_sentiment === "positive") sentimentPositive++;
        else if (c.ai_sentiment === "neutral") sentimentNeutral++;
        else if (c.ai_sentiment === "negative") sentimentNegative++;

        // FAQs
        if (c.ai_faq_category === "pricing") faqPricing++;
        else if (c.ai_faq_category === "delivery") faqDelivery++;
        else if (c.ai_faq_category === "refund") faqRefund++;
        else if (c.ai_faq_category === "demo") faqDemo++;
        else if (c.ai_faq_category === "general") faqGeneral++;
      });

      // Message performance stats
      let botMessagesCount = 0;
      let humanMessagesCount = 0;
      let botRepliesToday = 0;

      messages?.forEach((m) => {
        if (m.sender_type === "bot") {
          botMessagesCount++;
          if (m.created_at >= todayIso) botRepliesToday++;
        } else if (m.sender_type === "agent") {
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
      console.error("Failed to load AI analytics metrics:", err);
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
      { name: "Sales", value: metrics.intentSalesCount, fill: COLORS.sales },
      { name: "Support", value: metrics.intentSupportCount, fill: COLORS.support },
      { name: "Booking", value: metrics.intentBookingCount, fill: COLORS.booking },
      { name: "Complaint", value: metrics.intentComplaintCount, fill: COLORS.complaint },
      { name: "Other", value: metrics.intentOtherCount, fill: COLORS.other },
    ].filter((d) => d.value > 0);
  }, [metrics]);

  const leadScoreData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: "Hot", count: metrics.leadHotCount, fill: COLORS.hot },
      { name: "Warm", count: metrics.leadWarmCount, fill: COLORS.warm },
      { name: "Cold", count: metrics.leadColdCount, fill: COLORS.cold },
    ];
  }, [metrics]);

  const sentimentData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: "Positive 😊", value: metrics.sentimentPositive, fill: COLORS.positive },
      { name: "Neutral 😐", value: metrics.sentimentNeutral, fill: COLORS.neutral },
      { name: "Negative 😠", value: metrics.sentimentNegative, fill: COLORS.negative },
    ].filter((d) => d.value > 0);
  }, [metrics]);

  const faqData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: "Pricing", count: metrics.faqPricing },
      { name: "Delivery", count: metrics.faqDelivery },
      { name: "Refund Policy", count: metrics.faqRefund },
      { name: "Demo Request", count: metrics.faqDemo },
      { name: "General / Other", count: metrics.faqGeneral },
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
        <div className="text-center space-y-3">
          <Loader2 className="mx-auto size-8 animate-spin text-purple-400" />
          <p className="text-sm text-muted-foreground">Aggregating AI Insights...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Failed to compile AI insights database.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="size-6 text-purple-400" />
            AI Assistant Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time intent detection, sentiment trends, lead qualification, and automated reply metrics.
          </p>
        </div>
        <Button
          onClick={fetchAiMetrics}
          variant="outline"
          size="sm"
          className="border-border text-foreground hover:bg-muted self-start"
        >
          Refresh Data
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                AI Resolution Rate
              </span>
              <Sparkles className="size-4 text-purple-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{resolutionRate}%</span>
              <span className="text-xs text-muted-foreground">handled on auto</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {metrics.resolvedCount} resolved • {metrics.handoffCount} handoffs
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Hot Leads Identified
              </span>
              <Flame className="size-4 text-red-500 animate-pulse" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-red-400">{metrics.leadHotCount}</span>
              <span className="text-xs text-red-300/80">high interest</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {metrics.leadWarmCount} warm leads • {metrics.leadColdCount} cold
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                AI Autopilot Share
              </span>
              <TrendingUp className="size-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{autopilotRate}%</span>
              <span className="text-xs text-muted-foreground">of total replies</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {metrics.botMessagesCount.toLocaleString()} AI • {metrics.humanMessagesCount.toLocaleString()} human
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Human Handoffs
              </span>
              <ShieldAlert className="size-4 text-rose-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-rose-400">{metrics.handoffCount}</span>
              <span className="text-xs text-muted-foreground">escalated cases</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {metrics.aiEnabledCount} of {metrics.totalConversations} chats have AI active
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Intent Detection Breakdown */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
              <PieIcon className="size-4 text-purple-400" />
              Customer Intent Analysis
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Detected topics and context of incoming customer messages.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center">
            {intentData.length === 0 ? (
              <p className="text-xs text-muted-foreground">No intent data registered yet.</p>
            ) : (
              <div className="h-full w-full flex items-center">
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
                    <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: "8px", color: "#f8fafc", fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-[40%] text-xs space-y-2 pl-4">
                  {intentData.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                      <span className="truncate text-foreground font-medium">{d.name}</span>
                      <span className="text-muted-foreground ml-auto">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sentiment breakdown */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
              <Smile className="size-4 text-purple-400" />
              Customer Sentiment breakdown
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Atmosphere and attitude of conversations handled by the bot.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center">
            {sentimentData.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sentiment data registered yet.</p>
            ) : (
              <div className="h-full w-full flex items-center">
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
                    <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: "8px", color: "#f8fafc", fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-[40%] text-xs space-y-2 pl-4">
                  {sentimentData.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                      <span className="truncate text-foreground font-medium">{d.name}</span>
                      <span className="text-muted-foreground ml-auto">{d.value}</span>
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
        <Card className="border-border bg-card lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
              <HelpCircle className="size-4 text-purple-400" />
              Top FAQ Analytics
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Most frequently queried topics from customers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {faqData.length === 0 ? (
              <p className="text-xs text-muted-foreground pt-4 text-center">No FAQ data captured yet.</p>
            ) : (
              faqData.map((faq, i) => {
                const totalFaqs = faqData.reduce((acc, curr) => acc + curr.count, 0);
                const percent = totalFaqs > 0 ? Math.round((faq.count / totalFaqs) * 100) : 0;
                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{i + 1}. {faq.name}</span>
                      <span className="text-muted-foreground">{faq.count} ({percent}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Lead scoring metrics */}
        <Card className="border-border bg-card lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
              <Activity className="size-4 text-purple-400" />
              Lead Score Metrics
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Hot, Warm, and Cold lead distribution in workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[260px] flex items-center justify-center">
            {metrics.leadHotCount + metrics.leadWarmCount + metrics.leadColdCount === 0 ? (
              <p className="text-xs text-muted-foreground">No leads qualified by AI yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadScoreData} layout="vertical" margin={{ left: -10, right: 10, top: 10, bottom: 5 }}>
                  <XAxis type="number" stroke="#64748b" fontSize={10} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} />
                  <Tooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} contentStyle={{ background: "#1e293b", border: "none", fontSize: "11px", color: "#fff" }} />
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
        <Card className="border-purple-500/20 bg-purple-950/10 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-purple-300">
              <Calendar className="size-4 text-purple-400" />
              Today&apos;s Executive AI Report
            </CardTitle>
            <CardDescription className="text-xs text-purple-200/70">
              Aggregated automated operations summary for today.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-purple-900/10 border border-purple-500/10 rounded-lg p-2.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-purple-300">New Leads</span>
                <p className="text-lg font-bold text-purple-100 mt-0.5">{metrics.newLeadsToday}</p>
              </div>
              <div className="bg-purple-900/10 border border-purple-500/10 rounded-lg p-2.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-purple-300">Hot Leads</span>
                <p className="text-lg font-bold text-red-300 mt-0.5">{metrics.hotLeadsToday}</p>
              </div>
              <div className="bg-purple-900/10 border border-purple-500/10 rounded-lg p-2.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-purple-300">Bot Replies</span>
                <p className="text-lg font-bold text-purple-100 mt-0.5">{metrics.botRepliesToday}</p>
              </div>
              <div className="bg-purple-900/10 border border-purple-500/10 rounded-lg p-2.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-purple-300">Handoffs</span>
                <p className="text-lg font-bold text-rose-300 mt-0.5">{metrics.handoffsToday}</p>
              </div>
            </div>

            <div className="text-xs text-purple-200/90 leading-relaxed border-t border-purple-500/15 pt-3.5 space-y-2">
              <p className="font-semibold text-purple-300">Today&apos;s Summary:</p>
              <ul className="list-disc pl-4 space-y-1 text-purple-100/80">
                <li>Captured <strong className="text-purple-200">{metrics.newLeadsToday} new leads</strong> in workspace.</li>
                <li>Identified <strong className="text-red-300">{metrics.hotLeadsToday} highly interested leads</strong>.</li>
                <li>AI assistant automatically handled <strong className="text-purple-200">{metrics.botRepliesToday} customer queries</strong>.</li>
                <li>Human handoffs were requested <strong className="text-rose-300">{metrics.handoffsToday} times</strong> for escalations.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
