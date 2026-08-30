'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Hotel,
  MapPin,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
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
import { toast } from 'sonner';
import { salesApi } from '@/lib/sales/api-client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { resolveIndustryAlias } from '@/modules/terminology';
import { fetchTourPackage, fetchTourPackages } from '@/lib/travel/api-client';
import { tourPackageToProposalPrefill } from '@/lib/travel/proposal-adapter';
import type { TourPackage } from '@/lib/travel/types';
import {
  CREATE_TRIP_PROPOSAL_STEPS,
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

const duration = (start: string, end: string) => {
  if (!start || !end) return '';
  const nights = Math.max(
    0,
    Math.round(
      (new Date(`${end}T00:00:00`).getTime() -
        new Date(`${start}T00:00:00`).getTime()) /
        86400000
    )
  );
  return `${nights + 1} Days / ${nights} Nights`;
};

const money = (value?: number | null) =>
  `₹${Math.max(0, Number(value) || 0).toLocaleString('en-IN')}`;

const dateLabel = (value?: string) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
      })
    : '—';

export function getTripProposalDetailsError({
  contactId,
  destination,
  startDate,
  endDate,
}: {
  contactId: string;
  destination: string;
  startDate: string;
  endDate: string;
}) {
  if (!contactId) return 'Please select a traveller';
  if (!destination.trim()) return 'Destination is required';
  if (!startDate || !endDate) return 'Travel dates are required';
  if (new Date(`${endDate}T00:00:00`) < new Date(`${startDate}T00:00:00`)) {
    return 'End date cannot be before start date';
  }
  return null;
}

export function CreateTripProposalDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const { account } = useAuth();
  const isTravelWorkplace =
    resolveIndustryAlias(account?.industry) === 'travel';
  const [step, setStep] = useState(0);
  const [contacts, setContacts] = useState<
    Array<{ id: string; name: string; phone: string }>
  >([]);
  const [packages, setPackages] = useState<TourPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [saving, setSaving] = useState(false);
  const [contactId, setContactId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');
  const [travel, setTravel] = useState<TravelDetails>(emptyTravel());
  const [items, setItems] = useState<Item[]>([emptyItem()]);

  useEffect(() => {
    if (!open) return;
    salesApi<Array<{ id: string; name: string; phone: string }>>(
      '/api/contacts?limit=100'
    )
      .then((data) => setContacts(Array.isArray(data) ? data : []))
      .catch(() => {});
    if (isTravelWorkplace) {
      fetchTourPackages({ status: 'active' })
        .then((data) => setPackages(Array.isArray(data) ? data : []))
        .catch(() => setPackages([]));
    }
  }, [open, isTravelWorkplace]);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
        0
      ),
    [items]
  );
  const tax = (subtotal * (Number(taxRate) || 0)) / 100;
  const total = Math.max(0, subtotal + tax - (Number(discount) || 0));
  const advance = Math.min(
    total,
    Math.max(0, Number(travel.advance_amount) || 0)
  );
  const balance = Math.max(0, total - advance);
  const tripLength = duration(travel.start_date, travel.end_date);

  const setTravelField = <K extends keyof TravelDetails>(
    key: K,
    value: TravelDetails[K]
  ) => {
    setTravel((previous) => ({ ...previous, [key]: value }));
  };

  const reset = () => {
    setStep(0);
    setContactId('');
    setValidUntil('');
    setTaxRate('0');
    setDiscount('0');
    setNotes('');
    setTravel(emptyTravel());
    setItems([emptyItem()]);
    setSelectedPackageId('');
  };

  const close = () => {
    onOpenChange(false);
    reset();
  };

  const tripDetailsError = () =>
    getTripProposalDetailsError({
      contactId,
      destination: travel.destination,
      startDate: travel.start_date,
      endDate: travel.end_date,
    });

  const goNext = () => {
    if (step === 0) {
      const error = tripDetailsError();
      if (error) return toast.error(error);
    }
    if (step === 2 && items.some((item) => !item.description.trim())) {
      return toast.error('All services need a description');
    }
    setStep((current) =>
      Math.min(CREATE_TRIP_PROPOSAL_STEPS.length - 1, current + 1)
    );
  };

  const createProposal = async () => {
    const error = tripDetailsError();
    if (error) {
      setStep(0);
      return toast.error(error);
    }
    if (items.some((item) => !item.description.trim())) {
      setStep(2);
      return toast.error('All services need a description');
    }

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
          terms:
            'Package subject to availability. Payment terms as agreed with the traveller.',
          items: items.map(
            ({ description, quantity, unit_price, category }) => ({
              description,
              quantity,
              unit_price,
              category,
            })
          ),
          travel_details: {
            ...travel,
            proposal_title:
              travel.proposal_title.trim() || `${travel.destination} Trip`,
            duration_label: tripLength,
            itinerary: travel.itinerary.map((day, index) => ({
              ...day,
              day: index + 1,
            })),
            inclusions: travel.inclusions.filter(Boolean),
            exclusions: travel.exclusions.filter(Boolean),
            advance_amount: advance,
            balance_amount: balance,
          },
        }),
      });
      toast.success('Trip proposal created');
      onCreated();
      close();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to create proposal');
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (step < CREATE_TRIP_PROPOSAL_STEPS.length - 1) {
      goNext();
      return;
    }
    void createProposal();
  };

  const updateDay = (index: number, key: keyof Day, value: string) => {
    setTravel((previous) => ({
      ...previous,
      itinerary: previous.itinerary.map((day, dayIndex) =>
        dayIndex === index
          ? { ...day, [key]: key === 'day' ? Number(value) : value }
          : day
      ),
    }));
  };

  const fieldClass = 'mt-1 h-9 text-sm';

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close();
        else onOpenChange(true);
      }}
    >
      <DialogContent className={TRIP_PROPOSAL_CREATE_DIALOG_CLASSNAME}>
        <DialogHeader className="shrink-0 border-b px-5 py-3 pr-12">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Sparkles className="h-4 w-4 text-emerald-500" /> Create Trip
            Proposal
          </DialogTitle>
        </DialogHeader>

        <div className="grid shrink-0 grid-cols-4 gap-1 border-b px-3 py-2.5">
          {CREATE_TRIP_PROPOSAL_STEPS.map((label, index) => {
            const active = index === step;
            const done = index < step;
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (index <= step) setStep(index);
                }}
                className="flex flex-col items-center gap-1"
              >
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                    active
                      ? 'bg-emerald-500 text-white'
                      : done
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-200 text-slate-500'
                  )}
                >
                  {index + 1}
                </span>
                <span
                  className={cn(
                    'text-[11px]',
                    active ? 'font-semibold text-slate-900' : 'text-slate-500'
                  )}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {step === 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <MapPin className="h-4 w-4 text-emerald-500" /> Trip details
                </div>
                {isTravelWorkplace && packages.length > 0 ? (
                  <div>
                    <Label className="text-xs">Use existing Tour Package</Label>
                    <select
                      value={selectedPackageId}
                      onChange={(event) => {
                        const nextId = event.target.value;
                        setSelectedPackageId(nextId);
                        if (!nextId) return;
                        void fetchTourPackage(nextId)
                          .then((detail) => {
                            const prefill =
                              tourPackageToProposalPrefill(detail);
                            setTravel((previous) => ({
                              ...previous,
                              proposal_title: prefill.proposal_title,
                              destination: prefill.destination,
                              duration_label: prefill.duration_label,
                              trip_type: prefill.trip_type,
                              hotel_category: prefill.hotel_category,
                              meal_plan: prefill.meal_plan,
                              itinerary: prefill.itinerary,
                              inclusions: prefill.inclusions,
                              exclusions: prefill.exclusions,
                            }));
                            setItems(prefill.items);
                          })
                          .catch(() =>
                            toast.error('Unable to load the selected package')
                          );
                      }}
                      className="mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                    >
                      <option value="">Start from scratch</option>
                      {packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} — {pkg.destination}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div>
                  <Label className="text-xs">Traveller *</Label>
                  <select
                    value={contactId}
                    onChange={(event) => setContactId(event.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="">Choose traveller</option>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name} ({contact.phone})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs">Destination *</Label>
                    <Input
                      value={travel.destination}
                      onChange={(event) =>
                        setTravelField('destination', event.target.value)
                      }
                      placeholder="Goa, India"
                      className={fieldClass}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Title</Label>
                    <Input
                      value={travel.proposal_title}
                      onChange={(event) =>
                        setTravelField('proposal_title', event.target.value)
                      }
                      placeholder="Goa family holiday"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Start *</Label>
                    <Input
                      type="date"
                      value={travel.start_date}
                      onChange={(event) =>
                        setTravelField('start_date', event.target.value)
                      }
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">End *</Label>
                    <Input
                      type="date"
                      value={travel.end_date}
                      onChange={(event) =>
                        setTravelField('end_date', event.target.value)
                      }
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Adults</Label>
                    <Input
                      type="number"
                      min="1"
                      value={travel.adults}
                      onChange={(event) =>
                        setTravelField(
                          'adults',
                          Math.max(1, Number(event.target.value) || 1)
                        )
                      }
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Children</Label>
                    <Input
                      type="number"
                      min="0"
                      value={travel.children}
                      onChange={(event) =>
                        setTravelField(
                          'children',
                          Math.max(0, Number(event.target.value) || 0)
                        )
                      }
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Trip type</Label>
                    <select
                      value={travel.trip_type}
                      onChange={(event) =>
                        setTravelField('trip_type', event.target.value)
                      }
                      className="mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm"
                    >
                      <option>Family Holiday</option>
                      <option>Leisure</option>
                      <option>Honeymoon</option>
                      <option>Adventure</option>
                      <option>Business</option>
                      <option>Group Tour</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Hotel</Label>
                    <select
                      value={travel.hotel_category}
                      onChange={(event) =>
                        setTravelField('hotel_category', event.target.value)
                      }
                      className="mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm"
                    >
                      <option>3 Star</option>
                      <option>4 Star</option>
                      <option>5 Star</option>
                      <option>Luxury</option>
                      <option>Budget</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Meal plan</Label>
                    <select
                      value={travel.meal_plan}
                      onChange={(event) =>
                        setTravelField('meal_plan', event.target.value)
                      }
                      className="mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm"
                    >
                      <option>Breakfast</option>
                      <option>Breakfast & Dinner</option>
                      <option>Half Board</option>
                      <option>Full Board</option>
                      <option>Room Only</option>
                    </select>
                  </div>
                </div>
                {tripLength ? (
                  <p className="text-xs text-slate-500">{tripLength}</p>
                ) : null}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <CalendarDays className="h-4 w-4 text-emerald-500" />{' '}
                    Itinerary
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
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
                      }))
                    }
                    className="h-8 rounded-lg"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Day
                  </Button>
                </div>
                <div className="space-y-3">
                  {travel.itinerary.map((day, index) => (
                    <div
                      key={`day-${index}`}
                      className="space-y-2 rounded-xl border p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold tracking-wide text-emerald-600">
                          DAY {day.day}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setTravel((previous) => ({
                              ...previous,
                              itinerary: previous.itinerary
                                .filter((_, dayIndex) => dayIndex !== index)
                                .map((row, dayIndex) => ({
                                  ...row,
                                  day: dayIndex + 1,
                                })),
                            }))
                          }
                          disabled={travel.itinerary.length === 1}
                          className="h-7 w-7 text-rose-500 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Input
                        value={day.title}
                        onChange={(event) =>
                          updateDay(index, 'title', event.target.value)
                        }
                        placeholder="Day title"
                        className="h-9"
                      />
                      <Input
                        value={day.description}
                        onChange={(event) =>
                          updateDay(index, 'description', event.target.value)
                        }
                        placeholder="Activities and notes"
                        className="h-9"
                      />
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['inclusions', 'exclusions'] as const).map((key) => (
                    <div key={key}>
                      <div className="mb-2 flex items-center justify-between">
                        <Label className="text-xs font-semibold capitalize">
                          {key}
                        </Label>
                        <button
                          type="button"
                          onClick={() =>
                            setTravel((previous) => ({
                              ...previous,
                              [key]: [...previous[key], ''],
                            }))
                          }
                          className="text-[11px] font-semibold text-emerald-600"
                        >
                          + Add
                        </button>
                      </div>
                      <div className="space-y-2">
                        {travel[key].map((value, index) => (
                          <div
                            key={`${key}-${index}`}
                            className="flex items-center gap-1.5"
                          >
                            <Input
                              value={value}
                              onChange={(event) =>
                                setTravel((previous) => ({
                                  ...previous,
                                  [key]: previous[key].map((item, itemIndex) =>
                                    itemIndex === index
                                      ? event.target.value
                                      : item
                                  ),
                                }))
                              }
                              placeholder={
                                key === 'inclusions' ? 'Breakfast' : 'Airfare'
                              }
                              className="h-8 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setTravel((previous) => ({
                                  ...previous,
                                  [key]: previous[key].filter(
                                    (_, itemIndex) => itemIndex !== index
                                  ),
                                }))
                              }
                              className="text-rose-500"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Hotel className="h-4 w-4 text-emerald-500" /> Services
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setItems((previous) => [...previous, emptyItem()])
                    }
                    className="h-8 rounded-lg"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Service
                  </Button>
                </div>
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div
                      key={`service-${index}`}
                      className="space-y-1.5 rounded-lg border p-2"
                    >
                      <div className="flex min-w-0 gap-1.5">
                        <select
                          value={item.category}
                          onChange={(event) =>
                            setItems((previous) =>
                              previous.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, category: event.target.value }
                                  : row
                              )
                            )
                          }
                          className="h-9 w-24 shrink-0 rounded-lg border bg-white px-1.5 text-[11px]"
                        >
                          <option>Hotel</option>
                          <option>Transport</option>
                          <option>Flight</option>
                          <option>Activity</option>
                          <option>Meal</option>
                          <option>Transfer</option>
                          <option>Other</option>
                        </select>
                        <Input
                          value={item.description}
                          onChange={(event) =>
                            setItems((previous) =>
                              previous.map((row, rowIndex) =>
                                rowIndex === index
                                  ? {
                                      ...row,
                                      description: event.target.value,
                                    }
                                  : row
                              )
                            )
                          }
                          placeholder="Service"
                          className="h-9 min-w-0"
                        />
                      </div>
                      <div className="grid grid-cols-[64px_1fr_32px] gap-1.5">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(event) =>
                            setItems((previous) =>
                              previous.map((row, rowIndex) =>
                                rowIndex === index
                                  ? {
                                      ...row,
                                      quantity: Math.max(
                                        1,
                                        Number(event.target.value) || 1
                                      ),
                                    }
                                  : row
                              )
                            )
                          }
                          className="h-9"
                        />
                        <Input
                          type="number"
                          min="0"
                          value={item.unit_price}
                          onChange={(event) =>
                            setItems((previous) =>
                              previous.map((row, rowIndex) =>
                                rowIndex === index
                                  ? {
                                      ...row,
                                      unit_price: Math.max(
                                        0,
                                        Number(event.target.value) || 0
                                      ),
                                    }
                                  : row
                              )
                            )
                          }
                          className="h-9"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setItems((previous) =>
                              previous.length === 1
                                ? previous
                                : previous.filter(
                                    (_, rowIndex) => rowIndex !== index
                                  )
                            )
                          }
                          disabled={items.length === 1}
                          className="h-8 w-8 text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tax %</Label>
                    <Input
                      type="number"
                      min="0"
                      value={taxRate}
                      onChange={(event) => setTaxRate(event.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Discount (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={discount}
                      onChange={(event) => setDiscount(event.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Advance (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      max={total}
                      value={travel.advance_amount}
                      onChange={(event) =>
                        setTravelField(
                          'advance_amount',
                          Math.min(
                            total,
                            Math.max(0, Number(event.target.value) || 0)
                          )
                        )
                      }
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Balance</Label>
                    <Input
                      readOnly
                      value={money(balance)}
                      className={`${fieldClass} bg-slate-50`}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-700">Total</span>
                  <b className="text-emerald-700">{money(total)}</b>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="rounded-xl bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-slate-900">
                    {travel.proposal_title.trim() ||
                      `${travel.destination || 'Trip'} proposal`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {travel.destination || 'No destination'} ·{' '}
                    {dateLabel(travel.start_date)} –{' '}
                    {dateLabel(travel.end_date)}
                    {tripLength ? ` · ${tripLength}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {travel.adults} adults
                    {travel.children
                      ? ` · ${travel.children} children`
                      : ''} · {travel.hotel_category} · {travel.meal_plan}
                  </p>
                </div>
                <div className="space-y-1 text-xs">
                  {items.map((item, index) => (
                    <div
                      key={`review-${index}`}
                      className="flex justify-between gap-3"
                    >
                      <span className="truncate text-slate-600">
                        {item.category}: {item.description || 'Untitled'}
                      </span>
                      <span className="shrink-0 font-medium">
                        {money(
                          (Number(item.quantity) || 0) *
                            (Number(item.unit_price) || 0)
                        )}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                    <span>Total</span>
                    <span className="text-emerald-700">{money(total)}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Valid until</Label>
                  <Input
                    type="date"
                    value={validUntil}
                    onChange={(event) => setValidUntil(event.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <Label className="text-xs">Notes for traveller</Label>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Optional message"
                    className="mt-1 min-h-20 w-full resize-y rounded-lg border bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className={TRIP_PROPOSAL_CREATE_FOOTER_CLASSNAME}>
            <div className="flex w-full items-center justify-between gap-2">
              {step === 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={close}
                  className="rounded-lg"
                >
                  Cancel
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep((current) => Math.max(0, current - 1))}
                  className="rounded-lg"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
              )}
              {step < CREATE_TRIP_PROPOSAL_STEPS.length - 1 ? (
                <Button
                  type="submit"
                  className="rounded-lg bg-[#00b074] font-semibold text-white hover:bg-[#009b66]"
                >
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#00b074] font-semibold text-white hover:bg-[#009b66]"
                >
                  <Send className="mr-1.5 h-4 w-4" />
                  {saving ? 'Saving...' : 'Create proposal'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
