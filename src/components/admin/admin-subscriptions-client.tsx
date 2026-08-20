'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Search,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  X,
  Calendar,
  Receipt,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

interface TenantSubscription {
  id: string;
  name: string;
  industry?: string;
  created_at: string;
  owner: {
    full_name: string | null;
    email: string;
  } | null;
  membersCount: number;
  contactsCount: number;
  subscription: {
    status: 'trial' | 'active' | 'expired' | 'cancelled' | 'past_due';
    end_date: string | null;
    plan: {
      id: string;
      name: string;
    };
  } | null;
  usage: {
    aiRequests: number;
    whatsappMessages: number;
  };
}

interface Plan {
  id: string;
  name: string;
  monthly_price?: number;
  monthlyPrice?: number;
  setup_fee?: number;
  setupFee?: number;
}

interface RevenueData {
  activeSubscriptionsCount?: number;
  trialCustomersCount?: number;
  pastDueCount?: number;
  cancelledCount?: number;
  monthlyRecurringRevenue?: number;
  totalRevenue?: number;
  recentPayments?: Array<{
    id: string;
    amount: number;
    status: string;
    created_at: string;
    account?: { id: string; name: string };
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════════

const INDUSTRY_DISPLAY_NAMES: Record<string, string> = {
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
    INDUSTRY_DISPLAY_NAMES[clean] ||
    industry
      .split(/[_-]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recent';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AdminSubscriptionsClient() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantSubscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Search, Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<
    'newest' | 'oldest' | 'renewal' | 'name' | 'plan'
  >('newest');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // View Subscription Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [viewingTenant, setViewingTenant] = useState<TenantSubscription | null>(
    null
  );

  // Manage Subscription Modal
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] =
    useState<TenantSubscription | null>(null);
  const [editPlanId, setEditPlanId] = useState('');
  const [editStatus, setEditStatus] = useState<
    'trial' | 'active' | 'expired' | 'cancelled' | 'past_due'
  >('active');
  const [editEndDate, setEditEndDate] = useState('');
  const [submittingSub, setSubmittingSub] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tRes, pRes, rRes] = await Promise.all([
        fetch('/api/admin/tenants'),
        fetch('/api/admin/plans'),
        fetch('/api/admin/revenue'),
      ]);

      if (!tRes.ok) {
        throw new Error('Failed to load subscriptions');
      }

      const tData = await tRes.json();
      setTenants(Array.isArray(tData) ? tData : []);

      if (pRes.ok) {
        const pData = await pRes.json();
        setPlans(Array.isArray(pData) ? pData : []);
      }

      if (rRes.ok) {
        const rData = await rRes.json();
        setRevenueData(rData);
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'We couldn&apos;t load subscription information right now.';
      setError(msg);
      toast.error('Could not load subscriptions');
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
    let active = 0;
    let trial = 0;
    let paymentDue = revenueData?.pastDueCount ?? 0;
    let expired = 0;

    tenants.forEach((t) => {
      const status = t.subscription?.status || 'active';
      if (status === 'active') active++;
      else if (status === 'trial') trial++;
      else if (status === 'past_due') paymentDue++;
      else expired++;
    });

    return {
      active: revenueData?.activeSubscriptionsCount ?? active,
      trial: revenueData?.trialCustomersCount ?? trial,
      paymentDue,
      expired: revenueData?.cancelledCount ?? expired,
    };
  }, [tenants, revenueData]);

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTERING & SORTING PIPELINE
  // ═══════════════════════════════════════════════════════════════════════════
  const filteredAndSortedTenants = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const filtered = tenants.filter((t) => {
      // 1. Search Query
      if (q) {
        const nameMatch = t.name.toLowerCase().includes(q);
        const ownerMatch = t.owner?.full_name?.toLowerCase().includes(q);
        const emailMatch = t.owner?.email.toLowerCase().includes(q);
        const industryMatch = formatIndustry(t.industry)
          .toLowerCase()
          .includes(q);
        if (!nameMatch && !ownerMatch && !emailMatch && !industryMatch) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter !== 'all') {
        const status = t.subscription?.status || 'active';
        if (statusFilter === 'active' && status !== 'active') return false;
        if (statusFilter === 'trial' && status !== 'trial') return false;
        if (statusFilter === 'payment_due' && status !== 'past_due')
          return false;
        if (
          statusFilter === 'expired' &&
          status !== 'expired' &&
          status !== 'cancelled'
        )
          return false;
        if (statusFilter === 'cancelled' && status !== 'cancelled')
          return false;
      }

      // 3. Plan Filter
      if (planFilter !== 'all') {
        const planName = (t.subscription?.plan?.name || '').toLowerCase();
        if (!planName.includes(planFilter.toLowerCase())) return false;
      }

      // 4. Industry Filter
      if (industryFilter !== 'all') {
        const formatted = formatIndustry(t.industry);
        if (formatted !== industryFilter) return false;
      }

      return true;
    });

    // Sort
    return filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
      if (sortBy === 'oldest') {
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
      if (sortBy === 'renewal') {
        const dateA = a.subscription?.end_date
          ? new Date(a.subscription.end_date).getTime()
          : 0;
        const dateB = b.subscription?.end_date
          ? new Date(b.subscription.end_date).getTime()
          : 0;
        return dateA - dateB;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'plan') {
        const planA = a.subscription?.plan?.name || '';
        const planB = b.subscription?.plan?.name || '';
        return planA.localeCompare(planB);
      }
      return 0;
    });
  }, [tenants, searchQuery, statusFilter, planFilter, industryFilter, sortBy]);

  // Paginated Slice
  const totalPages = Math.ceil(filteredAndSortedTenants.length / pageSize) || 1;
  const paginatedTenants = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedTenants.slice(start, start + pageSize);
  }, [filteredAndSortedTenants, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, planFilter, industryFilter, sortBy]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'all' ||
    planFilter !== 'all' ||
    industryFilter !== 'all';

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPlanFilter('all');
    setIndustryFilter('all');
    setSortBy('newest');
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════
  function handleOpenDetail(tenant: TenantSubscription) {
    setViewingTenant(tenant);
    setDetailModalOpen(true);
  }

  function handleOpenManageDialog(tenant: TenantSubscription) {
    setSelectedTenant(tenant);
    const defaultPlanId =
      tenant.subscription?.plan?.id || plans[0]?.id || 'plan_growth';
    setEditPlanId(defaultPlanId);
    setEditStatus(tenant.subscription?.status || 'active');

    const defaultEndDate = tenant.subscription?.end_date
      ? new Date(tenant.subscription.end_date).toISOString().split('T')[0]
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];

    setEditEndDate(defaultEndDate);
    setManageDialogOpen(true);
  }

  async function handleManageSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTenant) {
      toast.error('No business selected');
      return;
    }

    const planIdToSave = editPlanId || plans[0]?.id || 'plan_growth';
    const endDateToSave =
      editEndDate ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

    setSubmittingSub(true);
    try {
      const response = await fetch('/api/admin/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: selectedTenant.id,
          planId: planIdToSave,
          status: editStatus || 'active',
          endDate: new Date(endDateToSave).toISOString(),
        }),
      });

      if (response.ok) {
        toast.success('Subscription updated successfully');
        setManageDialogOpen(false);
        if (viewingTenant && viewingTenant.id === selectedTenant.id) {
          setViewingTenant((prev) =>
            prev
              ? {
                  ...prev,
                  subscription: {
                    status: editStatus,
                    end_date: new Date(endDateToSave).toISOString(),
                    plan: {
                      id: planIdToSave,
                      name:
                        plans.find((p) => p.id === planIdToSave)?.name ||
                        'Growth Plan',
                    },
                  },
                }
              : null
          );
        }
        loadData();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update subscription');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error saving subscription changes');
    } finally {
      setSubmittingSub(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS BADGE RENDERER
  // ═══════════════════════════════════════════════════════════════════════════
  const getSubStatusBadge = (
    status:
      | 'trial'
      | 'active'
      | 'expired'
      | 'cancelled'
      | 'past_due'
      | undefined
      | null
  ) => {
    switch (status) {
      case 'active':
        return (
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
          >
            ● Active
          </Badge>
        );
      case 'trial':
        return (
          <Badge
            variant="outline"
            className="border-blue-500/30 bg-blue-500/10 text-[11px] font-semibold text-blue-600 dark:text-blue-400"
          >
            ● Trial
          </Badge>
        );
      case 'past_due':
        return (
          <Badge
            variant="outline"
            className="border-amber-500/30 bg-amber-500/10 text-[11px] font-semibold text-amber-600 dark:text-amber-400"
          >
            ⚠ Payment Due
          </Badge>
        );
      case 'expired':
        return (
          <Badge
            variant="outline"
            className="border-rose-500/30 bg-rose-500/10 text-[11px] font-semibold text-rose-600 dark:text-rose-400"
          >
            ● Expired
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge
            variant="outline"
            className="border-slate-500/30 bg-slate-500/10 text-[11px] font-semibold text-slate-600 dark:text-slate-400"
          >
            ● Cancelled
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
          >
            ● Active
          </Badge>
        );
    }
  };

  const getBillingStatusBadge = (status: string | undefined | null) => {
    if (status === 'active') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Paid
        </span>
      );
    }
    if (status === 'past_due') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Payment Due
        </span>
      );
    }
    if (status === 'trial') {
      return (
        <span className="text-muted-foreground text-[11px] font-medium">
          Trial Period
        </span>
      );
    }
    return (
      <span className="text-muted-foreground text-[11px] font-medium">—</span>
    );
  };

  return (
    <AdminNav onRefresh={loadData} loading={loading}>
      <div className="space-y-6">
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 1. TOP SUMMARY CARDS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          {/* Active */}
          <div className="border-border/60 bg-card/80 rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Active Paid
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 tabular-nums dark:text-emerald-400">
              {summaryCounts.active}
            </p>
          </div>

          {/* Trial */}
          <div className="border-border/60 bg-card/80 rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Trial
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Clock className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-blue-600 tabular-nums dark:text-blue-400">
              {summaryCounts.trial}
            </p>
          </div>

          {/* Payment Due */}
          <div className="border-border/60 bg-card/80 rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Payment Due
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600 tabular-nums dark:text-amber-400">
              {summaryCounts.paymentDue}
            </p>
          </div>

          {/* Expired / Cancelled */}
          <div className="border-border/60 bg-card/80 rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Expired
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <ShieldAlert className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600 tabular-nums dark:text-rose-400">
              {summaryCounts.expired}
            </p>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 2. NEEDS YOUR ATTENTION SECTION */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {summaryCounts.paymentDue > 0 || summaryCounts.expired > 0 ? (
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
                  {summaryCounts.paymentDue > 0
                    ? `⚠ ${summaryCounts.paymentDue} subscription${summaryCounts.paymentDue > 1 ? 's have' : ' has'} payment issues requiring follow-up.`
                    : `⚠ ${summaryCounts.expired} subscription${summaryCounts.expired > 1 ? 's have' : ' has'} expired.`}
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
                  ✓ Everything looks good
                </p>
                <p className="text-muted-foreground text-[11px]">
                  No subscription payment issues right now.
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
                placeholder="Search subscriptions by business, owner, or email..."
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

            {/* Filter Dropdowns */}
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
                  <SelectItem value="active" className="text-xs">
                    Active
                  </SelectItem>
                  <SelectItem value="trial" className="text-xs">
                    Trial
                  </SelectItem>
                  <SelectItem value="payment_due" className="text-xs">
                    Payment Due
                  </SelectItem>
                  <SelectItem value="expired" className="text-xs">
                    Expired
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Plan Filter */}
              <Select
                value={planFilter}
                onValueChange={(val) => {
                  if (val) setPlanFilter(val);
                }}
              >
                <SelectTrigger className="border-border/80 h-9 w-[120px] rounded-xl text-xs">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent className="border-border/80 rounded-xl">
                  <SelectItem value="all" className="text-xs">
                    All Plans
                  </SelectItem>
                  <SelectItem value="growth" className="text-xs">
                    Growth ⭐
                  </SelectItem>
                  <SelectItem value="starter" className="text-xs">
                    Starter
                  </SelectItem>
                  <SelectItem value="pro" className="text-xs">
                    Pro
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

              {/* Sort Dropdown */}
              <Select
                value={sortBy}
                onValueChange={(val) => {
                  if (
                    val === 'newest' ||
                    val === 'oldest' ||
                    val === 'renewal' ||
                    val === 'name' ||
                    val === 'plan'
                  ) {
                    setSortBy(val);
                  }
                }}
              >
                <SelectTrigger className="border-border/80 h-9 w-[130px] rounded-xl text-xs">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="border-border/80 rounded-xl">
                  <SelectItem value="newest" className="text-xs">
                    Newest First
                  </SelectItem>
                  <SelectItem value="renewal" className="text-xs">
                    Next Renewal
                  </SelectItem>
                  <SelectItem value="oldest" className="text-xs">
                    Oldest First
                  </SelectItem>
                  <SelectItem value="name" className="text-xs">
                    Business Name
                  </SelectItem>
                  <SelectItem value="plan" className="text-xs">
                    Plan
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
        {/* 4. SUBSCRIPTIONS TABLE / CARDS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="border-border/60 bg-card/80 overflow-hidden rounded-[1.35rem] border shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)]">
          {error ? (
            <div className="p-12 text-center">
              <AlertTriangle className="text-destructive mx-auto h-8 w-8" />
              <p className="text-foreground mt-2 text-sm font-semibold">
                Unable to load subscriptions
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
                Loading subscriptions...
              </p>
            </div>
          ) : filteredAndSortedTenants.length === 0 ? (
            <div className="p-12 text-center">
              <Receipt className="text-muted-foreground/40 mx-auto h-10 w-10" />
              <p className="text-foreground mt-3 text-sm font-semibold">
                {hasActiveFilters
                  ? 'No subscriptions found'
                  : 'No subscriptions yet'}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {hasActiveFilters
                  ? 'Try a different business name or filter.'
                  : 'Subscriptions will appear here when businesses choose a Helpa plan.'}
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
                      <th className="px-5 py-3.5">Plan</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Billing</th>
                      <th className="px-5 py-3.5">Next Renewal</th>
                      <th className="px-5 py-3.5">Joined</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border/40 divide-y">
                    {paginatedTenants.map((t) => {
                      const planName =
                        t.subscription?.plan?.name || 'Growth Plan';
                      const isGrowth = planName
                        .toLowerCase()
                        .includes('growth');

                      return (
                        <tr
                          key={t.id}
                          className="hover:bg-muted/20 transition-colors"
                        >
                          {/* Business */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 font-bold text-emerald-600 dark:text-emerald-400">
                                {t.name?.charAt(0)?.toUpperCase() || 'B'}
                              </div>
                              <div>
                                <div className="text-foreground text-xs font-semibold">
                                  {t.name}
                                </div>
                                <div className="text-muted-foreground text-[11px]">
                                  {t.owner?.full_name || 'Account Owner'}
                                  {t.owner?.email ? ` • ${t.owner.email}` : ''}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Plan */}
                          <td className="px-5 py-3.5">
                            <div className="text-foreground flex items-center gap-1.5 font-medium">
                              <span>{planName}</span>
                              {isGrowth && (
                                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                                  ⭐
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-3.5">
                            {getSubStatusBadge(t.subscription?.status)}
                          </td>

                          {/* Billing */}
                          <td className="px-5 py-3.5">
                            {getBillingStatusBadge(t.subscription?.status)}
                          </td>

                          {/* Renewal Date */}
                          <td className="text-muted-foreground px-5 py-3.5 font-medium">
                            {t.subscription?.end_date
                              ? formatDate(t.subscription.end_date)
                              : 'Not scheduled'}
                          </td>

                          {/* Joined Date */}
                          <td className="text-muted-foreground px-5 py-3.5">
                            {formatDate(t.created_at)}
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenDetail(t)}
                                className="border-border/80 hover:bg-muted/80 h-7 rounded-lg px-2.5 text-[11px] font-medium"
                              >
                                View
                              </Button>

                              <DropdownMenu>
                                <DropdownMenuTrigger className="text-muted-foreground hover:text-foreground hover:bg-muted/80 flex h-7 w-7 items-center justify-center rounded-lg p-0 transition-colors focus:outline-none">
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="w-48 rounded-xl"
                                >
                                  <DropdownMenuItem
                                    onClick={() => handleOpenDetail(t)}
                                    className="text-xs"
                                  >
                                    View Subscription
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleOpenManageDialog(t)}
                                    className="text-xs"
                                  >
                                    Manage Subscription
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="divide-border/40 block divide-y md:hidden">
                {paginatedTenants.map((t) => {
                  const planName = t.subscription?.plan?.name || 'Growth Plan';
                  const isGrowth = planName.toLowerCase().includes('growth');

                  return (
                    <div key={t.id} className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 font-bold text-emerald-600 dark:text-emerald-400">
                            {t.name?.charAt(0)?.toUpperCase() || 'B'}
                          </div>
                          <div>
                            <p className="text-foreground text-xs font-semibold">
                              {t.name}
                            </p>
                            <p className="text-muted-foreground text-[11px]">
                              {formatIndustry(t.industry)}
                            </p>
                          </div>
                        </div>
                        {getSubStatusBadge(t.subscription?.status)}
                      </div>

                      <div className="bg-muted/20 grid grid-cols-2 gap-2 rounded-xl p-2.5 text-[11px]">
                        <div>
                          <span className="text-muted-foreground">Plan:</span>{' '}
                          <span className="text-foreground font-semibold">
                            {planName} {isGrowth && '⭐'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Billing:
                          </span>{' '}
                          {getBillingStatusBadge(t.subscription?.status)}
                        </div>
                        <div className="text-muted-foreground col-span-2">
                          Next Renewal:{' '}
                          {t.subscription?.end_date
                            ? formatDate(t.subscription.end_date)
                            : 'Not scheduled'}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDetail(t)}
                          className="mr-2 h-7 w-full rounded-lg text-xs font-medium"
                        >
                          View Subscription
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger className="text-muted-foreground hover:text-foreground hover:bg-muted border-border/80 flex h-7 w-7 items-center justify-center rounded-lg border p-0 transition-colors focus:outline-none">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-48 rounded-xl"
                          >
                            <DropdownMenuItem
                              onClick={() => handleOpenManageDialog(t)}
                              className="text-xs"
                            >
                              Manage Subscription
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
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
                      filteredAndSortedTenants.length
                    )}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-foreground">
                    {Math.min(
                      currentPage * pageSize,
                      filteredAndSortedTenants.length
                    )}
                  </strong>{' '}
                  of{' '}
                  <strong className="text-foreground">
                    {filteredAndSortedTenants.length}
                  </strong>{' '}
                  subscriptions
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
      {/* 6. VIEW SUBSCRIPTION DETAIL MODAL */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="border-border/60 bg-card rounded-2xl border p-6 shadow-xl sm:max-w-lg">
          {viewingTenant && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <DialogTitle className="text-foreground text-lg font-bold">
                      {viewingTenant.name}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground mt-0.5 text-xs">
                      {formatIndustry(viewingTenant.industry)}
                    </DialogDescription>
                  </div>
                  {getSubStatusBadge(viewingTenant.subscription?.status)}
                </div>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* Current Plan Card */}
                <div className="border-border/60 bg-muted/20 space-y-2 rounded-xl border p-3.5">
                  <div className="text-foreground flex items-center gap-1.5 font-semibold">
                    <CreditCard className="h-3.5 w-3.5 text-emerald-600" />
                    Current Plan
                  </div>
                  <div className="text-muted-foreground grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[11px]">Plan:</span>{' '}
                      <span className="text-foreground font-semibold">
                        {viewingTenant.subscription?.plan?.name ||
                          'Growth Plan'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px]">Monthly Price:</span>{' '}
                      <span className="text-foreground font-semibold">
                        ₹
                        {plans
                          .find(
                            (p) => p.id === viewingTenant.subscription?.plan?.id
                          )
                          ?.monthly_price?.toLocaleString('en-IN') || '4,999'}
                        /mo
                      </span>
                    </div>
                  </div>
                </div>

                {/* Subscription Period */}
                <div className="border-border/60 bg-muted/20 space-y-2 rounded-xl border p-3.5">
                  <div className="text-foreground flex items-center gap-1.5 font-semibold">
                    <Calendar className="h-3.5 w-3.5 text-blue-600" />
                    Subscription Period
                  </div>
                  <div className="text-muted-foreground grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[11px]">Started / Joined:</span>{' '}
                      <span className="text-foreground font-medium">
                        {formatDate(viewingTenant.created_at)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px]">Next Renewal:</span>{' '}
                      <span className="text-foreground font-medium">
                        {viewingTenant.subscription?.end_date
                          ? formatDate(viewingTenant.subscription.end_date)
                          : 'Not scheduled'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Billing Health */}
                <div className="border-border/60 bg-muted/20 space-y-2 rounded-xl border p-3.5">
                  <div className="text-foreground flex items-center gap-1.5 font-semibold">
                    <Receipt className="h-3.5 w-3.5 text-purple-600" />
                    Billing Health
                  </div>
                  <div className="text-muted-foreground grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[11px]">Payment Status:</span>{' '}
                      {getBillingStatusBadge(
                        viewingTenant.subscription?.status
                      )}
                    </div>
                    <div>
                      <span className="text-[11px]">Owner:</span>{' '}
                      <span className="text-foreground font-medium">
                        {viewingTenant.owner?.full_name || 'Admin'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quota Usage */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="border-border/60 bg-muted/20 space-y-1.5 rounded-xl border p-3">
                    <span className="text-foreground font-semibold">
                      Helpa AI Calls
                    </span>
                    <p className="text-sm font-bold text-purple-600 dark:text-purple-400">
                      {(viewingTenant.usage?.aiRequests ?? 0).toLocaleString()}
                    </p>
                    <p className="text-muted-foreground text-[10px]">
                      Calls processed this cycle
                    </p>
                  </div>

                  <div className="border-border/60 bg-muted/20 space-y-1.5 rounded-xl border p-3">
                    <span className="text-foreground font-semibold">
                      WhatsApp Dispatches
                    </span>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {(
                        viewingTenant.usage?.whatsappMessages ?? 0
                      ).toLocaleString()}
                    </p>
                    <p className="text-muted-foreground text-[10px]">
                      Messages dispatched
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex items-center justify-between gap-2 pt-2 sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDetailModalOpen(false)}
                  className="h-8 rounded-lg text-xs"
                >
                  Close
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setDetailModalOpen(false);
                    handleOpenManageDialog(viewingTenant);
                  }}
                  className="h-8 rounded-lg text-xs"
                >
                  Manage Subscription
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 7. MANAGE SUBSCRIPTION MODAL */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="border-border/60 bg-card rounded-2xl border p-6 shadow-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base font-semibold">
              Manage Subscription — {selectedTenant?.name}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Adjust plan tier, active status, and renewal expiration date for
              this business.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleManageSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-foreground text-xs font-medium">
                Pricing Plan
              </Label>
              <Select
                value={editPlanId}
                onValueChange={(val) => {
                  if (val) setEditPlanId(val);
                }}
              >
                <SelectTrigger className="border-border/80 h-9 rounded-xl text-xs">
                  <SelectValue placeholder="Select Plan" />
                </SelectTrigger>
                <SelectContent className="border-border/80 rounded-xl">
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name} (₹{p.monthly_price || p.monthlyPrice || 0}/mo)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-foreground text-xs font-medium">
                Subscription Status
              </Label>
              <Select
                value={editStatus}
                onValueChange={(val) => {
                  if (val) {
                    setEditStatus(
                      val as
                        | 'trial'
                        | 'active'
                        | 'expired'
                        | 'cancelled'
                        | 'past_due'
                    );
                  }
                }}
              >
                <SelectTrigger className="border-border/80 h-9 rounded-xl text-xs">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent className="border-border/80 rounded-xl">
                  <SelectItem value="active" className="text-xs">
                    Active (Paid)
                  </SelectItem>
                  <SelectItem value="trial" className="text-xs">
                    Trial (14-day)
                  </SelectItem>
                  <SelectItem value="past_due" className="text-xs">
                    Payment Due
                  </SelectItem>
                  <SelectItem value="expired" className="text-xs">
                    Expired
                  </SelectItem>
                  <SelectItem value="cancelled" className="text-xs">
                    Cancelled
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-foreground text-xs font-medium">
                Billing / Trial Renewal Date
              </Label>
              <Input
                type="date"
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
                className="border-border/80 h-9 rounded-xl text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setManageDialogOpen(false)}
                className="h-8 rounded-lg text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submittingSub}
                className="h-8 rounded-lg text-xs"
              >
                {submittingSub && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminNav>
  );
}
