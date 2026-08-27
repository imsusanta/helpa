'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Hotel,
  MapPin,
  Plus,
  Receipt,
  Search,
  Send,
  Sparkles,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { salesApi } from '@/lib/sales/api-client';
import {
  TRIP_PROPOSAL_CREATE_DIALOG_CLASSNAME,
  TRIP_PROPOSAL_CREATE_FOOTER_CLASSNAME,
} from './dialog-classes';

interface Day {
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
  itinerary: Day[];
  inclusions: string[];
  exclusions: string[];
  advance_amount: number;
  balance_amount: number;
}

interface Item {
  description: string;
  quantity: number;
  unit_price: number;
  category: string;
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

const emptyItem = (): Item => ({
  description: '',
  quantity: 1,
  unit_price: 0,
  category: 'Other',
});

const emptyTravel = (): TravelDetails => ({
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
    {
      day: 1,
      title: 'Arrival & Check-in',
      description: 'Pickup and hotel check-in.',
    },
  ],
  inclusions: ['Hotel accommodation', 'Private transfers'],
  exclusions: ['Personal expenses'],
  advance_amount: 0,
  balance_amount: 0,
});

const dateLabel = (value?: string) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

const duration = (start: string, end: string) => {
  if (!start || !end) return '';
  const nights = Math.max(
    0,
    Math.round(
      (new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) /
        86400000,
    ),
  );
  return `${nights + 1} Days / ${nights} Nights`;
};

const money = (value?: number | null) => `₹${Math.max(0, Number(value) || 0).toLocaleString('en-IN')}`;

export default function TripProposalsPage() {
  const [rows, setRows] = useState<Proposal[]>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);

  const [contactId, setContactId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');
  const [travel, setTravel] = useState<TravelDetails>(emptyTravel());
  const [items, setItems] = useState<Item[]>([emptyItem()]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set('search', search.trim());
      if (filter !== 'all') query.set('status', filter);
      const data = await salesApi<Proposal[]>(`/api/quotations?${query.toString()}`);
      setRows(Array.isArray(data) ? data.filter((item) => item.travel_details) : []);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to load trip proposals');
    } finally {
      setLoading(false);
    }
  }, [search, filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!createOpen) return;
    salesApi<Array<{ id: string; name: string; phone: string }>>('/api/contacts?limit=100')
      .then((data) => setContacts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [createOpen]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0),
    [items],
  );
  const tax = (subtotal * (Number(taxRate) || 0)) / 100;
  const total = Math.max(0, subtotal + tax - (Number(discount) || 0));
  const advance = Math.min(total, Math.max(0, Number(travel.advance_amount) || 0));
  const balance = Math.max(0, total - advance);

  const setTravelField = <K extends keyof TravelDetails>(key: K, value: TravelDetails[K]) => {
    setTravel((previous) => ({ ...previous, [key]: value }));
  };

  const reset = () => {
    setContactId('');
    setValidUntil('');
    setTaxRate('0');
    setDiscount('0');
    setNotes('');
    setTravel(emptyTravel());
    setItems([emptyItem()]);
  };

  const addDay = () => {
    setTravel((previous) => ({
      ...previous,
      itinerary: [
        ...previous.itinerary,
        {
          day: previous.itinerary.length + 1,
          title: '',
          description: '',
        },
      ],
    }));
  };

  const updateDay = (index: number, key: keyof Day, value: string) => {
    setTravel((previous) => ({
      ...previous,
      itinerary: previous.itinerary.map((day, dayIndex) =>
        dayIndex === index ? { ...day, [key]: key === 'day' ? Number(value) : value } : day,
      ),
    }));
  };

  const removeDay = (index: number) => {
    setTravel((previous) => ({
      ...previous,
      itinerary: previous.itinerary
        .filter((_, dayIndex) => dayIndex !== index)
        .map((day, dayIndex) => ({ ...day, day: dayIndex + 1 })),
    }));
  };

  const updateList = (key: 'inclusions' | 'exclusions', index: number, value: string) => {
    setTravel((previous) => ({
      ...previous,
      [key]: previous[key].map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  };

  const addListItem = (key: 'inclusions' | 'exclusions') => {
    setTravel((previous) => ({ ...previous, [key]: [...previous[key], ''] }));
  };

  const removeListItem = (key: 'inclusions' | 'exclusions', index: number) => {
    setTravel((previous) => ({
      ...previous,
      [key]: previous[key].filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const createProposal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!contactId) return toast.error('Please select a traveller');
    if (!travel.destination.trim()) return toast.error('Destination is required');
    if (!travel.start_date || !travel.end_date) return toast.error('Travel dates are required');
    if (new Date(`${travel.end_date}T00:00:00`) < new Date(`${travel.start_date}T00:00:00`)) {
      return toast.error('End date cannot be before start date');
    }
    if (items.some((item) => !item.description.trim())) return toast.error('All services need a description');

    setSaving(true);
    try {
      await salesApi('/api/quotations', {
        method: 'POST',
        body: JSON.stringify({
          contact_id: contactId,
          valid_until: validUntil || undefined,
          tax_rate: Number(taxRate) || 0,
          discount_amount: Number(discount) || 0,
          notes: notes || undefined,
          currency: 'INR',
          terms: 'Package subject to availability. Payment terms as agreed with the traveller.',
          items: items.map(({ description, quantity, unit_price, category }) => ({ description, quantity, unit_price, category })),
          travel_details: {
            ...travel,
            proposal_title: travel.proposal_title.trim() || `${travel.destination} Trip`,
            duration_label: duration(travel.start_date, travel.end_date),
            itinerary: travel.itinerary.map((day, index) => ({ ...day, day: index + 1 })),
            inclusions: travel.inclusions.filter(Boolean),
            exclusions: travel.exclusions.filter(Boolean),
            advance_amount: advance,
            balance_amount: balance,
          },
        }),
      });
      toast.success('Trip proposal created');
      setCreateOpen(false);
      reset();
      load();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to create proposal');
    } finally {
      setSaving(false);
    }
  };

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
      const response = await salesApi<{ message?: string }>(`/api/quotations/${id}/convert-to-invoice`, {
        method: 'POST',
      });
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
            <h1 className="text-2xl font-bold text-slate-900">Trip Proposals</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">Travel proposal builder using Helpa&apos;s existing quotation and invoice engine.</p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="rounded-xl bg-[#00b074] font-bold text-white hover:bg-[#009b66]"
        >
          <Plus className="mr-2 h-4 w-4" /> Create Trip Proposal
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Total Proposals</p><p className="mt-1 text-2xl font-bold">{rows.length}</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Awaiting Approval</p><p className="mt-1 text-2xl font-bold text-blue-700">{rows.filter((row) => row.status === 'sent').length}</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Accepted</p><p className="mt-1 text-2xl font-bold text-emerald-700">{rows.filter((row) => row.status === 'accepted').length}</p></div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search destination, proposal or notes..." className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'draft', 'sent', 'accepted', 'rejected'].map((status) => (
            <button key={status} onClick={() => setFilter(status)} className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize ${filter === status ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        {loading ? (
          <div className="space-y-3 p-6">{[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>
        ) : rows.length === 0 ? (
          <div className="p-14 text-center"><MapPin className="mx-auto h-12 w-12 text-slate-300" /><h3 className="mt-3 font-semibold">No trip proposals yet</h3><p className="mt-1 text-xs text-slate-500">Create a destination-based proposal with itinerary, services and pricing.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500"><tr><th className="px-5 py-3.5">Proposal</th><th className="px-5 py-3.5">Traveller</th><th className="px-5 py-3.5">Trip</th><th className="px-5 py-3.5">Dates</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5 text-right">Total</th><th /></tr></thead>
              <tbody className="divide-y">
                {rows.map((proposal) => {
                  const trip = proposal.travel_details!;
                  return (
                    <tr key={proposal.id} onClick={() => { setSelected(proposal); setDetailsOpen(true); }} className="cursor-pointer hover:bg-slate-50">
                      <td className="px-5 py-4"><b>{trip.proposal_title || `${trip.destination} Trip`}</b><div className="text-[10px] text-slate-400">{proposal.quotation_number}</div></td>
                      <td className="px-5 py-4">{proposal.contacts?.name || 'Traveller'}</td>
                      <td className="px-5 py-4"><b>{trip.destination}</b><div className="flex items-center gap-1 text-[10px] text-slate-400"><Users className="h-3 w-3" />{trip.adults + trip.children} travellers</div></td>
                      <td className="px-5 py-4">{dateLabel(trip.start_date)} – {dateLabel(trip.end_date)}</td>
                      <td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS[proposal.status]}`}>{proposal.status}</span></td>
                      <td className="px-5 py-4 text-right font-extrabold">{money(proposal.total)}</td>
                      <td className="px-5"><ChevronRight className="h-4 w-4 text-slate-400" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className={TRIP_PROPOSAL_CREATE_DIALOG_CLASSNAME}>
          <DialogHeader className="shrink-0 border-b bg-white px-6 py-4 pr-14 sm:px-7">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Sparkles className="h-5 w-5 text-emerald-500" /> Create Trip Proposal
            </DialogTitle>
          </DialogHeader>

          <div className="shrink-0 border-b bg-white px-6 py-3 sm:px-7">
            <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 text-xs font-semibold text-slate-500">
              {[['1', 'Trip Details'], ['2', 'Itinerary'], ['3', 'Services & Pricing'], ['4', 'Review & Send']].map(([number, label], index) => (
                <div key={number} className="flex min-w-0 flex-1 items-center gap-2">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index === 0 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>{number}</div>
                  <span className="hidden truncate sm:block">{label}</span>
                  {index < 3 && <div className="h-px flex-1 bg-slate-200" />}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={createProposal} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/60 p-4 sm:p-6">
              <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.9fr)]">
                <div className="min-w-0 space-y-4">
                  <section className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
                    <div className="mb-4 flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-500" /><h3 className="text-sm font-bold text-slate-900">Trip Details</h3></div>
                    <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      <div className="sm:col-span-2 xl:col-span-2"><Label className="text-xs">Proposal Title</Label><Input value={travel.proposal_title} onChange={(event) => setTravelField('proposal_title', event.target.value)} placeholder="Goa Family Holiday" className="mt-1.5" /></div>
                      <div><Label className="text-xs">Traveller *</Label><select required value={contactId} onChange={(event) => setContactId(event.target.value)} className="mt-1.5 h-10 w-full min-w-0 rounded-xl border bg-white px-3 text-xs outline-none focus:ring-2 focus:ring-emerald-200"><option value="">Choose Traveller</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name} ({contact.phone})</option>)}</select></div>
                      <div><Label className="text-xs">Destination *</Label><Input required value={travel.destination} onChange={(event) => setTravelField('destination', event.target.value)} placeholder="Goa, India" className="mt-1.5" /></div>
                      <div><Label className="text-xs">Start Date *</Label><Input required type="date" value={travel.start_date} onChange={(event) => setTravelField('start_date', event.target.value)} className="mt-1.5" /></div>
                      <div><Label className="text-xs">End Date *</Label><Input required type="date" value={travel.end_date} onChange={(event) => setTravelField('end_date', event.target.value)} className="mt-1.5" /></div>
                      <div><Label className="text-xs">Duration</Label><Input readOnly value={duration(travel.start_date, travel.end_date)} placeholder="5 Days / 4 Nights" className="mt-1.5 bg-slate-50" /></div>
                      <div><Label className="text-xs">Adults *</Label><Input required type="number" min="1" value={travel.adults} onChange={(event) => setTravelField('adults', Math.max(1, Number(event.target.value) || 1))} className="mt-1.5" /></div>
                      <div><Label className="text-xs">Children</Label><Input type="number" min="0" value={travel.children} onChange={(event) => setTravelField('children', Math.max(0, Number(event.target.value) || 0))} className="mt-1.5" /></div>
                      <div><Label className="text-xs">Trip Type</Label><select value={travel.trip_type} onChange={(event) => setTravelField('trip_type', event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-xs"><option>Family Holiday</option><option>Leisure</option><option>Honeymoon</option><option>Adventure</option><option>Business</option><option>Group Tour</option></select></div>
                      <div><Label className="text-xs">Hotel Category</Label><select value={travel.hotel_category} onChange={(event) => setTravelField('hotel_category', event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-xs"><option>3 Star</option><option>4 Star</option><option>5 Star</option><option>Luxury</option><option>Budget</option></select></div>
                      <div><Label className="text-xs">Meal Plan</Label><select value={travel.meal_plan} onChange={(event) => setTravelField('meal_plan', event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-xs"><option>Breakfast</option><option>Breakfast & Dinner</option><option>Half Board</option><option>Full Board</option><option>Room Only</option></select></div>
                    </div>
                  </section>

                  <section className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-emerald-500" /><h3 className="text-sm font-bold text-slate-900">Day-by-Day Itinerary</h3></div><Button type="button" variant="outline" size="sm" onClick={addDay} className="rounded-xl"><Plus className="mr-1 h-3.5 w-3.5" /> Add Day</Button></div>
                    <div className="space-y-3">
                      {travel.itinerary.map((day, index) => (
                        <div key={`day-${index}`} className="grid min-w-0 gap-2 sm:grid-cols-[56px_minmax(0,1fr)_minmax(0,1.8fr)_36px] sm:items-center">
                          <div className="text-xs font-bold text-emerald-600">DAY {day.day}</div>
                          <Input value={day.title} onChange={(event) => updateDay(index, 'title', event.target.value)} placeholder="Day title" />
                          <Input value={day.description} onChange={(event) => updateDay(index, 'description', event.target.value)} placeholder="Activities, transfers and notes" />
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeDay(index)} disabled={travel.itinerary.length === 1} className="text-rose-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="grid min-w-0 gap-4 md:grid-cols-2">
                    {(['inclusions', 'exclusions'] as const).map((key) => (
                      <section key={key} className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold capitalize text-slate-900">{key}</h3><Button type="button" variant="ghost" size="sm" onClick={() => addListItem(key)} className="h-7 rounded-lg text-xs"><Plus className="mr-1 h-3 w-3" /> Add</Button></div>
                        <div className="space-y-2">
                          {travel[key].map((value, index) => (
                            <div key={`${key}-${index}`} className="flex min-w-0 items-center gap-2"><Input value={value} onChange={(event) => updateList(key, index, event.target.value)} placeholder={key === 'inclusions' ? 'Daily breakfast' : 'Airfare / train fare'} /><Button type="button" variant="ghost" size="icon" onClick={() => removeListItem(key, index)} className="shrink-0 text-rose-500"><X className="h-4 w-4" /></Button></div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>

                <div className="min-w-0 space-y-4">
                  <section className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
                    <div className="mb-4 flex items-center gap-2"><Hotel className="h-4 w-4 text-emerald-500" /><h3 className="text-sm font-bold text-slate-900">Services & Pricing</h3></div>
                    <div className="hidden grid-cols-[minmax(0,1fr)_60px_112px_100px_32px] gap-2 border-b pb-2 text-[10px] font-bold uppercase text-slate-400 sm:grid"><span>Service</span><span>Qty</span><span>Unit Price (₹)</span><span>Total (₹)</span><span /></div>
                    <div className="space-y-2 pt-2">
                      {items.map((item, index) => {
                        const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
                        return (
                          <div key={`service-${index}`} className="grid min-w-0 gap-2 rounded-xl border bg-slate-50/60 p-2 sm:grid-cols-[minmax(0,1fr)_60px_112px_100px_32px] sm:items-center sm:border-0 sm:bg-transparent sm:p-0">
                            <div className="min-w-0"><Label className="mb-1 block text-[10px] text-slate-400 sm:hidden">Service</Label><div className="flex min-w-0 items-center gap-2"><select value={item.category} onChange={(event) => setItems((previous) => previous.map((row, rowIndex) => rowIndex === index ? { ...row, category: event.target.value } : row))} className="h-10 w-28 shrink-0 rounded-xl border bg-white px-2 text-[11px]"><option>Hotel</option><option>Transport</option><option>Flight</option><option>Activity</option><option>Meal</option><option>Transfer</option><option>Other</option></select><Input value={item.description} onChange={(event) => setItems((previous) => previous.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row))} placeholder="Service description" /></div></div>
                            <div><Label className="mb-1 block text-[10px] text-slate-400 sm:hidden">Qty</Label><Input type="number" min="1" value={item.quantity} onChange={(event) => setItems((previous) => previous.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: Math.max(1, Number(event.target.value) || 1) } : row))} /></div>
                            <div><Label className="mb-1 block text-[10px] text-slate-400 sm:hidden">Unit Price</Label><Input type="number" min="0" value={item.unit_price} onChange={(event) => setItems((previous) => previous.map((row, rowIndex) => rowIndex === index ? { ...row, unit_price: Math.max(0, Number(event.target.value) || 0) } : row))} /></div>
                            <div className="flex h-10 items-center justify-between rounded-xl border bg-white px-3 text-xs font-semibold sm:border-0 sm:bg-transparent sm:px-0"><span className="sm:hidden">Total</span>{money(lineTotal)}</div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => setItems((previous) => previous.length === 1 ? previous : previous.filter((_, rowIndex) => rowIndex !== index))} disabled={items.length === 1} className="text-rose-500"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        );
                      })}
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setItems((previous) => [...previous, emptyItem()])} className="mt-3 rounded-xl"><Plus className="mr-1 h-3.5 w-3.5" /> Add Service</Button>
                  </section>

                  <section className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
                    <h3 className="mb-4 text-sm font-bold text-slate-900">Pricing Summary</h3>
                    <div className="space-y-3 text-xs"><div className="flex justify-between"><span className="text-slate-500">Sub Total</span><b>{money(subtotal)}</b></div><div className="grid grid-cols-2 items-center gap-3"><Label className="text-xs text-slate-500">Tax Rate (%)</Label><Input type="number" min="0" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} /></div><div className="flex justify-between"><span className="text-slate-500">Tax</span><b>{money(tax)}</b></div><div className="grid grid-cols-2 items-center gap-3"><Label className="text-xs text-slate-500">Discount (₹)</Label><Input type="number" min="0" value={discount} onChange={(event) => setDiscount(event.target.value)} /></div><div className="border-t pt-3 flex justify-between text-base"><span className="font-bold">Total Package Price</span><b className="text-emerald-600">{money(total)}</b></div></div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2"><div><Label className="text-xs">Advance Amount</Label><Input type="number" min="0" max={total} value={travel.advance_amount} onChange={(event) => setTravelField('advance_amount', Math.min(total, Math.max(0, Number(event.target.value) || 0)))} className="mt-1.5" /></div><div><Label className="text-xs">Balance Amount</Label><Input readOnly value={balance} className="mt-1.5 bg-slate-50" /></div><div className="sm:col-span-2"><Label className="text-xs">Proposal Valid Until</Label><Input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} className="mt-1.5" /></div></div>
                  </section>

                  <section className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
                    <Label className="text-sm font-bold text-slate-900">Notes for Traveller <span className="font-normal text-slate-400">(Optional)</span></Label>
                    <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="We are happy to customize this itinerary as per your preferences." className="mt-2 min-h-28 w-full resize-y rounded-xl border bg-white p-3 text-xs outline-none focus:ring-2 focus:ring-emerald-200" />
                  </section>
                </div>
              </div>
            </div>

            <DialogFooter className={TRIP_PROPOSAL_CREATE_FOOTER_CLASSNAME}>
              <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); reset(); }} className="rounded-xl">Cancel</Button>
                <div className="flex flex-col gap-2 sm:flex-row"><Button type="button" variant="outline" onClick={() => toast.info('Draft saving uses the same quotation workflow.')} className="rounded-xl">Save as Draft</Button><Button type="submit" disabled={saving} className="rounded-xl bg-[#00b074] font-bold text-white hover:bg-[#009b66]"><Send className="mr-2 h-4 w-4" />{saving ? 'Saving...' : 'Preview & Send Proposal'}</Button></div>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader><SheetTitle>{selected?.travel_details?.proposal_title || 'Trip Proposal'}</SheetTitle></SheetHeader>
          {selected?.travel_details && (
            <div className="mt-6 space-y-5 text-sm">
              <div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center justify-between"><b>{selected.travel_details.destination}</b><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS[selected.status]}`}>{selected.status}</span></div><p className="mt-2 text-xs text-slate-500">{dateLabel(selected.travel_details.start_date)} – {dateLabel(selected.travel_details.end_date)} · {selected.travel_details.duration_label}</p><p className="mt-1 text-xs text-slate-500">{selected.travel_details.adults} adults · {selected.travel_details.children} children · {selected.travel_details.hotel_category} · {selected.travel_details.meal_plan}</p></div>
              <div><h4 className="mb-2 font-bold">Itinerary</h4><div className="space-y-2">{(selected.travel_details.itinerary || []).map((day) => <div key={day.day} className="rounded-xl border p-3"><b className="text-emerald-600">Day {day.day} · {day.title}</b><p className="mt-1 text-xs text-slate-500">{day.description}</p></div>)}</div></div>
              <div><h4 className="mb-2 font-bold">Pricing</h4><div className="rounded-xl border p-4"><div className="flex justify-between"><span>Subtotal</span><b>{money(selected.subtotal)}</b></div><div className="mt-2 flex justify-between"><span>Tax</span><b>{money(selected.tax_amount ?? selected.tax_total)}</b></div><div className="mt-2 flex justify-between"><span>Discount</span><b>- {money(selected.discount_amount ?? selected.discount_total)}</b></div><div className="mt-3 border-t pt-3 flex justify-between text-base"><b>Total</b><b className="text-emerald-600">{money(selected.total)}</b></div></div></div>
              <div className="grid gap-2 sm:grid-cols-2"><Button type="button" variant="outline" onClick={copyLink} disabled={!selected.public_token}>Copy Proposal Link</Button><Button type="button" variant="outline" onClick={() => updateStatus(selected.id, 'sent')} disabled={selected.status === 'sent'}><Send className="mr-2 h-4 w-4" /> Mark Sent</Button><Button type="button" variant="outline" onClick={() => updateStatus(selected.id, 'accepted')}><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" /> Accept</Button><Button type="button" variant="outline" onClick={() => updateStatus(selected.id, 'rejected')}><XCircle className="mr-2 h-4 w-4 text-rose-500" /> Reject</Button></div>
              {selected.status === 'accepted' && <Button type="button" onClick={() => invoice(selected.id)} disabled={converting} className="w-full rounded-xl bg-slate-900 text-white hover:bg-slate-800"><Receipt className="mr-2 h-4 w-4" />{converting ? 'Creating Invoice...' : 'Convert to Invoice'}</Button>}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
