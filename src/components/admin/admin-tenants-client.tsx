'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Search, Loader2 } from 'lucide-react';
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
import { AdminNav } from './admin-nav';

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
  monthly_price: number;
  yearly_price: number;
}

export function AdminTenantsClient() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Subscription Edit Dialog State
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [editPlanId, setEditPlanId] = useState('');
  const [editStatus, setEditStatus] = useState<
    'trial' | 'active' | 'expired' | 'cancelled'
  >('trial');
  const [editEndDate, setEditEndDate] = useState('');
  const [submittingSub, setSubmittingSub] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [tRes, pRes] = await Promise.all([
        fetch('/api/admin/tenants'),
        fetch('/api/admin/plans'),
      ]);

      if (tRes.ok) {
        const tData = await tRes.json();
        setTenants(Array.isArray(tData) ? tData : []);
      }
      if (pRes.ok) {
        const pData = await pRes.json();
        setPlans(Array.isArray(pData) ? pData : []);
      }
    } catch (err) {
      console.error('Failed to load subscribers:', err);
      toast.error('Failed to load subscribers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTenant) {
      toast.error('No subscriber selected');
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
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
          >
            Active
          </Badge>
        );
      case 'trial':
        return (
          <Badge
            variant="outline"
            className="border-blue-500/30 bg-blue-500/10 text-xs font-semibold text-blue-600 dark:text-blue-400"
          >
            Trial
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge
            variant="outline"
            className="border-border bg-muted/60 text-muted-foreground text-xs font-semibold"
          >
            Suspended
          </Badge>
        );
      case 'expired':
        return (
          <Badge
            variant="outline"
            className="border-rose-500/30 bg-rose-500/10 text-xs font-semibold text-rose-600 dark:text-rose-400"
          >
            Expired
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
          >
            Active
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <AdminNav onRefresh={loadData} loading={loading} />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
            <Input
              placeholder="Search subscribers by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-border/80 bg-card text-foreground placeholder:text-muted-foreground focus-visible:border-primary h-9 rounded-xl pl-9 text-xs shadow-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs font-medium">
              Total Subscribers:{' '}
              <strong className="text-foreground">
                {filteredTenants.length}
              </strong>
            </span>
          </div>
        </div>

        <div className="border-border/60 bg-card/80 overflow-hidden rounded-[1.35rem] border shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)]">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="border-border/60 bg-muted/30 border-b">
                <TableRow>
                  <TableHead className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
                    Subscriber / Business
                  </TableHead>
                  <TableHead className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
                    Owner
                  </TableHead>
                  <TableHead className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
                    Plan
                  </TableHead>
                  <TableHead className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
                    Status
                  </TableHead>
                  <TableHead className="text-muted-foreground text-center text-[10px] font-bold tracking-[0.12em] uppercase">
                    Contacts
                  </TableHead>
                  <TableHead className="text-muted-foreground text-center text-[10px] font-bold tracking-[0.12em] uppercase">
                    Members
                  </TableHead>
                  <TableHead className="text-muted-foreground text-center text-[10px] font-bold tracking-[0.12em] uppercase">
                    AI Calls
                  </TableHead>
                  <TableHead className="text-muted-foreground text-right text-[10px] font-bold tracking-[0.12em] uppercase">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="text-muted-foreground flex items-center justify-center gap-2 text-xs">
                        <Loader2 className="text-primary h-4 w-4 animate-spin" />
                        Loading subscribers...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredTenants.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-muted-foreground h-32 text-center text-xs"
                    >
                      No subscribers found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTenants.map((t) => (
                    <TableRow
                      key={t.id}
                      className="border-border/40 hover:bg-muted/30 border-b transition-colors"
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2.5">
                          <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold">
                            {t.name?.charAt(0)?.toUpperCase() || 'B'}
                          </div>
                          <div>
                            <div className="text-foreground text-xs font-semibold">
                              {t.name}
                            </div>
                            <div className="text-muted-foreground text-[10px]">
                              Joined{' '}
                              {t.created_at
                                ? new Date(t.created_at).toLocaleDateString()
                                : 'Recent'}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-foreground text-xs font-medium">
                          {t.owner?.full_name || 'Admin'}
                        </div>
                        <div className="text-muted-foreground text-[11px]">
                          {t.owner?.email || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-foreground text-xs font-semibold">
                          {t.subscription?.plan?.name || 'Growth Premium'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getSubStatusBadge(t.subscription?.status)}
                      </TableCell>
                      <TableCell className="text-foreground text-center text-xs font-medium tabular-nums">
                        {t.contactsCount ?? 0}
                      </TableCell>
                      <TableCell className="text-foreground text-center text-xs font-medium tabular-nums">
                        {t.membersCount ?? 0}
                      </TableCell>
                      <TableCell className="text-foreground text-center text-xs font-medium tabular-nums">
                        {(t.usage?.aiRequests ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenSubDialog(t)}
                          className="border-border/80 hover:bg-muted/80 h-7 rounded-lg text-[11px] font-medium"
                        >
                          Edit Tier
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

      {/* Subscription Tier Editor Modal */}
      <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
        <DialogContent className="border-border/60 bg-card rounded-2xl border p-6 shadow-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base font-semibold">
              Edit Subscription — {selectedTenant?.name}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Adjust plan tier, status, and expiration date for this business
              account.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-foreground text-xs font-medium">
                Pricing Plan
              </Label>
              <Select
                value={editPlanId}
                onValueChange={(val) => setEditPlanId(val || '')}
              >
                <SelectTrigger className="border-border/80 h-9 rounded-xl text-xs">
                  <SelectValue placeholder="Select Plan" />
                </SelectTrigger>
                <SelectContent className="border-border/80 rounded-xl">
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name} (₹{p.monthly_price || 0}/mo)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-foreground text-xs font-medium">
                Status
              </Label>
              <Select
                value={editStatus}
                onValueChange={(val) =>
                  setEditStatus(
                    val as 'trial' | 'active' | 'expired' | 'cancelled'
                  )
                }
              >
                <SelectTrigger className="border-border/80 h-9 rounded-xl text-xs">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent className="border-border/80 rounded-xl">
                  <SelectItem value="trial" className="text-xs">
                    Trial (14-day)
                  </SelectItem>
                  <SelectItem value="active" className="text-xs">
                    Active (Paid)
                  </SelectItem>
                  <SelectItem value="expired" className="text-xs">
                    Expired
                  </SelectItem>
                  <SelectItem value="cancelled" className="text-xs">
                    Suspended / Cancelled
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-foreground text-xs font-medium">
                Billing / Trial End Date
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
                onClick={() => setSubDialogOpen(false)}
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
    </div>
  );
}
