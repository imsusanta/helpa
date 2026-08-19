'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Loader2, Check } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { AdminNav } from './admin-nav';

interface Plan {
  id: string;
  name: string;
  monthly_price?: number;
  monthlyPrice?: number;
  yearly_price?: number;
  yearlyPrice?: number;
  max_users?: number;
  max_contacts?: number;
  max_whatsapp_numbers?: number;
  max_ai_requests?: number;
  features?: string | string[];
}

export function AdminPlansClient() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);

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

  async function loadData() {
    setLoading(true);
    try {
      const pRes = await fetch('/api/admin/plans');
      if (pRes.ok) {
        const pData = await pRes.json();
        setPlans(Array.isArray(pData) ? pData : []);
      }
    } catch (err) {
      console.error('Failed to load plans:', err);
      toast.error('Failed to load billing plans');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

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

  function handleOpenCreatePlan() {
    setEditingPlan(null);
    setPlanForm({
      name: '',
      monthly_price: 1999,
      yearly_price: 19990,
      max_users: 5,
      max_contacts: 500,
      max_whatsapp_numbers: 1,
      max_ai_requests: 500,
      features: ['ai_copilot', 'flows', 'crm_pipelines', 'reminders'],
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

    setPlanForm({
      name: plan.name,
      monthly_price: plan.monthly_price ?? plan.monthlyPrice ?? 0,
      yearly_price: plan.yearly_price ?? plan.yearlyPrice ?? 0,
      max_users: plan.max_users ?? 5,
      max_contacts: plan.max_contacts ?? 500,
      max_whatsapp_numbers: plan.max_whatsapp_numbers ?? 1,
      max_ai_requests: plan.max_ai_requests ?? 100,
      features: feats,
    });
    setPlanDialogOpen(true);
  }

  async function handleDeletePlan(planId: string) {
    if (
      !confirm(
        'Are you sure you want to delete this plan? Subscribers on this plan will not be automatically deleted.'
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/plans?id=${planId}`, {
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

  return (
    <div className="space-y-6">
      <AdminNav onRefresh={loadData} loading={loading} />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-foreground text-sm font-semibold">
              Subscription & Pricing Tiers
            </h2>
            <p className="text-muted-foreground text-xs">
              Define pricing, usage limits, and capabilities available to
              subscriber accounts.
            </p>
          </div>
          <Button
            onClick={handleOpenCreatePlan}
            size="sm"
            className="h-8 gap-1.5 rounded-lg text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Create Plan
          </Button>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="text-primary h-6 w-6 animate-spin" />
          </div>
        ) : plans.length === 0 ? (
          <div className="border-border/80 flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-8 text-center">
            <p className="text-muted-foreground text-xs">
              No subscription plans configured yet.
            </p>
            <Button
              onClick={handleOpenCreatePlan}
              size="sm"
              variant="outline"
              className="h-8 rounded-lg text-xs"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Create First Plan
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => {
              const monthlyPrice = p.monthly_price ?? p.monthlyPrice ?? 0;
              const yearlyPrice = p.yearly_price ?? p.yearlyPrice ?? 0;
              const maxUsers = p.max_users ?? 5;
              const maxContacts = p.max_contacts ?? 500;
              const maxAi = p.max_ai_requests ?? 100;
              const maxWhatsapp = p.max_whatsapp_numbers ?? 1;

              let featsArray: string[] = [];
              if (Array.isArray(p.features)) {
                featsArray = p.features;
              } else if (typeof p.features === 'string') {
                try {
                  featsArray = JSON.parse(p.features);
                } catch {
                  featsArray = p.features.split(',').map((f) => f.trim());
                }
              }

              return (
                <div
                  key={p.id}
                  className="group border-border/60 bg-card/80 hover:border-primary/30 relative overflow-hidden rounded-[1.35rem] border p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-muted-foreground text-[10px] font-bold tracking-[0.16em] uppercase">
                        Tier
                      </span>
                      <h3 className="text-foreground mt-1 text-base font-semibold">
                        {p.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground h-7 w-7 rounded-lg"
                        onClick={() => handleOpenEditPlan(p)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive h-7 w-7 rounded-lg"
                        onClick={() => handleDeletePlan(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-foreground text-3xl font-bold tracking-tight tabular-nums">
                      ₹{monthlyPrice.toLocaleString('en-IN')}
                    </span>
                    <span className="text-muted-foreground text-xs">/mo</span>
                    {yearlyPrice > 0 && (
                      <span className="text-muted-foreground ml-1 text-[11px]">
                        (₹{Math.round(yearlyPrice / 12).toLocaleString('en-IN')}
                        /mo billed yearly)
                      </span>
                    )}
                  </div>

                  {/* Quotas Breakdown */}
                  <div className="border-border/50 bg-muted/30 mt-5 grid grid-cols-2 gap-2 rounded-xl border p-3 text-xs">
                    <div>
                      <span className="text-muted-foreground text-[10px] font-medium uppercase">
                        Members
                      </span>
                      <p className="text-foreground font-semibold">
                        {maxUsers >= 999 ? 'Unlimited' : maxUsers}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] font-medium uppercase">
                        Contacts
                      </span>
                      <p className="text-foreground font-semibold">
                        {maxContacts >= 99999
                          ? 'Unlimited'
                          : maxContacts.toLocaleString()}
                      </p>
                    </div>
                    <div className="mt-1">
                      <span className="text-muted-foreground text-[10px] font-medium uppercase">
                        AI Autopilot
                      </span>
                      <p className="text-foreground font-semibold">
                        {maxAi >= 99999
                          ? 'Unlimited'
                          : `${maxAi.toLocaleString()} /mo`}
                      </p>
                    </div>
                    <div className="mt-1">
                      <span className="text-muted-foreground text-[10px] font-medium uppercase">
                        WhatsApp No.
                      </span>
                      <p className="text-foreground font-semibold">
                        {maxWhatsapp}
                      </p>
                    </div>
                  </div>

                  {/* Feature Badges */}
                  <div className="mt-4 space-y-1.5">
                    <span className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
                      Included Modules & Features
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {featsArray.map((f, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="border-primary/20 bg-primary/5 text-foreground text-[11px] font-medium capitalize"
                        >
                          <Check className="text-primary mr-1 h-3 w-3" />
                          {f.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                      {featsArray.length === 0 && (
                        <span className="text-muted-foreground text-xs italic">
                          Standard core features only
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Plan Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="border-border/60 bg-card rounded-2xl border p-6 shadow-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base font-semibold">
              {editingPlan
                ? 'Edit Subscription Plan'
                : 'Create New Subscription Plan'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Define pricing limits and feature availability for this subscriber
              tier.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePlanSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-foreground text-xs font-medium">
                Plan Name
              </Label>
              <Input
                value={planForm.name}
                onChange={(e) =>
                  setPlanForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g. Starter, Growth, Enterprise"
                className="border-border/80 h-9 rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground text-xs font-medium">
                  Max Members
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
                  className="border-border/80 h-9 rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground text-xs font-medium">
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
                  className="border-border/80 h-9 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground text-xs font-medium">
                  AI Requests / mo
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
                  className="border-border/80 h-9 rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground text-xs font-medium">
                  WhatsApp Numbers
                </Label>
                <Input
                  type="number"
                  value={planForm.max_whatsapp_numbers}
                  onChange={(e) =>
                    setPlanForm((prev) => ({
                      ...prev,
                      max_whatsapp_numbers: Number(e.target.value),
                    }))
                  }
                  className="border-border/80 h-9 rounded-xl text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
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
                {editingPlan ? 'Update Plan' : 'Save Plan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
