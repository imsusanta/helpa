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
  const [activeTab, setActiveTab] = useState<"overview" | "tenants" | "plans">("overview");
  const [loading, setLoading] = useState(true);

  // States
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

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
      const [mRes, tRes, pRes] = await Promise.all([
        fetch("/api/admin/metrics"),
        fetch("/api/admin/tenants"),
        fetch("/api/admin/plans"),
      ]);

      if (mRes.ok) setMetrics(await mRes.json());
      if (tRes.ok) setTenants(await tRes.json());
      if (pRes.ok) setPlans(await pRes.json());
    } catch (err) {
      console.error(err);
      toast.error("Failed to load SaaS admin data");
    } finally {
      setLoading(false);
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
        return <Badge className="bg-green-500/15 text-green-400 border border-green-500/25">Active</Badge>;
      case "trial":
        return <Badge className="bg-blue-500/15 text-blue-400 border border-blue-500/25">Trial</Badge>;
      case "expired":
        return <Badge className="bg-red-500/15 text-red-400 border border-red-500/25">Expired</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground">Suspended</Badge>;
    }
  };

  if (loading && !metrics) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="size-7 text-purple-400" />
            Super Admin Control Center
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Global metrics, tenant plans provisioning, and limits configuration.
          </p>
        </div>
        <Button onClick={loadData} variant="outline" className="flex items-center gap-1.5">
          <RefreshCw className="size-4" />
          Sync Data
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {["overview", "tenants", "plans"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as typeof activeTab)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && metrics && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center justify-between">
                  Active Tenants
                  <Layers className="size-4 text-muted-foreground opacity-70" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{metrics.totalAccounts}</div>
                <p className="text-xs text-muted-foreground mt-1">Total business registries</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center justify-between">
                  Platform Users
                  <Users className="size-4 text-muted-foreground opacity-70" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{metrics.totalUsers}</div>
                <p className="text-xs text-muted-foreground mt-1">Total workspace agents & owners</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center justify-between">
                  Monthly AI Pilots
                  <Activity className="size-4 text-muted-foreground opacity-70" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{metrics.usage.aiRequests}</div>
                <p className="text-xs text-muted-foreground mt-1">Autopilot queries this month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center justify-between">
                  Total Contacts
                  <Users className="size-4 text-muted-foreground opacity-70" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{metrics.totalContacts}</div>
                <p className="text-xs text-muted-foreground mt-1">Managed CRM contacts</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Subscriptions Tier Share</CardTitle>
                <CardDescription>Breakdown of tenant plan registrations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center border-b border-border pb-2">
                  <span className="text-sm text-muted-foreground">Growth Premium ($29/mo)</span>
                  <span className="font-bold text-foreground">{metrics.subscriptions.planBreakdown["Growth"] || 0}</span>
                </div>
                <div className="flex justify-between items-center border-b border-border pb-2">
                  <span className="text-sm text-muted-foreground">Enterprise custom plans</span>
                  <span className="font-bold text-foreground">{metrics.subscriptions.planBreakdown["Enterprise"] || 0}</span>
                </div>
                <div className="flex justify-between items-center border-b border-border pb-2">
                  <span className="text-sm text-muted-foreground">14-Day Free Trials</span>
                  <span className="font-bold text-foreground">{metrics.subscriptions.planBreakdown["Free Trial"] || 0}</span>
                </div>
                <div className="flex justify-between items-center pt-2 font-semibold">
                  <span className="text-sm text-foreground">Total Active contracts</span>
                  <span className="text-foreground">{metrics.subscriptions.total}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Platform Active Usage</CardTitle>
                <CardDescription>Monthly totals for API transactions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center border-b border-border pb-2">
                  <span className="text-sm text-muted-foreground">AI Requests Sum</span>
                  <span className="font-bold text-foreground">{metrics.usage.aiRequests} calls</span>
                </div>
                <div className="flex justify-between items-center border-b border-border pb-2">
                  <span className="text-sm text-muted-foreground">WhatsApp Messages Sent</span>
                  <span className="font-bold text-foreground">{metrics.usage.whatsappMessages} msg</span>
                </div>
                <div className="flex justify-between items-center pt-2 font-semibold">
                  <span className="text-sm text-foreground">Billing Month</span>
                  <span className="text-muted-foreground text-xs">{metrics.usage.month}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TENANTS TAB */}
      {activeTab === "tenants" && (
        <div className="space-y-4 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company name, owner, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card text-foreground border-border"
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company/Tenant</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Contacts</TableHead>
                    <TableHead className="text-center">Members</TableHead>
                    <TableHead className="text-center">AI Requests (Mo)</TableHead>
                    <TableHead className="w-[120px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No tenants match your search query.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTenants.map((t) => (
                      <TableRow key={t.id} className="hover:bg-muted/10">
                        <TableCell className="font-bold text-foreground">{t.name}</TableCell>
                        <TableCell>
                          <div className="text-sm text-foreground">{t.owner?.full_name || "N/A"}</div>
                          <div className="text-xs text-muted-foreground">{t.owner?.email || "N/A"}</div>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {t.subscription?.plan?.name || "No Plan"}
                        </TableCell>
                        <TableCell>{getSubStatusBadge(t.subscription?.status || "cancelled")}</TableCell>
                        <TableCell className="text-center font-medium">{t.contactsCount}</TableCell>
                        <TableCell className="text-center font-medium">{t.membersCount}</TableCell>
                        <TableCell className="text-center font-medium">{t.usage.aiRequests}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => handleOpenSubDialog(t)}>
                            Manage Plan
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* PLANS TAB */}
      {activeTab === "plans" && (
        <div className="space-y-4 animate-in fade-in-50 duration-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-foreground">Billing Plans List</h3>
            <Button onClick={handleOpenAddPlan} className="flex items-center gap-1">
              <Plus className="size-4" /> Add Plan
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
                <Card key={p.id} className="flex flex-col justify-between border-border">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base font-bold text-foreground">{p.name}</CardTitle>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="size-8" onClick={() => handleOpenEditPlan(p)}>
                          <Edit className="size-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-8" onClick={() => handleDeletePlan(p.id)}>
                          <Trash2 className="size-3.5 text-red-500 hover:text-red-400" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription className="text-xs text-muted-foreground flex gap-1 items-baseline mt-1">
                      <span className="text-2xl font-bold text-foreground">${(p.monthly_price / 100).toFixed(0)}</span>
                      <span>/mo</span>
                      <span className="ml-2">(${(p.yearly_price / 1200).toFixed(0)}/yr)</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2 text-xs space-y-3">
                    <div className="border-t border-border pt-3 grid grid-cols-2 gap-2 text-muted-foreground font-medium">
                      <div>Max Users: <span className="text-foreground">{p.max_users >= 999 ? "∞" : p.max_users}</span></div>
                      <div>Max Contacts: <span className="text-foreground">{p.max_contacts >= 99999 ? "∞" : p.max_contacts}</span></div>
                      <div>Max AI: <span className="text-foreground">{p.max_ai_requests}</span></div>
                      <div>Numbers: <span className="text-foreground">{p.max_whatsapp_numbers}</span></div>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1">Features Included:</p>
                      <div className="flex flex-wrap gap-1">
                        {featsArray.map((f, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">
                            {f}
                          </Badge>
                        ))}
                        {featsArray.length === 0 && <span className="text-muted-foreground text-xs">None</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Subscription Dialog */}
      <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
        <DialogContent className="max-w-md bg-popover text-popover-foreground">
          <DialogHeader>
            <DialogTitle>Manage Tenant Subscription</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Modify the subscription tier and billing dates for {selectedTenant?.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubSubmit} className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="planSelect">Billing Tier Plan</Label>
              <Select value={editPlanId} onValueChange={(val) => setEditPlanId(val || "")}>
                <SelectTrigger id="planSelect" className="bg-background text-foreground">
                  <SelectValue placeholder="Select Plan" />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border-border">
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} (${(p.monthly_price / 100).toFixed(0)}/mo)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="statusSelect">Subscription Contract Status</Label>
              <Select value={editStatus} onValueChange={(val) => setEditStatus(val as typeof editStatus)}>
                <SelectTrigger id="statusSelect" className="bg-background text-foreground">
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
              <Label htmlFor="endDateInput">Contract Expiration Date</Label>
              <Input
                id="endDateInput"
                type="date"
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
                className="bg-background text-foreground"
              />
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setSubDialogOpen(false)} disabled={submittingSub}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingSub}>
                {submittingSub && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                Apply Subscription
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Plan Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-md bg-popover text-popover-foreground">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Subscription Plan" : "Add Subscription Plan"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Define pricing limits and feature availability for this SaaS tier.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePlanSubmit} className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="planNameInput">Plan Name</Label>
              <Input
                id="planNameInput"
                value={planForm.name}
                onChange={(e) => setPlanForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Starter, Premium"
                className="bg-background text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="monthlyPriceInput">Monthly Cost (Cents)</Label>
                <Input
                  id="monthlyPriceInput"
                  type="number"
                  value={planForm.monthly_price}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, monthly_price: Number(e.target.value) }))}
                  className="bg-background text-foreground"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="yearlyPriceInput">Yearly Cost (Cents)</Label>
                <Input
                  id="yearlyPriceInput"
                  type="number"
                  value={planForm.yearly_price}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, yearly_price: Number(e.target.value) }))}
                  className="bg-background text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="maxUsersInput">Max Team Members</Label>
                <Input
                  id="maxUsersInput"
                  type="number"
                  value={planForm.max_users}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, max_users: Number(e.target.value) }))}
                  className="bg-background text-foreground"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxContactsInput">Max Contacts</Label>
                <Input
                  id="maxContactsInput"
                  type="number"
                  value={planForm.max_contacts}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, max_contacts: Number(e.target.value) }))}
                  className="bg-background text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="maxWhatsappInput">WhatsApp Numbers</Label>
                <Input
                  id="maxWhatsappInput"
                  type="number"
                  value={planForm.max_whatsapp_numbers}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, max_whatsapp_numbers: Number(e.target.value) }))}
                  className="bg-background text-foreground"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxAiRequestsInput">Monthly AI Autopilot</Label>
                <Input
                  id="maxAiRequestsInput"
                  type="number"
                  value={planForm.max_ai_requests}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, max_ai_requests: Number(e.target.value) }))}
                  className="bg-background text-foreground"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Feature Flags</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {["ai_chat", "pipelines", "automations", "broadcasts", "flows"].map((feat) => (
                  <label key={feat} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={planForm.features.includes(feat)}
                      onChange={() => toggleFeature(feat)}
                      className="rounded border-border bg-background text-primary focus:ring-primary size-3.5"
                    />
                    {feat.replace("_", " ")}
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setPlanDialogOpen(false)} disabled={submittingPlan}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingPlan}>
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
