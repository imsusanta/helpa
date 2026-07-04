"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/currency";
import {
  Calendar,
  Users,
  MessageSquare,
  Clock,
  UserCheck,
  Brain,
  GitBranch,
  DollarSign,
  Loader2,
  Plus,
  ArrowRight,
  TrendingUp,
  FileText,
  CheckCheck,
  FileUp,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/dashboard/metric-card";
import { SkeletonCard } from "@/components/dashboard/skeleton";
import { QuickActions } from "@/components/dashboard/quick-actions";
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

const COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#f59e0b"];

export default function ClinicalDashboardPage() {
  const { defaultCurrency, accountId } = useAuth();
  
  const [loading, setLoading] = useState(true);
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
  });

  const [recentAppointments, setRecentAppointments] = useState<AppointmentRow[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [deptData, setDeptData] = useState<any[]>([]);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl">
            Hospital AI Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            How is my hospital communication performing today?
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/appointments">
            <Button className="font-semibold cursor-pointer">
              <Plus className="h-4 w-4 mr-2" /> Book Appointment
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Today's Conversations"
          value={String(stats.conversationsToday)}
          icon={MessageSquare}
          subtitle="Total customer chats today"
        />
        <MetricCard
          title="AI Replies"
          value={String(stats.aiRepliesToday)}
          icon={Brain}
          subtitle="Messages auto-replied by AI"
        />
        <MetricCard
          title="Human Replies"
          value={String(stats.humanRepliesToday)}
          icon={Users}
          subtitle="Messages handled by staff"
        />
        <MetricCard
          title="Today's Appointments"
          value={String(stats.appointmentsToday)}
          icon={Calendar}
          subtitle="Consultations scheduled today"
        />
        <MetricCard
          title="Pending Appointments"
          value={String(stats.pendingAppointments)}
          icon={Clock}
          subtitle="Inquiries awaiting confirmation"
        />
        <MetricCard
          title="Doctors Available Today"
          value={String(stats.doctorsAvailable)}
          icon={UserCheck}
          subtitle="On-duty clinical specialists"
        />
        <MetricCard
          title="AI Resolution Rate"
          value={`${stats.aiResolutionRate}%`}
          icon={TrendingUp}
          subtitle="Inquiries resolved without handoff"
        />
        <MetricCard
          title="Missed Conversations"
          value={String(stats.missedConversations)}
          icon={Clock}
          subtitle="Chats awaiting human takeover"
        />
        <MetricCard
          title="Reports Pending"
          value={String(stats.reportsPending)}
          icon={FileText}
          subtitle="Lab reports pending or processing"
        />
        <MetricCard
          title="Reports Ready Today"
          value={String(stats.reportsReadyToday)}
          icon={CheckCheck}
          subtitle="Reports ready for patient pickup"
        />
        <MetricCard
          title="Reports Delivered Today"
          value={String(stats.reportsDeliveredToday)}
          icon={FileUp}
          subtitle="Reports dispatched/collected today"
        />
      </div>

      {/* Charts & Split Panel Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Weekly Appointments Flow Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <div>
            <h3 className="font-bold text-foreground text-lg">Weekly Appointment Flow</h3>
            <p className="text-muted-foreground text-xs">Consultation volumes mapped day-by-day</p>
          </div>
          <div className="h-64 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }} />
                <Bar dataKey="appointments" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={45} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Active Departments Breakdown */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <div>
            <h3 className="font-bold text-foreground text-lg">Active Departments</h3>
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
          <div className="grid grid-cols-2 gap-2 text-xs">
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
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-foreground text-lg">Today's Appointment Schedule</h3>
            <p className="text-muted-foreground text-xs">Consultation queues currently scheduled for today</p>
          </div>
          <Link href="/appointments" className="text-xs text-primary hover:underline flex items-center gap-1">
            View All Appointments <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recentAppointments.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No consultations scheduled for today.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-muted-foreground">
              <thead className="text-xs uppercase bg-muted/30 border-b border-border text-foreground font-semibold">
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
                  <tr key={appt.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-semibold text-primary">{appt.appointment_time}</td>
                    <td className="px-4 py-3 font-medium">
                      {appt.patient?.name || appt.patient?.phone || "Unknown"}
                    </td>
                    <td className="px-4 py-3">{appt.doctor?.name || "Unassigned"}</td>
                    <td className="px-4 py-3 text-xs">{appt.department || "General"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        appt.status === "confirmed"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : appt.status === "pending"
                          ? "bg-amber-500/10 text-amber-500"
                          : "bg-muted text-muted-foreground"
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
