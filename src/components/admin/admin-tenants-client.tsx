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
      console.error('Failed to load tenants:', err);
      toast.error('Failed to load tenants');
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
            className="border-emerald-500/30 bg-emerald-500/10 text-xs font-medium text-emerald-600 dark:text-emerald-400"
          >
            Active
          </Badge>
        );
      case 'trial':
        return (
          <Badge
            variant="outline"
            className="border-blue-500/30 bg-blue-500/10 text-xs font-medium text-blue-600 dark:text-blue-400"
          >
            Trial
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge
            variant="outline"
            className="bg-muted text-muted-foreground border-border text-xs font-medium"
          >
            Suspended
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-xs font-medium text-emerald-600 dark:text-emerald-400"
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
        <div className="flex items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
            <Input
              placeholder="Search tenants by name, owner, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-card text-foreground border-border h-9 pl-9 text-xs"
            />
          </div>
        </div>

        <div className="bg-card border-border overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30 border-border border-b">
                <TableRow>
                  <TableHead className="text-muted-foreground text-xs font-semibold">
                    Company / Tenant
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold">
                    Owner
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold">
                    Plan
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold">
                    Status
                  </TableHead>
                  <TableHead className="text-muted-foreground text-center text-xs font-semibold">
                    Contacts
                  </TableHead>
                  <TableHead className="text-muted-foreground text-center text-xs font-semibold">
                    Members
                  </TableHead>
                  <TableHead className="text-muted-foreground text-center text-xs font-semibold">
                    AI Requests
                  </TableHead>
                  <TableHead className="text-muted-foreground text-right text-xs font-semibold">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center">
                      <Loader2 className="text-muted-foreground mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : filteredTenants.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-muted-foreground py-8 text-center"
                    >
                      No tenants match your search query.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTenants.map((t) => (
                    <TableRow
                      key={t.id}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      <TableCell className="text-foreground font-medium">
                        {t.name}
                      </TableCell>
                      <TableCell>
                        <div className="text-foreground font-medium">
                          {t.owner?.full_name || 'Unassigned'}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {t.owner?.email || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">
                        {t.subscription?.plan?.name || 'Growth Plan'}
                      </TableCell>
                      <TableCell>
                        {getSubStatusBadge(t.subscription?.status || 'active')}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {t.contactsCount}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {t.membersCount}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {t.usage?.aiRequests ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs font-medium"
                          onClick={() => handleOpenSubDialog(t)}
                        >
                          Manage
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

      {/* Edit Subscription Dialog */}
      <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
        <DialogContent className="bg-popover text-popover-foreground border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base font-semibold">
              Manage Tenant Subscription
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Modify the subscription tier and billing dates for{' '}
              {selectedTenant?.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubSubmit} className="space-y-4 py-2">
            <div className="grid gap-1.5">
              <Label
                htmlFor="planSelect"
                className="text-muted-foreground text-xs font-medium"
              >
                Billing Plan
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

            <div className="grid gap-1.5">
              <Label
                htmlFor="statusSelect"
                className="text-muted-foreground text-xs font-medium"
              >
                Subscription Status
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

            <div className="grid gap-1.5">
              <Label
                htmlFor="endDateInput"
                className="text-muted-foreground text-xs font-medium"
              >
                Contract Expiration Date
              </Label>
              <Input
                id="endDateInput"
                type="date"
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
                className="bg-background text-foreground border-border text-xs"
              />
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setSubDialogOpen(false)}
                disabled={submittingSub}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-xs font-medium"
                disabled={submittingSub}
              >
                {submittingSub && (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                )}
                Apply Subscription
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
