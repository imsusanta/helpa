'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Trash2,
  CreditCard,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { salesApi } from '@/lib/sales/api-client';
import { useWorkspace } from '@/hooks/use-workspace';

interface InvoiceItemRow {
  description: string;
  quantity: number;
  unit_price: number;
}

interface InvoiceModel {
  id: string;
  invoice_number: string;
  contact_id: string;
  deal_id?: string;
  status: 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'void';
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  amount_paid: number;
  currency: string;
  notes?: string;
  terms?: string;
  created_at: string;
  contacts?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
  };
  invoice_items?: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  invoice_payments?: Array<{
    id: string;
    amount: number;
    currency: string;
    payment_method: string;
    transaction_reference?: string;
    notes?: string;
    payment_date: string;
  }>;
}

const STATUS_BADGE_VARIANTS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partially_paid: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  overdue: 'bg-rose-50 text-rose-700 border-rose-200',
  void: 'bg-slate-200 text-slate-500 border-slate-300',
};

export default function InvoicesPage() {
  const { terminology } = useWorkspace();
  const [invoices, setInvoices] = useState<InvoiceModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Invoice Details Sheet
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceModel | null>(
    null
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Record Payment Dialog
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Create Invoice Dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [contacts, setContacts] = useState<
    Array<{ id: string; name: string; phone: string }>
  >([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [terms] = useState('Payment due upon invoice presentation.');
  const [items, setItems] = useState<InvoiceItemRow[]>([
    {
      description: `${terminology.service} / Consultation`,
      quantity: 1,
      unit_price: 2000,
    },
  ]);
  const [creating, setCreating] = useState(false);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const data = await salesApi<InvoiceModel[]>(
        `/api/invoices?${params.toString()}`
      );
      setInvoices(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    if (createOpen) {
      salesApi<Array<{ id: string; name: string; phone: string }>>(
        '/api/contacts'
      )
        .then((res) => {
          if (Array.isArray(res)) setContacts(res);
        })
        .catch(() => {});
    }
  }, [createOpen]);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { description: '', quantity: 1, unit_price: 0 },
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleItemChange = (
    idx: number,
    field: keyof InvoiceItemRow,
    val: string | number
  ) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    );
  };

  const subtotal = items.reduce(
    (sum, it) =>
      sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0
  );
  const tax = (subtotal * (Number(taxRate) || 0)) / 100;
  const total = Math.max(0, subtotal + tax - (Number(discountAmount) || 0));

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId) {
      toast.error('Please select a customer');
      return;
    }
    if (items.some((it) => !it.description.trim())) {
      toast.error('All line items must have a description');
      return;
    }

    setCreating(true);
    try {
      await salesApi('/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          contact_id: selectedContactId,
          due_date: dueDate || undefined,
          tax_rate: Number(taxRate) || 0,
          discount_amount: Number(discountAmount) || 0,
          notes: notes || undefined,
          terms: terms || undefined,
          currency: 'INR',
          items,
        }),
      });

      toast.success('Invoice created successfully');
      setCreateOpen(false);
      setSelectedContactId('');
      setItems([
        {
          description: `${terminology.service} / Consultation`,
          quantity: 1,
          unit_price: 2000,
        },
      ]);
      loadInvoices();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to create invoice');
    } finally {
      setCreating(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    const amountNum = Number(paymentAmount);
    if (!amountNum || amountNum <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setRecordingPayment(true);
    try {
      const res = await salesApi<{ message?: string; data?: InvoiceModel }>(
        `/api/invoices/${selectedInvoice.id}/payments`,
        {
          method: 'POST',
          body: JSON.stringify({
            amount: amountNum,
            payment_method: paymentMethod,
            transaction_reference: paymentRef || undefined,
            notes: paymentNotes || undefined,
          }),
        }
      );

      toast.success(res?.message || 'Payment recorded successfully!');
      setPaymentOpen(false);
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
      if (res?.data) {
        setSelectedInvoice(res.data);
      }
      loadInvoices();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
    }
  };

  const totalInvoiced = invoices.reduce(
    (sum, inv) => sum + (inv.total || 0),
    0
  );
  const totalCollected = invoices.reduce(
    (sum, inv) => sum + (inv.amount_paid || 0),
    0
  );
  const totalOutstanding = Math.max(0, totalInvoiced - totalCollected);

  return (
    <div className="mx-auto w-full max-w-[1536px] space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">
            Invoices & Billing
          </h1>
          <p className="text-sm font-medium text-slate-500">
            Create tax invoices, collect payments via UPI/Card, and monitor
            receivables.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="h-10 gap-1.5 rounded-xl bg-[#00b074] px-4 text-xs font-bold text-white hover:bg-[#009b66]"
        >
          <Plus className="h-4 w-4" />
          Create Invoice
        </Button>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <span className="text-[12px] font-bold tracking-wider text-slate-500 uppercase">
            Total Invoiced
          </span>
          <div className="mt-2 text-2xl font-extrabold text-[#0f172a]">
            ₹
            {totalInvoiced.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <span className="text-[12px] font-bold tracking-wider text-slate-500 uppercase">
            Total Revenue Collected
          </span>
          <div className="mt-2 text-2xl font-extrabold text-[#10b981]">
            ₹
            {totalCollected.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <span className="text-[12px] font-bold tracking-wider text-slate-500 uppercase">
            Outstanding Receivables
          </span>
          <div className="mt-2 text-2xl font-extrabold text-[#f59e0b]">
            ₹
            {totalOutstanding.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice number or notes..."
            className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          {['all', 'draft', 'sent', 'paid', 'partially_paid', 'overdue'].map(
            (st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            )
          )}
        </div>
      </div>

      {/* Invoices List */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        {loading ? (
          <div className="space-y-4 p-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-12 w-full animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Receipt className="h-12 w-12 text-slate-300" />
            <h3 className="mt-3 text-base font-semibold text-slate-800">
              No invoices found
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Create an invoice to bill your customers and record collections.
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              variant="outline"
              size="sm"
              className="mt-4 rounded-xl text-xs"
            >
              Create Invoice
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3.5">Invoice #</th>
                  <th className="px-5 py-3.5">{terminology.person}</th>
                  <th className="px-5 py-3.5">Due Date</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Total</th>
                  <th className="px-5 py-3.5 text-right">Paid</th>
                  <th className="px-5 py-3.5 text-right">Balance Due</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => {
                  const balanceDue = Math.max(
                    0,
                    inv.total - (inv.amount_paid || 0)
                  );
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => {
                        setSelectedInvoice(inv);
                        setDrawerOpen(true);
                      }}
                      className="cursor-pointer transition-colors hover:bg-slate-50/80"
                    >
                      <td className="px-5 py-4 font-bold text-slate-900">
                        {inv.invoice_number}
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-700">
                        {inv.contacts?.name || terminology.person}
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {new Date(inv.due_date).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                            STATUS_BADGE_VARIANTS[inv.status] ||
                            STATUS_BADGE_VARIANTS.draft
                          }`}
                        >
                          {inv.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-extrabold text-slate-900">
                        ₹
                        {inv.total.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-emerald-600">
                        ₹
                        {inv.amount_paid.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-5 py-4 text-right font-extrabold text-amber-600">
                        ₹
                        {balanceDue.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInvoice(inv);
                            setDrawerOpen(true);
                          }}
                        >
                          Details
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Invoice Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Invoice</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateInvoice} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Select {terminology.person} *</Label>
                <select
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800"
                  required
                >
                  <option value="">-- Choose {terminology.person} --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Due Date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold tracking-wider text-slate-800 uppercase">
                  Line Items
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="h-7 gap-1 text-[11px]"
                >
                  <Plus className="h-3 w-3" />
                  Add Line Item
                </Button>
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={item.description}
                      onChange={(e) =>
                        handleItemChange(idx, 'description', e.target.value)
                      }
                      placeholder="Item description or service name"
                      className="flex-1 text-xs"
                      required
                    />
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemChange(
                          idx,
                          'quantity',
                          Number(e.target.value)
                        )
                      }
                      placeholder="Qty"
                      className="w-20 text-xs"
                      required
                    />
                    <Input
                      type="number"
                      min="0"
                      value={item.unit_price}
                      onChange={(e) =>
                        handleItemChange(
                          idx,
                          'unit_price',
                          Number(e.target.value)
                        )
                      }
                      placeholder="Price"
                      className="w-28 text-xs"
                      required
                    />
                    <div className="w-24 text-right text-xs font-bold text-slate-700">
                      ₹
                      {(item.quantity * item.unit_price).toLocaleString(
                        'en-IN'
                      )}
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Tax and Discount */}
            <div className="grid grid-cols-2 gap-4 border-t pt-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tax Rate (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  placeholder="0"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Discount (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="0"
                  className="text-xs"
                />
              </div>
            </div>

            {/* Calculations Summary */}
            <div className="space-y-1.5 rounded-xl bg-slate-50 p-4 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>
                  ₹
                  {subtotal.toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax ({taxRate}%)</span>
                <span>
                  ₹{tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {Number(discountAmount) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Discount</span>
                  <span>
                    - ₹
                    {Number(discountAmount).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1.5 text-sm font-extrabold text-slate-900">
                <span>Total Amount</span>
                <span>
                  ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes / Payment Terms</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Payment instructions or bank account details..."
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="bg-[#00b074] text-xs font-bold text-white hover:bg-[#009b66]"
              >
                {creating ? 'Creating...' : 'Save & Issue Invoice'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invoice Details Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          {selectedInvoice && (
            <div className="flex h-full flex-col justify-between">
              <SheetHeader className="border-b pb-4">
                <div className="flex items-center justify-between">
                  <SheetTitle className="text-lg font-bold text-slate-900">
                    {selectedInvoice.invoice_number}
                  </SheetTitle>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                      STATUS_BADGE_VARIANTS[selectedInvoice.status] ||
                      STATUS_BADGE_VARIANTS.draft
                    }`}
                  >
                    {selectedInvoice.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Due by{' '}
                  {new Date(selectedInvoice.due_date).toLocaleDateString()}
                </p>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto py-5 text-xs">
                {/* Client Info */}
                <div className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                  <h4 className="text-[11px] font-bold tracking-wider text-slate-800 uppercase">
                    {terminology.person}
                  </h4>
                  <p className="font-semibold text-slate-900">
                    {selectedInvoice.contacts?.name || terminology.person}
                  </p>
                  <p className="text-slate-600">
                    {selectedInvoice.contacts?.phone}
                  </p>
                  {selectedInvoice.contacts?.email && (
                    <p className="text-slate-600">
                      {selectedInvoice.contacts?.email}
                    </p>
                  )}
                </div>

                {/* Items Breakdown */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold tracking-wider text-slate-800 uppercase">
                    Invoice Line Items
                  </h4>
                  <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                    {(selectedInvoice.invoice_items || []).map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between p-3"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            {it.description}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {it.quantity} × ₹
                            {it.unit_price.toLocaleString('en-IN')}
                          </p>
                        </div>
                        <span className="font-bold text-slate-800">
                          ₹
                          {it.total.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total and Balance Summary */}
                <div className="space-y-1.5 rounded-xl bg-slate-50 p-4 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Invoice Total</span>
                    <span>
                      ₹
                      {selectedInvoice.total.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold text-emerald-600">
                    <span>Total Paid</span>
                    <span>
                      ₹
                      {selectedInvoice.amount_paid.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-base font-extrabold text-amber-600">
                    <span>Balance Due</span>
                    <span>
                      ₹
                      {Math.max(
                        0,
                        selectedInvoice.total - selectedInvoice.amount_paid
                      ).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>

                {/* Payment History */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold tracking-wider text-slate-800 uppercase">
                    Payment History (
                    {selectedInvoice.invoice_payments?.length || 0})
                  </h4>
                  {!selectedInvoice.invoice_payments ||
                  selectedInvoice.invoice_payments.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No payments recorded yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                      {selectedInvoice.invoice_payments.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-3 text-xs"
                        >
                          <div>
                            <span className="font-bold text-emerald-600">
                              +₹
                              {p.amount.toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                            <span className="block text-[10px] text-slate-400 uppercase">
                              {p.payment_method}{' '}
                              {p.transaction_reference
                                ? `• Ref: ${p.transaction_reference}`
                                : ''}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(p.payment_date).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 border-t pt-4">
                <Button
                  onClick={() => {
                    const balance = Math.max(
                      0,
                      selectedInvoice.total - selectedInvoice.amount_paid
                    );
                    setPaymentAmount(String(balance > 0 ? balance : ''));
                    setPaymentOpen(true);
                  }}
                  className="h-10 w-full gap-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  <CreditCard className="h-4 w-4" />
                  Record Payment
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Record Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Record Payment for {selectedInvoice?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRecordPayment} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Payment Amount (₹) *</Label>
              <Input
                type="number"
                min="1"
                step="any"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Amount paid"
                className="text-xs"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Payment Method</Label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800"
              >
                <option value="upi">UPI / GPay / PhonePe</option>
                <option value="card">Credit / Debit Card</option>
                <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Transaction Reference / UTR Number
              </Label>
              <Input
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="e.g. UPI Ref / Bank Txn ID"
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Input
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Optional payment notes"
                className="text-xs"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaymentOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={recordingPayment}
                className="bg-[#00b074] text-xs font-bold text-white hover:bg-[#009b66]"
              >
                {recordingPayment ? 'Recording...' : 'Confirm & Save Payment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
