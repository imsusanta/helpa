'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Broadcast } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Megaphone, 
  Plus, 
  Loader2, 
  Percent, 
  CheckCheck, 
  MessageSquare, 
  TrendingUp, 
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Trash2
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { hasMinRole } from '@/lib/auth/roles';
import { getBroadcastStatus } from '@/lib/broadcast-status';
import { toast } from 'sonner';

const POLL_INTERVAL_MS = 5_000;

function percent(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function RateCell({
  value,
  total,
  color,
}: {
  value: number;
  total: number;
  color: string;
}) {
  const pct = percent(value, total);
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground font-semibold">
        {pct}%
      </span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-1.5 rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const router = useRouter();
  const { accountId, accountRole } = useAuth();
  
  const isAdmin = accountRole && hasMinRole(accountRole, 'admin');

  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [bookingsCount, setBookingsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaignIdToDelete, setCampaignIdToDelete] = useState<string | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState(false);

  // AI Opportunities state
  const [oppStats, setOppStats] = useState({
    inactive: 0,
    missed: 0,
    followup: 0,
    pediatric: 0
  });

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchCampaignsAndStats() {
    if (!accountId) return;
    try {
      const supabase = createClient();
      
      // 1. Fetch campaigns
      const { data: campaignRows, error: fetchError } = await supabase
        .from('broadcasts')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setBroadcasts(campaignRows ?? []);

      // 2. Fetch attributed bookings
      const { count: bookings, error: bookingsErr } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .not('campaign_id', 'is', null);
      
      if (!bookingsErr && bookings !== null) {
        setBookingsCount(bookings);
      }

      // 3. Fetch AI Opportunities counts
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const [inactiveRes, missedRes, followupRes, pedRes] = await Promise.all([
        supabase.from('patients').select('id', { count: 'exact', head: true }).lt('created_at', sixMonthsAgo.toISOString()),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).in('status', ['no_show', 'No Show', 'Cancelled']),
        supabase.from('patients').select('id', { count: 'exact', head: true }).is('last_followup_sent_at', null),
        supabase.from('patients').select('id', { count: 'exact', head: true }).eq('department', 'Pediatrics')
      ]);

      setOppStats({
        inactive: inactiveRes.count || 0,
        missed: missedRes.count || 0,
        followup: followupRes.count || 0,
        pediatric: pedRes.count || 0
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCampaignsAndStats();
  }, [accountId]);

  const anySending = useMemo(
    () => broadcasts.some((b) => b.status === 'sending'),
    [broadcasts],
  );

  useEffect(() => {
    function startPolling() {
      if (pollTimer.current) return;
      pollTimer.current = setInterval(fetchCampaignsAndStats, POLL_INTERVAL_MS);
    }
    function stopPolling() {
      if (!pollTimer.current) return;
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }

    if (anySending && document.visibilityState === 'visible') {
      startPolling();
    } else {
      stopPolling();
    }

    const handleVisibilityChange = () => {
      if (!anySending) return;
      if (document.visibilityState === 'hidden') {
        stopPolling();
      } else {
        fetchCampaignsAndStats();
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [anySending]);

  // Aggregate metrics
  const totalCampaigns = broadcasts.length;
  
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  const campaignsSentToday = broadcasts.filter(
    (b) => new Date(b.created_at) >= todayStart && b.status !== 'draft'
  ).length;

  const totalRecipients = useMemo(
    () => broadcasts.reduce((acc, curr) => acc + (curr.total_recipients || 0), 0),
    [broadcasts]
  );
  const totalDelivered = useMemo(
    () => broadcasts.reduce((acc, curr) => acc + (curr.delivered_count || 0), 0),
    [broadcasts]
  );
  const totalRead = useMemo(
    () => broadcasts.reduce((acc, curr) => acc + (curr.read_count || 0), 0),
    [broadcasts]
  );
  const totalReplied = useMemo(
    () => broadcasts.reduce((acc, curr) => acc + (curr.replied_count || 0), 0),
    [broadcasts]
  );

  const avgConversionRate = totalRecipients > 0 ? ((bookingsCount / totalRecipients) * 100).toFixed(1) : '0.0';

  async function handleDeleteCampaign(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setCampaignIdToDelete(id);
  }

  async function executeDeleteCampaign() {
    if (!campaignIdToDelete) return;
    setDeletingCampaign(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('broadcasts').delete().eq('id', campaignIdToDelete);
      if (error) throw error;
      toast.success('Campaign deleted successfully');
      setCampaignIdToDelete(null);
      fetchCampaignsAndStats();
    } catch (err) {
      toast.error('Failed to delete campaign');
    } finally {
      setDeletingCampaign(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-red-400">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  // Gated View: If receptionist, display read-only mode with a warning
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-500 text-sm">Read-Only Access</h4>
            <p className="text-xs text-muted-foreground mt-1">
              You are signed in as a Receptionist. Only Administrators and Marketing users can create, edit, schedule campaigns, or access advanced marketing analytics. You can still view active campaign statistics below for scheduling context.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Campaigns List</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review outbound campaign deliveries and schedules.
            </p>
          </div>
        </div>

        {broadcasts.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-border bg-card">
            <Megaphone className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No active campaigns</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">Category</TableHead>
                  <TableHead className="text-right text-muted-foreground">Recipients</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Sent Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {broadcasts.map((b) => {
                  const status = getBroadcastStatus(b.status);
                  return (
                    <TableRow
                      key={b.id}
                      className="cursor-pointer border-border hover:bg-muted/30"
                      onClick={() => router.push(`/broadcasts/${b.id}`)}
                    >
                      <TableCell className="font-semibold text-foreground">{b.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-medium">{b.category || 'General Announcement'}</TableCell>
                      <TableCell className="text-right text-muted-foreground font-semibold tabular-nums">{b.total_recipients}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${status.classes}`}>
                          {status.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {anySending && (
        <div
          role="progressbar"
          aria-label="Campaign dispatch in progress"
          className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-muted"
        >
          <div className="h-0.5 bg-indigo-600 animate-pulse w-1/3" />
        </div>
      )}

      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage patient marketing, health camp broadcasts, and automated check-up reminders.
          </p>
        </div>
        <Button
          onClick={() => router.push('/broadcasts/new')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" /> New Campaign
        </Button>
      </div>

      {/* ═══════ CAMPAIGN METRICS DASHBOARD ═══════ */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Campaigns</p>
          <p className="text-2xl font-black text-foreground mt-2 tabular-nums">{totalCampaigns}</p>
        </div>
        <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sent Today</p>
          <p className="text-2xl font-black text-foreground mt-2 tabular-nums">{campaignsSentToday}</p>
        </div>
        <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Delivered Rate</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 tabular-nums">{percent(totalDelivered, totalRecipients)}%</p>
        </div>
        <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Read Rate</p>
          <p className="text-2xl font-black text-blue-500 mt-2 tabular-nums">{percent(totalRead, totalRecipients)}%</p>
        </div>
        <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Replies</p>
          <p className="text-2xl font-black text-purple-500 mt-2 tabular-nums">{totalReplied}</p>
        </div>
        <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Bookings (Conv. %)</p>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2 tabular-nums">
            {bookingsCount} <span className="text-xs font-semibold text-muted-foreground">({avgConversionRate}%)</span>
          </p>
        </div>
      </div>

      {/* ═══════ AI RECOMMENDATIONS / OPPORTUNITIES ═══════ */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h3 className="font-extrabold text-foreground text-sm flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-indigo-600 animate-pulse" /> AI Campaign Opportunities
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {oppStats.inactive > 0 && (
            <div className="border border-border/70 rounded-xl p-4 bg-muted/20 flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">Inactive Patients</p>
                <p className="text-sm font-semibold text-foreground mt-2">
                  {oppStats.inactive} patients have not visited the clinic in the last 6 months.
                </p>
              </div>
              <Button
                onClick={() => router.push('/broadcasts/new?suggestion=inactive')}
                variant="outline"
                className="mt-4 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600/5 rounded-xl text-xs py-1.5 w-full flex items-center justify-center gap-1"
              >
                Promote Health Checkup <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          )}

          {oppStats.missed > 0 && (
            <div className="border border-border/70 rounded-xl p-4 bg-muted/20 flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Missed Appointments</p>
                <p className="text-sm font-semibold text-foreground mt-2">
                  {oppStats.missed} patients missed or cancelled appointments this month.
                </p>
              </div>
              <Button
                onClick={() => router.push('/broadcasts/new?suggestion=missed')}
                variant="outline"
                className="mt-4 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-600/5 rounded-xl text-xs py-1.5 w-full flex items-center justify-center gap-1"
              >
                Send Re-booking Campaign <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          )}

          {oppStats.followup > 0 && (
            <div className="border border-border/70 rounded-xl p-4 bg-muted/20 flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide">Follow-ups Due</p>
                <p className="text-sm font-semibold text-foreground mt-2">
                  {oppStats.followup} patients are due for routine follow-up consultations.
                </p>
              </div>
              <Button
                onClick={() => router.push('/broadcasts/new?suggestion=followup')}
                variant="outline"
                className="mt-4 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-600/5 rounded-xl text-xs py-1.5 w-full flex items-center justify-center gap-1"
              >
                Create Follow-up Reminder <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════ CAMPAIGNS TABLE ═══════ */}
      {broadcasts.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-border bg-card">
          <Megaphone className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No campaigns yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create your first healthcare campaign to engage your patients.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-muted-foreground">Category</TableHead>
                <TableHead className="text-right text-muted-foreground">Recipients</TableHead>
                <TableHead className="text-muted-foreground">Delivery</TableHead>
                <TableHead className="text-muted-foreground">Read</TableHead>
                <TableHead className="text-muted-foreground">Replies</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-right text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {broadcasts.map((b) => {
                const status = getBroadcastStatus(b.status);
                return (
                  <TableRow
                    key={b.id}
                    className="cursor-pointer border-border hover:bg-muted/20"
                    onClick={() => router.push(`/broadcasts/${b.id}`)}
                  >
                    <TableCell className="font-semibold text-foreground text-sm">
                      {b.name}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-semibold">
                      {b.category || 'General Announcement'}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground font-bold tabular-nums">
                      {b.total_recipients}
                    </TableCell>
                    <TableCell>
                      <RateCell
                        value={b.delivered_count}
                        total={b.total_recipients}
                        color="bg-emerald-500"
                      />
                    </TableCell>
                    <TableCell>
                      <RateCell
                        value={b.read_count}
                        total={b.total_recipients}
                        color="bg-blue-500"
                      />
                    </TableCell>
                    <TableCell className="text-xs font-semibold tabular-nums text-purple-600 dark:text-purple-400">
                      {b.replied_count || 0}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-bold ${status.classes}`}
                      >
                        {status.pulse && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-yellow-400" />
                          </span>
                        )}
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">
                      {new Date(b.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={(e) => handleDeleteCampaign(b.id, e)}
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700 hover:bg-red-500/10 cursor-pointer"
                        title="Delete Campaign"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={!!campaignIdToDelete}
        onOpenChange={(open) => !open && setCampaignIdToDelete(null)}
        title="Delete Campaign"
        description="Are you sure you want to delete this campaign and all its history? This action cannot be undone."
        onConfirm={executeDeleteCampaign}
        loading={deletingCampaign}
      />
    </div>
  );
}
