'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  monthly_price: number;
  yearly_price: number;
  max_users: number;
  max_contacts: number;
  max_whatsapp_numbers: number;
  max_ai_requests: number;
  features: string | string[];
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

  return (
    <div className="space-y-6">
      <AdminNav onRefresh={loadData} loading={loading} />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-foreground text-sm font-semibold">
              Billing Plans & Pricing
            </h3>
            <p className="text-muted-foreground text-xs">
              Configure usage limits, feature access, and pricing for
              subscription tiers
            </p>
          </div>
          <Button
            onClick={handleOpenAddPlan}
            size="sm"
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5" /> Add Plan
          </Button>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                <Card
                  key={p.id}
                  className="bg-card border-border flex flex-col justify-between shadow-none"
                >
                  <CardHeader className="border-border border-b p-4">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-foreground text-sm font-semibold">
                        {p.name}
                      </CardTitle>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-md"
                          onClick={() => handleOpenEditPlan(p)}
                        >
                          <Edit className="text-muted-foreground h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-md text-red-500 hover:text-red-600"
                          onClick={() => handleDeletePlan(p.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-foreground text-xl font-semibold">
                        ₹{(p.monthly_price ?? 0).toLocaleString('en-IN')}
                      </span>
                      <span className="text-muted-foreground text-xs">/mo</span>
                      {p.yearly_price ? (
                        <span className="text-muted-foreground ml-1.5 text-xs">
                          (₹
                          {Math.round(p.yearly_price / 12).toLocaleString(
                            'en-IN'
                          )}
                          /mo billed yearly)
                        </span>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4 text-xs">
                    <div className="text-muted-foreground grid grid-cols-2 gap-2">
                      <div>
                        Users:{' '}
                        <span className="text-foreground font-medium">
                          {p.max_users >= 999 ? '∞' : p.max_users}
                        </span>
                      </div>
                      <div>
                        Contacts:{' '}
                        <span className="text-foreground font-medium">
                          {p.max_contacts >= 99999
                            ? '∞'
                            : p.max_contacts.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        AI Autopilot:{' '}
                        <span className="text-foreground font-medium">
                          {p.max_ai_requests.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        WhatsApp:{' '}
                        <span className="text-foreground font-medium">
                          {p.max_whatsapp_numbers}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                      <span className="text-muted-foreground text-xs font-medium">
                        Features:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {featsArray.map((f, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="bg-muted text-foreground text-[11px] font-normal"
                          >
                            {f.replace('_', ' ')}
                          </Badge>
                        ))}
                        {featsArray.length === 0 && (
                          <span className="text-muted-foreground text-xs italic">
                            None
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Plan Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="bg-popover text-popover-foreground border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base font-semibold">
              {editingPlan ? 'Edit Subscription Plan' : 'Add Subscription Plan'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Define pricing limits and feature availability for this tier.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePlanSubmit} className="space-y-4 py-2">
            <div className="grid gap-1.5">
              <Label
                htmlFor="planNameInput"
                className="text-muted-foreground text-xs font-medium"
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
                className="bg-background text-foreground border-border text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label
                  htmlFor="monthlyPriceInput"
                  className="text-muted-foreground text-xs font-medium"
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
                  className="bg-background text-foreground border-border text-xs"
                />
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="yearlyPriceInput"
                  className="text-muted-foreground text-xs font-medium"
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
                  className="bg-background text-foreground border-border text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label
                  htmlFor="maxUsersInput"
                  className="text-muted-foreground text-xs font-medium"
                >
                  Max Members
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
                  className="bg-background text-foreground border-border text-xs"
                />
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="maxContactsInput"
                  className="text-muted-foreground text-xs font-medium"
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
                  className="bg-background text-foreground border-border text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label
                  htmlFor="maxWhatsappInput"
                  className="text-muted-foreground text-xs font-medium"
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
                  className="bg-background text-foreground border-border text-xs"
                />
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="maxAiRequestsInput"
                  className="text-muted-foreground text-xs font-medium"
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
                  className="bg-background text-foreground border-border text-xs"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-muted-foreground text-xs font-medium">
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
                    className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-2 text-xs select-none"
                  >
                    <input
                      type="checkbox"
                      checked={planForm.features.includes(feat)}
                      onChange={() => toggleFeature(feat)}
                      className="border-border bg-background h-3.5 w-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    {feat.replace('_', ' ')}
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setPlanDialogOpen(false)}
                disabled={submittingPlan}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-xs font-medium"
                disabled={submittingPlan}
              >
                {submittingPlan && (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
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
