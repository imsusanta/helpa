'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Hotel,
  MapPin,
  Pencil,
  Plus,
  Receipt,
  Search,
  Sparkles,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import { salesApi } from '@/lib/sales/api-client';

interface TripItem {
  description: string;
  quantity: number;
  unit_price: number;
  category: string;
}

interface ItineraryDay {
  day: number;
  title: string;
  description: string;
}

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
  itinerary: ItineraryDay[];
  inclusions: string[];
  exclusions: string[];
  advance_amount: number;
  balance_amount: number;
}

interface TripProposal {
  id: string;
  quotation_number: string;
  contact_id: string;
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

const blankTravelDetails = (): TravelDetails => ({
  proposal_title: '',
  destination: '',
  start_date: '',
  end_date: '',
  adults: 2,
  children: 0,
  trip_type: 'Family Holiday',
  duration_label: '',
  hotel_category: '4 Star',
  meal_plan: 'Breakfast',
  itinerary: [
    { day: 1, title: 'Arrival & Check-in', description: 'Airport/station pickup and hotel check-in.' },
  ],
  inclusions: ['Hotel accommodation', 'Private transfers'],
  exclusions: ['Personal expenses'],
  advance_amount: 0,
  balance_amount: 0,
});

const emptyItem = (): TripItem => ({
  description: '',
  quantity: 1,
  unit_price: 0,
  category: 'Other',
});

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  expired: 'bg-amber-50 text-amber-700 border-amber-200',
};

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getDuration(start: string, end: string) {
  if (!start || !end) return '';
  const a = new Date(`${start}T00:00:00`).getTime();
  const b = new Date(`${end}T00:00:00`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return '';
  const nights = Math.round((b - a) / 86400000);
  return `${nights + 1} Days / ${nights} Nights`;
}

export default function TripProposalsPage() {
  const [proposals, setProposals] = useState<TripProposal[]>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState<TripProposal | null>(null);
  const [creating, setCreating] = useState(false);
  const [converting, setConverting] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [travel, setTravel] = useState<TravelDetails>(blankTravelDetails());
  const [items, setItems] = useState<TripItem[]>([emptyItem()]);

  const loadProposals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const data = await salesApi<TripProposal[]>(`/api/quotations?${params.toString()}`);
      setProposals(Array.isArray(data) ? data.filter((p) => !!p.travel_details) : []);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to load trip proposals');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { loadProposals(); }, [loadProposals]);

  useEffect(() => {
    if (!createOpen) return;
    salesApi<Array<{ id: string; name: string; phone: string }>>('/api/contacts')
      .then((data) => setContacts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [createOpen]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unit_price) || 0), 0),
    [items]
  );
  const tax = (subtotal * (Number(taxRate) || 0)) / 100;
  const total = Math.max(0, subtotal + tax - (Number(discountAmount) || 0));

  const resetForm = () => {
    setSelectedContactId('');
    setValidUntil('');
    setTaxRate('0');
    setDiscountAmount('0');
    setNotes('');
    setTravel(blankTravelDetails());
    setItems([emptyItem()]);
  };

  const updateTravel = <K extends keyof TravelDetails>(key: K, value: TravelDetails[K]) => {
    setTravel((prev) => ({ ...prev, [key]: value }));
  };

  const addItineraryDay = () => {
    setTravel((prev) => ({
      ...prev,
      itinerary: [...prev.itinerary, { day: prev.itinerary.length + 1, title: '', description: '' }],
    }));
  };

  const removeItineraryDay = (index: number) => {
    setTravel((prev) => ({
      ...prev,
      itinerary: prev.itinerary.filter((_, i) => i !== index).map((day, i) => ({ ...day, day: i + 1 })),
    }));
  };

  const addListValue = (key: 'inclusions' | 'exclusions') => {
    setTravel((prev) => ({ ...prev, [key]: [...prev[key], ''] }));
  };

  const updateListValue = (key: 'inclusions' | 'exclusions', index: number, value: string) => {
    setTravel((prev) => ({
      ...prev,
      [key]: prev[key].map((item, i) => (i === index ? value : item)),
    }));
  };

  const removeListValue = (key: 'inclusions' | 'exclusions', index: number) => {
    setTravel((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedContactId) return toast.error('Please select a traveller');
    if (!travel.destination.trim()) return toast.error('Destination is required');
    if (!travel.start_date || !travel.end_date) return toast.error('Travel dates are required');
    if (items.some((item) => !item.description.trim())) return toast.error('All services need a description');

    const duration = getDuration(travel.start_date, travel.end_date);
    const balance = Math.max(0, total - (Number(travel.advance_amount) || 0));
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
          terms: 'Package subject to availability. Payment terms as agreed with the traveller.',
          currency: 'INR',
          items: items.map(({ description, quantity, unit_price }) => ({ description, quantity, unit_price })),
          travel_details: {
            ...travel,
            proposal_title: travel.proposal_title.trim() || `${travel.destination} Trip`,
            duration_label: duration,
            inclusions: travel.inclusions.filter(Boolean),
            exclusions: travel.exclusions.filter(Boolean),
            balance_amount: balance,
          },
        }),
      });
      toast.success('Trip proposal created successfully');
      setCreateOpen(false);
      resetForm();
      loadProposals();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to create trip proposal');
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const updated = await salesApi<TripProposal>(`/api/quotations/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      setSelected(updated);
      loadProposals();
      toast.success(`Proposal marked as ${status}`);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to update proposal');
    }
  };

  const convertToInvoice = async (id: string) => {
    setConverting(true);
    try {
      const result = await salesApi<{ message?: string }>(`/api/quotations/${id}/convert-to-invoice`, { method: 'POST' });
      toast.success(result?.message || 'Converted to invoice successfully');
      setDetailsOpen(false);
      loadProposals();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to convert to invoice');
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1536px] space-y-6 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-500" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Trip Proposals</h1>
          </div>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Build polished travel proposals while keeping the existing quotation and invoice workflow.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="h-10 gap-2 rounded-xl bg-[#00b074] px-4 text-xs font-bold text-white hover:bg-[#009b66]">
          <Plus className="h-4 w-4" /> Create Trip Proposal
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Total Proposals</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{proposals.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Awaiting Approval</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{proposals.filter((p) => p.status === 'sent').length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Accepted</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{proposals.filter((p) => p.status === 'accepted').length}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search destination, proposal or notes..." className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-9 text-xs" />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'draft', 'sent', 'accepted', 'rejected'].map((status) => (
            <button key={status} onClick={() => setStatusFilter(status)} className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize ${statusFilter === status ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-3 p-6">{[1, 2, 3, 4].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>
        ) : proposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-14 text-center">
            <MapPin className="h-12 w-12 text-slate-300" />
            <h3 className="mt-3 text-base font-semibold text-slate-800">No trip proposals yet</h3>
            <p className="mt-1 max-w-md text-xs text-slate-500">Create a destination-based proposal with itinerary, services, inclusions and pricing.</p>
            <Button onClick={() => setCreateOpen(true)} variant="outline" size="sm" className="mt-4 rounded-xl">Create Trip Proposal</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Proposal</th>
                  <th className="px-5 py-3.5">Traveller</th>
                  <th className="px-5 py-3.5">Trip</th>
                  <th className="px-5 py-3.5">Dates</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Total</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {proposals.map((proposal) => {
                  const trip = proposal.travel_details!;
                  return (
                    <tr key={proposal.id} onClick={() => { setSelected(proposal); setDetailsOpen(true); }} className="cursor-pointer hover:bg-slate-50/80">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">{trip.proposal_title || `${trip.destination} Trip`}</div>
                        <div className="mt-0.5 text-[10px] text-slate-400">{proposal.quotation_number}</div>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-700">{proposal.contacts?.name || 'Traveller'}</td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-800">{trip.destination}</div>
                        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400"><Users className="h-3 w-3" /> {trip.adults + trip.children} travellers</div>
                      </td>
                      <td className="px-5 py-4 text-slate-500">{formatDate(trip.start_date)} – {formatDate(trip.end_date)}</td>
                      <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_BADGE[proposal.status]}`}>{proposal.status}</span></td>
                      <td className="px-5 py-4 text-right font-extrabold text-slate-900">₹{proposal.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-5 py-4 text-right"><Button variant="ghost" size="sm" className="gap-1 text-xs font-semibold">View <ChevronRight className="h-3.5 w-3.5" /></Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-emerald-500" /> Create Trip Proposal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-4 flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-600" /><h3 className="text-sm font-bold text-slate-900">Trip Details</h3></div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5 lg:col-span-2"><Label className="text-xs">Proposal Title</Label><Input value={travel.proposal_title} onChange={(e) => updateTravel('proposal_title', e.target.value)} placeholder="Goa Family Holiday" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Traveller *</Label><select required value={selectedContactId} onChange={(e) => setSelectedContactId(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs"><option value="">-- Choose Traveller --</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}</select></div>
                <div className="space-y-1.5"><Label className="text-xs">Destination *</Label><Input required value={travel.destination} onChange={(e) => updateTravel('destination', e.target.value)} placeholder="Goa, India" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Start Date *</Label><Input required type="date" value={travel.start_date} onChange={(e) => updateTravel('start_date', e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs">End Date *</Label><Input required type="date" value={travel.end_date} onChange={(e) => updateTravel('end_date', e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Adults</Label><Input type="number" min="1" value={travel.adults} onChange={(e) => updateTravel('adults', Math.max(1, Number(e.target.value) || 1))} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Children</Label><Input type="number" min="0" value={travel.children} onChange={(e) => updateTravel('children', Math.max(0, Number(e.target.value) || 0))} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Trip Type</Label><select value={travel.trip_type} onChange={(e) => updateTravel('trip_type', e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs"><option>Family Holiday</option><option>Honeymoon</option><option>Adventure</option><option>Business</option><option>Group Tour</option><option>Custom</option></select></div>
                <div className="space-y-1.5"><Label className="text-xs">Hotel Category</Label><select value={travel.hotel_category} onChange={(e) => updateTravel('hotel_category', e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs"><option>3 Star</option><option>4 Star</option><option>5 Star</option><option>Luxury</option><option>Budget</option></select></div>
                <div className="space-y-1.5"><Label className="text-xs">Meal Plan</Label><select value={travel.meal_plan} onChange={(e) => updateTravel('meal_plan', e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs"><option>Room Only</option><option>Breakfast</option><option>Breakfast & Dinner</option><option>All Meals</option></select></div>
                <div className="space-y-1.5"><Label className="text-xs">Valid Until</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
              </div>
              {travel.start_date && travel.end_date && <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-700"><Clock3 className="h-3.5 w-3.5" /> {getDuration(travel.start_date, travel.end_date)}</div>}
            </section>

            <section className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-emerald-600" /><h3 className="text-sm font-bold">Day-by-Day Itinerary</h3></div><Button type="button" variant="outline" size="sm" onClick={addItineraryDay} className="rounded-xl"><Plus className="mr-1 h-3.5 w-3.5" /> Add Day</Button></div>
              <div className="space-y-3">
                {travel.itinerary.map((day, index) => <div key={index} className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-[70px_1fr_1.5fr_40px] md:items-center"><div className="text-xs font-bold text-emerald-700">DAY {day.day}</div><Input value={day.title} onChange={(e) => setTravel((prev) => ({ ...prev, itinerary: prev.itinerary.map((item, i) => i === index ? { ...item, title: e.target.value } : item) }))} placeholder="Arrival & Check-in" /><Input value={day.description} onChange={(e) => setTravel((prev) => ({ ...prev, itinerary: prev.itinerary.map((item, i) => i === index ? { ...item, description: e.target.value } : item) }))} placeholder="Describe activities, transfers and highlights..." />{travel.itinerary.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeItineraryDay(index)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>}</div>)}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-4 flex items-center gap-2"><Hotel className="h-4 w-4 text-emerald-600" /><h3 className="text-sm font-bold">Travel Services & Pricing</h3></div>
              <div className="space-y-3">
                {items.map((item, index) => <div key={index} className="grid gap-2 md:grid-cols-[150px_1fr_90px_120px_120px_40px] md:items-center"><select value={item.category} onChange={(e) => setItems((prev) => prev.map((x, i) => i === index ? { ...x, category: e.target.value } : x))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs"><option>Hotel</option><option>Transport</option><option>Flight</option><option>Activity</option><option>Meal</option><option>Guide</option><option>Transfer</option><option>Other</option></select><Input value={item.description} onChange={(e) => setItems((prev) => prev.map((x, i) => i === index ? { ...x, description: e.target.value } : x))} placeholder="4-star hotel for 4 nights" /><Input type="number" min="1" value={item.quantity} onChange={(e) => setItems((prev) => prev.map((x, i) => i === index ? { ...x, quantity: Number(e.target.value) || 1 } : x))} /><Input type="number" min="0" value={item.unit_price} onChange={(e) => setItems((prev) => prev.map((x, i) => i === index ? { ...x, unit_price: Number(e.target.value) || 0 } : x))} /><div className="text-right text-xs font-bold text-slate-800">₹{((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)).toLocaleString('en-IN')}</div>{items.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4 text-rose-500" /></Button>}</div>)}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, emptyItem()])} className="mt-3 rounded-xl"><Plus className="mr-1 h-3.5 w-3.5" /> Add Service</Button>
              <div className="mt-5 grid gap-4 md:grid-cols-3"><div><Label className="text-xs">Tax Rate (%)</Label><Input type="number" min="0" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} /></div><div><Label className="text-xs">Discount (₹)</Label><Input type="number" min="0" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} /></div><div><Label className="text-xs">Advance Amount (₹)</Label><Input type="number" min="0" value={travel.advance_amount} onChange={(e) => updateTravel('advance_amount', Math.max(0, Number(e.target.value) || 0))} /></div></div>
              <div className="mt-4 rounded-xl bg-slate-50 p-4"><div className="flex justify-between text-xs text-slate-500"><span>Subtotal</span><span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div><div className="mt-2 flex justify-between text-xs text-slate-500"><span>Tax</span><span>₹{tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div><div className="mt-2 flex justify-between text-sm font-extrabold text-slate-900"><span>Total Package</span><span>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div><div className="mt-1 flex justify-between text-xs text-emerald-700"><span>Balance after advance</span><span>₹{Math.max(0, total - (Number(travel.advance_amount) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div></div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              {(['inclusions', 'exclusions'] as const).map((key) => <div key={key} className="rounded-2xl border border-slate-200 p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold capitalize">{key}</h3><Button type="button" variant="ghost" size="sm" onClick={() => addListValue(key)}><Plus className="h-3.5 w-3.5" /></Button></div><div className="space-y-2">{travel[key].map((value, index) => <div key={index} className="flex gap-2"><Input value={value} onChange={(e) => updateListValue(key, index, e.target.value)} placeholder={key === 'inclusions' ? 'Airport transfer' : 'Personal expenses'} />{travel[key].length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeListValue(key, index)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>}</div>)}</div></div>)}
            </section>

            <div className="space-y-1.5"><Label className="text-xs">Agent Notes / Special Instructions</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cancellation policy, special requests, room preferences..." /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">Cancel</Button><Button type="submit" disabled={creating} className="rounded-xl bg-[#00b074] font-bold text-white hover:bg-[#009b66]">{creating ? 'Creating...' : 'Save & Generate Proposal'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected?.travel_details && <>
            <SheetHeader><SheetTitle>{selected.travel_details.proposal_title || `${selected.travel_details.destination} Trip`}</SheetTitle></SheetHeader>
            <div className="mt-6 space-y-5">
              <div className="rounded-2xl bg-slate-900 p-5 text-white"><div className="text-lg font-bold">{selected.travel_details.destination}</div><div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-300"><span>{formatDate(selected.travel_details.start_date)} – {formatDate(selected.travel_details.end_date)}</span><span>•</span><span>{selected.travel_details.duration_label}</span><span>•</span><span>{selected.travel_details.adults + selected.travel_details.children} travellers</span></div></div>
              <div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-slate-200 p-3"><div className="text-[10px] uppercase text-slate-400">Traveller</div><div className="mt-1 text-sm font-bold">{selected.contacts?.name || 'Traveller'}</div></div><div className="rounded-xl border border-slate-200 p-3"><div className="text-[10px] uppercase text-slate-400">Status</div><span className={`mt-1 inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_BADGE[selected.status]}`}>{selected.status}</span></div></div>
              <div><h3 className="mb-3 text-sm font-bold">Itinerary</h3><div className="space-y-2">{selected.travel_details.itinerary.map((day) => <div key={day.day} className="rounded-xl border border-slate-200 p-3"><div className="text-xs font-bold text-emerald-700">Day {day.day} · {day.title}</div><div className="mt-1 text-xs text-slate-500">{day.description}</div></div>)}</div></div>
              <div><h3 className="mb-3 text-sm font-bold">Package Services</h3><div className="divide-y divide-slate-100 rounded-xl border border-slate-200">{selected.quotation_items?.map((item) => <div key={item.id} className="flex items-center justify-between p-3"><div><div className="text-xs font-semibold text-slate-800">{item.description}</div><div className="text-[10px] text-slate-400">Qty {item.quantity}</div></div><div className="text-xs font-bold">₹{item.total.toLocaleString('en-IN')}</div></div>)}</div></div>
              <div className="rounded-2xl bg-slate-50 p-4"><div className="flex justify-between text-xs text-slate-500"><span>Total Package</span><span>₹{selected.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div><div className="mt-2 flex justify-between text-xs text-emerald-700"><span>Advance</span><span>₹{selected.travel_details.advance_amount.toLocaleString('en-IN')}</span></div><div className="mt-2 flex justify-between text-sm font-extrabold"><span>Balance</span><span>₹{selected.travel_details.balance_amount.toLocaleString('en-IN')}</span></div></div>
              <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="rounded-xl" onClick={() => updateStatus(selected.id, selected.status === 'draft' ? 'sent' : selected.status === 'sent' ? 'accepted' : selected.status)}><CheckCircle2 className="mr-1 h-4 w-4" /> {selected.status === 'draft' ? 'Mark Sent' : selected.status === 'sent' ? 'Mark Accepted' : 'Accepted'}</Button><Button className="rounded-xl bg-slate-900 text-white hover:bg-slate-800" onClick={() => convertToInvoice(selected.id)} disabled={converting}><Receipt className="mr-1 h-4 w-4" /> {converting ? 'Converting...' : 'Create Invoice'}</Button></div>
              {selected.status !== 'rejected' && <Button variant="ghost" className="w-full rounded-xl text-rose-600 hover:text-rose-700" onClick={() => updateStatus(selected.id, 'rejected')}><XCircle className="mr-1 h-4 w-4" /> Reject Proposal</Button>}
            </div>
          </>}
        </SheetContent>
      </Sheet>
    </div>
  );
}
