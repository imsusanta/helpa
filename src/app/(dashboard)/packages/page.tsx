'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/hooks/use-workspace';
import { useAuth } from '@/hooks/use-auth';
import {
  Luggage,
  Plus,
  Search,
  Trash2,
  MapPin,
  Edit3,
  CheckCircle2,
  Clock,
  Car,
  Building2,
  Archive,
  RefreshCw,
  DollarSign,
  X,
  Plane,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ItineraryDay {
  day_number: number;
  title: string;
  description: string;
  meals?: string;
  accommodation?: string;
}

interface PackageDeparture {
  id?: string;
  start_date: string;
  end_date?: string;
  departure_price?: number;
  total_seats?: number;
  available_seats?: number;
  status: 'scheduled' | 'sold_out' | 'cancelled';
}

interface TourPackageModel {
  id: string;
  package_code: string | null;
  name: string;
  destination: string;
  summary: string | null;
  duration_days: number;
  duration_nights: number | null;
  base_price: number | null;
  currency: string;
  price_basis: string | null;
  hotel_details: Record<string, unknown> | null;
  transport_details: Record<string, unknown> | null;
  inclusions: string[];
  exclusions: string[];
  terms_and_conditions: string | null;
  booking_deadline: string | null;
  valid_from: string | null;
  valid_until: string | null;
  status: 'draft' | 'published' | 'sold_out' | 'archived';
  itinerary?: ItineraryDay[];
  departures?: PackageDeparture[];
  created_at: string;
  updated_at: string;
}

const COMMON_INCLUSIONS = [
  'Hotel Accommodation',
  'Daily Breakfast',
  'Daily Breakfast & Dinner',
  'Private AC Cab for Sightseeing',
  'Airport / Railway Station Transfers',
  'English Speaking Driver / Guide',
  'All Tolls, Fuel & Parking Taxes',
  'Entry Tickets / Monument Passes',
];

const COMMON_EXCLUSIONS = [
  'Airfare / Train Tickets',
  'Personal Expenses & Laundry',
  'Tips and Gratuities',
  'GST & Applicable Taxes',
  'Adventure Activity Charges',
  'Lunches & Extra Meals',
];

const STATUS_CONFIGS: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  published: {
    label: 'Published (Active)',
    bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  draft: {
    label: 'Draft',
    bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
  },
  sold_out: {
    label: 'Sold Out',
    bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800',
  },
  archived: {
    label: 'Archived',
    bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    text: 'text-slate-700 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
  },
};

export default function PackagesPage() {
  const router = useRouter();
  const {
    currentIndustry,
    isRouteAllowed,
    loading: workspaceLoading,
  } = useWorkspace();
  const { accountRole } = useAuth();
  const canManage = Boolean(
    accountRole &&
    ['agent', 'admin', 'super_admin', 'owner'].includes(accountRole)
  );

  const [packages, setPackages] = useState<TourPackageModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!workspaceLoading) {
      const isTravel = currentIndustry === 'travel';
      const isAllowed = isRouteAllowed('/packages');
      if (!isTravel || !isAllowed) {
        toast.error(
          'Tour Packages catalog is only available for Travel Agency workspaces.'
        );
        router.replace('/dashboard');
      }
    }
  }, [workspaceLoading, currentIndustry, isRouteAllowed, router]);

  // Modal states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<TourPackageModel | null>(
    null
  );
  const [activeModalTab, setActiveModalTab] = useState('basic');
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState<{
    name: string;
    package_code: string;
    destination: string;
    summary: string;
    duration_days: number;
    duration_nights: number;
    base_price: number | '';
    currency: string;
    price_basis: string;
    status: 'draft' | 'published' | 'sold_out' | 'archived';
    valid_from: string;
    valid_until: string;
    booking_deadline: string;
    hotel_note: string;
    transport_note: string;
    terms_and_conditions: string;
    inclusions: string[];
    exclusions: string[];
    itinerary: ItineraryDay[];
    departures: PackageDeparture[];
  }>({
    name: '',
    package_code: '',
    destination: '',
    summary: '',
    duration_days: 1,
    duration_nights: 0,
    base_price: '',
    currency: 'INR',
    price_basis: 'per_person',
    status: 'draft',
    valid_from: '',
    valid_until: '',
    booking_deadline: '',
    hotel_note: '',
    transport_note: '',
    terms_and_conditions: '',
    inclusions: [],
    exclusions: [],
    itinerary: [
      {
        day_number: 1,
        title: '',
        description: '',
        meals: '',
        accommodation: '',
      },
    ],
    departures: [],
  });

  const [customInclusionInput, setCustomInclusionInput] = useState('');
  const [customExclusionInput, setCustomExclusionInput] = useState('');

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }

      const res = await fetch(`/api/travel/packages?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setPackages(data.data || []);
      } else {
        toast.error(data.message || 'Failed to fetch packages');
      }
    } catch (err) {
      console.error('Error fetching packages:', err);
      toast.error('Failed to load tour packages');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const handleOpenCreate = () => {
    setEditingPackage(null);
    setFormData({
      name: '',
      package_code: `PKG-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      destination: '',
      summary: '',
      duration_days: 1,
      duration_nights: 0,
      base_price: '',
      currency: 'INR',
      price_basis: 'per_person',
      status: 'draft',
      valid_from: '',
      valid_until: '',
      booking_deadline: '',
      hotel_note: '',
      transport_note: '',
      terms_and_conditions: '',
      inclusions: [],
      exclusions: [],
      itinerary: [
        {
          day_number: 1,
          title: '',
          description: '',
          meals: '',
          accommodation: '',
        },
      ],
      departures: [],
    });
    setActiveModalTab('basic');
    setIsDialogOpen(true);
  };

  const handleOpenEdit = async (pkg: TourPackageModel) => {
    try {
      const res = await fetch(`/api/travel/packages/${pkg.id}`);
      const data = await res.json();
      const fullPkg: TourPackageModel = data.success ? data.data : pkg;

      setEditingPackage(fullPkg);
      setFormData({
        name: fullPkg.name || '',
        package_code: fullPkg.package_code || '',
        destination: fullPkg.destination || '',
        summary: fullPkg.summary || '',
        duration_days: fullPkg.duration_days || 1,
        duration_nights: fullPkg.duration_nights || 0,
        base_price: fullPkg.base_price ?? '',
        currency: fullPkg.currency || 'INR',
        price_basis: fullPkg.price_basis || 'per_person',
        status: fullPkg.status || 'published',
        valid_from: fullPkg.valid_from ? fullPkg.valid_from.split('T')[0] : '',
        valid_until: fullPkg.valid_until
          ? fullPkg.valid_until.split('T')[0]
          : '',
        booking_deadline: fullPkg.booking_deadline
          ? fullPkg.booking_deadline.split('T')[0]
          : '',
        hotel_note:
          typeof fullPkg.hotel_details === 'string'
            ? fullPkg.hotel_details
            : (fullPkg.hotel_details?.description as string) ||
              (fullPkg.hotel_details?.name as string) ||
              '',
        transport_note:
          typeof fullPkg.transport_details === 'string'
            ? fullPkg.transport_details
            : (fullPkg.transport_details?.description as string) ||
              (fullPkg.transport_details?.type as string) ||
              '',
        terms_and_conditions: fullPkg.terms_and_conditions || '',
        inclusions: Array.isArray(fullPkg.inclusions) ? fullPkg.inclusions : [],
        exclusions: Array.isArray(fullPkg.exclusions) ? fullPkg.exclusions : [],
        itinerary:
          fullPkg.itinerary && fullPkg.itinerary.length > 0
            ? fullPkg.itinerary
            : [
                {
                  day_number: 1,
                  title: 'Day 1 Itinerary',
                  description: 'Arrival and sightseeing',
                },
              ],
        departures: Array.isArray(fullPkg.departures) ? fullPkg.departures : [],
      });
      setActiveModalTab('basic');
      setIsDialogOpen(true);
    } catch (e) {
      console.error('Error loading package details:', e);
      toast.error('Failed to load package details');
    }
  };

  const handleTogglePublish = async (pkg: TourPackageModel) => {
    const newAction = pkg.status === 'published' ? 'archive' : 'publish';
    try {
      const res = await fetch(`/api/travel/packages/${pkg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: newAction }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          newAction === 'publish'
            ? 'Package published and live for WhatsApp AI!'
            : 'Package archived'
        );
        fetchPackages();
      } else {
        toast.error(data.message || 'Action failed');
      }
    } catch {
      toast.error('Failed to update package status');
    }
  };

  const handleDelete = async (pkg: TourPackageModel) => {
    if (
      !confirm(
        `Are you sure you want to delete "${pkg.name}"? If it has linked bookings or proposals, it will be safely archived instead.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/travel/packages/${pkg.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Package deleted');
        fetchPackages();
      } else {
        toast.error(data.message || 'Failed to delete package');
      }
    } catch {
      toast.error('Delete request failed');
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Package Name is required');
      setActiveModalTab('basic');
      return;
    }
    if (!formData.destination.trim()) {
      toast.error('Destination is required');
      setActiveModalTab('basic');
      return;
    }
    if (formData.duration_days < 1) {
      toast.error('Duration must be at least 1 day');
      setActiveModalTab('basic');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        package_code: formData.package_code.trim() || undefined,
        destination: formData.destination.trim(),
        summary: formData.summary.trim() || undefined,
        duration_days: Number(formData.duration_days),
        duration_nights: Number(formData.duration_nights) || 0,
        base_price:
          formData.base_price === '' ? null : Number(formData.base_price),
        currency: formData.currency || 'INR',
        price_basis: formData.price_basis || 'per_person',
        status: formData.status,
        valid_from: formData.valid_from || undefined,
        valid_until: formData.valid_until || undefined,
        booking_deadline: formData.booking_deadline || undefined,
        hotel_details: formData.hotel_note
          ? { description: formData.hotel_note }
          : undefined,
        transport_details: formData.transport_note
          ? { description: formData.transport_note }
          : undefined,
        inclusions: formData.inclusions,
        exclusions: formData.exclusions,
        terms_and_conditions: formData.terms_and_conditions || undefined,
        itinerary: formData.itinerary,
        departures: formData.departures,
      };

      const url = editingPackage
        ? `/api/travel/packages/${editingPackage.id}`
        : '/api/travel/packages';
      const method = editingPackage ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(
          editingPackage
            ? 'Tour Package updated successfully!'
            : 'New Tour Package created!'
        );
        setIsDialogOpen(false);
        fetchPackages();
      } else {
        toast.error(data.message || 'Failed to save tour package');
      }
    } catch (err) {
      console.error('Error saving package:', err);
      toast.error('Error saving package data');
    } finally {
      setSubmitting(false);
    }
  };

  // Itinerary helper methods
  const addItineraryDay = () => {
    const nextDayNum = formData.itinerary.length + 1;
    setFormData((prev) => ({
      ...prev,
      itinerary: [
        ...prev.itinerary,
        {
          day_number: nextDayNum,
          title: `Day ${nextDayNum} Itinerary`,
          description: '',
          meals: 'Breakfast & Dinner',
          accommodation: 'Hotel Stay',
        },
      ],
    }));
  };

  const removeItineraryDay = (index: number) => {
    setFormData((prev) => {
      const updated = prev.itinerary
        .filter((_, i) => i !== index)
        .map((item, idx) => ({ ...item, day_number: idx + 1 }));
      return { ...prev, itinerary: updated };
    });
  };

  // Departure helper methods
  const addDeparture = () => {
    const today = new Date();
    today.setDate(today.getDate() + 14);
    const dateStr = today.toISOString().split('T')[0];

    setFormData((prev) => ({
      ...prev,
      departures: [
        ...prev.departures,
        {
          start_date: dateStr,
          departure_price:
            typeof prev.base_price === 'number' ? prev.base_price : undefined,
          total_seats: 20,
          available_seats: 20,
          status: 'scheduled',
        },
      ],
    }));
  };

  const removeDeparture = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      departures: prev.departures.filter((_, i) => i !== index),
    }));
  };

  const stats = {
    total: packages.length,
    published: packages.filter((p) => p.status === 'published').length,
    draft: packages.filter((p) => p.status === 'draft').length,
    sold_out: packages.filter((p) => p.status === 'sold_out').length,
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/50 dark:bg-slate-950/50">
      {/* Top Banner */}
      <div className="border-b bg-white px-6 py-6 shadow-sm dark:bg-slate-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                <Plane className="h-5 w-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Tour Packages Catalog
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Structured single source of truth for tour packages, day-by-day
              itineraries, scheduled departures, and AI WhatsApp quotations.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPackages}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
            {canManage && (
              <Button
                onClick={handleOpenCreate}
                className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Create Package
              </Button>
            )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border bg-slate-50/70 p-4 dark:bg-slate-800/40">
            <div className="text-xs font-medium tracking-wider text-slate-500 uppercase">
              Total Catalog
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.total}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div className="flex items-center gap-1 text-xs font-medium tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Published (AI Active)
            </div>
            <div className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {stats.published}
            </div>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
            <div className="text-xs font-medium tracking-wider text-amber-600 uppercase dark:text-amber-400">
              Drafts
            </div>
            <div className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-300">
              {stats.draft}
            </div>
          </div>
          <div className="rounded-xl border bg-slate-50/70 p-4 dark:bg-slate-800/40">
            <div className="text-xs font-medium tracking-wider text-slate-500 uppercase">
              Sold Out / Inactive
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.sold_out}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 space-y-6 p-6">
        {/* Search & Filters */}
        <div className="flex flex-col items-center justify-between gap-4 rounded-xl border bg-white p-4 shadow-sm sm:flex-row dark:bg-slate-900">
          <div className="relative w-full sm:w-80">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by package name, destination, code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50/50 pl-9 dark:bg-slate-800/50"
            />
          </div>
          <div className="flex w-full items-center gap-2 overflow-x-auto pb-1 sm:w-auto sm:pb-0">
            {['all', 'published', 'draft', 'sold_out', 'archived'].map(
              (status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap capitalize transition-colors ${
                    statusFilter === status
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {status.replace('_', ' ')}
                </button>
              )
            )}
          </div>
        </div>

        {/* Packages List / Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center text-slate-500">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-sm">Loading tour packages catalog...</p>
          </div>
        ) : packages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border bg-white p-12 text-center shadow-sm dark:bg-slate-900">
            <div className="rounded-full bg-indigo-50 p-4 text-indigo-600 dark:bg-indigo-950/50">
              <Luggage className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                No tour packages found
              </h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search criteria or filter status.'
                  : 'Start by creating your first tour package so the WhatsApp AI assistant can quote it accurately to travelers.'}
              </p>
            </div>
            {canManage && (
              <Button onClick={handleOpenCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Add First Tour Package
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => {
              const statusCfg =
                STATUS_CONFIGS[pkg.status] || STATUS_CONFIGS.draft;
              return (
                <div
                  key={pkg.id}
                  className="flex flex-col justify-between overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900"
                >
                  <div className="space-y-4 p-5">
                    {/* Top Row: Destination & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                        <MapPin className="h-3.5 w-3.5" />
                        {pkg.destination}
                      </div>
                      <Badge
                        variant="outline"
                        className={`px-2 py-0.5 text-xs font-medium ${statusCfg.bg} ${statusCfg.border}`}
                      >
                        {statusCfg.label}
                      </Badge>
                    </div>

                    {/* Title & Summary */}
                    <div>
                      <div className="font-mono text-xs text-slate-400">
                        {pkg.package_code ||
                          `PKG-${pkg.id.slice(0, 6).toUpperCase()}`}
                      </div>
                      <h3 className="mt-0.5 line-clamp-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                        {pkg.name}
                      </h3>
                      {pkg.summary && (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                          {pkg.summary}
                        </p>
                      )}
                    </div>

                    {/* Metrics / Key specs */}
                    <div className="grid grid-cols-2 gap-2 border-t pt-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>
                          {pkg.duration_days} Days
                          {pkg.duration_nights
                            ? ` / ${pkg.duration_nights} Nights`
                            : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                        <span>
                          {pkg.currency}{' '}
                          {pkg.base_price
                            ? Number(pkg.base_price).toLocaleString()
                            : 'On Request'}
                        </span>
                      </div>
                    </div>

                    {/* Inclusions Chips Preview */}
                    {pkg.inclusions && pkg.inclusions.length > 0 && (
                      <div className="space-y-1.5 border-t pt-2">
                        <div className="text-[11px] font-medium tracking-wider text-slate-400 uppercase">
                          Key Inclusions
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {pkg.inclusions.slice(0, 3).map((inc, i) => (
                            <span
                              key={i}
                              className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            >
                              ✓ {inc}
                            </span>
                          ))}
                          {pkg.inclusions.length > 3 && (
                            <span className="self-center text-[11px] text-slate-400">
                              +{pkg.inclusions.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Actions Footer */}
                  <div className="flex items-center justify-between gap-2 border-t bg-slate-50/70 px-5 py-3 dark:bg-slate-800/40">
                    {canManage ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePublish(pkg)}
                          className={`gap-1.5 text-xs ${
                            pkg.status === 'published'
                              ? 'text-slate-600 hover:text-amber-600'
                              : 'text-emerald-600 hover:text-emerald-700'
                          }`}
                        >
                          {pkg.status === 'published' ? (
                            <>
                              <Archive className="h-3.5 w-3.5" /> Archive
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Publish
                              to AI
                            </>
                          )}
                        </Button>

                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(pkg)}
                            className="gap-1.5 text-xs"
                          >
                            <Edit3 className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(pkg)}
                            className="p-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(pkg)}
                        className="w-full gap-1.5 text-xs text-slate-600"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> View Package Details
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Package Create & Edit Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Luggage className="h-5 w-5 text-indigo-600" />
              {editingPackage ? 'Edit Tour Package' : 'Create New Tour Package'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configure package metadata, pricing, inclusions, day-by-day
              itineraries, and scheduled departure batches.
            </DialogDescription>
          </DialogHeader>

          {/* Modal Tabs Header */}
          <div className="border-b bg-slate-50/50 px-6 pt-2 dark:bg-slate-900/50">
            <Tabs
              value={activeModalTab}
              onValueChange={setActiveModalTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-5 bg-slate-100 p-1 dark:bg-slate-800">
                <TabsTrigger value="basic" className="text-xs">
                  Basic Info
                </TabsTrigger>
                <TabsTrigger value="pricing" className="text-xs">
                  Pricing & Stays
                </TabsTrigger>
                <TabsTrigger value="inclusions" className="text-xs">
                  Inclusions
                </TabsTrigger>
                <TabsTrigger value="itinerary" className="text-xs">
                  Itinerary ({formData.itinerary.length}D)
                </TabsTrigger>
                <TabsTrigger value="departures" className="text-xs">
                  Departures ({formData.departures.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Modal Tabs Body */}
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            {activeModalTab === 'basic' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">
                      Package Name <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      placeholder="e.g. 5 Days Darjeeling & Gangtok Delight"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">
                      Destination <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      placeholder="e.g. Darjeeling, Sikkim"
                      value={formData.destination}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          destination: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">
                      Package Code
                    </Label>
                    <Input
                      placeholder="e.g. PKG-DARJ-01"
                      value={formData.package_code}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          package_code: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">
                      Duration (Days) <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.duration_days}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          duration_days: Math.max(
                            1,
                            parseInt(e.target.value) || 1
                          ),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">
                      Duration (Nights)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={formData.duration_nights}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          duration_nights: Math.max(
                            0,
                            parseInt(e.target.value) || 0
                          ),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    Package Summary / Description
                  </Label>
                  <textarea
                    rows={3}
                    placeholder="Brief description of the highlights, destinations covered, and key attractions..."
                    value={formData.summary}
                    onChange={(e) =>
                      setFormData({ ...formData, summary: e.target.value })
                    }
                    className="border-input bg-background focus:ring-ring w-full rounded-lg border p-3 text-sm focus:ring-2 focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    Publication Status
                  </Label>
                  <div className="flex gap-4">
                    {(
                      ['published', 'draft', 'sold_out', 'archived'] as const
                    ).map((st) => (
                      <label
                        key={st}
                        className="flex cursor-pointer items-center gap-2 text-xs capitalize"
                      >
                        <input
                          type="radio"
                          name="package_status"
                          checked={formData.status === st}
                          onChange={() =>
                            setFormData({ ...formData, status: st })
                          }
                          className="text-indigo-600"
                        />
                        {st.replace('_', ' ')}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeModalTab === 'pricing' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Base Price</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="e.g. 15000"
                      value={formData.base_price}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          base_price:
                            e.target.value === '' ? '' : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Currency</Label>
                    <select
                      value={formData.currency}
                      onChange={(e) =>
                        setFormData({ ...formData, currency: e.target.value })
                      }
                      className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="AED">AED</option>
                      <option value="THB">THB (฿)</option>
                      <option value="BDT">BDT (৳)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Price Basis</Label>
                    <select
                      value={formData.price_basis}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          price_basis: e.target.value,
                        })
                      }
                      className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm"
                    >
                      <option value="per_person">Per Person</option>
                      <option value="per_couple">Per Couple</option>
                      <option value="per_group">Per Group</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Valid From</Label>
                    <Input
                      type="date"
                      value={formData.valid_from}
                      onChange={(e) =>
                        setFormData({ ...formData, valid_from: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Valid Until</Label>
                    <Input
                      type="date"
                      value={formData.valid_until}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          valid_until: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">
                      Booking Deadline
                    </Label>
                    <Input
                      type="date"
                      value={formData.booking_deadline}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          booking_deadline: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-xs font-semibold">
                    <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                    Hotel & Accommodation Details
                  </Label>
                  <Input
                    placeholder="e.g. 3-Star / 4-Star Deluxe Room on Twin Sharing with daily breakfast"
                    value={formData.hotel_note}
                    onChange={(e) =>
                      setFormData({ ...formData, hotel_note: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-xs font-semibold">
                    <Car className="h-3.5 w-3.5 text-indigo-600" />
                    Transport & Transfer Details
                  </Label>
                  <Input
                    placeholder="e.g. Private AC Sedan with Driver for all transfers and sightseeing"
                    value={formData.transport_note}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        transport_note: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-xs font-semibold">
                    <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                    Terms & Cancellation Conditions
                  </Label>
                  <textarea
                    rows={2}
                    placeholder="e.g. 50% advance for booking confirmation. Free cancellation up to 14 days before trip."
                    value={formData.terms_and_conditions}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        terms_and_conditions: e.target.value,
                      })
                    }
                    className="border-input bg-background focus:ring-ring w-full rounded-lg border p-3 text-sm focus:ring-2 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {activeModalTab === 'inclusions' && (
              <div className="space-y-6">
                {/* Inclusions */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-emerald-700 uppercase dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> Package Inclusions
                    </Label>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="Add custom inclusion..."
                      value={customInclusionInput}
                      onChange={(e) => setCustomInclusionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customInclusionInput.trim()) {
                          e.preventDefault();
                          setFormData({
                            ...formData,
                            inclusions: [
                              ...formData.inclusions,
                              customInclusionInput.trim(),
                            ],
                          });
                          setCustomInclusionInput('');
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (customInclusionInput.trim()) {
                          setFormData({
                            ...formData,
                            inclusions: [
                              ...formData.inclusions,
                              customInclusionInput.trim(),
                            ],
                          });
                          setCustomInclusionInput('');
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>

                  {/* Active Inclusions Chips */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {formData.inclusions.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      >
                        ✓ {item}
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              inclusions: formData.inclusions.filter(
                                (_, i) => i !== idx
                              ),
                            })
                          }
                          className="text-emerald-600 hover:text-emerald-900"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Preset Inclusions helper */}
                  <div className="pt-2">
                    <div className="mb-1.5 text-[11px] font-medium text-slate-400">
                      Quick suggestions:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_INCLUSIONS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          disabled={formData.inclusions.includes(preset)}
                          onClick={() =>
                            setFormData({
                              ...formData,
                              inclusions: [...formData.inclusions, preset],
                            })
                          }
                          className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-400"
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Exclusions */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-rose-700 uppercase dark:text-rose-400">
                      <AlertCircle className="h-4 w-4" /> Package Exclusions
                    </Label>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="Add custom exclusion..."
                      value={customExclusionInput}
                      onChange={(e) => setCustomExclusionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customExclusionInput.trim()) {
                          e.preventDefault();
                          setFormData({
                            ...formData,
                            exclusions: [
                              ...formData.exclusions,
                              customExclusionInput.trim(),
                            ],
                          });
                          setCustomExclusionInput('');
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (customExclusionInput.trim()) {
                          setFormData({
                            ...formData,
                            exclusions: [
                              ...formData.exclusions,
                              customExclusionInput.trim(),
                            ],
                          });
                          setCustomExclusionInput('');
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>

                  {/* Active Exclusions Chips */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {formData.exclusions.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                      >
                        ✕ {item}
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              exclusions: formData.exclusions.filter(
                                (_, i) => i !== idx
                              ),
                            })
                          }
                          className="text-rose-600 hover:text-rose-900"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Preset Exclusions helper */}
                  <div className="pt-2">
                    <div className="mb-1.5 text-[11px] font-medium text-slate-400">
                      Quick suggestions:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_EXCLUSIONS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          disabled={formData.exclusions.includes(preset)}
                          onClick={() =>
                            setFormData({
                              ...formData,
                              exclusions: [...formData.exclusions, preset],
                            })
                          }
                          className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-400"
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeModalTab === 'itinerary' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Day-by-Day Tour Itinerary
                    </h4>
                    <p className="text-xs text-slate-500">
                      Structure each day with titles, activity summaries, meals,
                      and hotel stays.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={addItineraryDay}
                    className="gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Day
                  </Button>
                </div>

                <div className="space-y-3">
                  {formData.itinerary.map((day, idx) => (
                    <div
                      key={idx}
                      className="space-y-3 rounded-xl border bg-slate-50/50 p-4 dark:bg-slate-800/40"
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-600 dark:bg-indigo-950/60">
                          Day {day.day_number}
                        </span>
                        {formData.itinerary.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItineraryDay(idx)}
                            className="h-auto p-1.5 text-rose-600 hover:text-rose-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">
                            Day Title
                          </Label>
                          <Input
                            placeholder="e.g. Arrival & Evening Mall Road Walk"
                            value={day.title}
                            onChange={(e) => {
                              const updated = [...formData.itinerary];
                              updated[idx].title = e.target.value;
                              setFormData({ ...formData, itinerary: updated });
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">
                            Meals Included
                          </Label>
                          <Input
                            placeholder="e.g. Breakfast & Dinner"
                            value={day.meals || ''}
                            onChange={(e) => {
                              const updated = [...formData.itinerary];
                              updated[idx].meals = e.target.value;
                              setFormData({ ...formData, itinerary: updated });
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold">
                          Day Sightseeing & Activity Description
                        </Label>
                        <textarea
                          rows={2}
                          placeholder="Detailed itinerary for this day (sightseeing spots, transfer timings, activities)..."
                          value={day.description || ''}
                          onChange={(e) => {
                            const updated = [...formData.itinerary];
                            updated[idx].description = e.target.value;
                            setFormData({ ...formData, itinerary: updated });
                          }}
                          className="border-input bg-background focus:ring-ring w-full rounded-lg border p-2.5 text-xs focus:ring-1 focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeModalTab === 'departures' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Scheduled Departure Batches
                    </h4>
                    <p className="text-xs text-slate-500">
                      Manage fixed departure dates, seat inventory, and
                      batch-specific pricing.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={addDeparture}
                    className="gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Departure
                  </Button>
                </div>

                {formData.departures.length === 0 ? (
                  <div className="rounded-xl border border-dashed bg-slate-50/50 p-8 text-center text-xs text-slate-400">
                    No departure batches configured yet. You can add scheduled
                    group departure dates or leave empty for customized flexible
                    dates.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.departures.map((dep, idx) => (
                      <div
                        key={idx}
                        className="space-y-2.5 rounded-xl border bg-slate-50/50 p-3.5 dark:bg-slate-800/40"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Batch #{idx + 1}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDeparture(idx)}
                            className="h-auto p-1 text-rose-600 hover:text-rose-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                          <div className="space-y-1">
                            <Label className="text-[11px]">Start Date</Label>
                            <Input
                              type="date"
                              value={dep.start_date}
                              onChange={(e) => {
                                const updated = [...formData.departures];
                                updated[idx].start_date = e.target.value;
                                setFormData({
                                  ...formData,
                                  departures: updated,
                                });
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">End Date</Label>
                            <Input
                              type="date"
                              value={dep.end_date || ''}
                              onChange={(e) => {
                                const updated = [...formData.departures];
                                updated[idx].end_date = e.target.value;
                                setFormData({
                                  ...formData,
                                  departures: updated,
                                });
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">Price (₹)</Label>
                            <Input
                              type="number"
                              placeholder="Price"
                              value={dep.departure_price ?? ''}
                              onChange={(e) => {
                                const updated = [...formData.departures];
                                updated[idx].departure_price =
                                  e.target.value === ''
                                    ? undefined
                                    : Number(e.target.value);
                                setFormData({
                                  ...formData,
                                  departures: updated,
                                });
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">
                              Available Seats
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              placeholder="Seats"
                              value={dep.available_seats ?? ''}
                              onChange={(e) => {
                                const updated = [...formData.departures];
                                updated[idx].available_seats =
                                  e.target.value === ''
                                    ? undefined
                                    : Number(e.target.value);
                                setFormData({
                                  ...formData,
                                  departures: updated,
                                });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <DialogFooter className="flex items-center justify-between border-t bg-slate-50/50 px-6 py-4 dark:bg-slate-900/50">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {submitting && <RefreshCw className="h-4 w-4 animate-spin" />}
              {editingPackage ? 'Save Changes' : 'Create Package'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
