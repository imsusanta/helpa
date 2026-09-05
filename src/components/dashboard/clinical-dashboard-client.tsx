'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/db/client';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import {
  Calendar,
  Users,
  Clock,
  Plus,
  ArrowRight,
  FileText,
  CalendarCheck,
  Activity,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Inbox,
  RefreshCw,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/dashboard/skeleton';
import { DashboardSetupChecklist } from '@/components/dashboard/dashboard-setup-checklist';
import { DashboardWhatsAppStatus } from '@/components/dashboard/dashboard-whatsapp-status';
import { DashboardAutoReminders } from '@/components/dashboard/dashboard-auto-reminders';
import { toast } from 'sonner';

interface AppointmentRow {
  id: string;
  appointment_time: string;
  department: string;
  status: string;
  patient: { name: string; phone: string } | null;
  doctor: { name: string } | null;
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'primary',
  href,
}: {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  tone?: 'primary' | 'amber' | 'rose' | 'emerald' | 'blue' | 'violet';
  href?: string;
}) {
  const toneClasses = {
    primary: 'bg-primary-soft text-primary',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  };

  const card = (
    <div className="group border-border/60 bg-card/80 hover:border-primary/30 relative overflow-hidden rounded-[1.35rem] border p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="bg-primary/5 absolute -top-8 -right-8 h-24 w-24 rounded-full blur-2xl transition-transform duration-300 group-hover:scale-125" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-[10px] font-bold tracking-[0.16em] uppercase">
            {label}
          </p>
          <p className="text-foreground mt-4 text-3xl font-semibold tracking-[-0.04em] tabular-nums">
            {value}
          </p>
          <p className="text-muted-foreground mt-1 text-[11px]">{detail}</p>
        </div>
        <div className={cn('rounded-xl p-2.5', toneClasses[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );

  return href ? <Link href={href}>{card}</Link> : card;
}

interface ClinicalDashboardClientProps {
  onResumeOnboarding?: () => void;
}

export function ClinicalDashboardClient({
  onResumeOnboarding,
}: ClinicalDashboardClientProps = {}) {
  const { accountId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('Welcome back');
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
    <div className="animate-in fade-in space-y-7 duration-500">
      {/* WhatsApp Connection Health Status */}
      <DashboardWhatsAppStatus />

      <section className="border-border bg-card relative overflow-hidden rounded-2xl border p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span>Clinic Assistant Active</span>
            </div>
            <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
              {greeting} 👋
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Here&apos;s what needs your attention today.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/appointments">
              <Button className="h-10 rounded-xl px-4 text-xs font-semibold">
                <Plus className="mr-1.5 h-4 w-4" />
                Book Appointment
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Setup Onboarding Checklist */}
      <DashboardSetupChecklist onResumeOnboarding={onResumeOnboarding} />

      {/* What needs your attention section */}
      {(stats.pendingAppointments > 0 ||
        stats.todayFollowups > 0 ||
        stats.unreadWhatsAppChats > 0 ||
        stats.reportsAwaitingCollection > 0) && (
        <section className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-sm dark:bg-amber-500/10">
          <div className="mb-2 flex items-center gap-2">
            <CircleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-xs font-semibold tracking-wider text-amber-900 uppercase dark:text-amber-200">
              Needs Your Attention
            </h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {stats.pendingAppointments > 0 && (
              <div className="bg-background/80 dark:bg-background/40 flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 p-2.5 text-xs">
                <span>
                  {stats.pendingAppointments} appointment
                  {stats.pendingAppointments > 1 ? 's' : ''} waiting for
                  confirmation
                </span>
                <Link href="/appointments">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px] font-medium"
                  >
                    Review
                  </Button>
                </Link>
              </div>
            )}
            {stats.unreadWhatsAppChats > 0 && (
              <div className="bg-background/80 dark:bg-background/40 flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 p-2.5 text-xs">
                <span>
                  {stats.unreadWhatsAppChats} unread patient message
                  {stats.unreadWhatsAppChats > 1 ? 's' : ''}
                </span>
                <Link href="/inbox">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px] font-medium"
                  >
                    Reply
                  </Button>
                </Link>
              </div>
            )}
            {stats.todayFollowups > 0 && (
              <div className="bg-background/80 dark:bg-background/40 flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 p-2.5 text-xs">
                <span>
                  {stats.todayFollowups} patient follow-up
                  {stats.todayFollowups > 1 ? 's' : ''} due today
                </span>
                <Link href="/follow-ups">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px] font-medium"
                  >
                    Open
                  </Button>
                </Link>
              </div>
            )}
            {stats.reportsAwaitingCollection > 0 && (
              <div className="bg-background/80 dark:bg-background/40 flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 p-2.5 text-xs">
                <span>
                  {stats.reportsAwaitingCollection} lab report
                  {stats.reportsAwaitingCollection > 1 ? 's' : ''} ready for
                  delivery
                </span>
                <Link href="/lab-reports">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px] font-medium"
                  >
                    View
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <MetricCard
          label="Appointments"
          value={stats.appointmentsToday}
          detail="Scheduled today"
          icon={Calendar}
          tone="blue"
          href="/appointments"
        />
        <MetricCard
          label="Waiting"
          value={stats.waitingPatientsToday}
          detail="Patients in queue"
          icon={Users}
          tone="rose"
        />
        <MetricCard
          label="Pending"
          value={stats.pendingAppointments}
          detail="Need a decision"
          icon={Clock}
          tone="amber"
          href="/appointments"
        />
        <MetricCard
          label="Reports ready"
          value={stats.reportsAwaitingCollection}
          detail="Awaiting collection"
          icon={FileText}
          tone="emerald"
          href="/lab-reports"
        />
        <MetricCard
          label="Unread chats"
          value={stats.unreadWhatsAppChats}
          detail="WhatsApp conversations"
          icon={Inbox}
          tone="primary"
          href="/inbox"
        />
        <MetricCard
          label="Follow-ups"
          value={stats.todayFollowups}
          detail="Due today"
          icon={RefreshCw}
          tone="violet"
          href="/follow-ups"
        />
      </section>

      {/* Auto-Reminders Ready-Made Templates */}
      <DashboardAutoReminders />

      <section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="border-border/60 bg-card/80 rounded-[1.5rem] border p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-muted-foreground text-[10px] font-bold tracking-[0.16em] uppercase">
                Service pulse
              </p>
              <h2 className="text-foreground mt-1 text-xl font-semibold tracking-[-0.03em]">
                Keep the front desk flowing
              </h2>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
              <Activity className="h-3.5 w-3.5" />
              Live operations
            </div>
          </div>

          <div className="border-primary/15 bg-primary/5 mt-6 rounded-2xl border p-4 sm:p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-muted-foreground text-xs font-semibold">
                  AI resolution rate
                </p>
                <p className="text-foreground mt-2 text-4xl font-semibold tracking-[-0.06em] tabular-nums">
                  {stats.aiResolutionRate}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground text-[11px]">
                  {stats.aiRepliesToday} AI replies today
                </p>
                <p className="mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
                  {stats.humanRepliesToday} handed to staff
                </p>
              </div>
            </div>
            <div className="bg-background/70 mt-4 h-2 overflow-hidden rounded-full">
              <div
                className="from-primary h-full rounded-full bg-gradient-to-r via-violet-500 to-sky-400 transition-[width] duration-700"
                style={{ width: `${stats.aiResolutionRate}%` }}
              />
            </div>
            <p className="text-muted-foreground mt-3 text-xs leading-5">
              Helpa resolved the majority of today&apos;s conversations without
              a manual handoff.
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="bg-muted/45 rounded-2xl p-4">
              <p className="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase">
                Doctors on duty
              </p>
              <p className="text-foreground mt-2 text-2xl font-semibold tabular-nums">
                {stats.doctorsAvailable}
              </p>
              <p className="text-muted-foreground mt-1 text-[11px]">
                Available today
              </p>
            </div>
            <div className="bg-muted/45 rounded-2xl p-4">
              <p className="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase">
                Reminders sent
              </p>
              <p className="text-foreground mt-2 text-2xl font-semibold tabular-nums">
                {stats.remindersSentToday}
              </p>
              <p className="text-muted-foreground mt-1 text-[11px]">
                Automated today
              </p>
            </div>
            <div className="bg-muted/45 rounded-2xl p-4">
              <p className="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase">
                No-show rate
              </p>
              <p className="text-foreground mt-2 text-2xl font-semibold tabular-nums">
                {stats.noShowRate}%
              </p>
              <p className="text-muted-foreground mt-1 text-[11px]">
                Completed + no-show
              </p>
            </div>
          </div>
        </div>

        <div className="border-border/60 bg-card/80 rounded-[1.5rem] border p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-[10px] font-bold tracking-[0.16em] uppercase">
                At a glance
              </p>
              <h2 className="text-foreground mt-1 text-xl font-semibold tracking-[-0.03em]">
                Queue health
              </h2>
            </div>
            <ShieldCheck className="text-primary h-5 w-5" />
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-amber-500/10 p-3">
              <span className="rounded-xl bg-amber-500/15 p-2 text-amber-600 dark:text-amber-300">
                <Clock className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-foreground block text-xs font-semibold">
                  Appointment decisions
                </span>
                <span className="text-muted-foreground mt-0.5 block text-[11px]">
                  {stats.pendingAppointments} pending requests
                </span>
              </span>
              <span className="text-foreground text-lg font-semibold tabular-nums">
                {stats.pendingAppointments}
              </span>
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-rose-500/10 p-3">
              <span className="rounded-xl bg-rose-500/15 p-2 text-rose-600 dark:text-rose-300">
                <CircleAlert className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-foreground block text-xs font-semibold">
                  Conversations to review
                </span>
                <span className="text-muted-foreground mt-0.5 block text-[11px]">
                  AI handoffs needing attention
                </span>
              </span>
              <span className="text-foreground text-lg font-semibold tabular-nums">
                {stats.missedConversations}
              </span>
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 p-3">
              <span className="rounded-xl bg-emerald-500/15 p-2 text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-foreground block text-xs font-semibold">
                  Reports processed
                </span>
                <span className="text-muted-foreground mt-0.5 block text-[11px]">
                  Ready or delivered today
                </span>
              </span>
              <span className="text-foreground text-lg font-semibold tabular-nums">
                {stats.reportsReadyToday + stats.reportsDeliveredToday}
              </span>
            </div>
          </div>

          <Link
            href="/inbox"
            className="border-border/60 bg-muted/30 hover:border-primary/30 hover:bg-primary/5 mt-6 flex items-center justify-between rounded-2xl border px-4 py-3 text-xs font-semibold transition-colors"
          >
            Open inbox triage
            <ArrowRight className="text-primary h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="border-border/60 bg-card/80 rounded-[1.5rem] border p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] sm:p-6">
          <div>
            <p className="text-muted-foreground text-[10px] font-bold tracking-[0.16em] uppercase">
              Shortcuts
            </p>
            <h2 className="text-foreground mt-1 text-xl font-semibold tracking-[-0.03em]">
              Move faster
            </h2>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              { href: '/appointments', label: 'Appointments', icon: Calendar },
              { href: '/inbox', label: 'Inbox', icon: Inbox },
              { href: '/patients', label: 'Patients', icon: Users },
              { href: '/follow-ups', label: 'Follow-ups', icon: RefreshCw },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group border-border/60 bg-muted/25 hover:border-primary/30 hover:bg-primary/5 rounded-2xl border p-3 transition-all duration-200 hover:-translate-y-0.5"
              >
                <Icon className="text-primary h-4 w-4" />
                <span className="text-foreground mt-7 block text-xs font-semibold">
                  {label}
                </span>
                <ArrowUpRight className="text-muted-foreground mt-2 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            ))}
          </div>
        </div>

        <div className="border-border/60 bg-card/80 rounded-[1.5rem] border p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-[10px] font-bold tracking-[0.16em] uppercase">
                Live schedule
              </p>
              <h2 className="text-foreground mt-1 text-xl font-semibold tracking-[-0.03em]">
                Today&apos;s appointments
              </h2>
            </div>
            <Link
              href="/appointments"
              className="text-primary flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-75"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="border-border/60 mt-5 overflow-hidden rounded-2xl border">
            {recentAppointments.length === 0 ? (
              <div className="bg-muted/20 flex min-h-48 flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="bg-primary/10 text-primary rounded-2xl p-3">
                  <CalendarCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-foreground text-sm font-semibold">
                    No appointments yet
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    The schedule is clear for today.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="bg-muted/45 text-muted-foreground border-border/60 border-b text-[10px] font-bold tracking-[0.14em] uppercase">
                    <tr>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Patient</th>
                      <th className="px-4 py-3">Doctor</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border/60 divide-y">
                    {recentAppointments.map((appt) => {
                      const statusKey = appt.status
                        .toLowerCase()
                        .replace(/\s+/g, '_');
                      const statusClasses = {
                        confirmed:
                          'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
                        pending:
                          'bg-amber-500/10 text-amber-600 dark:text-amber-300',
                        requested:
                          'bg-amber-500/10 text-amber-600 dark:text-amber-300',
                        checked_in:
                          'bg-blue-500/10 text-blue-600 dark:text-blue-300',
                        waiting:
                          'bg-violet-500/10 text-violet-600 dark:text-violet-300',
                        completed: 'bg-muted text-muted-foreground',
                        cancelled:
                          'bg-rose-500/10 text-rose-600 dark:text-rose-300',
                      } as Record<string, string>;

                      const actionClass =
                        'rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-[10px] font-semibold transition-colors hover:border-primary/40 hover:bg-primary/5';

                      return (
                        <tr
                          key={appt.id}
                          className="group bg-card hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-4 py-3.5 align-top">
                            <span className="text-primary bg-primary/10 inline-flex rounded-lg px-2 py-1 font-semibold tabular-nums">
                              {appt.appointment_time}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <p className="text-foreground font-semibold">
                              {appt.patient?.name ||
                                appt.patient?.phone ||
                                'Unknown'}
                            </p>
                            <p className="text-muted-foreground mt-0.5 text-[11px]">
                              Patient visit
                            </p>
                          </td>
                          <td className="text-muted-foreground px-4 py-3.5 align-top">
                            {appt.doctor?.name || 'Unassigned'}
                          </td>
                          <td className="text-muted-foreground px-4 py-3.5 align-top">
                            {appt.department || 'General'}
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase',
                                statusClasses[statusKey] ||
                                  'bg-muted text-muted-foreground'
                              )}
                            >
                              {appt.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right align-top">
                            <div className="flex flex-wrap justify-end gap-1.5">
                              {(statusKey === 'pending' ||
                                statusKey === 'requested') && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateApptStatus(
                                        appt.id,
                                        'Confirmed'
                                      )
                                    }
                                    className={cn(
                                      actionClass,
                                      'text-emerald-600 dark:text-emerald-300'
                                    )}
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateApptStatus(
                                        appt.id,
                                        'Cancelled'
                                      )
                                    }
                                    className={cn(
                                      actionClass,
                                      'text-rose-600 dark:text-rose-300'
                                    )}
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                              {statusKey === 'confirmed' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateApptStatus(
                                        appt.id,
                                        'Checked In'
                                      )
                                    }
                                    className={cn(
                                      actionClass,
                                      'text-blue-600 dark:text-blue-300'
                                    )}
                                  >
                                    Check in
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateApptStatus(
                                        appt.id,
                                        'Cancelled'
                                      )
                                    }
                                    className={cn(
                                      actionClass,
                                      'text-rose-600 dark:text-rose-300'
                                    )}
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                              {statusKey === 'checked_in' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateApptStatus(appt.id, 'Waiting')
                                    }
                                    className={cn(
                                      actionClass,
                                      'text-violet-600 dark:text-violet-300'
                                    )}
                                  >
                                    Mark waiting
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateApptStatus(
                                        appt.id,
                                        'Completed'
                                      )
                                    }
                                    className={cn(
                                      actionClass,
                                      'text-foreground'
                                    )}
                                  >
                                    Complete
                                  </button>
                                </>
                              )}
                              {statusKey === 'waiting' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateApptStatus(appt.id, 'Completed')
                                  }
                                  className={cn(
                                    actionClass,
                                    'text-emerald-600 dark:text-emerald-300'
                                  )}
                                >
                                  Complete
                                </button>
                              )}
                            </div>
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
      </section>
    </div>
  );
}
