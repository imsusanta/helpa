'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Search,
  Trash2,
  Receipt,
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

interface QuotationItemRow {
  description: string;
  quantity: number;
  unit_price: number;
}

interface QuotationModel {
  id: string;
  quotation_number: string;
  contact_id: string;
  deal_id?: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  valid_until?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
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
  quotation_items?: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
}

const STATUS_BADGE_VARIANTS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  expired: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function QuotationsPage() {
  const { terminology } = useWorkspace();
  const [quotations, setQuotations] = useState<QuotationModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Quotation Details Drawer
  const [selectedQuotation, setSelectedQuotation] =
    useState<QuotationModel | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [converting, setConverting] = useState(false);

  // Create Quotation Dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [contacts, setContacts] = useState<
    Array<{ id: string; name: string; phone: string }>
  >([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [terms] = useState('Payment due within 15 days from issuance.');
  const [items, setItems] = useState<QuotationItemRow[]>([
    { description: terminology.service, quantity: 1, unit_price: 1500 },
  ]);
  const [creating, setCreating] = useState(false);

  const loadQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const data = await salesApi<QuotationModel[]>(
        `/api/quotations?${params.toString()}`
      );
      setQuotations(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to load quotations');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    loadQuotations();
  }, [loadQuotations]);

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
    field: keyof QuotationItemRow,
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

  const handleCreateQuotation = async (e: React.FormEvent) => {
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
      await salesApi('/api/quotations', {
        method: 'POST',
        body: JSON.stringify({
          contact_id: selectedContactId,
          valid_until: validUntil || undefined,
          tax_rate: Number(taxRate) || 0,
          discount_amount: Number(discountAmount) || 0,
          notes: notes || undefined,
          terms: terms || undefined,
          currency: 'INR',
          items,
        }),
      });

      toast.success('Quotation created successfully');
      setCreateOpen(false);
      setSelectedContactId('');
      setItems([
        {
          description: terminology.service,
          quantity: 1,
          unit_price: 1500,
        },
      ]);
      loadQuotations();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to create quotation');
    } finally {
      setCreating(false);
    }
  };

  const handleConvertToInvoice = async (quotationId: string) => {
    setConverting(true);
    try {
      const res = await salesApi<{ message?: string }>(
        `/api/quotations/${quotationId}/convert-to-invoice`,
        {
          method: 'POST',
        }
      );
      toast.success(res?.message || 'Converted to invoice successfully!');
      setDrawerOpen(false);
      loadQuotations();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to convert to invoice');
    } finally {
      setConverting(false);
    }
  };

  const handleStatusUpdate = async (quotationId: string, status: string) => {
    try {
      const updated = await salesApi<QuotationModel>(
        `/api/quotations/${quotationId}/status`,
        {
          method: 'POST',
          body: JSON.stringify({ status }),
        }
      );
      toast.success(`Quotation marked as ${status}`);
      setSelectedQuotation(updated);
      loadQuotations();
    } catch (err: unknown) {
      toast.error(
        (err as Error).message || 'Failed to update quotation status'
      );
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1536px] space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">
            Quotations / Estimates
          </h1>
          <p className="text-sm font-medium text-slate-500">
            Generate formal estimates, send via WhatsApp, and seamlessly convert
            to invoices upon approval.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="h-10 gap-1.5 rounded-xl bg-[#00b074] px-4 text-xs font-bold text-white hover:bg-[#009b66]"
        >
          <Plus className="h-4 w-4" />
          Create Quotation
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by quote number or notes..."
            className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          {['all', 'draft', 'sent', 'accepted', 'rejected'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Quotations List */}
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
        ) : quotations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <FileText className="h-12 w-12 text-slate-300" />
            <h3 className="mt-3 text-base font-semibold text-slate-800">
              No quotations found
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Create an estimate or quotation to send to your prospects.
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              variant="outline"
              size="sm"
              className="mt-4 rounded-xl text-xs"
            >
              Create Quotation
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3.5">Quotation #</th>
                  <th className="px-5 py-3.5">{terminology.person}</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Total Amount</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotations.map((q) => (
                  <tr
                    key={q.id}
                    onClick={() => {
                      setSelectedQuotation(q);
                      setDrawerOpen(true);
                    }}
                    className="cursor-pointer transition-colors hover:bg-slate-50/80"
                  >
                    <td className="px-5 py-4 font-bold text-slate-900">
                      {q.quotation_number}
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-700">
                      {q.contacts?.name || terminology.person}
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {new Date(q.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                          STATUS_BADGE_VARIANTS[q.status] ||
                          STATUS_BADGE_VARIANTS.draft
                        }`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-extrabold text-slate-900">
                      ₹
                      {q.total.toLocaleString('en-IN', {
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
                          setSelectedQuotation(q);
                          setDrawerOpen(true);
                        }}
                      >
                        View Details
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Quotation Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Quotation / Estimate</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateQuotation} className="space-y-4 pt-2">
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
                <Label className="text-xs">Valid Until Date</Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
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
              <Label className="text-xs">Notes / Instructions</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional details for the client..."
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
                {creating ? 'Creating...' : 'Save & Generate Quotation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quotation Details Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          {selectedQuotation && (
            <div className="flex h-full flex-col justify-between">
              <SheetHeader className="border-b pb-4">
                <div className="flex items-center justify-between">
                  <SheetTitle className="text-lg font-bold text-slate-900">
                    {selectedQuotation.quotation_number}
                  </SheetTitle>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                      STATUS_BADGE_VARIANTS[selectedQuotation.status] ||
                      STATUS_BADGE_VARIANTS.draft
                    }`}
                  >
                    {selectedQuotation.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Issued on{' '}
                  {new Date(selectedQuotation.created_at).toLocaleDateString()}
                </p>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto py-5 text-xs">
                {/* Client Info */}
                <div className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                  <h4 className="text-[11px] font-bold tracking-wider text-slate-800 uppercase">
                    {terminology.person}
                  </h4>
                  <p className="font-semibold text-slate-900">
                    {selectedQuotation.contacts?.name || terminology.person}
                  </p>
                  <p className="text-slate-600">
                    {selectedQuotation.contacts?.phone}
                  </p>
                  {selectedQuotation.contacts?.email && (
                    <p className="text-slate-600">
                      {selectedQuotation.contacts?.email}
                    </p>
                  )}
                </div>

                {/* Items Breakdown */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold tracking-wider text-slate-800 uppercase">
                    Quotation Line Items
                  </h4>
                  <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                    {(selectedQuotation.quotation_items || []).map((it) => (
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

                {/* Total Summary */}
                <div className="space-y-1.5 rounded-xl bg-slate-50 p-4 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span>
                      ₹
                      {selectedQuotation.subtotal.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tax</span>
                    <span>
                      ₹
                      {selectedQuotation.tax_amount.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  {selectedQuotation.discount_amount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Discount</span>
                      <span>
                        - ₹
                        {selectedQuotation.discount_amount.toLocaleString(
                          'en-IN',
                          { minimumFractionDigits: 2 }
                        )}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 text-base font-extrabold text-slate-900">
                    <span>Grand Total</span>
                    <span>
                      ₹
                      {selectedQuotation.total.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>

                {/* Status Changer Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {selectedQuotation.status === 'draft' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleStatusUpdate(selectedQuotation.id, 'sent')
                      }
                      className="text-xs"
                    >
                      Mark as Sent
                    </Button>
                  )}
                  {selectedQuotation.status !== 'accepted' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleStatusUpdate(selectedQuotation.id, 'accepted')
                      }
                      className="text-xs text-emerald-600"
                    >
                      Mark as Accepted
                    </Button>
                  )}
                  {selectedQuotation.status !== 'rejected' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleStatusUpdate(selectedQuotation.id, 'rejected')
                      }
                      className="text-xs text-rose-600"
                    >
                      Mark as Rejected
                    </Button>
                  )}
                </div>
              </div>

              {/* Convert to Invoice Action */}
              <div className="space-y-2 border-t pt-4">
                <Button
                  disabled={converting}
                  onClick={() => handleConvertToInvoice(selectedQuotation.id)}
                  className="h-10 w-full gap-1.5 rounded-xl bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
                >
                  <Receipt className="h-4 w-4" />
                  {converting ? 'Converting...' : 'Convert to Invoice'}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
