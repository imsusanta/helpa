'use client';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { hasMinRole } from '@/lib/auth/roles';
import { getBroadcastStatus } from '@/lib/broadcast-status';
import { toast } from 'sonner';
import { useWorkspace } from '@/hooks/use-workspace';

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
      <span className="text-muted-foreground w-10 text-right text-xs font-semibold tabular-nums">
        {pct}%
      </span>
      <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
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
  const { terminology } = useWorkspace();

  const isAdmin = accountRole && hasMinRole(accountRole, 'admin');

  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [bookingsCount, setBookingsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaignIdToDelete, setCampaignIdToDelete] = useState<string | null>(
    null
  );
  const [deletingCampaign, setDeletingCampaign] = useState(false);

  // AI Opportunities state
  const [oppStats, setOppStats] = useState({
    inactive: 0,
    missed: 0,
    followup: 0,
    pediatric: 0,
  });

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCampaignsAndStats = useCallback(async () => {
    if (!accountId) return;
    try {
      // 1. Fetch campaigns
      try {
        const res = await fetch('/api/broadcasts', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (res.ok) {
          const payload = await res.json();
          setBroadcasts(payload.data ?? []);
        } else {
          setBroadcasts([]);
        }
      } catch (err) {
        console.warn('[Broadcasts] Failed fetching broadcast collection:', err);
        setBroadcasts([]);
      }

      // 2. Fetch appointments for auxiliary counts
      try {
        const apptsRes = await fetch('/api/appointments', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (apptsRes.ok) {
          const apptsPayload = await apptsRes.json();
          const appts = apptsPayload.data || [];
          const missedCount = appts.filter((a: { status?: string }) =>
            ['no_show', 'No Show', 'Cancelled', 'cancelled'].includes(
              a.status || ''
            )
          ).length;
          setBookingsCount(appts.length);
          setOppStats((prev) => ({
            ...prev,
            missed: missedCount,
          }));
        }
      } catch {
        // auxiliary count fallback
      }

      // 3. Fetch AI Opportunities counts (auxiliary metrics)
      try {
        const contactsRes = await fetch('/api/contacts', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (contactsRes.ok) {
          const contactsPayload = await contactsRes.json();
          const contacts = contactsPayload.data || [];

          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

          const inactive = contacts.filter(
            (c: { created_at?: string }) =>
              c.created_at && new Date(c.created_at) < sixMonthsAgo
          ).length;
          const followup = contacts.filter(
            (c: { last_followup_sent_at?: string }) => !c.last_followup_sent_at
          ).length;
          const pediatric = contacts.filter(
            (c: { department?: string }) => c.department === 'Pediatrics'
          ).length;

          setOppStats((prev) => ({
            ...prev,
            inactive,
            followup,
            pediatric,
          }));
        }
      } catch {
        // auxiliary metrics fallback
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchCampaignsAndStats();
  }, [fetchCampaignsAndStats]);

  const anySending = useMemo(
    () => broadcasts.some((b) => b.status === 'sending'),
    [broadcasts]
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
  }, [anySending, fetchCampaignsAndStats]);

  // Aggregate metrics
  const totalCampaigns = broadcasts.length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const campaignsSentToday = broadcasts.filter(
    (b) => new Date(b.created_at) >= todayStart && b.status !== 'draft'
  ).length;

  const totalRecipients = useMemo(
    () =>
      broadcasts.reduce((acc, curr) => acc + (curr.total_recipients || 0), 0),
    [broadcasts]
  );
  const totalDelivered = useMemo(
    () =>
      broadcasts.reduce((acc, curr) => acc + (curr.delivered_count || 0), 0),
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

  const avgConversionRate =
    totalRecipients > 0
      ? ((bookingsCount / totalRecipients) * 100).toFixed(1)
      : '0.0';

  async function handleDeleteCampaign(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setCampaignIdToDelete(id);
  }

  async function executeDeleteCampaign() {
    if (!campaignIdToDelete) return;
    setDeletingCampaign(true);
    try {
      const res = await fetch(`/api/broadcasts/${campaignIdToDelete}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete campaign');
      toast.success('Campaign deleted successfully');
      setCampaignIdToDelete(null);
      fetchCampaignsAndStats();
    } catch {
      toast.error('Failed to delete campaign');
    } finally {
      setDeletingCampaign(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-primary h-6 w-6 animate-spin" />
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
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <h4 className="text-sm font-bold text-amber-500">
              Read-Only Access
            </h4>
            <p className="text-muted-foreground mt-1 text-xs">
              You are signed in as a Receptionist. Only Administrators and
              Marketing users can create, edit, schedule campaigns, or access
              advanced marketing analytics. You can still view active campaign
              statistics below for scheduling context.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground text-2xl font-bold">
              Campaigns List
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Review outbound campaign deliveries and schedules.
            </p>
          </div>
        </div>

        {broadcasts.length === 0 ? (
          <div className="border-border bg-card flex h-64 flex-col items-center justify-center rounded-xl border">
            <Megaphone className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="text-foreground text-sm font-medium">
              No active campaigns
            </p>
          </div>
        ) : (
          <div className="border-border bg-card overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">
                    Category
                  </TableHead>
                  <TableHead className="text-muted-foreground text-right">
                    Recipients
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Sent Date
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {broadcasts.map((b) => {
                  const status = getBroadcastStatus(b.status);
                  return (
                    <TableRow
                      key={b.id}
                      className="border-border hover:bg-muted/30 cursor-pointer"
                      onClick={() => router.push(`/broadcasts/${b.id}`)}
                    >
                      <TableCell className="text-foreground font-semibold">
                        {b.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-medium">
                        {b.category || 'General Announcement'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right font-semibold tabular-nums">
                        {b.total_recipients}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${status.classes}`}
                        >
                          {status.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(b.created_at).toLocaleDateString()}
                      </TableCell>
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
          className="bg-muted fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
        >
          <div className="h-0.5 w-1/3 animate-pulse bg-indigo-600" />
        </div>
      )}

      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage patient marketing, health camp broadcasts, and automated
            check-up reminders.
          </p>
        </div>
        <Button
          onClick={() => router.push('/broadcasts/new')}
          className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> New Campaign
        </Button>
      </div>

      {/* ═══════ CAMPAIGN METRICS DASHBOARD ═══════ */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm transition hover:shadow-md">
          <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
            Total Campaigns
          </p>
          <p className="text-foreground mt-2 text-2xl font-black tabular-nums">
            {totalCampaigns}
          </p>
        </div>
        <div className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm transition hover:shadow-md">
          <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
            Sent Today
          </p>
          <p className="text-foreground mt-2 text-2xl font-black tabular-nums">
            {campaignsSentToday}
          </p>
        </div>
        <div className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm transition hover:shadow-md">
          <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
            Delivered Rate
          </p>
          <p className="mt-2 text-2xl font-black text-emerald-600 tabular-nums dark:text-emerald-400">
            {percent(totalDelivered, totalRecipients)}%
          </p>
        </div>
        <div className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm transition hover:shadow-md">
          <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
            Read Rate
          </p>
          <p className="mt-2 text-2xl font-black text-blue-500 tabular-nums">
            {percent(totalRead, totalRecipients)}%
          </p>
        </div>
        <div className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm transition hover:shadow-md">
          <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
            Replies
          </p>
          <p className="mt-2 text-2xl font-black text-purple-500 tabular-nums">
            {totalReplied}
          </p>
        </div>
        <div className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm transition hover:shadow-md">
          <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
            {terminology.bookings} (Conv. %)
          </p>
          <p className="mt-2 text-2xl font-black text-indigo-600 tabular-nums dark:text-indigo-400">
            {bookingsCount}{' '}
            <span className="text-muted-foreground text-xs font-semibold">
              ({avgConversionRate}%)
            </span>
          </p>
        </div>
      </div>

      {/* ═══════ AI RECOMMENDATIONS / OPPORTUNITIES ═══════ */}
      <div className="bg-card border-border space-y-4 rounded-2xl border p-5">
        <h3 className="text-foreground flex items-center gap-1.5 text-sm font-extrabold">
          <Sparkles className="h-4 w-4 animate-pulse text-indigo-600" /> AI
          Campaign Opportunities
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {oppStats.inactive > 0 && (
            <div className="border-border/70 bg-muted/20 flex flex-col justify-between rounded-xl border p-4">
              <div>
                <p className="text-xs font-bold tracking-wide text-indigo-600 uppercase dark:text-indigo-400">
                  Inactive {terminology.people}
                </p>
                <p className="text-foreground mt-2 text-sm font-semibold">
                  {oppStats.inactive} {terminology.people.toLowerCase()} have
                  not engaged with the business in the last 6 months.
                </p>
              </div>
              <Button
                onClick={() =>
                  router.push('/broadcasts/new?suggestion=inactive')
                }
                variant="outline"
                className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl border-indigo-500/30 py-1.5 text-xs text-indigo-600 hover:bg-indigo-600/5 dark:text-indigo-400"
              >
                Promote {terminology.services}{' '}
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          )}

          {oppStats.missed > 0 && (
            <div className="border-border/70 bg-muted/20 flex flex-col justify-between rounded-xl border p-4">
              <div>
                <p className="text-xs font-bold tracking-wide text-amber-600 uppercase dark:text-amber-400">
                  Missed {terminology.meetings}
                </p>
                <p className="text-foreground mt-2 text-sm font-semibold">
                  {oppStats.missed} {terminology.people.toLowerCase()} missed or
                  cancelled {terminology.meetings.toLowerCase()}
                  this month.
                </p>
              </div>
              <Button
                onClick={() => router.push('/broadcasts/new?suggestion=missed')}
                variant="outline"
                className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl border-amber-500/30 py-1.5 text-xs text-amber-600 hover:bg-amber-600/5 dark:text-amber-400"
              >
                Send Re-booking Campaign <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          )}

          {oppStats.followup > 0 && (
            <div className="border-border/70 bg-muted/20 flex flex-col justify-between rounded-xl border p-4">
              <div>
                <p className="text-xs font-bold tracking-wide text-purple-600 uppercase dark:text-purple-400">
                  Follow-ups Due
                </p>
                <p className="text-foreground mt-2 text-sm font-semibold">
                  {oppStats.followup} {terminology.people.toLowerCase()} are due
                  for routine {terminology.followUp.toLowerCase()}
                  consultations.
                </p>
              </div>
              <Button
                onClick={() =>
                  router.push('/broadcasts/new?suggestion=followup')
                }
                variant="outline"
                className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl border-purple-500/30 py-1.5 text-xs text-purple-600 hover:bg-purple-600/5 dark:text-purple-400"
              >
                Create Follow-up Reminder <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════ CAMPAIGNS TABLE ═══════ */}
      {broadcasts.length === 0 ? (
        <div className="border-border bg-card flex h-64 flex-col items-center justify-center rounded-xl border">
          <Megaphone className="text-muted-foreground mb-3 h-10 w-10" />
          <p className="text-foreground text-sm font-medium">
            No campaigns yet
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Create your first healthcare campaign to engage your patients.
          </p>
        </div>
      ) : (
        <div className="border-border bg-card overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-muted-foreground">
                  Category
                </TableHead>
                <TableHead className="text-muted-foreground text-right">
                  Recipients
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Delivery
                </TableHead>
                <TableHead className="text-muted-foreground">Read</TableHead>
                <TableHead className="text-muted-foreground">Replies</TableHead>
                <TableHead className="text-muted-foreground font-semibold">
                  Status
                </TableHead>
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-muted-foreground text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {broadcasts.map((b) => {
                const status = getBroadcastStatus(b.status);
                return (
                  <TableRow
                    key={b.id}
                    className="border-border hover:bg-muted/20 cursor-pointer"
                    onClick={() => router.push(`/broadcasts/${b.id}`)}
                  >
                    <TableCell className="text-foreground text-sm font-semibold">
                      {b.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-semibold">
                      {b.category || 'General Announcement'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right font-bold tabular-nums">
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
                    <TableCell className="text-xs font-semibold text-purple-600 tabular-nums dark:text-purple-400">
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
                    <TableCell className="text-muted-foreground text-xs font-medium">
                      {new Date(b.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={(e) => handleDeleteCampaign(b.id, e)}
                        variant="ghost"
                        size="icon"
                        className="cursor-pointer text-red-500 hover:bg-red-500/10 hover:text-red-700"
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
