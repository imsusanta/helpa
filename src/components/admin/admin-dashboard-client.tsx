"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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
  MessageSquare,
  Check,
  CheckCheck,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { McpConnectView } from "./mcp-connect-view";

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
    status: "trial" | "active" | "expired" | "cancelled";
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

export function AdminDashboardClient() {
  const [activeTab, setActiveTab] = useState<"overview" | "tenants" | "plans" | "landing" | "mcp">("overview");
  const [loading, setLoading] = useState(true);

  // States
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [landingSettings, setLandingSettings] = useState({
    landing_hero_video_url: "https://www.youtube.com/embed/gFx-NjTw3sM",
    landing_action_video_url: "https://www.youtube.com/embed/gFx-NjTw3sM",
  });
  const [submittingSettings, setSubmittingSettings] = useState(false);

  // Subscription Edit Dialog State
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [editPlanId, setEditPlanId] = useState("");
  const [editStatus, setEditStatus] = useState<"trial" | "active" | "expired" | "cancelled">("trial");
  const [editEndDate, setEditEndDate] = useState("");
  const [submittingSub, setSubmittingSub] = useState(false);

  // Plan Edit Dialog State
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState({
    name: "",
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
        fetch("/api/admin/metrics"),
        fetch("/api/admin/tenants"),
        fetch("/api/admin/plans"),
        fetch("/api/admin/settings"),
      ]);

      if (mRes.ok) setMetrics(await mRes.json());
      if (tRes.ok) setTenants(await tRes.json());
      if (pRes.ok) setPlans(await pRes.json());
      if (sRes.ok) {
        const settings = await sRes.json();
        setLandingSettings((prev) => ({
          ...prev,
          landing_hero_video_url: settings.landing_hero_video_url || prev.landing_hero_video_url,
          landing_action_video_url: settings.landing_action_video_url || prev.landing_action_video_url,
        }));
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load SaaS admin data");
    } finally {
      setLoading(false);
    }
  }

  // Save Landing Page Settings
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingSettings(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(landingSettings),
      });

      if (response.ok) {
        toast.success("Landing page video links updated successfully");
        loadData();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update landing settings");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving landing settings");
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
    if (!selectedTenant || !editPlanId || !editEndDate) {
      toast.error("All subscription fields are required");
      return;
    }

    setSubmittingSub(true);
    try {
      const response = await fetch("/api/admin/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedTenant.id,
          planId: editPlanId,
          status: editStatus,
          endDate: new Date(editEndDate).toISOString(),
        }),
      });

      if (response.ok) {
        toast.success("Subscription updated successfully");
        setSubDialogOpen(false);
        loadData();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update subscription");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving subscription changes");
    } finally {
      setSubmittingSub(false);
    }
  }

  // Open Edit Subscription Modal
  function handleOpenSubDialog(tenant: Tenant) {
    setSelectedTenant(tenant);
    setEditPlanId(tenant.subscription?.plan?.id || "");
    setEditStatus(tenant.subscription?.status || "trial");

    if (tenant.subscription?.end_date) {
      setEditEndDate(new Date(tenant.subscription.end_date).toISOString().split("T")[0]);
    } else {
      setEditEndDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
    }
    setSubDialogOpen(true);
  }

  // Add/Edit Plan Submit
  async function handlePlanSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!planForm.name.trim()) {
      toast.error("Plan name is required");
      return;
    }

    setSubmittingPlan(true);
    try {
      const method = editingPlan ? "PATCH" : "POST";
      const body = {
        ...planForm,
        ...(editingPlan ? { id: editingPlan.id } : {}),
      };

      const response = await fetch("/api/admin/plans", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success(editingPlan ? "Plan updated successfully" : "Plan created successfully");
        setPlanDialogOpen(false);
        loadData();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save plan");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving plan");
    } finally {
      setSubmittingPlan(false);
    }
  }

  function handleOpenAddPlan() {
    setEditingPlan(null);
    setPlanForm({
      name: "",
      monthly_price: 2900,
      yearly_price: 29000,
      max_users: 10,
      max_contacts: 2000,
      max_whatsapp_numbers: 3,
      max_ai_requests: 1000,
      features: ["ai_chat", "pipelines", "automations"],
    });
    setPlanDialogOpen(true);
  }

  function handleOpenEditPlan(plan: Plan) {
    setEditingPlan(plan);
    let parsedFeatures: string[] = [];
    try {
      parsedFeatures = typeof plan.features === "string"
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
    if (!confirm("Are you sure you want to delete this plan?")) return;

    try {
      const response = await fetch(`/api/admin/plans?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Plan deleted successfully");
        loadData();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete plan");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error deleting plan");
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

  const getSubStatusBadge = (status: "trial" | "active" | "expired" | "cancelled" | undefined | null) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wider text-[9px] font-bold">Active</Badge>;
      case "trial":
        return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase tracking-wider text-[9px] font-bold">Trial</Badge>;
      case "expired":
        return <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 uppercase tracking-wider text-[9px] font-bold">Expired</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground border uppercase tracking-wider text-[9px] font-bold">Suspended</Badge>;
    }
  };

  if (loading && !metrics) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Redesigned Glassmorphism Control Center Header */}
      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between p-6 bg-gradient-to-r from-emerald-500/10 via-background to-background border border-emerald-500/20 rounded-2xl gap-4 shadow-sm overflow-hidden transition-all duration-300">
        <div className="z-10 flex items-start gap-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
            <Shield className="size-8 animate-pulse drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl flex items-center gap-2">
              Super Admin Control Center
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
              Global platform diagnostics, provisioning tenant limits, and subscription configuration.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 z-10">
          <Button onClick={loadData} variant="outline" className="border-border text-foreground hover:bg-muted font-semibold cursor-pointer hover:scale-[1.03] active:scale-[0.97] transition-all duration-200">
            <RefreshCw className="size-4 mr-1.5" /> Sync Data
          </Button>
        </div>
      </div>

      {/* Modernized Tab selection triggers */}
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {["overview", "tenants", "plans", "landing", "mcp"].map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === "landing" ? "landing page" : tab === "mcp" ? "MCP Connect" : tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* MCP CONNECT TAB */}
      {activeTab === "mcp" && <McpConnectView />}

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && metrics && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* KPI Metrics Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            
            {/* Active Tenants Card */}
            <div className="relative group overflow-hidden bg-card border border-border/80 rounded-2xl p-5 hover:border-emerald-500/20 hover:shadow-[0_8px_30px_rgba(16,185,129,0.06)] hover:scale-[1.02] active:scale-[0.99] transition-all duration-300">
              <div className="absolute -right-2 -bottom-2 opacity-5 text-emerald-500 group-hover:scale-110 transition-transform duration-300">
                <Layers className="h-20 w-20" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Tenants</span>
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg group-hover:scale-110 transition-transform duration-200">
                  <Layers className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-black text-foreground tracking-tight tabular-nums">
                  {metrics.totalAccounts}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 font-medium">Total registered business workspaces</p>
            </div>

            {/* Platform Users Card */}
            <div className="relative group overflow-hidden bg-card border border-border/80 rounded-2xl p-5 hover:border-blue-500/20 hover:shadow-[0_8px_30px_rgba(59,130,246,0.06)] hover:scale-[1.02] active:scale-[0.99] transition-all duration-300">
              <div className="absolute -right-2 -bottom-2 opacity-5 text-blue-500 group-hover:scale-110 transition-transform duration-300">
                <Users className="h-20 w-20" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Platform Agents</span>
                <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg group-hover:scale-110 transition-transform duration-200">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-black text-foreground tracking-tight tabular-nums">
                  {metrics.totalUsers}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 font-medium">Workspace agents & owners configured</p>
            </div>

            {/* Monthly AI Requests Card */}
            <div className="relative group overflow-hidden bg-card border border-border/80 rounded-2xl p-5 hover:border-purple-500/20 hover:shadow-[0_8px_30px_rgba(139,92,246,0.06)] hover:scale-[1.02] active:scale-[0.99] transition-all duration-300">
              <div className="absolute -right-2 -bottom-2 opacity-5 text-purple-500 group-hover:scale-110 transition-transform duration-300">
                <Activity className="h-20 w-20" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">AI Pilots Month</span>
                <div className="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg group-hover:scale-110 transition-transform duration-200">
                  <Activity className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-black text-foreground tracking-tight tabular-nums">
                  {metrics.usage.aiRequests}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 font-medium">Autopilot completions requested</p>
            </div>

            {/* Total Contacts Card */}
            <div className="relative group overflow-hidden bg-card border border-border/80 rounded-2xl p-5 hover:border-amber-500/20 hover:shadow-[0_8px_30px_rgba(245,158,11,0.06)] hover:scale-[1.02] active:scale-[0.99] transition-all duration-300">
              <div className="absolute -right-2 -bottom-2 opacity-5 text-amber-500 group-hover:scale-110 transition-transform duration-300">
                <Users className="h-20 w-20" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total CRM Contacts</span>
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg group-hover:scale-110 transition-transform duration-200">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-black text-foreground tracking-tight tabular-nums">
                  {metrics.totalContacts}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 font-medium">Total sync hospital patient profiles</p>
            </div>

          </div>

          <div className="grid gap-6 md:grid-cols-2">
            
            {/* Subscriptions Tier Card */}
            <div className="bg-card border border-border/80 rounded-2xl p-6 space-y-4 hover:border-emerald-500/20 hover:shadow-[0_8px_30px_rgba(16,185,129,0.04)] hover:scale-[1.01] transition-all duration-300 shadow-sm">
              <div>
                <h3 className="font-extrabold text-foreground text-md flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-emerald-500" />
                  Subscriptions Tier Share
                </h3>
                <p className="text-muted-foreground text-xs">Breakdown of tenant plan registrations</p>
              </div>
              <div className="space-y-3.5 pt-2">
                <div className="flex justify-between items-center text-xs p-2 rounded-lg bg-muted/20 border border-border/50 hover:bg-muted/30 hover:scale-[1.02] transition-all duration-200">
                  <span className="text-muted-foreground font-semibold">Growth Premium ($29/mo)</span>
                  <span className="font-bold text-foreground bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded">
                    {metrics.subscriptions.planBreakdown["Growth"] || 0} active
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs p-2 rounded-lg bg-muted/20 border border-border/50 hover:bg-muted/30 hover:scale-[1.02] transition-all duration-200">
                  <span className="text-muted-foreground font-semibold">Enterprise custom plans</span>
                  <span className="font-bold text-foreground bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                    {metrics.subscriptions.planBreakdown["Enterprise"] || 0} active
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs p-2 rounded-lg bg-muted/20 border border-border/50 hover:bg-muted/30 hover:scale-[1.02] transition-all duration-200">
                  <span className="text-muted-foreground font-semibold">14-Day Free Trials</span>
                  <span className="font-bold text-foreground bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded">
                    {metrics.subscriptions.planBreakdown["Free Trial"] || 0} trial
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-border font-bold text-sm">
                  <span className="text-foreground">Total Active Contracts</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{metrics.subscriptions.total}</span>
                </div>
              </div>
            </div>

            {/* Platform Active Usage Card */}
            <div className="bg-card border border-border/80 rounded-2xl p-6 space-y-4 hover:border-emerald-500/20 hover:shadow-[0_8px_30px_rgba(16,185,129,0.04)] hover:scale-[1.01] transition-all duration-300 shadow-sm">
              <div>
                <h3 className="font-extrabold text-foreground text-md flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Platform Active Usage
                </h3>
                <p className="text-muted-foreground text-xs">Monthly totals for API transactions</p>
              </div>
              <div className="space-y-3.5 pt-2">
                <div className="flex justify-between items-center text-xs p-2 rounded-lg bg-muted/20 border border-border/50 hover:bg-muted/30 hover:scale-[1.02] transition-all duration-200">
                  <span className="text-muted-foreground font-semibold">AI Requests Sum</span>
                  <span className="font-bold text-foreground">{metrics.usage.aiRequests.toLocaleString()} calls</span>
                </div>
                <div className="flex justify-between items-center text-xs p-2 rounded-lg bg-muted/20 border border-border/50 hover:bg-muted/30 hover:scale-[1.02] transition-all duration-200">
                  <span className="text-muted-foreground font-semibold">WhatsApp Messages Sent</span>
                  <span className="font-bold text-foreground">{metrics.usage.whatsappMessages.toLocaleString()} msgs</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-border font-bold text-sm">
                  <span className="text-foreground">Billing Month</span>
                  <span className="text-muted-foreground text-xs font-semibold">{metrics.usage.month}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TENANTS TAB */}
      {activeTab === "tenants" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company name, owner, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card text-foreground border-border focus-visible:ring-emerald-500"
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40 font-bold border-b border-border">
                  <TableRow>
                    <TableHead className="font-bold uppercase text-[10px] tracking-wider text-foreground">Company/Tenant</TableHead>
                    <TableHead className="font-bold uppercase text-[10px] tracking-wider text-foreground">Owner</TableHead>
                    <TableHead className="font-bold uppercase text-[10px] tracking-wider text-foreground">Plan</TableHead>
                    <TableHead className="font-bold uppercase text-[10px] tracking-wider text-foreground">Status</TableHead>
                    <TableHead className="text-center font-bold uppercase text-[10px] tracking-wider text-foreground">Contacts</TableHead>
                    <TableHead className="text-center font-bold uppercase text-[10px] tracking-wider text-foreground">Members</TableHead>
                    <TableHead className="text-center font-bold uppercase text-[10px] tracking-wider text-foreground">AI Requests (Mo)</TableHead>
                    <TableHead className="w-[120px] text-right font-bold uppercase text-[10px] tracking-wider text-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs text-foreground">
                  {filteredTenants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground italic">
                        No tenants match your search query.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTenants.map((t) => (
                      <TableRow key={t.id} className="hover:bg-muted/10 hover:translate-x-1.5 transition-all duration-200 cursor-pointer">
                        <TableCell className="font-extrabold text-foreground">{t.name}</TableCell>
                        <TableCell>
                          <div className="font-bold text-foreground">{t.owner?.full_name || "N/A"}</div>
                          <div className="text-[10px] text-muted-foreground font-medium">{t.owner?.email || "N/A"}</div>
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {t.subscription?.plan?.name || "No Plan"}
                        </TableCell>
                        <TableCell>{getSubStatusBadge(t.subscription?.status || "cancelled")}</TableCell>
                        <TableCell className="text-center font-semibold">{t.contactsCount}</TableCell>
                        <TableCell className="text-center font-semibold">{t.membersCount}</TableCell>
                        <TableCell className="text-center font-semibold">{t.usage.aiRequests}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" className="border-border text-foreground hover:bg-muted font-bold" onClick={() => handleOpenSubDialog(t)}>
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
      {activeTab === "plans" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-md font-bold text-foreground">Billing Plans List</h3>
              <p className="text-xs text-muted-foreground">Setup maximum usage metrics limits for SaaS tiers</p>
            </div>
            <Button onClick={handleOpenAddPlan} className="bg-emerald-700 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold cursor-pointer hover:scale-[1.03] active:scale-[0.97] transition-all">
              <Plus className="size-4 mr-1" /> Add Plan
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => {
              let featsArray: string[] = [];
              try {
                featsArray = typeof p.features === "string" ? JSON.parse(p.features) : p.features || [];
              } catch {
                featsArray = [];
              }

              return (
                <div key={p.id} className="flex flex-col justify-between bg-card border border-border rounded-2xl p-5 hover:border-emerald-500/20 hover:shadow-[0_8px_30px_rgba(16,185,129,0.06)] hover:scale-[1.02] active:scale-[0.99] transition-all duration-300">
                  <div className="pb-3 border-b border-border">
                    <div className="flex justify-between items-start">
                      <h4 className="text-md font-extrabold text-foreground">{p.name}</h4>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="size-8 cursor-pointer hover:bg-muted rounded-lg" onClick={() => handleOpenEditPlan(p)}>
                          <Edit className="size-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-8 cursor-pointer hover:bg-red-500/10 rounded-lg" onClick={() => handleDeletePlan(p.id)}>
                          <Trash2 className="size-3.5 text-red-500 hover:text-red-400" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-1 items-baseline mt-2">
                      <span className="text-2xl font-black text-foreground">₹{p.monthly_price.toLocaleString("en-IN")}</span>
                      <span className="text-xs text-muted-foreground font-semibold">/mo</span>
                      <span className="text-[10px] text-muted-foreground font-semibold ml-2">(₹{Math.round(p.yearly_price / 12).toLocaleString("en-IN")}/mo billed yearly)</span>
                    </div>
                  </div>
                  <div className="py-3 text-[11px] space-y-4">
                    <div className="grid grid-cols-2 gap-2.5 text-muted-foreground font-semibold">
                      <div>Max Users: <span className="text-foreground">{p.max_users >= 999 ? "∞" : p.max_users}</span></div>
                      <div>Max Contacts: <span className="text-foreground">{p.max_contacts >= 99999 ? "∞" : p.max_contacts}</span></div>
                      <div>Max AI autopilot: <span className="text-foreground">{p.max_ai_requests}</span></div>
                      <div>Phone Numbers: <span className="text-foreground">{p.max_whatsapp_numbers}</span></div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="font-bold text-foreground text-[10px] uppercase tracking-wider">Features Included:</p>
                      <div className="flex flex-wrap gap-1">
                        {featsArray.map((f, i) => (
                          <Badge key={i} variant="secondary" className="text-[9px] font-bold bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            {f.replace("_", " ")}
                          </Badge>
                        ))}
                        {featsArray.length === 0 && <span className="text-muted-foreground italic text-[10px]">None</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LANDING TAB */}
      {activeTab === "landing" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <h3 className="text-md font-bold text-foreground">Landing Page Settings</h3>
            <p className="text-xs text-muted-foreground">Manage the video embeds displayed on the public landing page</p>
          </div>

          <Card className="bg-card border-border max-w-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-foreground">YouTube Video Embeds</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Provide valid YouTube embed URLs (e.g. <code>https://www.youtube.com/embed/VIDEO_ID</code>) to change the landing page videos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="heroVideoInput" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Hero Video URL</Label>
                  <Input
                    id="heroVideoInput"
                    placeholder="https://www.youtube.com/embed/..."
                    value={landingSettings.landing_hero_video_url}
                    onChange={(e) => setLandingSettings(prev => ({ ...prev, landing_hero_video_url: e.target.value }))}
                    className="bg-background text-foreground border-border focus-visible:ring-emerald-500 text-xs font-mono"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="actionVideoInput" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Product Walkthrough Video URL</Label>
                  <Input
                    id="actionVideoInput"
                    placeholder="https://www.youtube.com/embed/..."
                    value={landingSettings.landing_action_video_url}
                    onChange={(e) => setLandingSettings(prev => ({ ...prev, landing_action_video_url: e.target.value }))}
                    className="bg-background text-foreground border-border focus-visible:ring-emerald-500 text-xs font-mono"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={submittingSettings} className="bg-emerald-700 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold cursor-pointer transition-all">
                    {submittingSettings && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
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
        <DialogContent className="max-w-md bg-popover text-popover-foreground border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-lg text-foreground">Manage Tenant Subscription</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
              Modify the subscription tier and billing dates for {selectedTenant?.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubSubmit} className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="planSelect" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Billing Tier Plan</Label>
              <Select value={editPlanId} onValueChange={(val) => setEditPlanId(val || "")}>
                <SelectTrigger id="planSelect" className="bg-background text-foreground border-border">
                  <SelectValue placeholder="Select Plan" />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border-border">
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} (₹{p.monthly_price.toLocaleString("en-IN")}/mo)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="statusSelect" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subscription Contract Status</Label>
              <Select value={editStatus} onValueChange={(val) => setEditStatus(val as typeof editStatus)}>
                <SelectTrigger id="statusSelect" className="bg-background text-foreground border-border">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border-border">
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="active">Active (Paid)</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Suspended / Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="endDateInput" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Contract Expiration Date</Label>
              <Input
                id="endDateInput"
                type="date"
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
                className="bg-background text-foreground border-border focus-visible:ring-emerald-500"
              />
            </div>

            <DialogFooter className="mt-6 gap-2">
              <Button type="button" variant="outline" className="border-border text-foreground hover:bg-muted font-bold" onClick={() => setSubDialogOpen(false)} disabled={submittingSub}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-700 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold cursor-pointer" disabled={submittingSub}>
                {submittingSub && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                Apply Subscription
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Plan Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-md bg-popover text-popover-foreground border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-lg text-foreground">{editingPlan ? "Edit Subscription Plan" : "Add Subscription Plan"}</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
              Define pricing limits and feature availability for this SaaS tier.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePlanSubmit} className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="planNameInput" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Plan Name</Label>
              <Input
                id="planNameInput"
                value={planForm.name}
                onChange={(e) => setPlanForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Starter, Premium"
                className="bg-background text-foreground border-border focus-visible:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="monthlyPriceInput" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Monthly Price (₹)</Label>
                <Input
                  id="monthlyPriceInput"
                  type="number"
                  value={planForm.monthly_price}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, monthly_price: Number(e.target.value) }))}
                  className="bg-background text-foreground border-border focus-visible:ring-emerald-500"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="yearlyPriceInput" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Yearly Price (₹)</Label>
                <Input
                  id="yearlyPriceInput"
                  type="number"
                  value={planForm.yearly_price}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, yearly_price: Number(e.target.value) }))}
                  className="bg-background text-foreground border-border focus-visible:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="maxUsersInput" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Max Team Members</Label>
                <Input
                  id="maxUsersInput"
                  type="number"
                  value={planForm.max_users}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, max_users: Number(e.target.value) }))}
                  className="bg-background text-foreground border-border focus-visible:ring-emerald-500"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxContactsInput" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Max Contacts</Label>
                <Input
                  id="maxContactsInput"
                  type="number"
                  value={planForm.max_contacts}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, max_contacts: Number(e.target.value) }))}
                  className="bg-background text-foreground border-border focus-visible:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="maxWhatsappInput" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">WhatsApp Numbers</Label>
                <Input
                  id="maxWhatsappInput"
                  type="number"
                  value={planForm.max_whatsapp_numbers}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, max_whatsapp_numbers: Number(e.target.value) }))}
                  className="bg-background text-foreground border-border focus-visible:ring-emerald-500"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxAiRequestsInput" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Monthly AI Autopilot</Label>
                <Input
                  id="maxAiRequestsInput"
                  type="number"
                  value={planForm.max_ai_requests}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, max_ai_requests: Number(e.target.value) }))}
                  className="bg-background text-foreground border-border focus-visible:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Feature Flags</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {["ai_chat", "pipelines", "automations", "broadcasts", "flows"].map((feat) => (
                  <label key={feat} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer select-none font-semibold">
                    <input
                      type="checkbox"
                      checked={planForm.features.includes(feat)}
                      onChange={() => toggleFeature(feat)}
                      className="rounded border-border bg-background text-emerald-600 focus:ring-emerald-500 size-3.5"
                    />
                    {feat.replace("_", " ")}
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter className="mt-6 gap-2">
              <Button type="button" variant="outline" className="border-border text-foreground hover:bg-muted font-bold" onClick={() => setPlanDialogOpen(false)} disabled={submittingPlan}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-700 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold cursor-pointer" disabled={submittingPlan}>
                {submittingPlan && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                {editingPlan ? "Save Changes" : "Create Plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
