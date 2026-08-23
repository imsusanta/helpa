'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  tags?: string[] | null;
  created_at: string;
  dealsCount: number;
  invoicesCount: number;
  quotationsCount: number;
  totalRevenue: number;
  openDealsValue: number;
  metadata?: Record<string, unknown>;
}

export default function CustomersPage() {
  const { terminology } = useWorkspace();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTag] = useState('all');

  // Customer Details Sheet
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(
    null
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Create Customer Dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [creating, setCreating] = useState(false);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (selectedTag !== 'all') params.set('tag', selectedTag);

      const data = await salesApi<CustomerRow[]>(
        `/api/customers?${params.toString()}`
      );
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      toast.error(
        (err as Error).message ||
          `Failed to load ${terminology.people.toLowerCase()}`
      );
    } finally {
      setLoading(false);
    }
  }, [search, selectedTag, terminology.people]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadCustomers]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(`${terminology.person} name is required`);
      return;
    }
    setCreating(true);
    try {
      const tags = tagInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (tags.length === 0) tags.push(terminology.person);

      await salesApi('/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          tags,
        }),
      });

      toast.success(`${terminology.person} added successfully`);
      setCreateOpen(false);
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setTagInput('');
      loadCustomers();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to create customer');
    } finally {
      setCreating(false);
    }
  };

  const totalRevenueAll = customers.reduce(
    (sum, c) => sum + (c.totalRevenue || 0),
    0
  );
  const totalOpenDeals = customers.reduce(
    (sum, c) => sum + (c.openDealsValue || 0),
    0
  );

  return (
    <div className="mx-auto w-full max-w-[1536px] space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">
            {terminology.people}
          </h1>
          <p className="text-sm font-medium text-slate-500">
            View accounts, linked deals, quotation histories, and invoices in
            one place.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="h-10 gap-1.5 rounded-xl bg-[#00b074] px-4 text-xs font-bold text-white hover:bg-[#009b66]"
        >
          <Plus className="h-4 w-4" />
          Add {terminology.person}
        </Button>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <span className="text-[12px] font-bold tracking-wider text-slate-500 uppercase">
            Total {terminology.people}
          </span>
          <div className="mt-2 text-2xl font-extrabold text-[#0f172a]">
            {customers.length}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <span className="text-[12px] font-bold tracking-wider text-slate-500 uppercase">
            Total Revenue Collected
          </span>
          <div className="mt-2 text-2xl font-extrabold text-[#10b981]">
            ₹
            {totalRevenueAll.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <span className="text-[12px] font-bold tracking-wider text-slate-500 uppercase">
            Active {terminology.pipelineItems} {terminology.pipeline}
          </span>
          <div className="mt-2 text-2xl font-extrabold text-[#2563eb]">
            ₹
            {totalOpenDeals.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers by name, phone, or email..."
            className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-9 text-xs"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        {loading ? (
          <div className="space-y-4 p-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-12 w-full animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Users className="h-12 w-12 text-slate-300" />
            <h3 className="mt-3 text-base font-semibold text-slate-800">
              No customers found
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Create a new customer or convert an incoming lead to get started.
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              variant="outline"
              size="sm"
              className="mt-4 rounded-xl text-xs"
            >
              Add First {terminology.person}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3.5">{terminology.person} Name</th>
                  <th className="px-5 py-3.5">Contact Details</th>
                  <th className="px-5 py-3.5">Tags</th>
                  <th className="px-5 py-3.5 text-center">
                    {terminology.pipelineItems}
                  </th>
                  <th className="px-5 py-3.5 text-center">Quotations</th>
                  <th className="px-5 py-3.5 text-center">Invoices</th>
                  <th className="px-5 py-3.5 text-right">Total Revenue</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setDrawerOpen(true);
                    }}
                    className="cursor-pointer transition-colors hover:bg-slate-50/80"
                  >
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {customer.name}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1 font-medium">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {customer.phone}
                        </span>
                        {customer.email && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Mail className="h-3 w-3 text-slate-400" />
                            {customer.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(customer.tags || []).slice(0, 2).map((t, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center font-bold text-slate-700">
                      {customer.dealsCount}
                    </td>
                    <td className="px-5 py-4 text-center font-bold text-slate-700">
                      {customer.quotationsCount}
                    </td>
                    <td className="px-5 py-4 text-center font-bold text-slate-700">
                      {customer.invoicesCount}
                    </td>
                    <td className="px-5 py-4 text-right font-extrabold text-emerald-600">
                      ₹
                      {customer.totalRevenue.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/inbox?contactId=${customer.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                        Chat
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Customer Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New {terminology.person}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCustomer} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corp or Jane Doe"
                className="text-xs"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone Number *</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+919876543210"
                className="text-xs"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email Address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@customer.com"
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Billing / Physical Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="City, State, Country"
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tags (comma separated)</Label>
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="VIP, Enterprise, Retail"
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
                {creating ? 'Saving...' : `Create ${terminology.person}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Customer Details Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {selectedCustomer && (
            <div className="flex h-full flex-col justify-between">
              <SheetHeader className="border-b pb-4">
                <SheetTitle className="text-lg font-bold text-slate-900">
                  {selectedCustomer.name}
                </SheetTitle>
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="outline" className="text-[11px]">
                    {terminology.person}
                  </Badge>
                  <span className="text-xs text-slate-400">
                    ID: {selectedCustomer.id.slice(0, 8)}
                  </span>
                </div>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto py-5 text-xs">
                {/* Contact Info */}
                <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                  <h4 className="text-[11px] font-bold tracking-wider text-slate-800 uppercase">
                    Contact Details
                  </h4>
                  <p className="flex items-center gap-2 text-slate-700">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {selectedCustomer.phone}
                  </p>
                  {selectedCustomer.email && (
                    <p className="flex items-center gap-2 text-slate-700">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      {selectedCustomer.email}
                    </p>
                  )}
                </div>

                {/* Sales Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Total Spend
                    </span>
                    <p className="mt-1 text-base font-extrabold text-emerald-600">
                      ₹
                      {selectedCustomer.totalRevenue.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Open {terminology.pipeline}
                    </span>
                    <p className="mt-1 text-base font-extrabold text-blue-600">
                      ₹
                      {selectedCustomer.openDealsValue.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>

                {/* Quick Navigation Links */}
                <div className="space-y-2 pt-2">
                  <Link
                    href={`/pipelines?contact_id=${selectedCustomer.id}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 transition hover:bg-slate-50"
                  >
                    <span className="font-semibold text-slate-800">
                      {terminology.pipelineItems} ({selectedCustomer.dealsCount}
                      )
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                  <Link
                    href={`/quotations?contact_id=${selectedCustomer.id}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 transition hover:bg-slate-50"
                  >
                    <span className="font-semibold text-slate-800">
                      Quotations ({selectedCustomer.quotationsCount})
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                  <Link
                    href={`/invoices?contact_id=${selectedCustomer.id}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 transition hover:bg-slate-50"
                  >
                    <span className="font-semibold text-slate-800">
                      Invoices ({selectedCustomer.invoicesCount})
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                </div>
              </div>

              <div className="border-t pt-4">
                <Link
                  href={`/inbox?contactId=${selectedCustomer.id}`}
                  className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  <MessageSquare className="h-4 w-4" />
                  Open WhatsApp Conversation
                </Link>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
