'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  IndianRupee,
  Clock,
  ShieldAlert,
  ArrowUpRight,
  Copy,
  Check,
  ExternalLink,
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

interface PaymentRecord {
  id: string;
  account_id?: string;
  subscription_id?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  amount: number;
  currency?: string;
  plan_slug?: string;
  payment_type?: string;
  status: 'captured' | 'paid' | 'pending' | 'failed' | 'refunded' | string;
  is_setup_fee_included?: boolean;
  setup_fee_amount?: number;
  monthly_recurring_amount?: number;
  period_start?: string;
  period_end?: string;
  created_at: string;
  account?: {
    id: string;
    name: string;
    industry?: string;
  } | null;
  metadata?: {
    gateway?: string;
    method?: string;
    email?: string;
    contact?: string;
  } | null;
}

interface RevenueData {
  totalRevenue?: number;
  recurringRevenue?: number;
  setupFeeRevenue?: number;
  recentPayments?: PaymentRecord[];
}

interface TenantItem {
  id: string;
  name: string;
  industry?: string;
  owner?: {
    full_name?: string | null;
    email?: string;
  } | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatINR(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
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

function formatPlanName(slug?: string): string {
  if (!slug) return 'Growth Plan';
  const clean = slug.toLowerCase().replace(/^plan_/, '');
  if (clean.includes('growth')) return 'Growth ⭐';
  if (clean.includes('starter')) return 'Starter';
  if (clean.includes('pro')) return 'Pro';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function formatPaymentMethod(record: PaymentRecord): string {
  const method = record.metadata?.method;
  if (method) {
    if (method.toLowerCase() === 'upi') return 'UPI';
    if (method.toLowerCase() === 'card') return 'Card';
    if (method.toLowerCase() === 'netbanking') return 'Net Banking';
    if (method.toLowerCase() === 'wallet') return 'Wallet';
    return method.charAt(0).toUpperCase() + method.slice(1);
  }
  return 'Razorpay';
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AdminPaymentsClient() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [sortBy, setSortBy] = useState<
    'newest' | 'oldest' | 'highest' | 'lowest' | 'name'
  >('newest');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // View Payment Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [viewingPayment, setViewingPayment] = useState<PaymentRecord | null>(
    null
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, rRes, tRes] = await Promise.all([
        fetch('/api/admin/payments'),
        fetch('/api/admin/revenue'),
        fetch('/api/admin/tenants'),
      ]);

      let loadedPayments: PaymentRecord[] = [];

      if (pRes.ok) {
        const pData = await pRes.json();
        if (Array.isArray(pData)) loadedPayments = pData;
      }

      if (rRes.ok) {
        const rData = await rRes.json();
        setRevenueData(rData);
        if (
          loadedPayments.length === 0 &&
          Array.isArray(rData.recentPayments)
        ) {
          loadedPayments = rData.recentPayments;
        }
      }

      if (tRes.ok) {
        const tData = await tRes.json();
        setTenants(Array.isArray(tData) ? tData : []);
      }

      setPayments(loadedPayments);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'We couldn&apos;t load payment information right now.';
      setError(msg);
      toast.error('Could not load payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ═══════════════════════════════════════════════════════════════════════════
  // REVENUE & PAYMENT METRICS
  // ═══════════════════════════════════════════════════════════════════════════
  const summaryMetrics = useMemo(() => {
    let successfulAmount = 0;
    let successfulCount = 0;
    let pendingAmount = 0;
    let pendingCount = 0;
    let failedAmount = 0;
    let failedCount = 0;
    let totalRevenue = revenueData?.totalRevenue ?? 0;

    payments.forEach((p) => {
      const st = (p.status || '').toLowerCase();
      const amt = Number(p.amount || 0);

      if (st === 'captured' || st === 'paid' || st === 'success') {
        successfulAmount += amt;
        successfulCount++;
      } else if (st === 'pending' || st === 'created') {
        pendingAmount += amt;
        pendingCount++;
      } else if (st === 'failed') {
        failedAmount += amt;
        failedCount++;
      }
    });

    if (totalRevenue === 0 && successfulAmount > 0) {
      totalRevenue = successfulAmount;
    }

    return {
      totalRevenue,
      successfulAmount: successfulAmount > 0 ? successfulAmount : totalRevenue,
      successfulCount: successfulCount > 0 ? successfulCount : payments.length,
      pendingAmount,
      pendingCount,
      failedAmount,
      failedCount,
    };
  }, [payments, revenueData]);

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTERING & SORTING PIPELINE
  // ═══════════════════════════════════════════════════════════════════════════
  const filteredAndSortedPayments = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const filtered = payments.filter((p) => {
      const businessName =
        p.account?.name ||
        tenants.find((t) => t.id === p.account_id)?.name ||
        'Business Account';
      const planName = formatPlanName(p.plan_slug);
      const method = formatPaymentMethod(p);

      // 1. Search Query
      if (q) {
        const nameMatch = businessName.toLowerCase().includes(q);
        const planMatch = planName.toLowerCase().includes(q);
        const methodMatch = method.toLowerCase().includes(q);
        const paymentIdMatch = (p.razorpay_payment_id || p.id)
          .toLowerCase()
          .includes(q);
        if (!nameMatch && !planMatch && !methodMatch && !paymentIdMatch) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter !== 'all') {
        const st = (p.status || '').toLowerCase();
        if (
          statusFilter === 'paid' &&
          st !== 'captured' &&
          st !== 'paid' &&
          st !== 'success'
        )
          return false;
        if (statusFilter === 'pending' && st !== 'pending' && st !== 'created')
          return false;
        if (statusFilter === 'failed' && st !== 'failed') return false;
        if (statusFilter === 'refunded' && st !== 'refunded') return false;
      }

      // 3. Plan Filter
      if (planFilter !== 'all') {
        const planKey = (p.plan_slug || '').toLowerCase();
        if (!planKey.includes(planFilter.toLowerCase())) return false;
      }

      // 4. Method Filter
      if (methodFilter !== 'all') {
        const currentMethod = formatPaymentMethod(p).toLowerCase();
        if (!currentMethod.includes(methodFilter.toLowerCase())) return false;
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
      if (sortBy === 'highest') {
        return Number(b.amount || 0) - Number(a.amount || 0);
      }
      if (sortBy === 'lowest') {
        return Number(a.amount || 0) - Number(b.amount || 0);
      }
      if (sortBy === 'name') {
        const nameA = a.account?.name || '';
        const nameB = b.account?.name || '';
        return nameA.localeCompare(nameB);
      }
      return 0;
    });
  }, [
    payments,
    tenants,
    searchQuery,
    statusFilter,
    planFilter,
    methodFilter,
    sortBy,
  ]);

  // Paginated Slice
  const totalPages =
    Math.ceil(filteredAndSortedPayments.length / pageSize) || 1;
  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedPayments.slice(start, start + pageSize);
  }, [filteredAndSortedPayments, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, planFilter, methodFilter, sortBy]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'all' ||
    planFilter !== 'all' ||
    methodFilter !== 'all';

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPlanFilter('all');
    setMethodFilter('all');
    setSortBy('newest');
  };

  function handleOpenDetail(payment: PaymentRecord) {
    setViewingPayment(payment);
    setDetailModalOpen(true);
    setCopiedField(null);
  }

  function handleCopy(text: string, fieldName: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Copied ${fieldName} to clipboard`);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS BADGE HELPER
  // ═══════════════════════════════════════════════════════════════════════════
  const getPaymentStatusBadge = (status?: string) => {
    const st = (status || '').toLowerCase();
    if (st === 'captured' || st === 'paid' || st === 'success') {
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/30 bg-emerald-500/10 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
        >
          ✓ Paid
        </Badge>
      );
    }
    if (st === 'pending' || st === 'created') {
      return (
        <Badge
          variant="outline"
          className="border-amber-500/30 bg-amber-500/10 text-[11px] font-semibold text-amber-600 dark:text-amber-400"
        >
          ○ Pending
        </Badge>
      );
    }
    if (st === 'failed') {
      return (
        <Badge
          variant="outline"
          className="border-rose-500/30 bg-rose-500/10 text-[11px] font-semibold text-rose-600 dark:text-rose-400"
        >
          ✕ Failed
        </Badge>
      );
    }
    if (st === 'refunded') {
      return (
        <Badge
          variant="outline"
          className="border-blue-500/30 bg-blue-500/10 text-[11px] font-semibold text-blue-600 dark:text-blue-400"
        >
          ↩ Refunded
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="border-slate-500/30 bg-slate-500/10 text-[11px] font-semibold text-slate-600 dark:text-slate-400"
      >
        {status || 'Processed'}
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
          {/* Total Revenue */}
          <div className="border-border/60 bg-card/80 rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Total Revenue
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <IndianRupee className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-foreground mt-2 text-2xl font-bold tracking-tight tabular-nums">
              {formatINR(summaryMetrics.totalRevenue)}
            </p>
          </div>

          {/* Successful */}
          <div className="border-border/60 bg-card/80 rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Successful
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 tabular-nums dark:text-emerald-400">
              {formatINR(summaryMetrics.successfulAmount)}{' '}
              <span className="text-muted-foreground text-xs font-normal">
                ({summaryMetrics.successfulCount} payments)
              </span>
            </p>
          </div>

          {/* Pending */}
          <div className="border-border/60 bg-card/80 rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Pending
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Clock className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600 tabular-nums dark:text-amber-400">
              {formatINR(summaryMetrics.pendingAmount)}{' '}
              <span className="text-muted-foreground text-xs font-normal">
                ({summaryMetrics.pendingCount})
              </span>
            </p>
          </div>

          {/* Failed */}
          <div className="border-border/60 bg-card/80 rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Failed
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <ShieldAlert className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600 tabular-nums dark:text-rose-400">
              {formatINR(summaryMetrics.failedAmount)}{' '}
              <span className="text-muted-foreground text-xs font-normal">
                ({summaryMetrics.failedCount})
              </span>
            </p>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 2. NEEDS YOUR ATTENTION SECTION */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {summaryMetrics.pendingCount > 0 || summaryMetrics.failedCount > 0 ? (
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
                  {summaryMetrics.pendingCount > 0
                    ? `⚠ ${summaryMetrics.pendingCount} payment${summaryMetrics.pendingCount > 1 ? 's are' : ' is'} currently pending.`
                    : `✕ ${summaryMetrics.failedCount} payment${summaryMetrics.failedCount > 1 ? 's' : ''} failed.`}
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
                  ✓ Payments are looking good
                </p>
                <p className="text-muted-foreground text-[11px]">
                  No payment issues require attention right now.
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
                placeholder="Search payments by business, plan, or method..."
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
                  <SelectItem value="paid" className="text-xs">
                    Paid
                  </SelectItem>
                  <SelectItem value="pending" className="text-xs">
                    Pending
                  </SelectItem>
                  <SelectItem value="failed" className="text-xs">
                    Failed
                  </SelectItem>
                  <SelectItem value="refunded" className="text-xs">
                    Refunded
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

              {/* Method Filter */}
              <Select
                value={methodFilter}
                onValueChange={(val) => {
                  if (val) setMethodFilter(val);
                }}
              >
                <SelectTrigger className="border-border/80 h-9 w-[130px] rounded-xl text-xs">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent className="border-border/80 rounded-xl">
                  <SelectItem value="all" className="text-xs">
                    All Methods
                  </SelectItem>
                  <SelectItem value="razorpay" className="text-xs">
                    Razorpay
                  </SelectItem>
                  <SelectItem value="upi" className="text-xs">
                    UPI
                  </SelectItem>
                  <SelectItem value="card" className="text-xs">
                    Card
                  </SelectItem>
                  <SelectItem value="netbanking" className="text-xs">
                    Net Banking
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
                    val === 'highest' ||
                    val === 'lowest' ||
                    val === 'name'
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
                  <SelectItem value="highest" className="text-xs">
                    Highest Amount
                  </SelectItem>
                  <SelectItem value="lowest" className="text-xs">
                    Lowest Amount
                  </SelectItem>
                  <SelectItem value="oldest" className="text-xs">
                    Oldest First
                  </SelectItem>
                  <SelectItem value="name" className="text-xs">
                    Business Name
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
        {/* 4. PAYMENTS TABLE / CARDS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="border-border/60 bg-card/80 overflow-hidden rounded-[1.35rem] border shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)]">
          {error ? (
            <div className="p-12 text-center">
              <AlertTriangle className="text-destructive mx-auto h-8 w-8" />
              <p className="text-foreground mt-2 text-sm font-semibold">
                Unable to load payments
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
                Loading payments...
              </p>
            </div>
          ) : filteredAndSortedPayments.length === 0 ? (
            <div className="p-12 text-center">
              <CreditCard className="text-muted-foreground/40 mx-auto h-10 w-10" />
              <p className="text-foreground mt-3 text-sm font-semibold">
                {hasActiveFilters ? 'No payments found' : 'No payments yet'}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {hasActiveFilters
                  ? 'Try a different business, status, or date.'
                  : 'Payments from Helpa businesses will appear here.'}
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
                      <th className="px-5 py-3.5">Amount</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Payment Date</th>
                      <th className="px-5 py-3.5">Method</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border/40 divide-y">
                    {paginatedPayments.map((p) => {
                      const businessName =
                        p.account?.name ||
                        tenants.find((t) => t.id === p.account_id)?.name ||
                        'Business Account';
                      const planName = formatPlanName(p.plan_slug);
                      const isGrowth = planName.includes('Growth');

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-muted/20 transition-colors"
                        >
                          {/* Business */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 font-bold text-emerald-600 dark:text-emerald-400">
                                {businessName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-foreground text-xs font-semibold">
                                  {businessName}
                                </div>
                                <div className="text-muted-foreground text-[11px]">
                                  {p.account?.industry || 'Verified Client'}
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

                          {/* Amount */}
                          <td className="px-5 py-3.5">
                            <div className="text-foreground text-xs font-bold tabular-nums">
                              {formatINR(p.amount)}
                            </div>
                            {p.is_setup_fee_included && (
                              <div className="text-muted-foreground text-[10px]">
                                Includes Setup Fee
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-5 py-3.5">
                            {getPaymentStatusBadge(p.status)}
                          </td>

                          {/* Payment Date */}
                          <td className="text-muted-foreground px-5 py-3.5 font-medium">
                            {formatDate(p.created_at)}
                          </td>

                          {/* Payment Method */}
                          <td className="text-muted-foreground px-5 py-3.5">
                            {formatPaymentMethod(p)}
                          </td>

                          {/* Action */}
                          <td className="px-5 py-3.5 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenDetail(p)}
                              className="border-border/80 hover:bg-muted/80 h-7 rounded-lg px-2.5 text-[11px] font-medium"
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="divide-border/40 block divide-y md:hidden">
                {paginatedPayments.map((p) => {
                  const businessName =
                    p.account?.name ||
                    tenants.find((t) => t.id === p.account_id)?.name ||
                    'Business Account';
                  const planName = formatPlanName(p.plan_slug);

                  return (
                    <div key={p.id} className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 font-bold text-emerald-600 dark:text-emerald-400">
                            {businessName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-foreground text-xs font-semibold">
                              {businessName}
                            </p>
                            <p className="text-muted-foreground text-[11px]">
                              {planName}
                            </p>
                          </div>
                        </div>
                        {getPaymentStatusBadge(p.status)}
                      </div>

                      <div className="bg-muted/20 grid grid-cols-2 gap-2 rounded-xl p-2.5 text-[11px]">
                        <div>
                          <span className="text-muted-foreground">Amount:</span>{' '}
                          <span className="text-foreground font-bold tabular-nums">
                            {formatINR(p.amount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Method:</span>{' '}
                          <span className="text-foreground font-medium">
                            {formatPaymentMethod(p)}
                          </span>
                        </div>
                        <div className="text-muted-foreground col-span-2">
                          Date: {formatDate(p.created_at)}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenDetail(p)}
                        className="h-7 w-full rounded-lg text-xs font-medium"
                      >
                        View Payment Details
                      </Button>
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
                      filteredAndSortedPayments.length
                    )}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-foreground">
                    {Math.min(
                      currentPage * pageSize,
                      filteredAndSortedPayments.length
                    )}
                  </strong>{' '}
                  of{' '}
                  <strong className="text-foreground">
                    {filteredAndSortedPayments.length}
                  </strong>{' '}
                  payments
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
      {/* 6. VIEW PAYMENT DETAIL MODAL */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="border-border/60 bg-card rounded-2xl border p-6 shadow-xl sm:max-w-lg">
          {viewingPayment && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <DialogTitle className="text-foreground text-lg font-bold">
                      Payment Details
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground mt-0.5 text-xs">
                      {viewingPayment.account?.name ||
                        tenants.find((t) => t.id === viewingPayment.account_id)
                          ?.name ||
                        'Business Account'}
                    </DialogDescription>
                  </div>
                  {getPaymentStatusBadge(viewingPayment.status)}
                </div>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* Hero Amount Card */}
                <div className="space-y-1 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
                  <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Amount Received
                  </span>
                  <p className="text-3xl font-extrabold tracking-tight text-emerald-600 tabular-nums dark:text-emerald-400">
                    {formatINR(viewingPayment.amount)}
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    {viewingPayment.is_setup_fee_included
                      ? 'Package Setup & First Month Subscription'
                      : 'Monthly Recurring Subscription'}
                  </p>
                </div>

                {/* Core Payment Attributes */}
                <div className="border-border/60 bg-muted/20 text-muted-foreground grid grid-cols-2 gap-3 rounded-xl border p-3.5">
                  <div>
                    <span className="text-[11px]">Plan Purchased:</span>
                    <p className="text-foreground font-semibold">
                      {formatPlanName(viewingPayment.plan_slug)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px]">Payment Method:</span>
                    <p className="text-foreground font-semibold">
                      {formatPaymentMethod(viewingPayment)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px]">Payment Date:</span>
                    <p className="text-foreground font-medium">
                      {formatDate(viewingPayment.created_at)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px]">Billing Currency:</span>
                    <p className="text-foreground font-medium">
                      {viewingPayment.currency || 'INR (₹)'}
                    </p>
                  </div>
                </div>

                {/* Advanced Support Reference (Compact) */}
                <div className="border-border/60 bg-muted/30 space-y-2 rounded-xl border p-3">
                  <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase">
                    <Calendar className="h-3 w-3" />
                    Gateway & Support Reference
                  </div>

                  <div className="space-y-1.5 pt-0.5">
                    {viewingPayment.razorpay_payment_id && (
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-muted-foreground">
                          Payment ID:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <code className="text-foreground bg-background/80 rounded px-1.5 py-0.5 font-mono text-[10px]">
                            {viewingPayment.razorpay_payment_id}
                          </code>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(
                                viewingPayment.razorpay_payment_id!,
                                'Payment ID'
                              )
                            }
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {copiedField === 'Payment ID' ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {viewingPayment.razorpay_order_id && (
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-muted-foreground">Order ID:</span>
                        <div className="flex items-center gap-1.5">
                          <code className="text-foreground bg-background/80 rounded px-1.5 py-0.5 font-mono text-[10px]">
                            {viewingPayment.razorpay_order_id}
                          </code>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(
                                viewingPayment.razorpay_order_id!,
                                'Order ID'
                              )
                            }
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {copiedField === 'Order ID' ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
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

                <div className="flex items-center gap-2">
                  <Link
                    href="/admin/subscriptions"
                    className="border-border hover:bg-muted inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs font-medium transition-colors"
                  >
                    Subscriptions
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
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
    </AdminNav>
  );
}
