"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Users,
  MessageSquare,
  Clock,
  UserCheck,
  Brain,
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
  Bot,
  User,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/dashboard/skeleton";
import { toast } from "sonner";
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

export function ClinicalDashboardClient() {
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
    waitingPatientsToday: 0,
    unreadWhatsAppChats: 0,
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
        waitingToday,
        unreadChats,
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
          .limit(30),
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
        db.from("appointments").select("id", { count: "exact", head: true }).eq("appointment_date", todayStr).in("status", ["checked_in", "waiting"]),
        db.from("conversations").select("id", { count: "exact", head: true }).gt("unread_count", 0),
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
        waitingPatientsToday: waitingToday.count || 0,
        unreadWhatsAppChats: unreadChats.count || 0,
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

  const handleUpdateApptStatus = async (apptId: string, newStatus: string) => {
    const db = createClient();
    const { error } = await db
      .from("appointments")
      .update({ status: newStatus })
      .eq("id", apptId);

    if (error) {
      toast.error(`Failed to update status to ${newStatus}`);
    } else {
      toast.success(`Appointment status updated to ${newStatus}`);
      loadDashboardData();
    }
  };

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
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Dynamic Glassmorphism Welcome Header */}
      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between p-6 bg-gradient-to-r from-blue-500/10 via-background to-background border border-blue-500/20 rounded-2xl gap-4 shadow-sm overflow-hidden transition-all duration-300">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Sparkles className="h-40 w-40 text-blue-500 animate-pulse" />
        </div>
        <div className="z-10">
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl">
            {greeting}, Receptionist
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
            Welcome to your digital reception desk. Manage today's patients, appointments, and WhatsApp queries at a glance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 z-10">
          {/* Active AI Status Badge */}
          <Link href="/settings?tab=ai">
            <div className="flex items-center gap-2.5 px-4 py-2 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 rounded-xl cursor-pointer hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
              </span>
              <div className="text-left">
                <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider">
                  AI Receptionist: Active
                </p>
                <p className="text-[9px] text-muted-foreground font-semibold">
                  Model: {activeModelName}
                </p>
              </div>
            </div>
          </Link>
          <Link href="/appointments">
            <Button className="bg-primary hover:bg-primary/90 text-white font-bold cursor-pointer hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 py-5">
              <Plus className="h-4 w-4 mr-1.5" /> Book Appointment
            </Button>
          </Link>
        </div>
      </div>

      {/* 8 Hospital Reception Desk Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* Today's Appointments */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Today's Appointments</span>
            <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-foreground tracking-tight tabular-nums">
              {stats.appointmentsToday}
            </span>
          </div>
        </div>

        {/* Pending Appointments */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pending Appointments</span>
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-foreground tracking-tight tabular-nums">
              {stats.pendingAppointments}
            </span>
          </div>
        </div>

        {/* Waiting Patients */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Waiting Patients</span>
            <div className="p-2 bg-rose-500/10 text-rose-600 rounded-lg">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-foreground tracking-tight tabular-nums">
              {stats.waitingPatientsToday}
            </span>
          </div>
        </div>

        {/* Reports Ready */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Reports Ready</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-foreground tracking-tight tabular-nums">
              {stats.reportsAwaitingCollection}
            </span>
          </div>
        </div>

        {/* Doctors Available */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Doctors Available</span>
            <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-lg">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-foreground tracking-tight tabular-nums">
              {stats.doctorsAvailable}
            </span>
          </div>
        </div>

        {/* Unread WhatsApp Chats */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Unread Chats</span>
            <div className="p-2 bg-green-500/10 text-green-600 rounded-lg">
              <MessageSquare className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-foreground tracking-tight tabular-nums">
              {stats.unreadWhatsAppChats}
            </span>
          </div>
        </div>

        {/* Today's AI Replies */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Today's AI Replies</span>
            <div className="p-2 bg-purple-500/10 text-purple-600 rounded-lg">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-foreground tracking-tight tabular-nums">
              {stats.aiRepliesToday}
            </span>
          </div>
        </div>

        {/* Today's Human Replies */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Today's Human Replies</span>
            <div className="p-2 bg-sky-500/10 text-sky-600 rounded-lg">
              <User className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-foreground tracking-tight tabular-nums">
              {stats.humanRepliesToday}
            </span>
          </div>
        </div>

      </div>

      {/* Today's Schedule Table */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-foreground text-md flex items-center gap-1.5">
              <CalendarCheck className="size-5 text-blue-600 dark:text-blue-400" />
              Today's Appointment Schedule
            </h3>
            <p className="text-muted-foreground text-xs">Manage appointments and check-in status directly</p>
          </div>
          <Link href="/appointments" className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
            View All Appointments <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recentAppointments.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm italic">
            No appointments scheduled for today.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-muted-foreground">
              <thead className="text-[10px] uppercase bg-muted/60 border-b border-border text-foreground font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Doctor</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {recentAppointments.map((appt) => {
                  const statusLower = appt.status.toLowerCase();
                  return (
                    <tr key={appt.id} className="hover:bg-muted/30 transition-all duration-150">
                      <td className="px-4 py-3 font-bold text-primary">{appt.appointment_time}</td>
                      <td className="px-4 py-3 font-semibold">
                        {appt.patient?.name || appt.patient?.phone || "Unknown"}
                      </td>
                      <td className="px-4 py-3">{appt.doctor?.name || "Unassigned"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{appt.department || "General"}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "text-[9px] font-bold uppercase px-2 py-0.5 rounded border",
                          statusLower === "confirmed" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                          statusLower === "pending" && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                          statusLower === "checked_in" && "bg-blue-500/10 text-blue-600 border-blue-500/20",
                          statusLower === "waiting" && "bg-purple-500/10 text-purple-600 border-purple-500/20",
                          statusLower === "completed" && "bg-slate-500/10 text-slate-600 border-slate-500/20",
                          statusLower === "cancelled" && "bg-red-500/10 text-red-600 border-red-500/20"
                        )}>
                          {appt.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1.5">
                        {(statusLower === "pending" || statusLower === "requested") && (
                          <>
                            <button
                              onClick={() => handleUpdateApptStatus(appt.id, "Confirmed")}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition-all shadow-sm cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => handleUpdateApptStatus(appt.id, "Cancelled")}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold transition-all shadow-sm cursor-pointer"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {statusLower === "confirmed" && (
                          <>
                            <button
                              onClick={() => handleUpdateApptStatus(appt.id, "Checked In")}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold transition-all shadow-sm cursor-pointer"
                            >
                              Check In
                            </button>
                            <button
                              onClick={() => handleUpdateApptStatus(appt.id, "Cancelled")}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold transition-all shadow-sm cursor-pointer"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {statusLower === "checked_in" && (
                          <>
                            <button
                              onClick={() => handleUpdateApptStatus(appt.id, "Waiting")}
                              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[10px] font-bold transition-all shadow-sm cursor-pointer"
                            >
                              Mark Waiting
                            </button>
                            <button
                              onClick={() => handleUpdateApptStatus(appt.id, "Completed")}
                              className="px-2.5 py-1 bg-slate-600 hover:bg-slate-700 text-white rounded text-[10px] font-bold transition-all shadow-sm cursor-pointer"
                            >
                              Complete
                            </button>
                          </>
                        )}
                        {statusLower === "waiting" && (
                          <button
                            onClick={() => handleUpdateApptStatus(appt.id, "Completed")}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition-all shadow-sm cursor-pointer"
                          >
                            Complete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
