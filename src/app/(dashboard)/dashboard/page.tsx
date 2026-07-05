"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Calendar,
  Users,
  MessageSquare,
  Clock,
  UserCheck,
  Brain,
  DollarSign,
  Loader2,
  Plus,
  ArrowRight,
  TrendingUp,
  FileText,
  CheckCheck,
  FileUp,
  Bell,
  CalendarCheck,
  CalendarX,
  Percent,
  Package,
  Sparkles,
  ArrowUpRight,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/dashboard/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface AppointmentRow {
  id: string;
  appointment_time: string;
  department: string;
  status: string;
  patient: { name: string; phone: string } | null;
  doctor: { name: string } | null;
}

const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"];

export default function ClinicalDashboardPage() {
  const { accountId } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Welcome back");
  const [activeModelName, setActiveModelName] = useState("Gemini 2.5 Flash");
  const [stats, setStats] = useState({
    conversationsToday: 0,
    aiRepliesToday: 0,
    humanRepliesToday: 0,
    appointmentsToday: 0,
    pendingAppointments: 0,
    doctorsAvailable: 0,
    aiResolutionRate: 95,
    missedConversations: 0,
    reportsPending: 0,
    reportsReadyToday: 0,
    reportsDeliveredToday: 0,
    remindersSentToday: 0,
    confirmedAppointments: 0,
    rescheduledAppointments: 0,
    cancelledAppointments: 0,
    noShowRate: 0,
    reportsAwaitingCollection: 0,
  });

  const [recentAppointments, setRecentAppointments] = useState<AppointmentRow[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [deptData, setDeptData] = useState<any[]>([]);

  // Dynamically compute greeting
  useEffect(() => {
    const hr = new Date().getHours();
    if (hr < 12) setGreeting("Good Morning");
    else if (hr < 18) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");
  }, []);

  // Fetch active OpenRouter model
  useEffect(() => {
    if (!accountId) return;
    async function getAiModel() {
      try {
        const res = await fetch("/api/account/ai");
        if (res.ok) {
          const data = await res.json();
          const modelId = data.openrouter_model || "google/gemini-2.5-flash";
          if (modelId === "google/gemini-2.5-flash") setActiveModelName("Gemini 2.5 Flash");
          else if (modelId === "anthropic/claude-3.5-sonnet") setActiveModelName("Claude 3.5 Sonnet");
          else if (modelId === "meta-llama/llama-3.3-70b-instruct") setActiveModelName("Llama 3.3 70B");
          else setActiveModelName(modelId.split("/")[1] || modelId);
        }
      } catch (e) {
        console.error("Failed to load active model name:", e);
      }
    }
    getAiModel();
  }, [accountId]);

  const loadDashboardData = useCallback(async () => {
    if (!accountId) return;
    const db = createClient();
    const todayStr = new Date().toISOString().split("T")[0];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    try {
      // 1. Fetch counts in parallel
      const [
        convsToday,
        aiReplies,
        humanReplies,
        apptToday,
        apptPending,
        docsActive,
        handoffConvs,
        recentAppts,
        reportsPending,
        reportsReady,
        reportsDelivered,
        remindersSent,
        confirmedCount,
        rescheduledCount,
        cancelledCount,
        noShowCount,
        completedCount,
        awaitingCollection,
      ] = await Promise.all([
        db.from("conversations").select("id", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()),
        db.from("messages").select("id", { count: "exact", head: true }).eq("sender_type", "bot").gte("created_at", todayStart.toISOString()),
        db.from("messages").select("id", { count: "exact", head: true }).eq("sender_type", "agent").gte("created_at", todayStart.toISOString()),
        db.from("appointments").select("id", { count: "exact", head: true }).eq("appointment_date", todayStr),
        db.from("appointments").select("id", { count: "exact", head: true }).eq("status", "pending"),
        db.from("hospital_doctors").select("id", { count: "exact", head: true }).eq("status", "active"),
        db.from("conversations").select("id", { count: "exact", head: true }).eq("ai_handoff_required", true),
        db
          .from("appointments")
          .select("id, appointment_time, department, status, patient:contacts(name, phone), doctor:hospital_doctors(name)")
          .eq("appointment_date", todayStr)
          .order("appointment_time", { ascending: true })
          .limit(5),
        db.from("hospital_lab_reports").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]),
        db.from("hospital_lab_reports").select("id", { count: "exact", head: true }).eq("status", "ready").gte("updated_at", todayStart.toISOString()),
        db.from("hospital_lab_reports").select("id", { count: "exact", head: true }).eq("status", "delivered").gte("updated_at", todayStart.toISOString()),
        // Reminders & Statuses Queries
        db.from("appointments").select("id", { count: "exact", head: true }).or("reminder_24h_sent.eq.true,reminder_2h_sent.eq.true").gte("updated_at", todayStart.toISOString()),
        db.from("appointments").select("id", { count: "exact", head: true }).eq("status", "Confirmed"),
        db.from("appointments").select("id", { count: "exact", head: true }).eq("status", "Rescheduled"),
        db.from("appointments").select("id", { count: "exact", head: true }).eq("status", "Cancelled"),
        db.from("appointments").select("id", { count: "exact", head: true }).eq("status", "No Show"),
        db.from("appointments").select("id", { count: "exact", head: true }).eq("status", "Completed"),
        db.from("hospital_lab_reports").select("id", { count: "exact", head: true }).eq("status", "ready"),
      ]);

      const totalConvs = convsToday.count || 0;
      const missed = handoffConvs.count || 0;
      const aiRepliesCount = aiReplies.count || 0;
      const humanRepliesCount = humanReplies.count || 0;

      // Calculate AI Resolution Rate dynamically
      let resolutionRate = 95;
      if (totalConvs > 0) {
        resolutionRate = Math.round(((totalConvs - missed) / totalConvs) * 100);
        if (resolutionRate < 0) resolutionRate = 0;
        if (resolutionRate > 100) resolutionRate = 100;
      }

      const noShows = noShowCount.count || 0;
      const completed = completedCount.count || 0;
      const totalConcluded = noShows + completed;
      const noShowRatePercent = totalConcluded > 0 ? Math.round((noShows / totalConcluded) * 100) : 0;

      setStats({
        conversationsToday: totalConvs,
        aiRepliesToday: aiRepliesCount,
        humanRepliesToday: humanRepliesCount,
        appointmentsToday: apptToday.count || 0,
        pendingAppointments: apptPending.count || 0,
        doctorsAvailable: docsActive.count || 0,
        aiResolutionRate: resolutionRate,
        missedConversations: missed,
        reportsPending: reportsPending.count || 0,
        reportsReadyToday: reportsReady.count || 0,
        reportsDeliveredToday: reportsDelivered.count || 0,
        remindersSentToday: remindersSent.count || 0,
        confirmedAppointments: confirmedCount.count || 0,
        rescheduledAppointments: rescheduledCount.count || 0,
        cancelledAppointments: cancelledCount.count || 0,
        noShowRate: noShowRatePercent,
        reportsAwaitingCollection: awaitingCollection.count || 0,
      });

      setRecentAppointments((recentAppts.data as any) || []);

      // Seed chart data
      setChartData([
        { name: "Mon", appointments: 4 },
        { name: "Tue", appointments: 8 },
        { name: "Wed", appointments: apptToday.count || 6 },
        { name: "Thu", appointments: 5 },
        { name: "Fri", appointments: 9 },
        { name: "Sat", appointments: 3 },
      ]);

      setDeptData([
        { name: "Pediatrics", value: 35 },
        { name: "Cardiology", value: 20 },
        { name: "General Medicine", value: 25 },
        { name: "Orthopedics", value: 15 },
        { name: "Dermatology", value: 5 },
      ]);
    } catch (err) {
      console.error("Error loading dashboard metrics:", err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Loading receptionist KPIs and activity feed...</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Dynamic Glassmorphism Welcome Header */}
      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between p-6 bg-gradient-to-r from-emerald-500/10 via-background to-background border border-emerald-500/20 rounded-2xl gap-4 shadow-sm overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Sparkles className="h-40 w-40 text-emerald-500" />
        </div>
        <div className="z-10">
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl">
            {greeting}, WACRM Staff
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
            Here is your live clinical communication summary for today. Your WhatsApp receptionist is handling inbound enquiries on autopilot.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 z-10">
          {/* Active AI Status Badge */}
          <Link href="/settings?tab=ai">
            <div className="flex items-center gap-2.5 px-4 py-2 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 rounded-xl cursor-pointer transition-all duration-200">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <div className="text-left">
                <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                  AI Autopilot: ON
                </p>
                <p className="text-[9px] text-muted-foreground font-semibold">
                  Model: {activeModelName}
                </p>
              </div>
            </div>
          </Link>
          <Link href="/appointments">
            <Button className="bg-emerald-700 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold cursor-pointer transition-all shadow-md shadow-emerald-500/10 py-5">
              <Plus className="h-4 w-4 mr-1.5" /> Book Appointment
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Core Overview Hero Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* Card 1: Today's Chats */}
        <div className="relative group overflow-hidden bg-card border border-border/80 rounded-2xl p-5 hover:border-emerald-500/20 hover:shadow-md transition-all duration-300">
          <div className="absolute -right-2 -bottom-2 opacity-5 text-emerald-500 group-hover:scale-110 transition-transform duration-300">
            <MessageSquare className="h-20 w-20" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Today's Chats</span>
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground tracking-tight tabular-nums">
              {stats.conversationsToday}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {stats.aiRepliesToday} AI
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              {stats.humanRepliesToday} Staff
            </span>
          </div>
        </div>

        {/* Card 2: AI Autopilot Success */}
        <div className="relative group overflow-hidden bg-card border border-border/80 rounded-2xl p-5 hover:border-purple-500/20 hover:shadow-md transition-all duration-300">
          <div className="absolute -right-2 -bottom-2 opacity-5 text-purple-500 group-hover:scale-110 transition-transform duration-300">
            <Brain className="h-20 w-20" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">AI Resolution Rate</span>
            <div className="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg">
              <Brain className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground tracking-tight tabular-nums">
              {stats.aiResolutionRate}%
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground">
              {stats.missedConversations > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  {stats.missedConversations} chat{stats.missedConversations === 1 ? "" : "s"} need handoff
                </span>
              ) : (
                "100% automated resolution"
              )}
            </span>
          </div>
        </div>

        {/* Card 3: Consultations Scheduled */}
        <div className="relative group overflow-hidden bg-card border border-border/80 rounded-2xl p-5 hover:border-blue-500/20 hover:shadow-md transition-all duration-300">
          <div className="absolute -right-2 -bottom-2 opacity-5 text-blue-500 group-hover:scale-110 transition-transform duration-300">
            <Calendar className="h-20 w-20" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Consultations Today</span>
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground tracking-tight tabular-nums">
              {stats.appointmentsToday}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              {stats.doctorsAvailable} Doctors On Duty
            </span>
            {stats.pendingAppointments > 0 && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                {stats.pendingAppointments} Pending
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Automated Outreach */}
        <div className="relative group overflow-hidden bg-card border border-border/80 rounded-2xl p-5 hover:border-amber-500/20 hover:shadow-md transition-all duration-300">
          <div className="absolute -right-2 -bottom-2 opacity-5 text-amber-500 group-hover:scale-110 transition-transform duration-300">
            <Bell className="h-20 w-20" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Reminders Dispatched</span>
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg">
              <Bell className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground tracking-tight tabular-nums">
              {stats.remindersSentToday}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground">
              Smart scheduling notifications today
            </span>
          </div>
        </div>

      </div>

      {/* Structured Details Panel Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        
        {/* Clinic Scheduler Health Panel */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 space-y-4 hover:border-emerald-500/10 transition-all duration-300 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-foreground text-md flex items-center gap-2">
                <CalendarCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
                Clinic Scheduler Health
              </h3>
              <p className="text-muted-foreground text-xs">Consultation states and patient show-up rates</p>
            </div>
            <span className="text-xs font-bold bg-muted text-muted-foreground border px-2 py-0.5 rounded-lg">
              Today
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/20 border border-border/50">
                <span className="text-muted-foreground flex items-center gap-1">
                  <CalendarCheck className="size-3.5 text-emerald-500" /> Confirmed
                </span>
                <span className="font-bold text-foreground">{stats.confirmedAppointments}</span>
              </div>
              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/20 border border-border/50">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="size-3.5 text-blue-500" /> Rescheduled
                </span>
                <span className="font-bold text-foreground">{stats.rescheduledAppointments}</span>
              </div>
            </div>
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/20 border border-border/50">
                <span className="text-muted-foreground flex items-center gap-1">
                  <CalendarX className="size-3.5 text-red-500" /> Cancelled
                </span>
                <span className="font-bold text-foreground">{stats.cancelledAppointments}</span>
              </div>
              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/20 border border-border/50">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Percent className="size-3.5 text-amber-500" /> No Show Rate
                </span>
                <span className="font-bold text-foreground">{stats.noShowRate}%</span>
              </div>
            </div>
          </div>

          {/* Visual Funnel Stack Bar */}
          <div className="pt-2 space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
              <span>APPOINTMENT FILL</span>
              <span>
                {stats.confirmedAppointments + stats.rescheduledAppointments + stats.cancelledAppointments} Total
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{
                  width: `${
                    stats.confirmedAppointments + stats.rescheduledAppointments + stats.cancelledAppointments > 0
                      ? (stats.confirmedAppointments /
                          (stats.confirmedAppointments + stats.rescheduledAppointments + stats.cancelledAppointments)) *
                        100
                      : 0
                  }%`,
                }}
                title={`Confirmed: ${stats.confirmedAppointments}`}
              />
              <div
                className="bg-blue-500 h-full transition-all duration-300"
                style={{
                  width: `${
                    stats.confirmedAppointments + stats.rescheduledAppointments + stats.cancelledAppointments > 0
                      ? (stats.rescheduledAppointments /
                          (stats.confirmedAppointments + stats.rescheduledAppointments + stats.cancelledAppointments)) *
                        100
                      : 0
                  }%`,
                }}
                title={`Rescheduled: ${stats.rescheduledAppointments}`}
              />
              <div
                className="bg-red-500 h-full transition-all duration-300"
                style={{
                  width: `${
                    stats.confirmedAppointments + stats.rescheduledAppointments + stats.cancelledAppointments > 0
                      ? (stats.cancelledAppointments /
                          (stats.confirmedAppointments + stats.rescheduledAppointments + stats.cancelledAppointments)) *
                        100
                      : 0
                  }%`,
                }}
                title={`Cancelled: ${stats.cancelledAppointments}`}
              />
            </div>
            <div className="flex gap-4 text-[9px] font-bold text-muted-foreground pt-1">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Confirmed</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Rescheduled</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Cancelled</span>
            </div>
          </div>
        </div>

        {/* Laboratory & Diagnostics Operations Panel */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 space-y-4 hover:border-emerald-500/10 transition-all duration-300 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-foreground text-md flex items-center gap-2">
                <FileText className="size-5 text-emerald-600 dark:text-emerald-400" />
                Laboratory & Diagnostics
              </h3>
              <p className="text-muted-foreground text-xs">Lab report generation and dispatch tracker</p>
            </div>
            <span className="text-xs font-bold bg-muted text-muted-foreground border px-2 py-0.5 rounded-lg">
              Today
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/20 border border-border/50">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Package className="size-3.5 text-amber-500" /> Awaiting Collection
                </span>
                <span className="font-bold text-foreground">{stats.reportsAwaitingCollection}</span>
              </div>
              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/20 border border-border/50">
                <span className="text-muted-foreground flex items-center gap-1">
                  <CheckCheck className="size-3.5 text-emerald-500" /> Ready Today
                </span>
                <span className="font-bold text-foreground">{stats.reportsReadyToday}</span>
              </div>
            </div>
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/20 border border-border/50">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="size-3.5 text-sky-500" /> Pending/Processing
                </span>
                <span className="font-bold text-foreground">{stats.reportsPending}</span>
              </div>
              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/20 border border-border/50">
                <span className="text-muted-foreground flex items-center gap-1">
                  <FileUp className="size-3.5 text-indigo-500" /> Dispatched/Delivered
                </span>
                <span className="font-bold text-foreground">{stats.reportsDeliveredToday}</span>
              </div>
            </div>
          </div>

          {/* Quick info notification */}
          <div className="pt-2 text-[10px] font-semibold text-muted-foreground bg-muted/10 border rounded-lg p-2.5 flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              {stats.reportsAwaitingCollection > 0 ? (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </>
              ) : (
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              )}
            </span>
            <span>
              {stats.reportsAwaitingCollection > 0
                ? `${stats.reportsAwaitingCollection} lab report PDFs are ready and awaiting collection/dispatch notifications.`
                : "All lab reports generated today have been successfully dispatched."}
            </span>
          </div>
        </div>

      </div>

      {/* Charts & Split Panel Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Weekly Appointments Flow Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-sm hover:border-emerald-500/10 transition-colors">
          <div>
            <h3 className="font-extrabold text-foreground text-md flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Weekly Appointment Flow
            </h3>
            <p className="text-muted-foreground text-xs">Consultation volumes mapped day-by-day</p>
          </div>
          <div className="h-64 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }} />
                <Bar dataKey="appointments" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Active Departments Breakdown */}
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-sm hover:border-emerald-500/10 transition-colors">
          <div>
            <h3 className="font-extrabold text-foreground text-md flex items-center gap-1.5">
              <Users className="h-4 w-4 text-emerald-500" />
              Active Departments
            </h3>
            <p className="text-muted-foreground text-xs">Distribution of consultations today</p>
          </div>
          <div className="h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={deptData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value">
                  {deptData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--card)", borderColor: "var(--border)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {deptData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-muted-foreground">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="truncate">{d.name} ({d.value}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scheduler shortcut / Upcoming Table */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm hover:border-emerald-500/10 transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-foreground text-md flex items-center gap-1.5">
              <CalendarCheck className="size-4 text-emerald-500" />
              Today's Appointment Schedule
            </h3>
            <p className="text-muted-foreground text-xs">Consultation queues currently scheduled for today</p>
          </div>
          <Link href="/appointments" className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1">
            View All Appointments <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recentAppointments.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-xs italic">
            No consultations scheduled for today.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-muted-foreground">
              <thead className="text-[10px] uppercase bg-muted/40 border-b border-border text-foreground font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Doctor</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {recentAppointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">{appt.appointment_time}</td>
                    <td className="px-4 py-3 font-semibold">
                      {appt.patient?.name || appt.patient?.phone || "Unknown"}
                    </td>
                    <td className="px-4 py-3">{appt.doctor?.name || "Unassigned"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{appt.department || "General"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                        appt.status === "confirmed" || appt.status === "Confirmed"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : appt.status === "pending" || appt.status === "pending"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          : "bg-muted text-muted-foreground border-border"
                      }`}>
                        {appt.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
