'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  X,
  Phone,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AdminNav } from './admin-nav';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

interface WhatsAppAccountItem {
  id: string;
  name: string;
  industry?: string;
  created_at: string;
  whatsapp: {
    connected: boolean;
    status: 'connected' | 'needs_attention' | 'disconnected';
    phoneNumber: string;
    wabaId?: string | null;
    phoneNumberId?: string | null;
    lastActivity?: string | null;
  };
}

const INDUSTRY_NAMES: Record<string, string> = {
  hospital_clinic: 'Health & Clinic',
  health: 'Health & Clinic',
  clinic: 'Health & Clinic',
  coaching: 'Coaching & Institute',
  solo_teacher: 'Solo Tutor',
  tutor: 'Solo Tutor',
  salon: 'Salon & Spa',
  real_estate: 'Real Estate',
  travel: 'Travel & Tourism',
  gym: 'Gym & Fitness',
  restaurant: 'Restaurant & Cafe',
  general: 'Business Services',
};

function formatIndustry(industry?: string): string {
  if (!industry) return 'Health & Clinic';
  const clean = industry.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return (
    INDUSTRY_NAMES[clean] ||
    industry
      .split(/[_-]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}

function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return '+91 •••• 1234';
  const clean = phone.replace(/[^0-9+]/g, '');
  if (clean.length < 8) return phone;
  const prefix = clean.slice(0, 3);
  const suffix = clean.slice(-4);
  return `${prefix} •••• ${suffix}`;
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return 'No recent activity';
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 2) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  } catch {
    return 'Recently';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AdminWhatsAppClient() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<WhatsAppAccountItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<
    'newest' | 'name' | 'activity' | 'status'
  >('newest');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // View Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [viewingAccount, setViewingAccount] =
    useState<WhatsAppAccountItem | null>(null);

  // Disconnect Confirmation Dialog
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [disconnectingAccount, setDisconnectingAccount] =
    useState<WhatsAppAccountItem | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/whatsapp');
      if (!res.ok) {
        throw new Error('Failed to load WhatsApp accounts');
      }
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'We couldn&apos;t load WhatsApp connection information right now.';
      setError(msg);
      toast.error('Could not load WhatsApp connections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY METRICS
  // ═══════════════════════════════════════════════════════════════════════════
  const summaryCounts = useMemo(() => {
    let connected = 0;
    let needsAttention = 0;
    let disconnected = 0;

    accounts.forEach((acc) => {
      if (acc.whatsapp.status === 'needs_attention') {
        needsAttention++;
      } else if (acc.whatsapp.connected) {
        connected++;
      } else {
        disconnected++;
      }
    });

    return {
      connected,
      needsAttention,
      disconnected,
      total: accounts.length,
    };
  }, [accounts]);

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTERING & SORTING PIPELINE
  // ═══════════════════════════════════════════════════════════════════════════
  const filteredAndSortedAccounts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const filtered = accounts.filter((acc) => {
      const name = acc.name.toLowerCase();
      const phone = (acc.whatsapp.phoneNumber || '').toLowerCase();
      const industry = formatIndustry(acc.industry).toLowerCase();

      // 1. Search Query
      if (q) {
        const nameMatch = name.includes(q);
        const phoneMatch = phone.includes(q);
        const industryMatch = industry.includes(q);
        if (!nameMatch && !phoneMatch && !industryMatch) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'connected' && !acc.whatsapp.connected)
          return false;
        if (statusFilter === 'disconnected' && acc.whatsapp.connected)
          return false;
        if (
          statusFilter === 'needs_attention' &&
          acc.whatsapp.status !== 'needs_attention'
        )
          return false;
      }

      // 3. Industry Filter
      if (industryFilter !== 'all') {
        const formatted = formatIndustry(acc.industry);
        if (formatted !== industryFilter) return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'status') {
        return (b.whatsapp.connected ? 1 : 0) - (a.whatsapp.connected ? 1 : 0);
      }
      if (sortBy === 'activity') {
        const dateA = a.whatsapp.lastActivity
          ? new Date(a.whatsapp.lastActivity).getTime()
          : 0;
        const dateB = b.whatsapp.lastActivity
          ? new Date(b.whatsapp.lastActivity).getTime()
          : 0;
        return dateB - dateA;
      }
      return 0;
    });
  }, [accounts, searchQuery, statusFilter, industryFilter, sortBy]);

  const totalPages =
    Math.ceil(filteredAndSortedAccounts.length / pageSize) || 1;
  const paginatedAccounts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedAccounts.slice(start, start + pageSize);
  }, [filteredAndSortedAccounts, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, industryFilter, sortBy]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'all' ||
    industryFilter !== 'all';

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setIndustryFilter('all');
    setSortBy('newest');
  };

  function handleOpenDetail(account: WhatsAppAccountItem) {
    setViewingAccount(account);
    setDetailModalOpen(true);
  }

  function handleOpenDisconnectDialog(account: WhatsAppAccountItem) {
    setDisconnectingAccount(account);
    setDisconnectDialogOpen(true);
  }

  async function executeDisconnect() {
    if (!disconnectingAccount) return;

    setIsDisconnecting(true);
    try {
      const res = await fetch(
        `/api/admin/whatsapp?accountId=${disconnectingAccount.id}`,
        {
          method: 'DELETE',
        }
      );

      if (res.ok) {
        toast.success(`WhatsApp disconnected for ${disconnectingAccount.name}`);
        setDisconnectDialogOpen(false);
        setDetailModalOpen(false);
        loadData();
      } else {
        toast.error('Failed to disconnect WhatsApp');
      }
    } catch {
      toast.error('Error disconnecting WhatsApp');
    } finally {
      setIsDisconnecting(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS BADGE HELPER
  // ═══════════════════════════════════════════════════════════════════════════
  const getWhatsAppStatusBadge = (connected: boolean, status?: string) => {
    if (connected) {
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/30 bg-emerald-500/10 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
        >
          ● Connected
        </Badge>
      );
    }
    if (status === 'needs_attention') {
      return (
        <Badge
          variant="outline"
          className="border-amber-500/30 bg-amber-500/10 text-[11px] font-semibold text-amber-600 dark:text-amber-400"
        >
          ⚠ Needs Attention
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="border-slate-500/30 bg-slate-500/10 text-[11px] font-semibold text-slate-600 dark:text-slate-400"
      >
        ○ Disconnected
      </Badge>
    );
  };

  return (
    <AdminNav onRefresh={loadData} loading={loading}>
      <div className="space-y-6">
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 1. TOP SUMMARY CARDS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          {/* Connected */}
          <div className="border-border/60 bg-card/80 rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Connected
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 tabular-nums dark:text-emerald-400">
              {summaryCounts.connected}
            </p>
          </div>

          {/* Needs Attention */}
          <div className="border-border/60 bg-card/80 rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Needs Attention
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600 tabular-nums dark:text-amber-400">
              {summaryCounts.needsAttention}
            </p>
          </div>

          {/* Disconnected */}
          <div className="border-border/60 bg-card/80 rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Disconnected
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400">
                <Phone className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-muted-foreground mt-2 text-2xl font-bold tracking-tight tabular-nums">
              {summaryCounts.disconnected}
            </p>
          </div>

          {/* Total Businesses */}
          <div className="border-border/60 bg-card/80 rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Total Businesses
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <MessageSquare className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-foreground mt-2 text-2xl font-bold tracking-tight tabular-nums">
              {summaryCounts.total}
            </p>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 2. NEEDS YOUR ATTENTION SECTION */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {summaryCounts.needsAttention > 0 ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <h3 className="text-foreground text-xs font-semibold">
                  Needs Your Attention
                </h3>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  ⚠ {summaryCounts.needsAttention} business WhatsApp connection
                  requires attention or re-authentication.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-foreground text-xs font-semibold">
                  ✓ All WhatsApp connections are healthy
                </p>
                <p className="text-muted-foreground text-[11px]">
                  Webhooks and message dispatchers are running smoothly.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 3. SEARCH & FILTERS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="border-border/60 bg-card/80 space-y-3 rounded-2xl border p-4 shadow-xs">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
              <Input
                placeholder="Search businesses or phone numbers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-border/80 bg-background/50 h-9 rounded-xl pl-9 text-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-muted-foreground hover:text-foreground absolute top-2.5 right-3"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter */}
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  if (val) setStatusFilter(val);
                }}
              >
                <SelectTrigger className="border-border/80 h-9 w-[130px] rounded-xl text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="border-border/80 rounded-xl">
                  <SelectItem value="all" className="text-xs">
                    All Statuses
                  </SelectItem>
                  <SelectItem value="connected" className="text-xs">
                    Connected
                  </SelectItem>
                  <SelectItem value="disconnected" className="text-xs">
                    Disconnected
                  </SelectItem>
                  <SelectItem value="needs_attention" className="text-xs">
                    Needs Attention
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Industry Filter */}
              <Select
                value={industryFilter}
                onValueChange={(val) => {
                  if (val) setIndustryFilter(val);
                }}
              >
                <SelectTrigger className="border-border/80 h-9 w-[145px] rounded-xl text-xs">
                  <SelectValue placeholder="Industry" />
                </SelectTrigger>
                <SelectContent className="border-border/80 rounded-xl">
                  <SelectItem value="all" className="text-xs">
                    All Industries
                  </SelectItem>
                  <SelectItem value="Health & Clinic" className="text-xs">
                    Health & Clinic
                  </SelectItem>
                  <SelectItem value="Coaching & Institute" className="text-xs">
                    Coaching
                  </SelectItem>
                  <SelectItem value="Solo Tutor" className="text-xs">
                    Solo Tutor
                  </SelectItem>
                  <SelectItem value="Salon & Spa" className="text-xs">
                    Salon & Spa
                  </SelectItem>
                  <SelectItem value="Real Estate" className="text-xs">
                    Real Estate
                  </SelectItem>
                  <SelectItem value="Travel & Tourism" className="text-xs">
                    Travel
                  </SelectItem>
                  <SelectItem value="Gym & Fitness" className="text-xs">
                    Gym & Fitness
                  </SelectItem>
                  <SelectItem value="Restaurant & Cafe" className="text-xs">
                    Restaurant
                  </SelectItem>
                  <SelectItem value="Business Services" className="text-xs">
                    Business Services
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Sort Filter */}
              <Select
                value={sortBy}
                onValueChange={(val) => {
                  if (
                    val === 'newest' ||
                    val === 'name' ||
                    val === 'activity' ||
                    val === 'status'
                  ) {
                    setSortBy(val);
                  }
                }}
              >
                <SelectTrigger className="border-border/80 h-9 w-[140px] rounded-xl text-xs">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="border-border/80 rounded-xl">
                  <SelectItem value="newest" className="text-xs">
                    Newest First
                  </SelectItem>
                  <SelectItem value="activity" className="text-xs">
                    Last Activity
                  </SelectItem>
                  <SelectItem value="name" className="text-xs">
                    Business Name
                  </SelectItem>
                  <SelectItem value="status" className="text-xs">
                    Connection Status
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-muted-foreground hover:text-foreground h-9 gap-1 rounded-xl text-xs"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 4. WHATSAPP ACCOUNTS TABLE / CARDS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="border-border/60 bg-card/80 overflow-hidden rounded-[1.35rem] border shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)]">
          {error ? (
            <div className="p-12 text-center">
              <AlertTriangle className="text-destructive mx-auto h-8 w-8" />
              <p className="text-foreground mt-2 text-sm font-semibold">
                Unable to load WhatsApp accounts
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                className="mt-4 h-8 rounded-xl text-xs"
              >
                Try Again
              </Button>
            </div>
          ) : loading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600 dark:text-emerald-400" />
              <p className="text-muted-foreground text-xs">
                Loading WhatsApp connections...
              </p>
            </div>
          ) : filteredAndSortedAccounts.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquare className="text-muted-foreground/40 mx-auto h-10 w-10" />
              <p className="text-foreground mt-3 text-sm font-semibold">
                {hasActiveFilters
                  ? 'No WhatsApp connections found'
                  : 'No WhatsApp connections yet'}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {hasActiveFilters
                  ? 'Try a different business name or phone number.'
                  : 'Businesses will appear here after connecting WhatsApp.'}
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllFilters}
                  className="mt-4 h-8 rounded-xl text-xs"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-xs">
                  <thead className="border-border/60 bg-muted/30 text-muted-foreground border-b text-[11px] font-semibold">
                    <tr>
                      <th className="px-5 py-3.5">Business</th>
                      <th className="px-5 py-3.5">Industry</th>
                      <th className="px-5 py-3.5">WhatsApp Number</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Last Activity</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border/40 divide-y">
                    {paginatedAccounts.map((acc) => (
                      <tr
                        key={acc.id}
                        className="hover:bg-muted/20 transition-colors"
                      >
                        {/* Business */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 font-bold text-emerald-600 dark:text-emerald-400">
                              {acc.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="text-foreground text-xs font-semibold">
                              {acc.name}
                            </div>
                          </div>
                        </td>

                        {/* Industry */}
                        <td className="text-muted-foreground px-5 py-3.5 font-medium">
                          {formatIndustry(acc.industry)}
                        </td>

                        {/* WhatsApp Number */}
                        <td className="text-foreground px-5 py-3.5 font-mono text-xs font-medium">
                          {acc.whatsapp.connected
                            ? maskPhoneNumber(acc.whatsapp.phoneNumber)
                            : '—'}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          {getWhatsAppStatusBadge(
                            acc.whatsapp.connected,
                            acc.whatsapp.status
                          )}
                        </td>

                        {/* Last Activity */}
                        <td className="text-muted-foreground px-5 py-3.5">
                          {formatRelativeTime(acc.whatsapp.lastActivity)}
                        </td>

                        {/* Action */}
                        <td className="px-5 py-3.5 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenDetail(acc)}
                            className="border-border/80 hover:bg-muted/80 h-7 rounded-lg px-2.5 text-[11px] font-medium"
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="divide-border/40 block divide-y md:hidden">
                {paginatedAccounts.map((acc) => (
                  <div key={acc.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 font-bold text-emerald-600 dark:text-emerald-400">
                          {acc.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-foreground text-xs font-semibold">
                            {acc.name}
                          </p>
                          <p className="text-muted-foreground text-[11px]">
                            {formatIndustry(acc.industry)}
                          </p>
                        </div>
                      </div>
                      {getWhatsAppStatusBadge(
                        acc.whatsapp.connected,
                        acc.whatsapp.status
                      )}
                    </div>

                    <div className="bg-muted/20 grid grid-cols-2 gap-2 rounded-xl p-2.5 text-[11px]">
                      <div>
                        <span className="text-muted-foreground">Number:</span>{' '}
                        <span className="text-foreground font-mono font-medium">
                          {acc.whatsapp.connected
                            ? maskPhoneNumber(acc.whatsapp.phoneNumber)
                            : 'Not set'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Activity:</span>{' '}
                        <span className="text-foreground font-medium">
                          {formatRelativeTime(acc.whatsapp.lastActivity)}
                        </span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenDetail(acc)}
                      className="h-7 w-full rounded-lg text-xs font-medium"
                    >
                      View Details
                    </Button>
                  </div>
                ))}
              </div>

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* 5. PAGINATION */}
              {/* ═══════════════════════════════════════════════════════════ */}
              <div className="border-border/60 bg-muted/20 flex flex-col items-center justify-between gap-3 border-t p-4 sm:flex-row sm:px-6">
                <span className="text-muted-foreground text-xs">
                  Showing{' '}
                  <strong className="text-foreground">
                    {Math.min(
                      (currentPage - 1) * pageSize + 1,
                      filteredAndSortedAccounts.length
                    )}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-foreground">
                    {Math.min(
                      currentPage * pageSize,
                      filteredAndSortedAccounts.length
                    )}
                  </strong>{' '}
                  of{' '}
                  <strong className="text-foreground">
                    {filteredAndSortedAccounts.length}
                  </strong>{' '}
                  connections
                </span>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={currentPage === 1}
                    className="h-7 gap-1 rounded-lg text-xs"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </Button>

                  <div className="px-2 text-xs font-semibold">
                    {currentPage} / {totalPages}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    disabled={currentPage >= totalPages}
                    className="h-7 gap-1 rounded-lg text-xs"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 6. VIEW WHATSAPP DETAIL MODAL */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="border-border/60 bg-card rounded-2xl border p-6 shadow-xl sm:max-w-md">
          {viewingAccount && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <DialogTitle className="text-foreground text-lg font-bold">
                      {viewingAccount.name}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground mt-0.5 text-xs">
                      {formatIndustry(viewingAccount.industry)}
                    </DialogDescription>
                  </div>
                  {getWhatsAppStatusBadge(
                    viewingAccount.whatsapp.connected,
                    viewingAccount.whatsapp.status
                  )}
                </div>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* Number & Connection Card */}
                <div className="border-border/60 bg-muted/20 space-y-2 rounded-xl border p-3.5">
                  <div className="text-foreground flex items-center gap-1.5 font-semibold">
                    <Phone className="h-3.5 w-3.5 text-emerald-600" />
                    WhatsApp Phone Number
                  </div>
                  <p className="text-foreground font-mono text-sm font-bold">
                    {viewingAccount.whatsapp.connected
                      ? maskPhoneNumber(viewingAccount.whatsapp.phoneNumber)
                      : 'Not connected'}
                  </p>
                </div>

                {/* Health Metrics */}
                <div className="border-border/60 bg-muted/20 space-y-2.5 rounded-xl border p-3.5">
                  <div className="text-foreground flex items-center gap-1.5 font-semibold">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                    Connection Health
                  </div>
                  <div className="text-muted-foreground grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px]">Webhook State:</span>
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                        ● Operational
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px]">Last Activity:</span>
                      <p className="text-foreground font-medium">
                        {formatRelativeTime(
                          viewingAccount.whatsapp.lastActivity
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Advanced Details */}
                <div className="border-border/60 bg-muted/30 space-y-1.5 rounded-xl border p-3 text-[11px]">
                  <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Connection Metadata
                  </span>
                  <div className="text-muted-foreground flex items-center justify-between">
                    <span>Business Account:</span>
                    <code className="text-foreground font-mono">
                      {viewingAccount.whatsapp.wabaId || '••••••••'}
                    </code>
                  </div>
                  <div className="text-muted-foreground flex items-center justify-between">
                    <span>Phone ID:</span>
                    <code className="text-foreground font-mono">
                      {viewingAccount.whatsapp.phoneNumberId || '••••••••'}
                    </code>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex items-center justify-between gap-2 pt-2 sm:justify-between">
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDetailModalOpen(false)}
                    className="h-8 rounded-lg text-xs"
                  >
                    Close
                  </Button>
                  {viewingAccount.whatsapp.connected && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDetailModalOpen(false);
                        handleOpenDisconnectDialog(viewingAccount);
                      }}
                      className="h-8 rounded-lg text-xs text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
                    >
                      Disconnect
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href="/admin/subscribers"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-medium transition-colors"
                  >
                    View Business
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 7. DISCONNECT CONFIRMATION MODAL */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={disconnectDialogOpen}
        onOpenChange={setDisconnectDialogOpen}
      >
        <DialogContent className="border-border/60 bg-card rounded-2xl border p-6 shadow-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base font-semibold">
              Disconnect WhatsApp — {disconnectingAccount?.name}?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              This will pause live WhatsApp automated messaging for this
              business until reconnected.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDisconnectDialogOpen(false)}
              className="h-8 rounded-lg text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isDisconnecting}
              onClick={executeDisconnect}
              className="h-8 rounded-lg bg-rose-600 text-xs text-white hover:bg-rose-700"
            >
              {isDisconnecting && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Disconnect WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminNav>
  );
}
