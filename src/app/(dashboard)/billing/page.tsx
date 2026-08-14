'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/appwrite-compat';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CreditCard,
  Plus,
  Loader2,
  Check,
  TrendingUp,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';

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

export default function BillingPage() {
  const { accountId } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'unpaid' | 'paid' | 'overdue'
  >('all');

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'unpaid' | 'paid'>('unpaid');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!accountId) return;
    const db = createClient();
    try {
      const { data: billRows } = await db
        .from('hospital_bills')
        .select(
          'id, bill_number, description, amount, status, created_at, patient:contacts(id, name, phone)'
        )
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      setBills((billRows as unknown as Bill[]) || []);

      const { data: pats } = await db
        .from('patients')
        .select('id, contact:contacts(name)')
        .eq('account_id', accountId);

      const mappedPats = (pats || []).map((p) => {
        const cData = p.contact as
          { name?: string } | { name?: string }[] | null;
        const cName =
          (Array.isArray(cData) ? cData[0]?.name : cData?.name) ||
          'Unknown Patient';
        return {
          id: p.id as string,
          name: cName,
        };
      });
      setPatients(mappedPats);
    } catch (err) {
      console.error('Error loading bills:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !amount || !accountId) {
      toast.error('Patient and amount are required');
      return;
    }

    setSaving(true);
    const db = createClient();
    try {
      const { error } = await db.from('hospital_bills').insert({
        account_id: accountId,
        patient_id: patientId,
        description: description || 'General Consultation & Treatment Fee',
        amount: parseFloat(amount),
        status: 'unpaid',
      });

      if (error) throw error;
      toast.success('Invoice generated successfully!');
      setPatientId('');
      setDescription('');
      setAmount('');
      setShowAddForm(false);
      loadData();
    } catch (err: unknown) {
      toast.error('Failed to generate bill: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (
    billId: string,
    newStatus: 'unpaid' | 'paid' | 'overdue'
  ) => {
    const db = createClient();
    try {
      const { error } = await db
        .from('hospital_bills')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', billId);

      if (error) throw error;
      toast.success(`Bill status updated to ${newStatus}.`);
      loadData();
    } catch (err: unknown) {
      toast.error('Status update failed: ' + (err as Error).message);
    }
  };

  const filteredBills = bills.filter((b) => {
    if (activeFilter === 'all') return true;
    return b.status === activeFilter;
  });

  const totalPaid = bills
    .filter((b) => b.status === 'paid')
    .reduce((sum, b) => sum + Number(b.amount), 0);
  const totalUnpaid = bills
    .filter((b) => b.status === 'unpaid')
    .reduce((sum, b) => sum + Number(b.amount), 0);
  const totalOverdue = bills
    .filter((b) => b.status === 'overdue')
    .reduce((sum, b) => sum + Number(b.amount), 0);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">
            Clinical Billing & Invoices
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Create invoices, manage patient payments, and track outpatient
            revenue.
          </p>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" /> Generate Invoice
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="bg-card border-border flex items-center gap-4 rounded-xl border p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="text-muted-foreground text-xs font-semibold uppercase">
              Total Collected
            </div>
            <div className="text-foreground mt-0.5 text-xl font-bold">
              ${totalPaid.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="bg-card border-border flex items-center gap-4 rounded-xl border p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-muted-foreground text-xs font-semibold uppercase">
              Pending Invoices
            </div>
            <div className="text-foreground mt-0.5 text-xl font-bold">
              ${totalUnpaid.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="bg-card border-border flex items-center gap-4 rounded-xl border p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-muted-foreground text-xs font-semibold uppercase">
              Overdue Amount
            </div>
            <div className="text-foreground mt-0.5 text-xl font-bold">
              ${totalOverdue.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleCreateBill}
          className="bg-card border-border animate-in fade-in slide-in-from-top-4 max-w-2xl space-y-4 rounded-xl border p-5 duration-200"
        >
          <h3 className="text-foreground font-bold">New Outpatient Invoice</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Select Patient *</Label>
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                required
                className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                <option value="">-- Select Patient --</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Service / Item Description *</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Cardiology Consultation Fee"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Amount (USD) *</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Initial Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'unpaid' | 'paid')}
                className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{' '}
              Issue Invoice
            </Button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="border-border flex border-b">
        {(['all', 'unpaid', 'paid', 'overdue'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`border-b-2 px-4 py-2 text-sm font-semibold capitalize transition-colors ${
              activeFilter === tab
                ? 'border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Bills listing */}
      {filteredBills.length === 0 ? (
        <div className="border-border mx-auto max-w-2xl rounded-xl border border-dashed p-12 text-center">
          <CreditCard className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="text-foreground text-lg font-bold">
            No invoices generated
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            There are no billing records matching this filter.
          </p>
        </div>
      ) : (
        <div className="bg-card border-border overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <table className="text-muted-foreground w-full text-left text-sm">
              <thead className="bg-muted/50 border-border text-foreground border-b text-xs font-semibold uppercase">
                <tr>
                  <th className="px-6 py-4">Invoice #</th>
                  <th className="px-6 py-4">Patient</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-border text-foreground divide-y">
                {filteredBills.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">
                      {b.bill_number}
                    </td>
                    <td className="px-6 py-4 font-semibold">
                      <div>
                        <div>{b.patient?.name || 'Unknown Patient'}</div>
                        <div className="text-muted-foreground text-xs font-normal">
                          {b.patient?.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">{b.description}</td>
                    <td className="text-primary px-6 py-4 font-bold">
                      ${Number(b.amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          b.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : b.status === 'unpaid'
                              ? 'animate-pulse bg-amber-500/10 text-amber-500'
                              : 'bg-red-500/10 text-red-500'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="flex items-center justify-end space-x-1.5 px-6 py-4 text-right">
                      {b.status !== 'paid' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(b.id, 'paid')}
                          className="cursor-pointer border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-500 hover:bg-emerald-500/20"
                        >
                          <Check className="mr-1 h-3.5 w-3.5" /> Mark Paid
                        </Button>
                      )}
                      {b.status === 'unpaid' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(b.id, 'overdue')}
                          className="cursor-pointer border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs text-red-500 hover:bg-red-500/20"
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
        </div>
      )}
    </div>
  );
}
