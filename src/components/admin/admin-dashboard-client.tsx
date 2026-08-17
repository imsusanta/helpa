'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Shield,
  Users,
  Layers,
  Activity,
  Plus,
  Search,
  Edit,
  Trash2,
  Loader2,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

import { AdminAiInfrastructure } from './admin-ai-infrastructure';

interface Metrics {
  totalAccounts: number;
  totalContacts: number;
  totalUsers: number;
  subscriptions: {
    active: number;
    trial: number;
    expired: number;
    total: number;
    planBreakdown: Record<string, number>;
  };
  usage: {
    month: string;
    aiRequests: number;
    whatsappMessages: number;
  };
}

interface Tenant {
  id: string;
  name: string;
  created_at: string;
  owner: {
    full_name: string | null;
    email: string;
  } | null;
  membersCount: number;
  contactsCount: number;
  subscription: {
    status: 'trial' | 'active' | 'expired' | 'cancelled';
    end_date: string;
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
  monthly_price: number;
  yearly_price: number;
  max_users: number;
  max_contacts: number;
  max_whatsapp_numbers: number;
  max_ai_requests: number;
  features: string | string[];
}

const DEFAULT_METRICS: Metrics = {
  totalAccounts: 1,
  totalContacts: 0,
  totalUsers: 1,
  subscriptions: {
    active: 1,
    trial: 0,
    expired: 0,
    total: 1,
    planBreakdown: { Standard: 1 },
  },
  usage: {
    month: new Date().toISOString().substring(0, 7) + '-01',
    aiRequests: 0,
    whatsappMessages: 0,
  },
};

export function AdminDashboardClient() {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'tenants' | 'plans' | 'ai' | 'landing'
  >('overview');
  const [loading, setLoading] = useState(true);

  // States
  const [metrics, setMetrics] = useState<Metrics>(DEFAULT_METRICS);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [landingSettings, setLandingSettings] = useState({
    landing_hero_video_url: 'https://www.youtube.com/embed/gFx-NjTw3sM',
    landing_action_video_url: 'https://www.youtube.com/embed/gFx-NjTw3sM',
  });
  const [submittingSettings, setSubmittingSettings] = useState(false);

  // Subscription Edit Dialog State
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [editPlanId, setEditPlanId] = useState('');
  const [editStatus, setEditStatus] = useState<
    'trial' | 'active' | 'expired' | 'cancelled'
  >('trial');
  const [editEndDate, setEditEndDate] = useState('');
  const [submittingSub, setSubmittingSub] = useState(false);

  // Plan Edit Dialog State
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    monthly_price: 0,
    yearly_price: 0,
    max_users: 5,
    max_contacts: 500,
    max_whatsapp_numbers: 1,
    max_ai_requests: 100,
    features: [] as string[],
  });
  const [submittingPlan, setSubmittingPlan] = useState(false);

  // Load SaaS Data
  async function loadData() {
    setLoading(true);
    try {
      const [mRes, tRes, pRes, sRes] = await Promise.all([
        fetch('/api/admin/metrics'),
        fetch('/api/admin/tenants'),
        fetch('/api/admin/plans'),
        fetch('/api/admin/settings'),
      ]);

      if (mRes.ok) {
        const mData = await mRes.json();
        setMetrics(mData);
      }
      if (tRes.ok) {
        const tData = await tRes.json();
        setTenants(
          Array.isArray(tData) && tData.length > 0
            ? tData
            : [
                {
                  id: 'default_account',
                  name: 'Helpa Health Clinic',
                  created_at: new Date().toISOString(),
                  owner: null,
                  membersCount: 1,
                  contactsCount: 0,
                  subscription: {
                    status: 'active',
                    end_date: null,
                    plan: {
                      id: 'plan_growth',
                      name: 'Growth Plan',
                    },
                  },
                  usage: {
                    aiRequests: 0,
                    whatsappMessages: 0,
                  },
                },
              ]
        );
      }
      if (pRes.ok) {
        const pData = await pRes.json();
        setPlans(pData);
      }
      if (sRes.ok) {
        const settings = await sRes.json();
        setLandingSettings((prev) => ({
          ...prev,
          landing_hero_video_url:
            settings.landing_hero_video_url || prev.landing_hero_video_url,
          landing_action_video_url:
            settings.landing_action_video_url || prev.landing_action_video_url,
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Save Landing Page Settings
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingSettings(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(landingSettings),
      });

      if (response.ok) {
        toast.success('Landing page video links updated successfully');
        loadData();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update landing settings');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error saving landing settings');
    } finally {
      setSubmittingSettings(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Manage Subscription Submit
  async function handleSubSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTenant) {
      toast.error('No tenant selected');
      return;
    }

    const planIdToSave = editPlanId || plans[0]?.id || 'plan_growth';
    const endDateToSave =
      editEndDate ||
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

    setSubmittingSub(true);
    try {
      const response = await fetch('/api/admin/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedTenant.id,
          planId: planIdToSave,
          status: editStatus || 'trial',
          endDate: new Date(endDateToSave).toISOString(),
        }),
      });

      if (response.ok) {
        toast.success('Subscription updated successfully');
        setSubDialogOpen(false);
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

  // Open Edit Subscription Modal
  function handleOpenSubDialog(tenant: Tenant) {
    setSelectedTenant(tenant);
    const defaultPlanId =
      tenant.subscription?.plan?.id || plans[0]?.id || 'plan_growth';
    setEditPlanId(defaultPlanId);
    setEditStatus(tenant.subscription?.status || 'trial');

    const defaultEndDate = tenant.subscription?.end_date
      ? new Date(tenant.subscription.end_date).toISOString().split('T')[0]
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];

    setEditEndDate(defaultEndDate);
    setSubDialogOpen(true);
  }

  // Add/Edit Plan Submit
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
        ...planForm,
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
      toast.error('Error saving plan');
    } finally {
      setSubmittingPlan(false);
    }
  }

  function handleOpenAddPlan() {
    setEditingPlan(null);
    setPlanForm({
      name: '',
      monthly_price: 2900,
      yearly_price: 29000,
      max_users: 10,
      max_contacts: 2000,
      max_whatsapp_numbers: 3,
      max_ai_requests: 1000,
      features: ['ai_chat', 'pipelines', 'automations'],
    });
    setPlanDialogOpen(true);
  }

  function handleOpenEditPlan(plan: Plan) {
    setEditingPlan(plan);
    let parsedFeatures: string[] = [];
    try {
      parsedFeatures =
        typeof plan.features === 'string'
          ? JSON.parse(plan.features)
          : Array.isArray(plan.features)
            ? plan.features
            : [];
    } catch {
      parsedFeatures = [];
    }

    setPlanForm({
      name: plan.name,
      monthly_price: plan.monthly_price,
      yearly_price: plan.yearly_price,
      max_users: plan.max_users,
      max_contacts: plan.max_contacts,
      max_whatsapp_numbers: plan.max_whatsapp_numbers,
      max_ai_requests: plan.max_ai_requests,
      features: parsedFeatures,
    });
    setPlanDialogOpen(true);
  }

  async function handleDeletePlan(id: string) {
    if (!confirm('Are you sure you want to delete this plan?')) return;

    try {
      const response = await fetch(`/api/admin/plans?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Plan deleted successfully');
        loadData();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to delete plan');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error deleting plan');
    }
  }

  const toggleFeature = (feat: string) => {
    setPlanForm((prev) => ({
      ...prev,
      features: prev.features.includes(feat)
        ? prev.features.filter((f) => f !== feat)
        : [...prev.features, feat],
    }));
  };

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.owner?.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.owner?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSubStatusBadge = (
    status: 'trial' | 'active' | 'expired' | 'cancelled' | undefined | null
  ) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="border border-emerald-500/20 bg-emerald-500/10 text-[9px] font-bold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
            Active
          </Badge>
        );
      case 'trial':
        return (
          <Badge className="border border-blue-500/20 bg-blue-500/10 text-[9px] font-bold tracking-wider text-blue-600 uppercase dark:text-blue-400">
            Trial
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-muted text-muted-foreground border text-[9px] font-bold tracking-wider uppercase">
            Suspended
          </Badge>
        );
      default:
        return (
          <Badge className="border border-emerald-500/20 bg-emerald-500/10 text-[9px] font-bold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
            Active
          </Badge>
        );
    }
  };

  return (
    <div className="animate-in fade-in space-y-6 duration-300">
      {/* Redesigned Glassmorphism Control Center Header */}
      <div className="via-background to-background relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 p-6 shadow-sm transition-all duration-300 md:flex-row md:items-center md:justify-between">
        <div className="z-10 flex items-start gap-4">
          <div className="shrink-0 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400">
            <Shield className="size-8 animate-pulse drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
          </div>
          <div>
            <h1 className="text-foreground flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Super Admin Control Center
            </h1>
            <p className="text-muted-foreground mt-1 max-w-xl text-xs leading-relaxed">
              Global platform diagnostics, provisioning tenant limits, and
              subscription configuration.
            </p>
          </div>
        </div>
        <div className="z-10 flex items-center gap-2">
          <Button
            onClick={loadData}
            variant="outline"
            disabled={loading}
            className="border-border text-foreground hover:bg-muted cursor-pointer font-semibold transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
          >
            <RefreshCw
              className={`mr-1.5 size-4 ${loading ? 'animate-spin' : ''}`}
            />{' '}
            Sync Data
          </Button>
        </div>
      </div>

      {/* Modernized Tab selection triggers */}
      <div className="border-border flex gap-2 overflow-x-auto border-b">
        {['overview', 'tenants', 'plans', 'ai', 'landing'].map((tab) => {
          const isActive = activeTab === tab;
          const label =
            tab === 'landing'
              ? 'landing page'
              : tab === 'ai'
                ? 'AI Infrastructure'
                : tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`cursor-pointer border-b-2 px-5 py-3 text-xs font-bold tracking-wider whitespace-nowrap uppercase transition-all ${
                isActive
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="animate-in fade-in space-y-6 duration-300">
          {/* KPI Metrics Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Active Tenants Card */}
            <div className="group bg-card border-border/80 relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:scale-[1.02] hover:border-emerald-500/20 hover:shadow-[0_8px_30px_rgba(16,185,129,0.06)] active:scale-[0.99]">
              <div className="absolute -right-2 -bottom-2 text-emerald-500 opacity-5 transition-transform duration-300 group-hover:scale-110">
                <Layers className="h-20 w-20" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  Active Tenants
                </span>
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-600 transition-transform duration-200 group-hover:scale-110 dark:text-emerald-400">
                  <Layers className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-foreground text-3xl font-black tracking-tight tabular-nums">
                  {metrics?.totalAccounts ?? 0}
                </span>
              </div>
              <p className="text-muted-foreground mt-2 text-[10px] font-medium">
                Total registered business workspaces
              </p>
            </div>

            {/* Platform Users Card */}
            <div className="group bg-card border-border/80 relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:scale-[1.02] hover:border-blue-500/20 hover:shadow-[0_8px_30px_rgba(59,130,246,0.06)] active:scale-[0.99]">
              <div className="absolute -right-2 -bottom-2 text-blue-500 opacity-5 transition-transform duration-300 group-hover:scale-110">
                <Users className="h-20 w-20" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  Platform Agents
                </span>
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-2 text-blue-600 transition-transform duration-200 group-hover:scale-110 dark:text-blue-400">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-foreground text-3xl font-black tracking-tight tabular-nums">
                  {metrics?.totalUsers ?? 0}
                </span>
              </div>
              <p className="text-muted-foreground mt-2 text-[10px] font-medium">
                Workspace agents & owners configured
              </p>
            </div>

            {/* Monthly AI Requests Card */}
            <div className="group bg-card border-border/80 relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:scale-[1.02] hover:border-purple-500/20 hover:shadow-[0_8px_30px_rgba(139,92,246,0.06)] active:scale-[0.99]">
              <div className="absolute -right-2 -bottom-2 text-purple-500 opacity-5 transition-transform duration-300 group-hover:scale-110">
                <Activity className="h-20 w-20" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  AI Pilots Month
                </span>
                <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-2 text-purple-600 transition-transform duration-200 group-hover:scale-110 dark:text-purple-400">
                  <Activity className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-foreground text-3xl font-black tracking-tight tabular-nums">
                  {metrics?.usage?.aiRequests ?? 0}
                </span>
              </div>
              <p className="text-muted-foreground mt-2 text-[10px] font-medium">
                Autopilot completions requested
              </p>
            </div>

            {/* Total Contacts Card */}
            <div className="group bg-card border-border/80 relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:scale-[1.02] hover:border-amber-500/20 hover:shadow-[0_8px_30px_rgba(245,158,11,0.06)] active:scale-[0.99]">
              <div className="absolute -right-2 -bottom-2 text-amber-500 opacity-5 transition-transform duration-300 group-hover:scale-110">
                <Users className="h-20 w-20" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  Total CRM Contacts
                </span>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-amber-600 transition-transform duration-200 group-hover:scale-110 dark:text-amber-400">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-foreground text-3xl font-black tracking-tight tabular-nums">
                  {metrics?.totalContacts ?? 0}
                </span>
              </div>
              <p className="text-muted-foreground mt-2 text-[10px] font-medium">
                Total sync hospital patient profiles
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Subscriptions Tier Card */}
            <div className="bg-card border-border/80 space-y-4 rounded-2xl border p-6 shadow-sm transition-all duration-300 hover:scale-[1.01] hover:border-emerald-500/20 hover:shadow-[0_8px_30px_rgba(16,185,129,0.04)]">
              <div>
                <h3 className="text-foreground text-md flex items-center gap-1.5 font-extrabold">
                  <Layers className="h-4 w-4 text-emerald-500" />
                  Subscriptions Tier Share
                </h3>
                <p className="text-muted-foreground text-xs">
                  Breakdown of tenant plan registrations
                </p>
              </div>
              <div className="space-y-3.5 pt-2">
                <div className="bg-muted/20 border-border/50 hover:bg-muted/30 flex items-center justify-between rounded-lg border p-2 text-xs transition-all duration-200 hover:scale-[1.02]">
                  <span className="text-muted-foreground font-semibold">
                    Growth Premium ($29/mo)
                  </span>
                  <span className="text-foreground rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-600 dark:text-emerald-400">
                    {metrics?.subscriptions?.planBreakdown?.['Growth'] || 0}{' '}
                    active
                  </span>
                </div>
                <div className="bg-muted/20 border-border/50 hover:bg-muted/30 flex items-center justify-between rounded-lg border p-2 text-xs transition-all duration-200 hover:scale-[1.02]">
                  <span className="text-muted-foreground font-semibold">
                    Enterprise custom plans
                  </span>
                  <span className="text-foreground rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 font-bold text-blue-600 dark:text-blue-400">
                    {metrics?.subscriptions?.planBreakdown?.['Enterprise'] || 0}{' '}
                    active
                  </span>
                </div>
                <div className="bg-muted/20 border-border/50 hover:bg-muted/30 flex items-center justify-between rounded-lg border p-2 text-xs transition-all duration-200 hover:scale-[1.02]">
                  <span className="text-muted-foreground font-semibold">
                    14-Day Free Trials
                  </span>
                  <span className="text-foreground rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-bold text-amber-600 dark:text-amber-400">
                    {metrics?.subscriptions?.planBreakdown?.['Free Trial'] || 0}{' '}
                    trial
                  </span>
                </div>
                <div className="border-border flex items-center justify-between border-t pt-3 text-sm font-bold">
                  <span className="text-foreground">
                    Total Active Contracts
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {metrics?.subscriptions?.total ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Platform Active Usage Card */}
            <div className="bg-card border-border/80 space-y-4 rounded-2xl border p-6 shadow-sm transition-all duration-300 hover:scale-[1.01] hover:border-emerald-500/20 hover:shadow-[0_8px_30px_rgba(16,185,129,0.04)]">
              <div>
                <h3 className="text-foreground text-md flex items-center gap-1.5 font-extrabold">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Platform Active Usage
                </h3>
                <p className="text-muted-foreground text-xs">
                  Monthly totals for API transactions
                </p>
              </div>
              <div className="space-y-3.5 pt-2">
                <div className="bg-muted/20 border-border/50 hover:bg-muted/30 flex items-center justify-between rounded-lg border p-2 text-xs transition-all duration-200 hover:scale-[1.02]">
                  <span className="text-muted-foreground font-semibold">
                    AI Requests Sum
                  </span>
                  <span className="text-foreground font-bold">
                    {(metrics?.usage?.aiRequests ?? 0).toLocaleString()} calls
                  </span>
                </div>
                <div className="bg-muted/20 border-border/50 hover:bg-muted/30 flex items-center justify-between rounded-lg border p-2 text-xs transition-all duration-200 hover:scale-[1.02]">
                  <span className="text-muted-foreground font-semibold">
                    WhatsApp Messages Sent
                  </span>
                  <span className="text-foreground font-bold">
                    {(metrics?.usage?.whatsappMessages ?? 0).toLocaleString()}{' '}
                    msgs
                  </span>
                </div>
                <div className="border-border flex items-center justify-between border-t pt-3 text-sm font-bold">
                  <span className="text-foreground">Billing Month</span>
                  <span className="text-muted-foreground text-xs font-semibold">
                    {metrics?.usage?.month || 'Current Month'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TENANTS TAB */}
      {activeTab === 'tenants' && (
        <div className="animate-in fade-in space-y-4 duration-200">
          <div className="flex items-center justify-between gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
              <Input
                placeholder="Search by company name, owner, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-card text-foreground border-border pl-9 focus-visible:ring-emerald-500"
              />
            </div>
          </div>

          <div className="bg-card border-border overflow-hidden rounded-2xl border shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40 border-border border-b font-bold">
                  <TableRow>
                    <TableHead className="text-foreground text-[10px] font-bold tracking-wider uppercase">
                      Company/Tenant
                    </TableHead>
                    <TableHead className="text-foreground text-[10px] font-bold tracking-wider uppercase">
                      Owner
                    </TableHead>
                    <TableHead className="text-foreground text-[10px] font-bold tracking-wider uppercase">
                      Plan
                    </TableHead>
                    <TableHead className="text-foreground text-[10px] font-bold tracking-wider uppercase">
                      Status
                    </TableHead>
                    <TableHead className="text-foreground text-center text-[10px] font-bold tracking-wider uppercase">
                      Contacts
                    </TableHead>
                    <TableHead className="text-foreground text-center text-[10px] font-bold tracking-wider uppercase">
                      Members
                    </TableHead>
                    <TableHead className="text-foreground text-center text-[10px] font-bold tracking-wider uppercase">
                      AI Requests (Mo)
                    </TableHead>
                    <TableHead className="text-foreground w-[120px] text-right text-[10px] font-bold tracking-wider uppercase">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-foreground text-xs">
                  {filteredTenants.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-muted-foreground py-8 text-center italic"
                      >
                        No tenants match your search query.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTenants.map((t) => (
                      <TableRow
                        key={t.id}
                        className="hover:bg-muted/10 cursor-pointer transition-all duration-200 hover:translate-x-1.5"
                      >
                        <TableCell className="text-foreground font-extrabold">
                          {t.name}
                        </TableCell>
                        <TableCell>
                          <div className="text-foreground font-bold">
                            {t.owner?.full_name || 'Unassigned'}
                          </div>
                          <div className="text-muted-foreground text-[10px] font-medium">
                            {t.owner?.email || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground font-semibold">
                          {t.subscription?.plan?.name || 'Growth Plan'}
                        </TableCell>
                        <TableCell>
                          {getSubStatusBadge(
                            t.subscription?.status || 'active'
                          )}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {t.contactsCount}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {t.membersCount}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {t.usage.aiRequests}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-border text-foreground hover:bg-muted font-bold"
                            onClick={() => handleOpenSubDialog(t)}
                          >
                            Manage Plan
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* PLANS TAB */}
      {activeTab === 'plans' && (
        <div className="animate-in fade-in space-y-4 duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-md text-foreground font-bold">
                Billing Plans List
              </h3>
              <p className="text-muted-foreground text-xs">
                Setup maximum usage metrics limits for SaaS tiers
              </p>
            </div>
            <Button
              onClick={handleOpenAddPlan}
              className="cursor-pointer bg-emerald-700 font-bold text-white transition-all hover:scale-[1.03] hover:bg-emerald-600 active:scale-[0.97] dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              <Plus className="mr-1 size-4" /> Add Plan
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => {
              let featsArray: string[] = [];
              try {
                featsArray =
                  typeof p.features === 'string'
                    ? JSON.parse(p.features)
                    : p.features || [];
              } catch {
                featsArray = [];
              }

              return (
                <div
                  key={p.id}
                  className="bg-card border-border flex flex-col justify-between rounded-2xl border p-5 transition-all duration-300 hover:scale-[1.02] hover:border-emerald-500/20 hover:shadow-[0_8px_30px_rgba(16,185,129,0.06)] active:scale-[0.99]"
                >
                  <div className="border-border border-b pb-3">
                    <div className="flex items-start justify-between">
                      <h4 className="text-md text-foreground font-extrabold">
                        {p.name}
                      </h4>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="hover:bg-muted size-8 cursor-pointer rounded-lg"
                          onClick={() => handleOpenEditPlan(p)}
                        >
                          <Edit className="text-muted-foreground hover:text-foreground size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 cursor-pointer rounded-lg hover:bg-red-500/10"
                          onClick={() => handleDeletePlan(p.id)}
                        >
                          <Trash2 className="size-3.5 text-red-500 hover:text-red-400" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-foreground text-2xl font-black">
                        ₹{(p.monthly_price ?? 0).toLocaleString('en-IN')}
                      </span>
                      <span className="text-muted-foreground text-xs font-semibold">
                        /mo
                      </span>
                      <span className="text-muted-foreground ml-2 text-[10px] font-semibold">
                        (₹
                        {(p.yearly_price
                          ? Math.round(p.yearly_price / 12)
                          : 0
                        ).toLocaleString('en-IN')}
                        /mo billed yearly)
                      </span>
                    </div>
                  </div>
                  <div className="space-y-4 py-3 text-[11px]">
                    <div className="text-muted-foreground grid grid-cols-2 gap-2.5 font-semibold">
                      <div>
                        Max Users:{' '}
                        <span className="text-foreground">
                          {p.max_users >= 999 ? '∞' : p.max_users}
                        </span>
                      </div>
                      <div>
                        Max Contacts:{' '}
                        <span className="text-foreground">
                          {p.max_contacts >= 99999 ? '∞' : p.max_contacts}
                        </span>
                      </div>
                      <div>
                        Max AI autopilot:{' '}
                        <span className="text-foreground">
                          {p.max_ai_requests}
                        </span>
                      </div>
                      <div>
                        Phone Numbers:{' '}
                        <span className="text-foreground">
                          {p.max_whatsapp_numbers}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-foreground text-[10px] font-bold tracking-wider uppercase">
                        Features Included:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {featsArray.map((f, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="border border-emerald-500/20 bg-emerald-500/5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400"
                          >
                            {f.replace('_', ' ')}
                          </Badge>
                        ))}
                        {featsArray.length === 0 && (
                          <span className="text-muted-foreground text-[10px] italic">
                            None
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI INFRASTRUCTURE TAB */}
      {activeTab === 'ai' && <AdminAiInfrastructure />}

      {/* LANDING TAB */}
      {activeTab === 'landing' && (
        <div className="animate-in fade-in space-y-6 duration-200">
          <div>
            <h3 className="text-md text-foreground font-bold">
              Landing Page Settings
            </h3>
            <p className="text-muted-foreground text-xs">
              Manage the video embeds displayed on the public landing page
            </p>
          </div>

          <Card className="bg-card border-border max-w-2xl">
            <CardHeader>
              <CardTitle className="text-foreground text-sm font-extrabold tracking-wider uppercase">
                YouTube Video Embeds
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                Provide valid YouTube embed URLs (e.g.{' '}
                <code>https://www.youtube.com/embed/VIDEO_ID</code>) to change
                the landing page videos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid gap-2">
                  <Label
                    htmlFor="heroVideoInput"
                    className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
                  >
                    Hero Video URL
                  </Label>
                  <Input
                    id="heroVideoInput"
                    placeholder="https://www.youtube.com/embed/..."
                    value={landingSettings.landing_hero_video_url}
                    onChange={(e) =>
                      setLandingSettings((prev) => ({
                        ...prev,
                        landing_hero_video_url: e.target.value,
                      }))
                    }
                    className="bg-background text-foreground border-border font-mono text-xs focus-visible:ring-emerald-500"
                  />
                </div>

                <div className="grid gap-2">
                  <Label
                    htmlFor="actionVideoInput"
                    className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
                  >
                    Product Walkthrough Video URL
                  </Label>
                  <Input
                    id="actionVideoInput"
                    placeholder="https://www.youtube.com/embed/..."
                    value={landingSettings.landing_action_video_url}
                    onChange={(e) =>
                      setLandingSettings((prev) => ({
                        ...prev,
                        landing_action_video_url: e.target.value,
                      }))
                    }
                    className="bg-background text-foreground border-border font-mono text-xs focus-visible:ring-emerald-500"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={submittingSettings}
                    className="cursor-pointer bg-emerald-700 font-bold text-white transition-all hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  >
                    {submittingSettings && (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    )}
                    Save Video Settings
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Subscription Dialog */}
      <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
        <DialogContent className="bg-popover text-popover-foreground border-border max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg font-extrabold">
              Manage Tenant Subscription
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
              Modify the subscription tier and billing dates for{' '}
              {selectedTenant?.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubSubmit} className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label
                htmlFor="planSelect"
                className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
              >
                Billing Tier Plan
              </Label>
              <Select
                value={editPlanId}
                onValueChange={(val) => setEditPlanId(val || '')}
              >
                <SelectTrigger
                  id="planSelect"
                  className="bg-background text-foreground border-border"
                >
                  <SelectValue placeholder="Select Plan" />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border-border">
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} (₹
                      {(p.monthly_price ?? 0).toLocaleString('en-IN')}/mo)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label
                htmlFor="statusSelect"
                className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
              >
                Subscription Contract Status
              </Label>
              <Select
                value={editStatus}
                onValueChange={(val) => setEditStatus(val as typeof editStatus)}
              >
                <SelectTrigger
                  id="statusSelect"
                  className="bg-background text-foreground border-border"
                >
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border-border">
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="active">Active (Paid)</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">
                    Suspended / Cancelled
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label
                htmlFor="endDateInput"
                className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
              >
                Contract Expiration Date
              </Label>
              <Input
                id="endDateInput"
                type="date"
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
                className="bg-background text-foreground border-border focus-visible:ring-emerald-500"
              />
            </div>

            <DialogFooter className="mt-6 gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-border text-foreground hover:bg-muted font-bold"
                onClick={() => setSubDialogOpen(false)}
                disabled={submittingSub}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="cursor-pointer bg-emerald-700 font-bold text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                disabled={submittingSub}
              >
                {submittingSub && (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                )}
                Apply Subscription
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Plan Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="bg-popover text-popover-foreground border-border max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg font-extrabold">
              {editingPlan ? 'Edit Subscription Plan' : 'Add Subscription Plan'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
              Define pricing limits and feature availability for this SaaS tier.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePlanSubmit} className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label
                htmlFor="planNameInput"
                className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
              >
                Plan Name
              </Label>
              <Input
                id="planNameInput"
                value={planForm.name}
                onChange={(e) =>
                  setPlanForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g. Starter, Premium"
                className="bg-background text-foreground border-border focus-visible:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label
                  htmlFor="monthlyPriceInput"
                  className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
                >
                  Monthly Price (₹)
                </Label>
                <Input
                  id="monthlyPriceInput"
                  type="number"
                  value={planForm.monthly_price}
                  onChange={(e) =>
                    setPlanForm((prev) => ({
                      ...prev,
                      monthly_price: Number(e.target.value),
                    }))
                  }
                  className="bg-background text-foreground border-border focus-visible:ring-emerald-500"
                />
              </div>
              <div className="grid gap-2">
                <Label
                  htmlFor="yearlyPriceInput"
                  className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
                >
                  Yearly Price (₹)
                </Label>
                <Input
                  id="yearlyPriceInput"
                  type="number"
                  value={planForm.yearly_price}
                  onChange={(e) =>
                    setPlanForm((prev) => ({
                      ...prev,
                      yearly_price: Number(e.target.value),
                    }))
                  }
                  className="bg-background text-foreground border-border focus-visible:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label
                  htmlFor="maxUsersInput"
                  className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
                >
                  Max Team Members
                </Label>
                <Input
                  id="maxUsersInput"
                  type="number"
                  value={planForm.max_users}
                  onChange={(e) =>
                    setPlanForm((prev) => ({
                      ...prev,
                      max_users: Number(e.target.value),
                    }))
                  }
                  className="bg-background text-foreground border-border focus-visible:ring-emerald-500"
                />
              </div>
              <div className="grid gap-2">
                <Label
                  htmlFor="maxContactsInput"
                  className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
                >
                  Max Contacts
                </Label>
                <Input
                  id="maxContactsInput"
                  type="number"
                  value={planForm.max_contacts}
                  onChange={(e) =>
                    setPlanForm((prev) => ({
                      ...prev,
                      max_contacts: Number(e.target.value),
                    }))
                  }
                  className="bg-background text-foreground border-border focus-visible:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label
                  htmlFor="maxWhatsappInput"
                  className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
                >
                  WhatsApp Numbers
                </Label>
                <Input
                  id="maxWhatsappInput"
                  type="number"
                  value={planForm.max_whatsapp_numbers}
                  onChange={(e) =>
                    setPlanForm((prev) => ({
                      ...prev,
                      max_whatsapp_numbers: Number(e.target.value),
                    }))
                  }
                  className="bg-background text-foreground border-border focus-visible:ring-emerald-500"
                />
              </div>
              <div className="grid gap-2">
                <Label
                  htmlFor="maxAiRequestsInput"
                  className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
                >
                  Monthly AI Autopilot
                </Label>
                <Input
                  id="maxAiRequestsInput"
                  type="number"
                  value={planForm.max_ai_requests}
                  onChange={(e) =>
                    setPlanForm((prev) => ({
                      ...prev,
                      max_ai_requests: Number(e.target.value),
                    }))
                  }
                  className="bg-background text-foreground border-border focus-visible:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                Feature Flags
              </Label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {[
                  'ai_chat',
                  'pipelines',
                  'automations',
                  'broadcasts',
                  'flows',
                ].map((feat) => (
                  <label
                    key={feat}
                    className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-2 text-xs font-semibold select-none"
                  >
                    <input
                      type="checkbox"
                      checked={planForm.features.includes(feat)}
                      onChange={() => toggleFeature(feat)}
                      className="border-border bg-background size-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    {feat.replace('_', ' ')}
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter className="mt-6 gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-border text-foreground hover:bg-muted font-bold"
                onClick={() => setPlanDialogOpen(false)}
                disabled={submittingPlan}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="cursor-pointer bg-emerald-700 font-bold text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                disabled={submittingPlan}
              >
                {submittingPlan && (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                )}
                {editingPlan ? 'Save Changes' : 'Create Plan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
