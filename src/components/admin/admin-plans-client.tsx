'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Loader2,
  Check,
  Building2,
  CreditCard,
  Sparkles,
  AlertTriangle,
  MoreVertical,
  Edit2,
  PowerOff,
  Power,
  Trash2,
  Layers,
  Zap,
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
  DropdownMenuSeparator,
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
import { Checkbox } from '@/components/ui/checkbox';
import { AdminNav } from './admin-nav';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

interface Plan {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  monthly_price?: number;
  monthlyPrice?: number;
  yearly_price?: number;
  yearlyPrice?: number;
  setup_fee?: number;
  setupFee?: number;
  currency?: string;
  is_recommended?: boolean;
  isRecommended?: boolean;
  is_active?: boolean;
  isActive?: boolean;
  display_order?: number;
  displayOrder?: number;
  max_users?: number;
  max_contacts?: number;
  max_whatsapp_numbers?: number;
  max_ai_requests?: number;
  features?: string | string[];
  usageLimits?: {
    aiMessages?: number;
    whatsappMessages?: number;
    teamMembers?: number;
    contacts?: number;
    automations?: number;
    knowledgeBaseMb?: number;
    appointments?: number;
  };
}

interface TenantItem {
  id: string;
  name: string;
  subscription?: {
    status?: string;
    plan?: {
      id?: string;
      name?: string;
    };
  } | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HUMAN-FRIENDLY FEATURE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const AVAILABLE_FEATURE_OPTIONS: Array<{
  id: string;
  label: string;
  description: string;
  group: 'core' | 'ai' | 'automation';
}> = [
  {
    id: 'core.inbox',
    label: 'Shared Team Inbox',
    description: 'Multi-agent WhatsApp conversation center',
    group: 'core',
  },
  {
    id: 'core.contacts',
    label: 'Contact Management',
    description: 'Patient, student, and customer directory',
    group: 'core',
  },
  {
    id: 'core.ai',
    label: 'AI Receptionist',
    description: '24/7 intelligent automated replies',
    group: 'ai',
  },
  {
    id: 'core.knowledge_base',
    label: 'Business Knowledge Base',
    description: 'Custom FAQs, pricing & operating hours',
    group: 'ai',
  },
  {
    id: 'core.campaigns',
    label: 'WhatsApp Campaigns',
    description: 'Broadcast reminders, announcements & offers',
    group: 'core',
  },
  {
    id: 'core.automations',
    label: 'Workflow Automations',
    description: 'Auto-reminders, follow-ups & triggers',
    group: 'automation',
  },
  {
    id: 'core.ai_copilot',
    label: 'AI Copilot & Smart Suggestions',
    description: 'Live drafted responses & human handoff',
    group: 'ai',
  },
  {
    id: 'core.analytics',
    label: 'Business Analytics & Reports',
    description: 'Conversation metrics & appointment tracking',
    group: 'core',
  },
  {
    id: 'core.custom_models',
    label: 'Custom AI Models & Routing',
    description: 'Specialized LLMs and temperature controls',
    group: 'ai',
  },
  {
    id: 'core.dedicated_support',
    label: 'Priority Dedicated Support',
    description: 'Direct SLA assistance and onboarding help',
    group: 'core',
  },
];

function formatFeatureLabel(featureKey: string): string {
  const matched = AVAILABLE_FEATURE_OPTIONS.find((f) => f.id === featureKey);
  if (matched) return matched.label;

  // Pretty print raw keys like "health.patients" -> "Patient Records"
  return featureKey
    .replace(/^(core|health|coaching|tutor|salon|realestate)\./, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AdminPlansClient() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Plan Edit / Create Modal State
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    monthly_price: 3499,
    yearly_price: 34990,
    setup_fee: 7999,
    is_recommended: false,
    is_active: true,
    max_users: 5,
    max_contacts: 1500,
    max_whatsapp_numbers: 1,
    max_ai_requests: 1500,
    features: [] as string[],
  });
  const [submittingPlan, setSubmittingPlan] = useState(false);

  // Confirmation Modal for Disabling/Deleting
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [actionPlan, setActionPlan] = useState<Plan | null>(null);
  const [actionType, setActionType] = useState<
    'toggle_active' | 'delete' | null
  >(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, tRes] = await Promise.all([
        fetch('/api/admin/plans'),
        fetch('/api/admin/tenants'),
      ]);

      if (!pRes.ok) {
        throw new Error('Failed to load pricing plans');
      }

      const pData = await pRes.json();
      setPlans(Array.isArray(pData) ? pData : []);

      if (tRes.ok) {
        const tData = await tRes.json();
        setTenants(Array.isArray(tData) ? tData : []);
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Something went wrong while loading your pricing plans.';
      setError(msg);
      toast.error('Could not load plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ═══════════════════════════════════════════════════════════════════════════
  // BUSINESS COUNT AGGREGATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const businessesByPlan = useMemo(() => {
    const counts: Record<string, number> = {};

    tenants.forEach((t) => {
      const planName = (t.subscription?.plan?.name || '').toLowerCase();
      const planId = (t.subscription?.plan?.id || '').toLowerCase();

      if (planName.includes('starter') || planId.includes('starter')) {
        counts['starter'] = (counts['starter'] || 0) + 1;
      } else if (planName.includes('growth') || planId.includes('growth')) {
        counts['growth'] = (counts['growth'] || 0) + 1;
      } else if (
        planName.includes('pro') ||
        planName.includes('business') ||
        planId.includes('pro')
      ) {
        counts['pro'] = (counts['pro'] || 0) + 1;
      } else {
        counts['other'] = (counts['other'] || 0) + 1;
      }
    });

    return counts;
  }, [tenants]);

  function getPlanBusinessCount(plan: Plan): number {
    const key = (plan.slug || plan.name || plan.id).toLowerCase();
    if (key.includes('starter')) return businessesByPlan['starter'] || 0;
    if (key.includes('growth')) return businessesByPlan['growth'] || 0;
    if (key.includes('pro') || key.includes('business'))
      return businessesByPlan['pro'] || 0;
    return 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORM HANDLERS (Create / Edit Plan)
  // ═══════════════════════════════════════════════════════════════════════════
  function handleOpenCreatePlan() {
    setEditingPlan(null);
    setPlanForm({
      name: '',
      monthly_price: 4999,
      yearly_price: 49990,
      setup_fee: 11999,
      is_recommended: false,
      is_active: true,
      max_users: 10,
      max_contacts: 5000,
      max_whatsapp_numbers: 1,
      max_ai_requests: 5000,
      features: [
        'core.inbox',
        'core.contacts',
        'core.ai',
        'core.knowledge_base',
        'core.campaigns',
        'core.automations',
        'core.ai_copilot',
      ],
    });
    setPlanDialogOpen(true);
  }

  function handleOpenEditPlan(plan: Plan) {
    setEditingPlan(plan);

    let feats: string[] = [];
    if (Array.isArray(plan.features)) {
      feats = plan.features;
    } else if (typeof plan.features === 'string') {
      try {
        feats = JSON.parse(plan.features);
      } catch {
        feats = plan.features.split(',').map((f) => f.trim());
      }
    }

    const isRecommended = Boolean(
      plan.is_recommended ??
      plan.isRecommended ??
      plan.name.toLowerCase().includes('growth')
    );

    const isActive = Boolean(
      plan.is_active !== undefined
        ? plan.is_active
        : plan.isActive !== undefined
          ? plan.isActive
          : true
    );

    setPlanForm({
      name: plan.name.replace('⭐', '').trim(),
      monthly_price: Number(plan.monthly_price ?? plan.monthlyPrice ?? 0),
      yearly_price: Number(plan.yearly_price ?? plan.yearlyPrice ?? 0),
      setup_fee: Number(plan.setup_fee ?? plan.setupFee ?? 0),
      is_recommended: isRecommended,
      is_active: isActive,
      max_users: Number(plan.max_users ?? plan.usageLimits?.teamMembers ?? 5),
      max_contacts: Number(
        plan.max_contacts ?? plan.usageLimits?.contacts ?? 1500
      ),
      max_whatsapp_numbers: Number(plan.max_whatsapp_numbers ?? 1),
      max_ai_requests: Number(
        plan.max_ai_requests ?? plan.usageLimits?.aiMessages ?? 1500
      ),
      features: feats,
    });

    setPlanDialogOpen(true);
  }

  async function handlePlanSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!planForm.name.trim()) {
      toast.error('Plan name is required');
      return;
    }

    setSubmittingPlan(true);
    try {
      const method = editingPlan ? 'PATCH' : 'POST';
      const body = {
        name: planForm.name.trim(),
        monthly_price: Number(planForm.monthly_price),
        yearly_price: Number(planForm.yearly_price),
        setup_fee: Number(planForm.setup_fee),
        is_recommended: Boolean(planForm.is_recommended),
        is_active: Boolean(planForm.is_active),
        max_users: Number(planForm.max_users),
        max_contacts: Number(planForm.max_contacts),
        max_whatsapp_numbers: Number(planForm.max_whatsapp_numbers),
        max_ai_requests: Number(planForm.max_ai_requests),
        features: planForm.features,
        ...(editingPlan ? { id: editingPlan.id } : {}),
      };

      const response = await fetch('/api/admin/plans', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success(
          editingPlan
            ? 'Plan updated successfully'
            : 'Plan created successfully'
        );
        setPlanDialogOpen(false);
        loadData();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save plan');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error saving plan changes');
    } finally {
      setSubmittingPlan(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOGGLE ACTIVE / DELETE ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  function handleConfirmAction(plan: Plan, type: 'toggle_active' | 'delete') {
    setActionPlan(plan);
    setActionType(type);
    setConfirmDialogOpen(true);
  }

  async function executeConfirmedAction() {
    if (!actionPlan || !actionType) return;

    setSubmittingAction(true);
    try {
      if (actionType === 'toggle_active') {
        const currentActive = Boolean(
          actionPlan.is_active !== undefined
            ? actionPlan.is_active
            : actionPlan.isActive !== undefined
              ? actionPlan.isActive
              : true
        );
        const nextActive = !currentActive;

        const res = await fetch('/api/admin/plans', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: actionPlan.id,
            is_active: nextActive,
          }),
        });

        if (res.ok) {
          toast.success(
            nextActive ? 'Plan enabled successfully' : 'Plan disabled'
          );
          setConfirmDialogOpen(false);
          loadData();
        } else {
          const d = await res.json();
          toast.error(d.error || 'Failed to update plan status');
        }
      } else if (actionType === 'delete') {
        const res = await fetch(`/api/admin/plans?id=${actionPlan.id}`, {
          method: 'DELETE',
        });

        if (res.ok) {
          toast.success('Plan deleted successfully');
          setConfirmDialogOpen(false);
          loadData();
        } else {
          const d = await res.json();
          toast.error(d.error || 'Failed to delete plan');
        }
      }
    } catch {
      toast.error('Action failed');
    } finally {
      setSubmittingAction(false);
    }
  }

  const toggleFeatureCheckbox = (featureId: string) => {
    setPlanForm((prev) => {
      const exists = prev.features.includes(featureId);
      return {
        ...prev,
        features: exists
          ? prev.features.filter((f) => f !== featureId)
          : [...prev.features, featureId],
      };
    });
  };

  return (
    <AdminNav onRefresh={loadData} loading={loading}>
      <div className="space-y-8">
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 1. PAGE HEADER */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-foreground text-lg font-bold tracking-tight sm:text-xl">
              Plans & Pricing
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">
              Manage the plans available to businesses using Helpa.
            </p>
          </div>

          <Button
            onClick={handleOpenCreatePlan}
            size="sm"
            className="h-9 gap-1.5 rounded-xl px-4 text-xs font-semibold shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Create Plan
          </Button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 2. TOP ACTIVE SUMMARY BAR */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="border-border/60 bg-card/80 rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Total Businesses
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Building2 className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-foreground mt-2 text-2xl font-bold tracking-tight tabular-nums">
              {tenants.length}
            </p>
          </div>

          <div className="border-border/60 bg-card/80 rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Starter Tier
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Layers className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-foreground mt-2 text-2xl font-bold tracking-tight tabular-nums">
              {businessesByPlan['starter'] || 0}{' '}
              <span className="text-muted-foreground text-xs font-normal">
                businesses
              </span>
            </p>
          </div>

          <div className="border-border/60 bg-card/80 rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Growth Tier ⭐
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 tabular-nums dark:text-emerald-400">
              {businessesByPlan['growth'] || 0}{' '}
              <span className="text-muted-foreground text-xs font-normal">
                businesses
              </span>
            </p>
          </div>

          <div className="border-border/60 bg-card/80 rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Pro Tier
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Zap className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-foreground mt-2 text-2xl font-bold tracking-tight tabular-nums">
              {businessesByPlan['pro'] || 0}{' '}
              <span className="text-muted-foreground text-xs font-normal">
                businesses
              </span>
            </p>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 3. PRICING CARDS GRID */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {error ? (
          <div className="border-border/60 bg-card/80 rounded-2xl border p-12 text-center shadow-xs">
            <AlertTriangle className="text-destructive mx-auto h-8 w-8" />
            <p className="text-foreground mt-3 text-sm font-semibold">
              Unable to load plans
            </p>
            <p className="text-muted-foreground mt-1 text-xs">{error}</p>
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="border-border/60 bg-card/80 h-96 animate-pulse rounded-[1.5rem] border p-6"
              />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="border-border/60 bg-card/80 rounded-[1.5rem] border p-12 text-center shadow-xs">
            <CreditCard className="text-muted-foreground/40 mx-auto h-10 w-10" />
            <p className="text-foreground mt-3 text-sm font-semibold">
              No plans yet
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Create your first pricing plan to start offering Helpa.
            </p>
            <Button
              onClick={handleOpenCreatePlan}
              size="sm"
              className="mt-4 h-8 rounded-xl text-xs"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create Plan
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const monthlyPrice = Number(
                plan.monthly_price ?? plan.monthlyPrice ?? 0
              );
              const setupFee = Number(plan.setup_fee ?? plan.setupFee ?? 0);
              const isGrowth =
                plan.name.toLowerCase().includes('growth') ||
                Boolean(plan.is_recommended ?? plan.isRecommended);
              const isActive = Boolean(
                plan.is_active !== undefined
                  ? plan.is_active
                  : plan.isActive !== undefined
                    ? plan.isActive
                    : true
              );
              const businessCount = getPlanBusinessCount(plan);

              let featsArray: string[] = [];
              if (Array.isArray(plan.features)) {
                featsArray = plan.features;
              } else if (typeof plan.features === 'string') {
                try {
                  featsArray = JSON.parse(plan.features);
                } catch {
                  featsArray = plan.features.split(',').map((f) => f.trim());
                }
              }

              // Extract key highlights
              const maxUsers = Number(
                plan.max_users ?? plan.usageLimits?.teamMembers ?? 5
              );
              const maxContacts = Number(
                plan.max_contacts ?? plan.usageLimits?.contacts ?? 1500
              );
              const maxAi = Number(
                plan.max_ai_requests ?? plan.usageLimits?.aiMessages ?? 1500
              );

              return (
                <div
                  key={plan.id}
                  className={cn(
                    'relative flex flex-col justify-between overflow-hidden rounded-[1.5rem] border p-6 transition-all duration-200',
                    isGrowth
                      ? 'bg-card/95 border-emerald-500/40 shadow-[0_20px_50px_-25px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/20'
                      : 'border-border/60 bg-card/80 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)]'
                  )}
                >
                  {/* Recommended Badge Ribbon */}
                  {isGrowth && (
                    <div className="absolute top-4 right-4">
                      <Badge className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-[10px] font-bold tracking-wide text-emerald-600 uppercase dark:text-emerald-400">
                        <Sparkles className="h-3 w-3" /> Recommended
                      </Badge>
                    </div>
                  )}

                  <div>
                    {/* Plan Name & Status */}
                    <div className="flex items-center gap-2">
                      <h3 className="text-foreground text-lg font-bold">
                        {plan.name.replace('⭐', '').trim()}
                        {isGrowth && <span className="ml-1 text-sm">⭐</span>}
                      </h3>
                      {!isGrowth && (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              isActive
                                ? 'bg-emerald-500'
                                : 'bg-muted-foreground'
                            )}
                          />
                          {isActive ? 'Active' : 'Disabled'}
                        </span>
                      )}
                    </div>

                    {/* Pricing Display */}
                    <div className="mt-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-foreground text-3xl font-extrabold tracking-tight tabular-nums">
                          ₹{monthlyPrice.toLocaleString('en-IN')}
                        </span>
                        <span className="text-muted-foreground text-xs font-medium">
                          / month
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">
                          ₹{setupFee.toLocaleString('en-IN')} setup fee
                        </span>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="text-foreground font-semibold">
                          {businessCount}{' '}
                          {businessCount === 1 ? 'business' : 'businesses'}
                        </span>
                      </div>
                    </div>

                    {!isActive && (
                      <p className="mt-3 rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-600 dark:text-amber-400">
                        This plan is currently unavailable for new businesses.
                      </p>
                    )}

                    {/* Quota Highlights */}
                    <div className="border-border/50 bg-muted/20 mt-5 grid grid-cols-3 gap-2 rounded-xl border p-3 text-center text-xs">
                      <div>
                        <span className="text-muted-foreground text-[10px] font-medium uppercase">
                          AI Calls
                        </span>
                        <p className="text-foreground font-bold">
                          {maxAi.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[10px] font-medium uppercase">
                          Contacts
                        </span>
                        <p className="text-foreground font-bold">
                          {maxContacts.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[10px] font-medium uppercase">
                          Members
                        </span>
                        <p className="text-foreground font-bold">{maxUsers}</p>
                      </div>
                    </div>

                    {/* Features List */}
                    <div className="mt-5 space-y-2">
                      <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                        What&apos;s Included
                      </span>
                      <div className="space-y-1.5 pt-1">
                        {featsArray.slice(0, 7).map((feat, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-xs"
                          >
                            <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              <Check className="h-2.5 w-2.5 stroke-[3]" />
                            </div>
                            <span className="text-foreground text-[11px] font-medium">
                              {formatFeatureLabel(feat)}
                            </span>
                          </div>
                        ))}
                        {featsArray.length > 7 && (
                          <p className="text-muted-foreground pt-1 text-[11px] italic">
                            + {featsArray.length - 7} more specialized tools
                          </p>
                        )}
                        {featsArray.length === 0 && (
                          <p className="text-muted-foreground text-xs">
                            Standard core capabilities
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="border-border/40 mt-6 flex items-center justify-between gap-2 border-t pt-4">
                    <Button
                      size="sm"
                      variant={isGrowth ? 'default' : 'outline'}
                      onClick={() => handleOpenEditPlan(plan)}
                      className={cn(
                        'h-8 flex-1 rounded-xl text-xs font-semibold',
                        isGrowth &&
                          'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600'
                      )}
                    >
                      <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                      Edit Plan
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger className="border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/80 flex h-8 w-8 items-center justify-center rounded-xl border p-0 transition-colors focus:outline-none">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-48 rounded-xl"
                      >
                        <DropdownMenuItem
                          onClick={() => handleOpenEditPlan(plan)}
                          className="text-xs"
                        >
                          <Edit2 className="text-muted-foreground mr-2 h-3.5 w-3.5" />
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleConfirmAction(plan, 'toggle_active')
                          }
                          className="text-xs"
                        >
                          {isActive ? (
                            <>
                              <PowerOff className="mr-2 h-3.5 w-3.5 text-amber-500" />
                              Disable Plan
                            </>
                          ) : (
                            <>
                              <Power className="mr-2 h-3.5 w-3.5 text-emerald-500" />
                              Enable Plan
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleConfirmAction(plan, 'delete')}
                          className="text-xs text-rose-600 dark:text-rose-400"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Delete Plan
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 4. PLAN COMPARISON MATRIX */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="border-border/60 bg-card/80 overflow-hidden rounded-[1.5rem] border p-6 shadow-xs">
          <div className="border-border/60 border-b pb-3">
            <h3 className="text-foreground text-sm font-semibold">
              Plan Comparison Matrix
            </h3>
            <p className="text-muted-foreground text-xs">
              Quick side-by-side feature access across packages.
            </p>
          </div>

          <div className="overflow-x-auto pt-4">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground border-border/40 border-b text-[11px] font-semibold">
                <tr>
                  <th className="pr-4 pb-3">Feature Capability</th>
                  <th className="pb-3 text-center">Starter</th>
                  <th className="pb-3 text-center text-emerald-600 dark:text-emerald-400">
                    Growth ⭐
                  </th>
                  <th className="pb-3 text-center">Pro</th>
                </tr>
              </thead>
              <tbody className="divide-border/40 divide-y">
                <tr>
                  <td className="text-foreground py-3 font-medium">
                    Shared WhatsApp Inbox
                  </td>
                  <td className="py-3 text-center text-emerald-600">✓</td>
                  <td className="py-3 text-center font-bold text-emerald-600">
                    ✓
                  </td>
                  <td className="py-3 text-center text-emerald-600">✓</td>
                </tr>
                <tr>
                  <td className="text-foreground py-3 font-medium">
                    AI Automated Receptionist
                  </td>
                  <td className="py-3 text-center text-emerald-600">✓</td>
                  <td className="py-3 text-center font-bold text-emerald-600">
                    ✓
                  </td>
                  <td className="py-3 text-center text-emerald-600">✓</td>
                </tr>
                <tr>
                  <td className="text-foreground py-3 font-medium">
                    WhatsApp Campaigns & Broadcasts
                  </td>
                  <td className="py-3 text-center text-emerald-600">✓</td>
                  <td className="py-3 text-center font-bold text-emerald-600">
                    ✓
                  </td>
                  <td className="py-3 text-center text-emerald-600">✓</td>
                </tr>
                <tr>
                  <td className="text-foreground py-3 font-medium">
                    AI Copilot & Smart Suggestions
                  </td>
                  <td className="text-muted-foreground py-3 text-center">—</td>
                  <td className="py-3 text-center font-bold text-emerald-600">
                    ✓
                  </td>
                  <td className="py-3 text-center text-emerald-600">✓</td>
                </tr>
                <tr>
                  <td className="text-foreground py-3 font-medium">
                    Workflow Automations & Reminders
                  </td>
                  <td className="text-muted-foreground py-3 text-center">—</td>
                  <td className="py-3 text-center font-bold text-emerald-600">
                    ✓
                  </td>
                  <td className="py-3 text-center text-emerald-600">✓</td>
                </tr>
                <tr>
                  <td className="text-foreground py-3 font-medium">
                    Custom AI Models & Dedicated Support
                  </td>
                  <td className="text-muted-foreground py-3 text-center">—</td>
                  <td className="text-muted-foreground py-3 text-center">—</td>
                  <td className="py-3 text-center font-bold text-emerald-600">
                    ✓
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 5. CREATE / EDIT PLAN MODAL */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="border-border/60 bg-card max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base font-semibold">
              {editingPlan ? 'Edit Pricing Plan' : 'Create Pricing Plan'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Configure commercial pricing, quotas, and feature capabilities for
              this tier.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePlanSubmit} className="space-y-4 pt-2">
            {/* Plan Name & Recommendation */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-foreground text-xs font-medium">
                  Plan Name
                </Label>
                <Input
                  value={planForm.name}
                  onChange={(e) =>
                    setPlanForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Starter, Growth, Pro"
                  className="border-border/80 h-9 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground text-xs font-medium">
                  Status
                </Label>
                <Select
                  value={planForm.is_active ? 'active' : 'disabled'}
                  onValueChange={(val) =>
                    setPlanForm((prev) => ({
                      ...prev,
                      is_active: val === 'active',
                    }))
                  }
                >
                  <SelectTrigger className="border-border/80 h-9 rounded-xl text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="border-border/80 rounded-xl">
                    <SelectItem value="active" className="text-xs">
                      Active (Available)
                    </SelectItem>
                    <SelectItem value="disabled" className="text-xs">
                      Disabled (Hidden from new businesses)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pricing Details */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground text-xs font-medium">
                  Monthly Price (₹)
                </Label>
                <Input
                  type="number"
                  value={planForm.monthly_price}
                  onChange={(e) =>
                    setPlanForm((prev) => ({
                      ...prev,
                      monthly_price: Number(e.target.value),
                    }))
                  }
                  className="border-border/80 h-9 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground text-xs font-medium">
                  Setup Fee (₹)
                </Label>
                <Input
                  type="number"
                  value={planForm.setup_fee}
                  onChange={(e) =>
                    setPlanForm((prev) => ({
                      ...prev,
                      setup_fee: Number(e.target.value),
                    }))
                  }
                  className="border-border/80 h-9 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground text-xs font-medium">
                  Yearly Price (₹)
                </Label>
                <Input
                  type="number"
                  value={planForm.yearly_price}
                  onChange={(e) =>
                    setPlanForm((prev) => ({
                      ...prev,
                      yearly_price: Number(e.target.value),
                    }))
                  }
                  className="border-border/80 h-9 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Recommended Checkbox */}
            <div className="border-border/50 bg-muted/20 flex items-center space-x-2 rounded-xl border p-3">
              <Checkbox
                id="is_recommended"
                checked={planForm.is_recommended}
                onCheckedChange={(checked) =>
                  setPlanForm((prev) => ({
                    ...prev,
                    is_recommended: Boolean(checked),
                  }))
                }
              />
              <label
                htmlFor="is_recommended"
                className="text-foreground cursor-pointer text-xs leading-none font-medium"
              >
                Highlight as Recommended Tier (⭐)
              </label>
            </div>

            {/* Usage Quotas */}
            <div className="space-y-2 pt-1">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Monthly Usage Quotas
              </span>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-[11px]">
                    AI Messages / mo
                  </Label>
                  <Input
                    type="number"
                    value={planForm.max_ai_requests}
                    onChange={(e) =>
                      setPlanForm((prev) => ({
                        ...prev,
                        max_ai_requests: Number(e.target.value),
                      }))
                    }
                    className="border-border/80 h-8 rounded-lg text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-muted-foreground text-[11px]">
                    Max Contacts
                  </Label>
                  <Input
                    type="number"
                    value={planForm.max_contacts}
                    onChange={(e) =>
                      setPlanForm((prev) => ({
                        ...prev,
                        max_contacts: Number(e.target.value),
                      }))
                    }
                    className="border-border/80 h-8 rounded-lg text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-muted-foreground text-[11px]">
                    Team Members
                  </Label>
                  <Input
                    type="number"
                    value={planForm.max_users}
                    onChange={(e) =>
                      setPlanForm((prev) => ({
                        ...prev,
                        max_users: Number(e.target.value),
                      }))
                    }
                    className="border-border/80 h-8 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Feature Access Toggles */}
            <div className="space-y-2 pt-2">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Included Features & Capabilities
              </span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {AVAILABLE_FEATURE_OPTIONS.map((feat) => {
                  const isChecked = planForm.features.includes(feat.id);
                  return (
                    <div
                      key={feat.id}
                      onClick={() => toggleFeatureCheckbox(feat.id)}
                      className={cn(
                        'flex cursor-pointer items-start space-x-2 rounded-xl border p-2.5 transition-colors',
                        isChecked
                          ? 'border-emerald-500/40 bg-emerald-500/5'
                          : 'border-border/60 hover:bg-muted/30'
                      )}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleFeatureCheckbox(feat.id)}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <p className="text-foreground text-xs leading-none font-medium">
                          {feat.label}
                        </p>
                        <p className="text-muted-foreground text-[10px] leading-tight">
                          {feat.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPlanDialogOpen(false)}
                className="h-8 rounded-lg text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submittingPlan}
                className="h-8 rounded-lg text-xs"
              >
                {submittingPlan && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                {editingPlan ? 'Save Changes' : 'Create Plan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 6. CONFIRMATION DIALOG (Disable / Delete) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="border-border/60 bg-card rounded-2xl border p-6 shadow-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base font-semibold">
              {actionType === 'delete'
                ? `Delete ${actionPlan?.name}?`
                : `${actionPlan?.is_active ? 'Disable' : 'Enable'} ${actionPlan?.name}?`}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              {actionType === 'delete'
                ? 'Are you sure you want to delete this plan? This action cannot be undone if no active subscribers are using it.'
                : actionPlan?.is_active
                  ? 'New businesses will no longer be able to select this plan. Existing subscribers will keep their current terms.'
                  : 'This plan will be made available for new businesses joining Helpa.'}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmDialogOpen(false)}
              className="h-8 rounded-lg text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submittingAction}
              onClick={executeConfirmedAction}
              className={cn(
                'h-8 rounded-lg text-xs',
                actionType === 'delete' &&
                  'bg-rose-600 text-white hover:bg-rose-700'
              )}
            >
              {submittingAction && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              {actionType === 'delete'
                ? 'Delete Plan'
                : actionPlan?.is_active
                  ? 'Disable Plan'
                  : 'Enable Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminNav>
  );
}
