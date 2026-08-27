'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Search,
  Trash2,
  Calendar,
  MapPin,
  Users,
  Send,
  ExternalLink,
  Copy,
  CheckCircle2,
  Building2,
  Car,
  Sparkles,
  Plane,
  Eye,
  RefreshCw,
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

interface ItineraryDay {
  day: number;
  title: string;
  description: string;
}

interface TripProposalModel {
  id: string;
  proposal_number: string;
  contact_id?: string;
  package_id?: string;
  title: string;
  destination: string;
  duration_days: number;
  duration_nights: number;
  start_date?: string;
  end_date?: string;
  adults_count: number;
  children_count: number;
  currency: string;
  base_price: number;
  tax_amount: number;
  discount_amount: number;
  total_price: number;
  inclusions: string[];
  exclusions: string[];
  itinerary: ItineraryDay[];
  hotel_details?: string;
  transport_details?: string;
  notes?: string;
  terms?: string;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
  valid_until?: string;
  sent_at?: string;
  sent_channel?: string;
  created_at: string;
  contacts?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
  };
  travel_packages?: {
    id: string;
    name: string;
    destination: string;
    duration_days: number;
    price: number;
  };
}

interface TourPackageOption {
  id: string;
  name: string;
  destination: string;
  duration_days: number;
  price: number;
  description?: string;
}

interface ContactOption {
  id: string;
  name: string;
  phone: string;
}

const STATUS_BADGES: Record<string, { label: string; class: string }> = {
  draft: {
    label: 'Draft',
    class: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  sent: {
    label: 'Sent on WhatsApp',
    class: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  viewed: {
    label: 'Viewed',
    class: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  accepted: {
    label: 'Accepted / Booked',
    class: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  rejected: {
    label: 'Declined',
    class: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  expired: {
    label: 'Expired',
    class: 'bg-amber-50 text-amber-700 border-amber-200',
  },
};

const POPULAR_INCLUSIONS = [
  'Hotel Accommodation with Breakfast',
  'Daily Breakfast & Dinner',
  'Private AC Sightseeing Cab',
  'All Toll, Parking & Driver Allowances',
  'Airport / Railway Station Transfers',
  'Sightseeing Permits & Taxes',
];

const POPULAR_EXCLUSIONS = [
  'Airfare / Train Tickets',
  'Personal Expenses, Laundry & Tips',
  'Monument / Museum Entry Tickets',
  'Adventure Activities (Rafting, Paragliding, etc.)',
  'Travel Insurance',
];

export default function TripProposalsPage() {
  const [proposals, setProposals] = useState<TripProposalModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Create Proposal Dialog State
  const [createOpen, setCreateOpen] = useState(false);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [tourPackages, setTourPackages] = useState<TourPackageOption[]>([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [durationDays, setDurationDays] = useState(3);
  const [durationNights, setDurationNights] = useState(2);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [adultsCount, setAdultsCount] = useState(2);
  const [childrenCount, setChildrenCount] = useState(0);
  const [basePrice, setBasePrice] = useState('15000');
  const [taxAmount, setTaxAmount] = useState('750');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [hotelDetails, setHotelDetails] = useState('');
  const [transportDetails, setTransportDetails] = useState('');
  const [inclusions, setInclusions] = useState<string[]>([
    'Hotel Accommodation with Breakfast',
    'Private AC Sightseeing Cab',
    'All Toll, Parking & Driver Allowances',
  ]);
  const [exclusions, setExclusions] = useState<string[]>([
    'Airfare / Train Tickets',
    'Personal Expenses & Tips',
  ]);
  const [itinerary, setItinerary] = useState<ItineraryDay[]>([
    {
      day: 1,
      title: 'Arrival & Hotel Check-in',
      description:
        'Meet and greet at arrival point. Transfer to hotel, check-in and evening at leisure.',
    },
    {
      day: 2,
      title: 'Full Day Sightseeing & Tour',
      description:
        'Explore popular local viewpoints, heritage spots, and natural attractions.',
    },
    {
      day: 3,
      title: 'Departure Transfer',
      description:
        'Check out from hotel with pleasant memories and transfer to airport/station.',
    },
  ]);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(
    '50% advance for booking confirmation. Balance payment 7 days before trip start date.'
  );
  const [validUntil, setValidUntil] = useState('');
  const [creating, setCreating] = useState(false);

  // Send via WhatsApp Dialog State
  const [sendOpen, setSendOpen] = useState(false);
  const [proposalToSend, setProposalToSend] =
    useState<TripProposalModel | null>(null);
  const [sendPhone, setSendPhone] = useState('');
  const [sending, setSending] = useState(false);

  // Proposal Detail Drawer State
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] =
    useState<TripProposalModel | null>(null);

  const loadProposals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await salesApi<{ data?: TripProposalModel[] }>(
        `/api/trip-proposals?${params.toString()}`
      );
      setProposals(Array.isArray(res?.data) ? res.data : []);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to load trip proposals');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  useEffect(() => {
    if (createOpen) {
      // Load contacts
      salesApi<ContactOption[]>('/api/contacts')
        .then((res) => {
          if (Array.isArray(res)) setContacts(res);
        })
        .catch(() => {});

      // Load tour packages
      fetch('/api/packages')
        .then((res) => res.json())
        .then((res) => {
          if (Array.isArray(res)) setTourPackages(res);
          else if (Array.isArray(res?.data)) setTourPackages(res.data);
        })
        .catch(() => {});
    }
  }, [createOpen]);

  // When a tour package is selected in the creation form, pre-populate details
  const handleSelectPackage = (pkgId: string) => {
    setSelectedPackageId(pkgId);
    if (!pkgId) return;

    const pkg = tourPackages.find((p) => p.id === pkgId);
    if (pkg) {
      setTitle(pkg.name);
      setDestination(pkg.destination || '');
      setDurationDays(pkg.duration_days || 3);
      setDurationNights(Math.max(0, (pkg.duration_days || 3) - 1));
      setBasePrice(String(pkg.price || 0));
      setTaxAmount(String(Math.round((pkg.price || 0) * 0.05)));

      // Generate default day-wise structure matching duration
      const daysCount = pkg.duration_days || 3;
      const newDays: ItineraryDay[] = [];
      for (let i = 1; i <= daysCount; i++) {
        if (i === 1) {
          newDays.push({
            day: 1,
            title: `Arrival at ${pkg.destination || 'Destination'}`,
            description: `Pickup and transfer to hotel. Check-in and relax for the evening.`,
          });
        } else if (i === daysCount) {
          newDays.push({
            day: i,
            title: 'Departure Transfer',
            description:
              'Check out from hotel and transfer to airport/station with sweet memories.',
          });
        } else {
          newDays.push({
            day: i,
            title: `Day ${i} Sightseeing & Excursion`,
            description: `Explore local attractions, scenic viewpoints, and cultural spots in ${pkg.destination || 'the area'}.`,
          });
        }
      }
      setItinerary(newDays);
    }
  };

  const calculatedTotal = Math.max(
    0,
    Number(basePrice || 0) +
      Number(taxAmount || 0) -
      Number(discountAmount || 0)
  );

  const handleAddDay = () => {
    const nextDayNum = itinerary.length + 1;
    setItinerary([
      ...itinerary,
      {
        day: nextDayNum,
        title: `Day ${nextDayNum} Sightseeing`,
        description: 'Explore scenic attractions and enjoy local activities.',
      },
    ]);
  };

  const handleRemoveDay = (index: number) => {
    if (itinerary.length <= 1) return;
    const updated = itinerary
      .filter((_, i) => i !== index)
      .map((d, i) => ({ ...d, day: i + 1 }));
    setItinerary(updated);
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !destination.trim()) {
      toast.error('Title and destination are required');
      return;
    }

    setCreating(true);
    try {
      const res = await salesApi<{ data?: TripProposalModel }>(
        '/api/trip-proposals',
        {
          method: 'POST',
          body: JSON.stringify({
            contact_id: selectedContactId || undefined,
            package_id: selectedPackageId || undefined,
            title: title.trim(),
            destination: destination.trim(),
            duration_days: Number(durationDays) || 1,
            duration_nights: Number(durationNights) || 0,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
            adults_count: Number(adultsCount) || 1,
            children_count: Number(childrenCount) || 0,
            base_price: Number(basePrice) || 0,
            tax_amount: Number(taxAmount) || 0,
            discount_amount: Number(discountAmount) || 0,
            inclusions,
            exclusions,
            itinerary,
            hotel_details: hotelDetails || undefined,
            transport_details: transportDetails || undefined,
            notes: notes || undefined,
            terms: terms || undefined,
            valid_until: validUntil || undefined,
          }),
        }
      );

      toast.success('Trip Proposal created successfully!');
      setCreateOpen(false);
      loadProposals();

      // Open Send Dialog immediately for smooth workflow
      if (res?.data) {
        openSendDialog(res.data);
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to create proposal');
    } finally {
      setCreating(false);
    }
  };

  const openSendDialog = (proposal: TripProposalModel) => {
    setProposalToSend(proposal);
    setSendPhone(proposal.contacts?.phone || '');
    setSendOpen(true);
  };

  const handleSendWhatsApp = async () => {
    if (!proposalToSend) return;
    if (!sendPhone.trim()) {
      toast.error('Please provide recipient phone number');
      return;
    }

    setSending(true);
    try {
      const res = await salesApi<{ message?: string }>(
        `/api/trip-proposals/${proposalToSend.id}/send`,
        {
          method: 'POST',
          body: JSON.stringify({ phone: sendPhone.trim() }),
        }
      );

      toast.success(
        res?.message || 'Trip Proposal sent via WhatsApp successfully!'
      );
      setSendOpen(false);
      loadProposals();
    } catch (err: unknown) {
      toast.error(
        (err as Error).message || 'Failed to send proposal via WhatsApp'
      );
    } finally {
      setSending(false);
    }
  };

  const handleCopyProposalLink = (id: string) => {
    const url = `${window.location.origin}/proposals/${id}`;
    navigator.clipboard.writeText(url);
    toast.success('Public proposal link copied to clipboard!');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this trip proposal?')) return;
    try {
      await salesApi(`/api/trip-proposals/${id}`, { method: 'DELETE' });
      toast.success('Proposal deleted');
      loadProposals();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Delete failed');
    }
  };

  // Metric aggregates
  const totalCount = proposals.length;
  const sentCount = proposals.filter(
    (p) => p.status === 'sent' || p.status === 'viewed'
  ).length;
  const acceptedCount = proposals.filter((p) => p.status === 'accepted').length;
  const totalValue = proposals.reduce(
    (sum, p) => sum + Number(p.total_price || 0),
    0
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Plane className="h-6 w-6 text-emerald-600" />
            Trip Proposals
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create customized tour itineraries and send quotes directly to
            travelers via WhatsApp
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadProposals}
            className="gap-1.5 text-slate-600"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            className="gap-2 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            New Trip Proposal
          </Button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">
            Total Proposals
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {totalCount}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-blue-600 uppercase">
            Sent on WhatsApp
          </div>
          <div className="mt-1 text-2xl font-bold text-blue-700">
            {sentCount}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-emerald-600 uppercase">
            Accepted & Booked
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-700">
            {acceptedCount}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">
            Total Quoted Value
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            ₹{totalValue.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:flex-row">
        <div className="relative w-full sm:w-80">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search proposal #, traveler, destination..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>

        <div className="flex w-full items-center gap-1 overflow-x-auto sm:w-auto">
          {['all', 'draft', 'sent', 'accepted', 'expired'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === st
                  ? 'border border-emerald-200 bg-emerald-50 font-semibold text-emerald-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Proposals List / Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            Loading trip proposals...
          </div>
        ) : proposals.length === 0 ? (
          <div className="space-y-3 p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">
              No Trip Proposals Found
            </h3>
            <p className="mx-auto max-w-sm text-xs text-slate-500">
              Create a custom tour proposal with day-wise itinerary and send it
              directly to your traveler on WhatsApp.
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="mt-2 gap-1.5 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Create First Proposal
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {proposals.map((p) => {
              const badge = STATUS_BADGES[p.status] || STATUS_BADGES.draft;
              return (
                <div
                  key={p.id}
                  className="flex flex-col justify-between gap-4 p-4 transition-colors hover:bg-slate-50/70 sm:p-5 lg:flex-row lg:items-center"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-500">
                        {p.proposal_number}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.class}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(p.created_at).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <h3 className="truncate text-base font-bold text-slate-900">
                      {p.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                      <span className="flex items-center gap-1 font-medium">
                        <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                        {p.destination} ({p.duration_days}D/{p.duration_nights}
                        N)
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        {p.contacts?.name || 'Traveler'}{' '}
                        {p.contacts?.phone ? `(${p.contacts.phone})` : ''}
                      </span>
                      {p.start_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {p.start_date}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 pt-2 lg:justify-end lg:border-t-0 lg:pt-0">
                    <div className="mr-2 text-right">
                      <div className="text-xs text-slate-500">
                        Package Total
                      </div>
                      <div className="text-lg font-extrabold text-emerald-700">
                        ₹{Number(p.total_price || 0).toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => openSendDialog(p)}
                        className="gap-1.5 bg-emerald-600 text-xs text-white shadow-sm hover:bg-emerald-700"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Send via WhatsApp
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProposal(p);
                          setDetailOpen(true);
                        }}
                        className="text-xs text-slate-600"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyProposalLink(p.id)}
                        title="Copy Public Link"
                        className="text-xs text-slate-600"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(p.id)}
                        className="text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Proposal Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Plane className="h-5 w-5 text-emerald-600" />
              Create New Trip Proposal
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateProposal} className="space-y-6 pt-2">
            {/* Package / Template Pre-loader */}
            {tourPackages.length > 0 && (
              <div className="space-y-1.5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                <Label className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                  Quick Load from Existing Tour Package (Optional)
                </Label>
                <select
                  value={selectedPackageId}
                  onChange={(e) => handleSelectPackage(e.target.value)}
                  className="h-9 w-full rounded-lg border border-emerald-300 bg-white px-3 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">
                    -- Choose a package template to pre-fill itinerary --
                  </option>
                  {tourPackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.destination} - {pkg.duration_days} Days)
                      • ₹{pkg.price}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Traveler & Destination */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Select Traveler / Contact *
                </Label>
                <select
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">-- Select Contact or leave empty --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Destination *
                </Label>
                <Input
                  required
                  placeholder="e.g. Darjeeling, Gangtok"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Proposal Title *
              </Label>
              <Input
                required
                placeholder="e.g. Darjeeling & Mirik 4D3N Scenic Holiday"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-9 text-xs font-medium"
              />
            </div>

            {/* Dates & Duration & Guests */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Duration Days</Label>
                <Input
                  type="number"
                  min="1"
                  value={durationDays}
                  onChange={(e) => {
                    const days = parseInt(e.target.value, 10) || 1;
                    setDurationDays(days);
                    setDurationNights(Math.max(0, days - 1));
                  }}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-slate-600">
                  Duration Nights
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={durationNights}
                  onChange={(e) =>
                    setDurationNights(parseInt(e.target.value, 10) || 0)
                  }
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Adults Count</Label>
                <Input
                  type="number"
                  min="1"
                  value={adultsCount}
                  onChange={(e) =>
                    setAdultsCount(parseInt(e.target.value, 10) || 1)
                  }
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Children Count</Label>
                <Input
                  type="number"
                  min="0"
                  value={childrenCount}
                  onChange={(e) =>
                    setChildrenCount(parseInt(e.target.value, 10) || 0)
                  }
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">
                  Start Date (Optional)
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-slate-600">
                  End Date (Optional)
                </Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Day-by-Day Itinerary Builder */}
            <div className="space-y-3 border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  Day-by-Day Tour Itinerary ({itinerary.length} Days)
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddDay}
                  className="h-7 border-emerald-200 text-xs text-emerald-700"
                >
                  <Plus className="mr-1 h-3 w-3" /> Add Day
                </Button>
              </div>

              <div className="space-y-3">
                {itinerary.map((d, index) => (
                  <div
                    key={index}
                    className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold text-slate-700">
                        Day {d.day}
                      </span>
                      <Input
                        placeholder="Day Title (e.g. NJP to Darjeeling & Hotel Check-in)"
                        value={d.title}
                        onChange={(e) => {
                          const updated = [...itinerary];
                          updated[index].title = e.target.value;
                          setItinerary(updated);
                        }}
                        className="h-8 flex-1 bg-white text-xs font-medium"
                      />
                      {itinerary.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDay(index)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <textarea
                      placeholder="Describe activities, visits, transfer schedule for this day..."
                      rows={2}
                      value={d.description}
                      onChange={(e) => {
                        const updated = [...itinerary];
                        updated[index].description = e.target.value;
                        setItinerary(updated);
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Hotel & Transport Details */}
            <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                  Hotel / Accommodation Details
                </Label>
                <textarea
                  rows={2}
                  placeholder="e.g. Deluxe Room with Mountain View at Summit Hermitage or similar"
                  value={hotelDetails}
                  onChange={(e) => setHotelDetails(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Car className="h-3.5 w-3.5 text-emerald-600" />
                  Transport / Sightseeing Cab
                </Label>
                <textarea
                  rows={2}
                  placeholder="e.g. Private AC Innova / Xylo with experienced hill driver for 4 days"
                  value={transportDetails}
                  onChange={(e) => setTransportDetails(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Inclusions & Exclusions */}
            <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Inclusions (Select or type comma separated)
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_INCLUSIONS.map((item) => {
                    const active = inclusions.includes(item);
                    return (
                      <button
                        type="button"
                        key={item}
                        onClick={() => {
                          if (active)
                            setInclusions(inclusions.filter((i) => i !== item));
                          else setInclusions([...inclusions, item]);
                        }}
                        className={`rounded-md border px-2 py-1 text-left text-[11px] transition-colors ${
                          active
                            ? 'border-emerald-300 bg-emerald-100/70 font-medium text-emerald-900'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {active ? '✓ ' : '+ '} {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-rose-900">
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                  Exclusions
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_EXCLUSIONS.map((item) => {
                    const active = exclusions.includes(item);
                    return (
                      <button
                        type="button"
                        key={item}
                        onClick={() => {
                          if (active)
                            setExclusions(exclusions.filter((i) => i !== item));
                          else setExclusions([...exclusions, item]);
                        }}
                        className={`rounded-md border px-2 py-1 text-left text-[11px] transition-colors ${
                          active
                            ? 'border-rose-300 bg-rose-100/70 font-medium text-rose-900'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {active ? '✕ ' : '+ '} {item}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-xs font-bold tracking-wider text-slate-900 uppercase">
                Pricing Breakdown
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">
                    Base Price (₹) *
                  </Label>
                  <Input
                    type="number"
                    required
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="h-9 bg-white text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">
                    Taxes / GST (₹)
                  </Label>
                  <Input
                    type="number"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                    className="h-9 bg-white text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Discount (₹)</Label>
                  <Input
                    type="number"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className="h-9 bg-white text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="text-xs font-bold text-slate-700">
                  Total Proposal Price:
                </span>
                <span className="text-xl font-extrabold text-emerald-700">
                  ₹{calculatedTotal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Validity, Terms & Notes */}
            <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Proposal Valid Until (Optional)
                </Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Payment / Booking Terms
                </Label>
                <Input
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="e.g. 50% advance to confirm..."
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Special Notes / Remarks (Optional)
              </Label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions or customized notes for the traveler..."
                className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <DialogFooter className="border-t border-slate-100 pt-4">
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
                className="bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                {creating ? 'Saving Proposal...' : 'Create & Proceed to Send'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Send via WhatsApp Modal */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Send className="h-5 w-5 text-emerald-600" />
              Send Trip Proposal via WhatsApp
            </DialogTitle>
          </DialogHeader>

          {proposalToSend && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Proposal: {proposalToSend.proposal_number}</span>
                  <span className="font-bold text-emerald-700">
                    ₹
                    {Number(proposalToSend.total_price).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {proposalToSend.title}
                </div>
                <div className="text-xs text-slate-500">
                  {proposalToSend.destination} • {proposalToSend.duration_days}{' '}
                  Days / {proposalToSend.duration_nights} Nights
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Recipient WhatsApp Phone Number *
                </Label>
                <Input
                  required
                  placeholder="e.g. 919547771118 or +91 95477 71118"
                  value={sendPhone}
                  onChange={(e) => setSendPhone(e.target.value)}
                  className="h-9 text-sm font-medium"
                />
                <p className="text-[11px] text-slate-500">
                  Include country code (e.g. 91 for India).
                </p>
              </div>

              <div className="space-y-1.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-950">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  What the traveler receives:
                </div>
                <p className="text-[11px] leading-relaxed text-emerald-800">
                  A formatted WhatsApp message with trip highlights, total price
                  in ₹, key inclusions, and an interactive online proposal link.
                </p>
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSendOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendWhatsApp}
                  disabled={sending || !sendPhone.trim()}
                  className="gap-1.5 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <Send className="h-3.5 w-3.5" />
                  {sending ? 'Sending...' : 'Send to WhatsApp Now'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Proposal Details Drawer / Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between pr-6 text-lg font-bold text-slate-900">
              <span>{selectedProposal?.proposal_number}</span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                ₹
                {Number(selectedProposal?.total_price || 0).toLocaleString(
                  'en-IN'
                )}
              </span>
            </SheetTitle>
          </SheetHeader>

          {selectedProposal && (
            <div className="space-y-6 pt-4 text-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedProposal.title}
                </h3>
                <div className="mt-0.5 text-xs text-slate-500">
                  {selectedProposal.destination} •{' '}
                  {selectedProposal.duration_days} Days /{' '}
                  {selectedProposal.duration_nights} Nights
                </div>
              </div>

              <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                <div className="font-semibold text-slate-700">
                  Traveler Details
                </div>
                <div className="font-bold text-slate-900">
                  {selectedProposal.contacts?.name || 'Unnamed Traveler'}
                </div>
                <div className="text-slate-500">
                  {selectedProposal.contacts?.phone || 'No phone'}
                </div>
              </div>

              {/* Day-by-Day */}
              {selectedProposal.itinerary &&
                selectedProposal.itinerary.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-xs font-bold tracking-wider text-slate-900 uppercase">
                      Itinerary
                    </div>
                    <div className="space-y-2.5">
                      {selectedProposal.itinerary.map((d, idx) => (
                        <div
                          key={idx}
                          className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
                        >
                          <div className="font-bold text-slate-900">
                            Day {d.day}: {d.title}
                          </div>
                          <p className="text-[11px] leading-relaxed text-slate-600">
                            {d.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Actions */}
              <div className="space-y-2 border-t border-slate-200 pt-4">
                <Button
                  onClick={() => {
                    setDetailOpen(false);
                    openSendDialog(selectedProposal);
                  }}
                  className="w-full gap-2 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send Proposal via WhatsApp
                </Button>

                <Button
                  variant="outline"
                  onClick={() =>
                    window.open(`/proposals/${selectedProposal.id}`, '_blank')
                  }
                  className="w-full gap-2 text-xs text-slate-700"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Public Traveler View
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
