'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  MapPin,
  Plus,
  Receipt,
  Search,
  Send,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import { salesApi } from '@/lib/sales/api-client';
import { CreateTripProposalDialog } from './create-dialog';

interface TravelDetails {
  proposal_title: string;
  destination: string;
  start_date: string;
  end_date: string;
  adults: number;
  children: number;
  trip_type: string;
  duration_label: string;
  hotel_category: string;
  meal_plan: string;
  itinerary: Array<{ day: number; title: string; description: string }>;
  inclusions: string[];
  exclusions: string[];
  advance_amount: number;
  balance_amount: number;
}

interface Proposal {
  id: string;
  quotation_number: string;
  public_token?: string;
  contact_id: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  valid_until?: string;
  subtotal: number;
  tax_amount?: number;
  discount_amount?: number;
  tax_total?: number;
  discount_total?: number;
  total: number;
  currency: string;
  notes?: string;
  terms?: string;
  created_at: string;
  contacts?: { id: string; name: string; phone: string; email?: string };
  quotation_items?: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  travel_details?: TravelDetails | null;
}

const STATUS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  expired: 'bg-amber-50 text-amber-700 border-amber-200',
};

const dateLabel = (value?: string) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

const money = (value?: number | null) =>
  `₹${Math.max(0, Number(value) || 0).toLocaleString('en-IN')}`;

export default function TripProposalsPage() {
  const [rows, setRows] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [converting, setConverting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set('search', search.trim());
      if (filter !== 'all') query.set('status', filter);
      const data = await salesApi<Proposal[]>(
        `/api/quotations?${query.toString()}`
      );
      setRows(
        Array.isArray(data) ? data.filter((item) => item.travel_details) : []
      );
    } catch (error) {
      toast.error((error as Error).message || 'Failed to load trip proposals');
    } finally {
      setLoading(false);
    }
  }, [search, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (id: string, status: string) => {
    try {
      const updated = await salesApi<Proposal>(`/api/quotations/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      setSelected(updated);
      await load();
      toast.success(`Proposal marked as ${status}`);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to update proposal');
    }
  };

  const invoice = async (id: string) => {
    setConverting(true);
    try {
      const response = await salesApi<{ message?: string }>(
        `/api/quotations/${id}/convert-to-invoice`,
        {
          method: 'POST',
        }
      );
      toast.success(response?.message || 'Invoice created');
      setDetailsOpen(false);
      load();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to create invoice');
    } finally {
      setConverting(false);
    }
  };

  const publicUrl = selected?.public_token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/proposal/${selected.public_token}`
    : '';

  const copyLink = async () => {
    if (!publicUrl) return toast.error('Public link is not available');
    await navigator.clipboard.writeText(publicUrl);
    toast.success('Proposal link copied');
  };

  return (
    <div className="mx-auto w-full max-w-[1536px] space-y-6 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-500" />
            <h1 className="text-2xl font-bold text-slate-900">
              Trip Proposals
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Travel proposal builder using Helpa&apos;s existing quotation and
            invoice engine.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="rounded-xl bg-[#00b074] font-bold text-white hover:bg-[#009b66]"
        >
          <Plus className="mr-2 h-4 w-4" /> Create Trip Proposal
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Total Proposals</p>
          <p className="mt-1 text-2xl font-bold">{rows.length}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Awaiting Approval</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">
            {rows.filter((row) => row.status === 'sent').length}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Accepted</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {rows.filter((row) => row.status === 'accepted').length}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search destination, proposal or notes..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'draft', 'sent', 'accepted', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize ${filter === status ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        {loading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-16 animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-14 text-center">
            <MapPin className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-3 font-semibold">No trip proposals yet</h3>
            <p className="mt-1 text-xs text-slate-500">
              Create a destination-based proposal with itinerary, services and
              pricing.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3.5">Proposal</th>
                  <th className="px-5 py-3.5">Traveller</th>
                  <th className="px-5 py-3.5">Trip</th>
                  <th className="px-5 py-3.5">Dates</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((proposal) => {
                  const trip = proposal.travel_details!;
                  return (
                    <tr
                      key={proposal.id}
                      onClick={() => {
                        setSelected(proposal);
                        setDetailsOpen(true);
                      }}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <b>
                          {trip.proposal_title || `${trip.destination} Trip`}
                        </b>
                        <div className="text-[10px] text-slate-400">
                          {proposal.quotation_number}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {proposal.contacts?.name || 'Traveller'}
                      </td>
                      <td className="px-5 py-4">
                        <b>{trip.destination}</b>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Users className="h-3 w-3" />
                          {trip.adults + trip.children} travellers
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {dateLabel(trip.start_date)} –{' '}
                        {dateLabel(trip.end_date)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS[proposal.status]}`}
                        >
                          {proposal.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-extrabold">
                        {money(proposal.total)}
                      </td>
                      <td className="px-5">
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateTripProposalDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={load}
      />

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {selected?.travel_details?.proposal_title || 'Trip Proposal'}
            </SheetTitle>
          </SheetHeader>
          {selected?.travel_details && (
            <div className="mt-6 space-y-5 text-sm">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <b>{selected.travel_details.destination}</b>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS[selected.status]}`}
                  >
                    {selected.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {dateLabel(selected.travel_details.start_date)} –{' '}
                  {dateLabel(selected.travel_details.end_date)} ·{' '}
                  {selected.travel_details.duration_label}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {selected.travel_details.adults} adults ·{' '}
                  {selected.travel_details.children} children ·{' '}
                  {selected.travel_details.hotel_category} ·{' '}
                  {selected.travel_details.meal_plan}
                </p>
              </div>
              <div>
                <h4 className="mb-2 font-bold">Itinerary</h4>
                <div className="space-y-2">
                  {(selected.travel_details.itinerary || []).map((day) => (
                    <div key={day.day} className="rounded-xl border p-3">
                      <b className="text-emerald-600">
                        Day {day.day} · {day.title}
                      </b>
                      <p className="mt-1 text-xs text-slate-500">
                        {day.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-2 font-bold">Pricing</h4>
                <div className="rounded-xl border p-4">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <b>{money(selected.subtotal)}</b>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span>Tax</span>
                    <b>{money(selected.tax_amount ?? selected.tax_total)}</b>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span>Discount</span>
                    <b>
                      -{' '}
                      {money(
                        selected.discount_amount ?? selected.discount_total
                      )}
                    </b>
                  </div>
                  <div className="mt-3 flex justify-between border-t pt-3 text-base">
                    <b>Total</b>
                    <b className="text-emerald-600">{money(selected.total)}</b>
                  </div>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={copyLink}
                  disabled={!selected.public_token}
                >
                  Copy Proposal Link
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => updateStatus(selected.id, 'sent')}
                  disabled={selected.status === 'sent'}
                >
                  <Send className="mr-2 h-4 w-4" /> Mark Sent
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => updateStatus(selected.id, 'accepted')}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />{' '}
                  Accept
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => updateStatus(selected.id, 'rejected')}
                >
                  <XCircle className="mr-2 h-4 w-4 text-rose-500" /> Reject
                </Button>
              </div>
              {selected.status === 'accepted' && (
                <Button
                  type="button"
                  onClick={() => invoice(selected.id)}
                  disabled={converting}
                  className="w-full rounded-xl bg-slate-900 text-white hover:bg-slate-800"
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  {converting ? 'Creating Invoice...' : 'Convert to Invoice'}
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
