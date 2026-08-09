'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import {
  Calendar,
  Users,
  MessageSquare,
  Clock,
  UserCheck,
  Plus,
  ArrowRight,
  FileText,
  CalendarCheck,
  Sparkles,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/dashboard/skeleton';
import { toast } from 'sonner';

interface AppointmentRow {
  id: string;
  appointment_time: string;
  department: string;
  status: string;
  patient: { name: string; phone: string } | null;
  doctor: { name: string } | null;
}

export function ClinicalDashboardClient() {
  const { accountId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('Welcome back');
  const [activeModelName, setActiveModelName] = useState('Gemini 2.5 Flash');
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
    todayFollowups: 0,
  });

  const [recentAppointments, setRecentAppointments] = useState<
    AppointmentRow[]
  >([]);

  // Dynamically compute greeting
  useEffect(() => {
    const hr = new Date().getHours();
    if (hr < 12) setGreeting('Good Morning');
    else if (hr < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  // Fetch active OpenRouter model
  useEffect(() => {
    if (!accountId) return;
    async function getAiModel() {
      try {
        const res = await fetch('/api/account/ai');
        if (res.ok) {
          const data = await res.json();
          const modelId = data.openrouter_model || 'google/gemini-2.5-flash';
          if (modelId === 'google/gemini-2.5-flash')
            setActiveModelName('Gemini 2.5 Flash');
          else if (modelId === 'anthropic/claude-3.5-sonnet')
            setActiveModelName('Claude 3.5 Sonnet');
          else if (modelId === 'meta-llama/llama-3.3-70b-instruct')
            setActiveModelName('Llama 3.3 70B');
          else setActiveModelName(modelId.split('/')[1] || modelId);
        }
      } catch (e) {
        console.error('Failed to load active model name:', e);
      }
    }
    getAiModel();
  }, [accountId]);

  const loadDashboardData = useCallback(async () => {
    if (!accountId) return;
    const db = createClient();
    const todayStr = new Date().toISOString().split('T')[0];
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
        todayFollowups,
      ] = await Promise.all([
        db
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', todayStart.toISOString()),
        db
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('sender_type', 'bot')
          .gte('created_at', todayStart.toISOString()),
        db
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('sender_type', 'agent')
          .gte('created_at', todayStart.toISOString()),
        db
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('appointment_date', todayStr),
        db
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        db
          .from('hospital_doctors')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        db
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .eq('ai_handoff_required', true),
        db
          .from('appointments')
          .select(
            'id, appointment_time, department, status, patient:contacts(name, phone), doctor:hospital_doctors(name)'
          )
          .eq('appointment_date', todayStr)
          .order('appointment_time', { ascending: true })
          .limit(30),
        db
          .from('hospital_lab_reports')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'processing']),
        db
          .from('hospital_lab_reports')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'ready')
          .gte('updated_at', todayStart.toISOString()),
        db
          .from('hospital_lab_reports')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'delivered')
          .gte('updated_at', todayStart.toISOString()),
        // Reminders & Statuses Queries
        db
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .or('reminder_24h_sent.eq.true,reminder_2h_sent.eq.true')
          .gte('updated_at', todayStart.toISOString()),
        db
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'Confirmed'),
        db
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'Rescheduled'),
        db
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'Cancelled'),
        db
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'No Show'),
        db
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'Completed'),
        db
          .from('hospital_lab_reports')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'ready'),
        db
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('appointment_date', todayStr)
          .in('status', ['checked_in', 'waiting']),
        db
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .gt('unread_count', 0),
        db
          .from('hospital_followups')
          .select('id', { count: 'exact', head: true })
          .eq('due_date', todayStr),
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
      const noShowRatePercent =
        totalConcluded > 0 ? Math.round((noShows / totalConcluded) * 100) : 0;

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
        todayFollowups: todayFollowups?.count || 0,
      });

      setRecentAppointments(
        (recentAppts.data as unknown as AppointmentRow[]) || []
      );
    } catch (err) {
      console.error('Error loading dashboard metrics:', err);
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
      .from('appointments')
      .update({ status: newStatus })
      .eq('id', apptId);

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
          <h1 className="text-foreground text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Loading receptionist KPIs and activity feed...
          </p>
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
    <div className="animate-in fade-in space-y-6 duration-500">
      {/* Dynamic Glassmorphism Welcome Header */}
      <div className="via-background to-background relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-500/10 p-6 shadow-sm transition-all duration-300 md:flex-row md:items-center md:justify-between">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Sparkles className="h-40 w-40 animate-pulse text-blue-500" />
        </div>
        <div className="z-10">
          <h1 className="text-foreground text-2xl font-extrabold tracking-tight sm:text-3xl">
            {greeting}, Receptionist
          </h1>
          <p className="text-muted-foreground mt-1 max-w-xl text-xs leading-relaxed">
            Welcome to your digital reception desk. Manage today&apos;s
            patients, appointments, and WhatsApp queries at a glance.
          </p>
        </div>
        <div className="z-10 flex flex-wrap items-center gap-3">
          {/* Active AI Status Badge */}
          <Link href="/settings?tab=ai">
            <div className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-2 shadow-sm transition-all duration-200 hover:scale-[1.03] hover:bg-blue-500/10 active:scale-[0.97]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
              </span>
              <div className="text-left">
                <p className="text-[10px] font-bold tracking-wider text-blue-600 uppercase dark:text-blue-400">
                  AI Receptionist: Active
                </p>
                <p className="text-muted-foreground text-[9px] font-semibold">
                  Model: {activeModelName}
                </p>
              </div>
            </div>
          </Link>
          <Link href="/appointments">
            <Button className="bg-primary hover:bg-primary/90 cursor-pointer py-5 font-bold text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]">
              <Plus className="mr-1.5 h-4 w-4" /> Book Appointment
            </Button>
          </Link>
        </div>
      </div>

      {/* 8 Hospital Reception Desk Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Today&apos;s Appointments */}
        <div className="bg-card border-border/80 rounded-2xl border p-5 transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              Today&apos;s Appointments
            </span>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-foreground text-3xl font-black tracking-tight tabular-nums">
              {stats.appointmentsToday}
            </span>
          </div>
        </div>

        {/* Pending Appointments */}
        <div className="bg-card border-border/80 rounded-2xl border p-5 transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              Pending Appointments
            </span>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-foreground text-3xl font-black tracking-tight tabular-nums">
              {stats.pendingAppointments}
            </span>
          </div>
        </div>

        {/* Waiting Patients */}
        <div className="bg-card border-border/80 rounded-2xl border p-5 transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              Waiting Patients
            </span>
            <div className="rounded-lg bg-rose-500/10 p-2 text-rose-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-foreground text-3xl font-black tracking-tight tabular-nums">
              {stats.waitingPatientsToday}
            </span>
          </div>
        </div>

        {/* Reports Ready */}
        <div className="bg-card border-border/80 rounded-2xl border p-5 transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              Reports Ready
            </span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-foreground text-3xl font-black tracking-tight tabular-nums">
              {stats.reportsAwaitingCollection}
            </span>
          </div>
        </div>

        {/* Doctors Available */}
        <div className="bg-card border-border/80 rounded-2xl border p-5 transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              Doctors Available
            </span>
            <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-600">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-foreground text-3xl font-black tracking-tight tabular-nums">
              {stats.doctorsAvailable}
            </span>
          </div>
        </div>

        {/* Today&apos;s Follow-ups */}
        <Link href="/follow-ups">
          <div className="bg-card border-border/80 hover:border-primary/40 cursor-pointer rounded-2xl border p-5 transition-all duration-200 hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                Today&apos;s Follow-ups
              </span>
              <div className="rounded-lg bg-purple-500/10 p-2 text-purple-600">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-foreground text-3xl font-black tracking-tight tabular-nums">
                {stats.todayFollowups}
              </span>
            </div>
          </div>
        </Link>

        {/* Unread WhatsApp Chats */}
        <div className="bg-card border-border/80 rounded-2xl border p-5 transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              Unread Chats
            </span>
            <div className="rounded-lg bg-green-500/10 p-2 text-green-600">
              <MessageSquare className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-foreground text-3xl font-black tracking-tight tabular-nums">
              {stats.unreadWhatsAppChats}
            </span>
          </div>
        </div>

        {/* Today&apos;s AI Replies */}
        <div className="bg-card border-border/80 rounded-2xl border p-5 transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              Today&apos;s AI Replies
            </span>
            <div className="rounded-lg bg-purple-500/10 p-2 text-purple-600">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-foreground text-3xl font-black tracking-tight tabular-nums">
              {stats.aiRepliesToday}
            </span>
          </div>
        </div>

        {/* Today&apos;s Human Replies */}
        <div className="bg-card border-border/80 rounded-2xl border p-5 transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              Today&apos;s Human Replies
            </span>
            <div className="rounded-lg bg-sky-500/10 p-2 text-sky-600">
              <User className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-foreground text-3xl font-black tracking-tight tabular-nums">
              {stats.humanRepliesToday}
            </span>
          </div>
        </div>
      </div>

      {/* Today&apos;s Schedule Table */}
      <div className="bg-card border-border space-y-4 rounded-2xl border p-5 shadow-sm transition-all duration-200 hover:shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-foreground text-md flex items-center gap-1.5 font-extrabold">
              <CalendarCheck className="size-5 text-blue-600 dark:text-blue-400" />
              Today&apos;s Appointment Schedule
            </h3>
            <p className="text-muted-foreground text-xs">
              Manage appointments and check-in status directly
            </p>
          </div>
          <Link
            href="/appointments"
            className="text-primary flex items-center gap-1 text-xs font-bold hover:underline"
          >
            View All Appointments <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recentAppointments.length === 0 ? (
          <div className="text-muted-foreground py-10 text-center text-sm italic">
            No appointments scheduled for today.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-muted-foreground w-full text-left text-xs">
              <thead className="bg-muted/60 border-border text-foreground border-b text-[10px] font-bold tracking-wider uppercase">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Doctor</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-border text-foreground divide-y">
                {recentAppointments.map((appt) => {
                  const statusLower = appt.status.toLowerCase();
                  return (
                    <tr
                      key={appt.id}
                      className="hover:bg-muted/30 transition-all duration-150"
                    >
                      <td className="text-primary px-4 py-3 font-bold">
                        {appt.appointment_time}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {appt.patient?.name || appt.patient?.phone || 'Unknown'}
                      </td>
                      <td className="px-4 py-3">
                        {appt.doctor?.name || 'Unassigned'}
                      </td>
                      <td className="text-muted-foreground px-4 py-3">
                        {appt.department || 'General'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded border px-2 py-0.5 text-[9px] font-bold uppercase',
                            statusLower === 'confirmed' &&
                              'border-emerald-500/20 bg-emerald-500/10 text-emerald-600',
                            statusLower === 'pending' &&
                              'border-amber-500/20 bg-amber-500/10 text-amber-600',
                            statusLower === 'checked_in' &&
                              'border-blue-500/20 bg-blue-500/10 text-blue-600',
                            statusLower === 'waiting' &&
                              'border-purple-500/20 bg-purple-500/10 text-purple-600',
                            statusLower === 'completed' &&
                              'border-slate-500/20 bg-slate-500/10 text-slate-600',
                            statusLower === 'cancelled' &&
                              'border-red-500/20 bg-red-500/10 text-red-600'
                          )}
                        >
                          {appt.status}
                        </span>
                      </td>
                      <td className="space-x-1.5 px-4 py-3 text-right">
                        {(statusLower === 'pending' ||
                          statusLower === 'requested') && (
                          <>
                            <button
                              onClick={() =>
                                handleUpdateApptStatus(appt.id, 'Confirmed')
                              }
                              className="cursor-pointer rounded bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm transition-all hover:bg-emerald-700"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() =>
                                handleUpdateApptStatus(appt.id, 'Cancelled')
                              }
                              className="cursor-pointer rounded bg-red-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm transition-all hover:bg-red-700"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {statusLower === 'confirmed' && (
                          <>
                            <button
                              onClick={() =>
                                handleUpdateApptStatus(appt.id, 'Checked In')
                              }
                              className="cursor-pointer rounded bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm transition-all hover:bg-blue-700"
                            >
                              Check In
                            </button>
                            <button
                              onClick={() =>
                                handleUpdateApptStatus(appt.id, 'Cancelled')
                              }
                              className="cursor-pointer rounded bg-red-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm transition-all hover:bg-red-700"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {statusLower === 'checked_in' && (
                          <>
                            <button
                              onClick={() =>
                                handleUpdateApptStatus(appt.id, 'Waiting')
                              }
                              className="cursor-pointer rounded bg-purple-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm transition-all hover:bg-purple-700"
                            >
                              Mark Waiting
                            </button>
                            <button
                              onClick={() =>
                                handleUpdateApptStatus(appt.id, 'Completed')
                              }
                              className="cursor-pointer rounded bg-slate-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm transition-all hover:bg-slate-700"
                            >
                              Complete
                            </button>
                          </>
                        )}
                        {statusLower === 'waiting' && (
                          <button
                            onClick={() =>
                              handleUpdateApptStatus(appt.id, 'Completed')
                            }
                            className="cursor-pointer rounded bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm transition-all hover:bg-emerald-700"
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
