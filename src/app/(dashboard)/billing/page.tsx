'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle,
  CreditCard,
  Loader2,
  Plus,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';

interface Bill {
  id: string;
  bill_number: string;
  description: string;
  amount: number;
  status: 'unpaid' | 'paid' | 'overdue';
  created_at: string;
  patient: { id: string; name: string; phone: string } | null;
}

interface Patient {
  id: string;
  name: string;
}

interface ContactRow {
  id: string;
  name?: string;
  phone?: string;
}

async function readJson(response: Response) {
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}

export default function BillingPage() {
  const { accountId } = useAuth();
  const { terminology } = useWorkspace();
  const [bills, setBills] = useState<Bill[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'unpaid' | 'paid' | 'overdue'
  >('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'unpaid' | 'paid'>('unpaid');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);

    const requestOptions: RequestInit = {
      credentials: 'include',
      cache: 'no-store',
    };

    try {
      const [billingResult, contactsResult] = await Promise.allSettled([
        fetch('/api/billing', requestOptions).then(readJson),
        fetch('/api/contacts?limit=100', requestOptions).then(readJson),
      ]);

      if (billingResult.status === 'fulfilled') {
        setBills((billingResult.value.data as Bill[]) || []);
      } else {
        console.error('Failed to load bills:', billingResult.reason);
        setBills([]);
      }

      if (contactsResult.status === 'fulfilled') {
        const contacts = (contactsResult.value.data || []) as ContactRow[];
        setPatients(
          contacts.map((contact) => {
            const name = contact.name || terminology.person;
            return {
              id: contact.id,
              name: contact.phone ? `${name} (${contact.phone})` : name,
            };
          })
        );
      } else {
        console.warn('Failed to load billing contacts:', contactsResult.reason);
        setPatients([]);
      }
    } finally {
      setLoading(false);
    }
  }, [accountId, terminology.person]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreateBill(event: React.FormEvent) {
    event.preventDefault();
    if (!patientId || !amount || !accountId) {
      toast.error(`${terminology.person} and amount are required`);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          description: description || `General ${terminology.service} Fee`,
          amount: Number.parseFloat(amount),
          status,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to generate bill');
      }

      toast.success('Invoice generated successfully!');
      setPatientId('');
      setDescription('');
      setAmount('');
      setStatus('unpaid');
      setShowAddForm(false);
      await loadData();
    } catch (error) {
      toast.error(`Failed to generate bill: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStatus(
    billId: string,
    nextStatus: Bill['status']
  ) {
    try {
      const response = await fetch(`/api/billing/${billId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to update bill status');
      }
      toast.success(`Bill status updated to ${nextStatus}.`);
      await loadData();
    } catch (error) {
      toast.error(`Status update failed: ${(error as Error).message}`);
    }
  }

  const totals = useMemo(
    () =>
      bills.reduce(
        (result, bill) => ({
          ...result,
          [bill.status]: result[bill.status] + Number(bill.amount),
        }),
        { paid: 0, unpaid: 0, overdue: 0 }
      ),
    [bills]
  );

  const filteredBills = useMemo(
    () =>
      bills.filter(
        (bill) => activeFilter === 'all' || bill.status === activeFilter
      ),
    [activeFilter, bills]
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  const metricCards = [
    {
      label: 'Total Collected',
      value: totals.paid,
      icon: TrendingUp,
      tone: 'text-emerald-500 bg-emerald-500/10',
    },
    {
      label: 'Pending Invoices',
      value: totals.unpaid,
      icon: AlertCircle,
      tone: 'text-amber-500 bg-amber-500/10',
    },
    {
      label: 'Overdue Amount',
      value: totals.overdue,
      icon: CheckCircle,
      tone: 'text-red-500 bg-red-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">
            Billing & Invoices
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Create invoices, manage {terminology.person.toLowerCase()} payments,
            and track revenue.
          </p>
        </div>
        <Button onClick={() => setShowAddForm((open) => !open)}>
          <Plus className="mr-2 h-4 w-4" /> Generate Invoice
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {metricCards.map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className="bg-card border-border flex items-center gap-4 rounded-xl border p-5"
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-muted-foreground text-xs font-semibold uppercase">
                {label}
              </div>
              <div className="text-foreground mt-0.5 text-xl font-bold">
                ${value.toFixed(2)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAddForm && (
        <form
          onSubmit={handleCreateBill}
          className="bg-card border-border max-w-2xl space-y-4 rounded-xl border p-5"
        >
          <h3 className="text-foreground font-bold">New Outpatient Invoice</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Select {terminology.person} *</Label>
              <select
                value={patientId}
                onChange={(event) => setPatientId(event.target.value)}
                required
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              >
                <option value="">-- Select {terminology.person} --</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{terminology.service} / Item Description *</Label>
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Amount (USD) *</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Initial Status</Label>
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as 'unpaid' | 'paid')
                }
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              >
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Issue
              Invoice
            </Button>
          </div>
        </form>
      )}

      <div className="border-border flex border-b">
        {(['all', 'unpaid', 'paid', 'overdue'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`border-b-2 px-4 py-2 text-sm font-semibold capitalize ${activeFilter === filter ? 'border-primary text-primary' : 'text-muted-foreground border-transparent'}`}
          >
            {filter}
          </button>
        ))}
      </div>

      {filteredBills.length === 0 ? (
        <div className="border-border rounded-xl border border-dashed p-12 text-center">
          <CreditCard className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="text-foreground text-lg font-bold">
            No invoices generated
          </h3>
        </div>
      ) : (
        <div className="bg-card border-border overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-border border-b text-xs uppercase">
              <tr>
                <th className="px-6 py-4">Invoice #</th>
                <th className="px-6 py-4">{terminology.person}</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {filteredBills.map((bill) => (
                <tr key={bill.id} className="hover:bg-muted/30">
                  <td className="px-6 py-4 font-bold">{bill.bill_number}</td>
                  <td className="px-6 py-4 font-semibold">
                    <div>
                      {bill.patient?.name || `Unknown ${terminology.person}`}
                    </div>
                    <div className="text-muted-foreground text-xs font-normal">
                      {bill.patient?.phone}
                    </div>
                  </td>
                  <td className="px-6 py-4">{bill.description}</td>
                  <td className="text-primary px-6 py-4 font-bold">
                    ${Number(bill.amount).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold uppercase">
                      {bill.status}
                    </span>
                  </td>
                  <td className="space-x-2 px-6 py-4 text-right">
                    {bill.status !== 'paid' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(bill.id, 'paid')}
                      >
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Mark Paid
                      </Button>
                    )}
                    {bill.status === 'unpaid' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(bill.id, 'overdue')}
                      >
                        Overdue
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
