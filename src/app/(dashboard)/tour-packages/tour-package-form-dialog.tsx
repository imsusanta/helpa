'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
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
import {
  createTourPackageRequest,
  fetchTourPackage,
  updateTourPackageRequest,
} from '@/lib/travel/api-client';
import {
  TOUR_DEPARTURE_STATUSES,
  TOUR_PACKAGE_CATEGORIES,
  TOUR_PACKAGE_CURRENCIES,
  TOUR_PACKAGE_TYPES,
  type TourPackageDetail,
  type TourPackageWriteInput,
} from '@/lib/travel/types';

const TABS = [
  'Details',
  'Itinerary',
  'Inclusions',
  'Hotels',
  'Pricing',
  'Departures',
] as const;

type FormState = TourPackageWriteInput;

function emptyForm(): FormState {
  return {
    name: '',
    destination: '',
    description: '',
    package_type: 'Family',
    category: 'Domestic',
    duration_days: 5,
    duration_nights: 4,
    starting_price: 0,
    currency: 'INR',
    status: 'active',
    featured: false,
    valid_from: '',
    valid_until: '',
    booking_notes: '',
    terms_and_conditions: '',
    itineraries: [
      {
        day_number: 1,
        title: '',
        description: '',
        activities: '',
        meals: '',
        hotel: '',
        overnight_location: '',
      },
    ],
    inclusions: [{ item: '' }],
    exclusions: [{ item: '' }],
    hotels: [
      {
        city: '',
        hotel_name: '',
        star_category: '',
        room_type: '',
        meal_plan: '',
        notes: '',
      },
    ],
    pricing: [
      {
        pricing_name: 'Per person',
        adults: 2,
        children: 0,
        occupancy_type: 'Double',
        price: 0,
        currency: 'INR',
        extra_bed: null,
        notes: '',
      },
    ],
    departures: [],
  };
}

function fromDetail(pkg: TourPackageDetail): FormState {
  return {
    ...emptyForm(),
    ...pkg,
    itineraries:
      pkg.itineraries.length > 0 ? pkg.itineraries : emptyForm().itineraries,
    inclusions: pkg.inclusions.length > 0 ? pkg.inclusions : [{ item: '' }],
    exclusions: pkg.exclusions.length > 0 ? pkg.exclusions : [{ item: '' }],
    hotels: pkg.hotels.length > 0 ? pkg.hotels : emptyForm().hotels,
    pricing: pkg.pricing.length > 0 ? pkg.pricing : emptyForm().pricing,
    departures: pkg.departures,
  };
}

export function TourPackageFormDialog({
  open,
  packageId,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  packageId: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Details');
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab('Details');
    if (!packageId) {
      setForm(emptyForm());
      return;
    }
    setLoading(true);
    fetchTourPackage(packageId)
      .then((detail) => setForm(fromDetail(detail)))
      .catch((error) =>
        toast.error((error as Error).message || 'Failed to load package')
      )
      .finally(() => setLoading(false));
  }, [open, packageId]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    if (!form.name.trim() || !form.destination.trim()) {
      setTab('Details');
      return toast.error('Package name and destination are required');
    }
    setSaving(true);
    try {
      if (packageId) await updateTourPackageRequest(packageId, form);
      else await createTourPackageRequest(form);
      toast.success(packageId ? 'Package updated' : 'Package created');
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to save package');
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = 'mt-1 h-9 text-sm';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92vh,820px)] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b px-5 py-3 pr-12">
          <DialogTitle className="text-base font-semibold">
            {packageId ? 'Edit Tour Package' : 'Create Tour Package'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex shrink-0 flex-wrap gap-1 border-b px-3 py-2">
          {TABS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setTab(label)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                tab === label
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-12 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : (
            <>
              {tab === 'Details' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs">Package Name *</Label>
                    <Input
                      value={form.name}
                      onChange={(event) => setField('name', event.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Destination *</Label>
                    <Input
                      value={form.destination}
                      onChange={(event) =>
                        setField('destination', event.target.value)
                      }
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Package Type</Label>
                    <select
                      value={form.package_type || ''}
                      onChange={(event) =>
                        setField('package_type', event.target.value)
                      }
                      className="mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm"
                    >
                      {TOUR_PACKAGE_TYPES.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Description</Label>
                    <textarea
                      value={form.description || ''}
                      onChange={(event) =>
                        setField('description', event.target.value)
                      }
                      className="mt-1 min-h-20 w-full rounded-lg border p-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Category</Label>
                    <select
                      value={form.category || ''}
                      onChange={(event) =>
                        setField('category', event.target.value)
                      }
                      className="mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm"
                    >
                      {TOUR_PACKAGE_CATEGORIES.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Currency</Label>
                    <select
                      value={form.currency || 'INR'}
                      onChange={(event) =>
                        setField('currency', event.target.value)
                      }
                      className="mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm"
                    >
                      {TOUR_PACKAGE_CURRENCIES.map((currency) => (
                        <option key={currency}>{currency}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Duration (days)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={form.duration_days}
                      onChange={(event) =>
                        setField(
                          'duration_days',
                          Math.max(1, Number(event.target.value) || 1)
                        )
                      }
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Duration (nights)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.duration_nights}
                      onChange={(event) =>
                        setField(
                          'duration_nights',
                          Math.max(0, Number(event.target.value) || 0)
                        )
                      }
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Starting Price</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.starting_price ?? ''}
                      onChange={(event) =>
                        setField(
                          'starting_price',
                          event.target.value === ''
                            ? null
                            : Number(event.target.value)
                        )
                      }
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <select
                      value={form.status}
                      onChange={(event) =>
                        setField(
                          'status',
                          event.target.value === 'inactive'
                            ? 'inactive'
                            : 'active'
                        )
                      }
                      className="mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Valid from</Label>
                    <Input
                      type="date"
                      value={form.valid_from || ''}
                      onChange={(event) =>
                        setField('valid_from', event.target.value)
                      }
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Valid until</Label>
                    <Input
                      type="date"
                      value={form.valid_until || ''}
                      onChange={(event) =>
                        setField('valid_until', event.target.value)
                      }
                      className={fieldClass}
                    />
                  </div>
                  <label className="col-span-2 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(form.featured)}
                      onChange={(event) =>
                        setField('featured', event.target.checked)
                      }
                    />
                    Featured package
                  </label>
                  <div className="col-span-2">
                    <Label className="text-xs">Booking notes</Label>
                    <Input
                      value={form.booking_notes || ''}
                      onChange={(event) =>
                        setField('booking_notes', event.target.value)
                      }
                      className={fieldClass}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Terms and conditions</Label>
                    <textarea
                      value={form.terms_and_conditions || ''}
                      onChange={(event) =>
                        setField('terms_and_conditions', event.target.value)
                      }
                      className="mt-1 min-h-16 w-full rounded-lg border p-2.5 text-sm"
                    />
                  </div>
                </div>
              )}

              {tab === 'Itinerary' && (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setField('itineraries', [
                          ...(form.itineraries || []),
                          {
                            day_number: (form.itineraries || []).length + 1,
                            title: '',
                            description: '',
                            activities: '',
                            meals: '',
                            hotel: '',
                            overnight_location: '',
                          },
                        ])
                      }
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Day
                    </Button>
                  </div>
                  {(form.itineraries || []).map((day, index) => (
                    <div
                      key={`day-${index}`}
                      className="space-y-2 rounded-xl border p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-600">
                          DAY {index + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-rose-500"
                          disabled={(form.itineraries || []).length === 1}
                          onClick={() =>
                            setField(
                              'itineraries',
                              (form.itineraries || [])
                                .filter((_, itemIndex) => itemIndex !== index)
                                .map((row, itemIndex) => ({
                                  ...row,
                                  day_number: itemIndex + 1,
                                }))
                            )
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Input
                        placeholder="Title"
                        value={day.title || ''}
                        onChange={(event) =>
                          setField(
                            'itineraries',
                            (form.itineraries || []).map((row, itemIndex) =>
                              itemIndex === index
                                ? { ...row, title: event.target.value }
                                : row
                            )
                          )
                        }
                      />
                      <Input
                        placeholder="Description"
                        value={day.description || ''}
                        onChange={(event) =>
                          setField(
                            'itineraries',
                            (form.itineraries || []).map((row, itemIndex) =>
                              itemIndex === index
                                ? { ...row, description: event.target.value }
                                : row
                            )
                          )
                        }
                      />
                      <Input
                        placeholder="Activities"
                        value={day.activities || ''}
                        onChange={(event) =>
                          setField(
                            'itineraries',
                            (form.itineraries || []).map((row, itemIndex) =>
                              itemIndex === index
                                ? { ...row, activities: event.target.value }
                                : row
                            )
                          )
                        }
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          placeholder="Meals"
                          value={day.meals || ''}
                          onChange={(event) =>
                            setField(
                              'itineraries',
                              (form.itineraries || []).map((row, itemIndex) =>
                                itemIndex === index
                                  ? { ...row, meals: event.target.value }
                                  : row
                              )
                            )
                          }
                        />
                        <Input
                          placeholder="Hotel"
                          value={day.hotel || ''}
                          onChange={(event) =>
                            setField(
                              'itineraries',
                              (form.itineraries || []).map((row, itemIndex) =>
                                itemIndex === index
                                  ? { ...row, hotel: event.target.value }
                                  : row
                              )
                            )
                          }
                        />
                        <Input
                          placeholder="Overnight"
                          value={day.overnight_location || ''}
                          onChange={(event) =>
                            setField(
                              'itineraries',
                              (form.itineraries || []).map((row, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...row,
                                      overnight_location: event.target.value,
                                    }
                                  : row
                              )
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'Inclusions' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {(['inclusions', 'exclusions'] as const).map((key) => (
                    <div key={key}>
                      <div className="mb-2 flex items-center justify-between">
                        <Label className="text-xs font-semibold capitalize">
                          {key}
                        </Label>
                        <button
                          type="button"
                          className="text-[11px] font-semibold text-emerald-600"
                          onClick={() =>
                            setField(key, [...(form[key] || []), { item: '' }])
                          }
                        >
                          + Add
                        </button>
                      </div>
                      <div className="space-y-2">
                        {(form[key] || []).map((row, index) => (
                          <div key={`${key}-${index}`} className="flex gap-1.5">
                            <Input
                              value={row.item}
                              onChange={(event) =>
                                setField(
                                  key,
                                  (form[key] || []).map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { item: event.target.value }
                                      : item
                                  )
                                )
                              }
                              className="h-8"
                            />
                            <button
                              type="button"
                              className="text-rose-500"
                              onClick={() =>
                                setField(
                                  key,
                                  (form[key] || []).filter(
                                    (_, itemIndex) => itemIndex !== index
                                  )
                                )
                              }
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'Hotels' && (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setField('hotels', [
                          ...(form.hotels || []),
                          {
                            city: '',
                            hotel_name: '',
                            star_category: '',
                            room_type: '',
                            meal_plan: '',
                            notes: '',
                          },
                        ])
                      }
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Hotel
                    </Button>
                  </div>
                  {(form.hotels || []).map((hotel, index) => (
                    <div
                      key={`hotel-${index}`}
                      className="grid grid-cols-2 gap-2 rounded-xl border p-3"
                    >
                      <Input
                        placeholder="Hotel name"
                        value={hotel.hotel_name}
                        onChange={(event) =>
                          setField(
                            'hotels',
                            (form.hotels || []).map((row, itemIndex) =>
                              itemIndex === index
                                ? { ...row, hotel_name: event.target.value }
                                : row
                            )
                          )
                        }
                      />
                      <Input
                        placeholder="City"
                        value={hotel.city || ''}
                        onChange={(event) =>
                          setField(
                            'hotels',
                            (form.hotels || []).map((row, itemIndex) =>
                              itemIndex === index
                                ? { ...row, city: event.target.value }
                                : row
                            )
                          )
                        }
                      />
                      <Input
                        placeholder="Star category"
                        value={hotel.star_category || ''}
                        onChange={(event) =>
                          setField(
                            'hotels',
                            (form.hotels || []).map((row, itemIndex) =>
                              itemIndex === index
                                ? { ...row, star_category: event.target.value }
                                : row
                            )
                          )
                        }
                      />
                      <Input
                        placeholder="Room type"
                        value={hotel.room_type || ''}
                        onChange={(event) =>
                          setField(
                            'hotels',
                            (form.hotels || []).map((row, itemIndex) =>
                              itemIndex === index
                                ? { ...row, room_type: event.target.value }
                                : row
                            )
                          )
                        }
                      />
                      <Input
                        placeholder="Meal plan"
                        value={hotel.meal_plan || ''}
                        onChange={(event) =>
                          setField(
                            'hotels',
                            (form.hotels || []).map((row, itemIndex) =>
                              itemIndex === index
                                ? { ...row, meal_plan: event.target.value }
                                : row
                            )
                          )
                        }
                      />
                      <Input
                        placeholder="Notes"
                        value={hotel.notes || ''}
                        onChange={(event) =>
                          setField(
                            'hotels',
                            (form.hotels || []).map((row, itemIndex) =>
                              itemIndex === index
                                ? { ...row, notes: event.target.value }
                                : row
                            )
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              {tab === 'Pricing' && (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setField('pricing', [
                          ...(form.pricing || []),
                          {
                            pricing_name: '',
                            adults: 2,
                            children: 0,
                            occupancy_type: '',
                            price: 0,
                            currency: form.currency || 'INR',
                          },
                        ])
                      }
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Price rule
                    </Button>
                  </div>
                  {(form.pricing || []).map((row, index) => (
                    <div
                      key={`price-${index}`}
                      className="grid grid-cols-2 gap-2 rounded-xl border p-3"
                    >
                      <Input
                        placeholder="Pricing name"
                        value={row.pricing_name || ''}
                        onChange={(event) =>
                          setField(
                            'pricing',
                            (form.pricing || []).map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, pricing_name: event.target.value }
                                : item
                            )
                          )
                        }
                      />
                      <Input
                        placeholder="Occupancy"
                        value={row.occupancy_type || ''}
                        onChange={(event) =>
                          setField(
                            'pricing',
                            (form.pricing || []).map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    occupancy_type: event.target.value,
                                  }
                                : item
                            )
                          )
                        }
                      />
                      <Input
                        type="number"
                        min="1"
                        placeholder="Adults"
                        value={row.adults}
                        onChange={(event) =>
                          setField(
                            'pricing',
                            (form.pricing || []).map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    adults: Math.max(
                                      1,
                                      Number(event.target.value) || 1
                                    ),
                                  }
                                : item
                            )
                          )
                        }
                      />
                      <Input
                        type="number"
                        min="0"
                        placeholder="Children"
                        value={row.children}
                        onChange={(event) =>
                          setField(
                            'pricing',
                            (form.pricing || []).map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    children: Math.max(
                                      0,
                                      Number(event.target.value) || 0
                                    ),
                                  }
                                : item
                            )
                          )
                        }
                      />
                      <Input
                        type="number"
                        min="0"
                        placeholder="Price"
                        value={row.price}
                        onChange={(event) =>
                          setField(
                            'pricing',
                            (form.pricing || []).map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    price: Number(event.target.value) || 0,
                                  }
                                : item
                            )
                          )
                        }
                      />
                      <Input
                        type="number"
                        min="0"
                        placeholder="Extra bed"
                        value={row.extra_bed ?? ''}
                        onChange={(event) =>
                          setField(
                            'pricing',
                            (form.pricing || []).map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    extra_bed:
                                      event.target.value === ''
                                        ? null
                                        : Number(event.target.value),
                                  }
                                : item
                            )
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              {tab === 'Departures' && (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setField('departures', [
                          ...(form.departures || []),
                          {
                            departure_date: '',
                            return_date: '',
                            total_seats: 20,
                            available_seats: 20,
                            price: form.starting_price ?? null,
                            currency: form.currency || 'INR',
                            status: 'open',
                          },
                        ])
                      }
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Departure
                    </Button>
                  </div>
                  {(form.departures || []).length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Optional. Add fixed departure dates when this package runs
                      on a schedule.
                    </p>
                  ) : (
                    (form.departures || []).map((row, index) => (
                      <div
                        key={`dep-${index}`}
                        className="grid grid-cols-2 gap-2 rounded-xl border p-3"
                      >
                        <Input
                          type="date"
                          value={row.departure_date}
                          onChange={(event) =>
                            setField(
                              'departures',
                              (form.departures || []).map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      departure_date: event.target.value,
                                    }
                                  : item
                              )
                            )
                          }
                        />
                        <Input
                          type="date"
                          value={row.return_date || ''}
                          onChange={(event) =>
                            setField(
                              'departures',
                              (form.departures || []).map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, return_date: event.target.value }
                                  : item
                              )
                            )
                          }
                        />
                        <Input
                          type="number"
                          min="0"
                          placeholder="Total seats"
                          value={row.total_seats ?? ''}
                          onChange={(event) =>
                            setField(
                              'departures',
                              (form.departures || []).map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      total_seats:
                                        event.target.value === ''
                                          ? null
                                          : Number(event.target.value),
                                    }
                                  : item
                              )
                            )
                          }
                        />
                        <Input
                          type="number"
                          min="0"
                          placeholder="Available seats"
                          value={row.available_seats ?? ''}
                          onChange={(event) =>
                            setField(
                              'departures',
                              (form.departures || []).map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      available_seats:
                                        event.target.value === ''
                                          ? null
                                          : Number(event.target.value),
                                    }
                                  : item
                              )
                            )
                          }
                        />
                        <Input
                          type="number"
                          min="0"
                          placeholder="Departure price"
                          value={row.price ?? ''}
                          onChange={(event) =>
                            setField(
                              'departures',
                              (form.departures || []).map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      price:
                                        event.target.value === ''
                                          ? null
                                          : Number(event.target.value),
                                    }
                                  : item
                              )
                            )
                          }
                        />
                        <select
                          value={row.status || 'open'}
                          onChange={(event) =>
                            setField(
                              'departures',
                              (form.departures || []).map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      status: event.target
                                        .value as (typeof TOUR_DEPARTURE_STATUSES)[number],
                                    }
                                  : item
                              )
                            )
                          }
                          className="h-9 rounded-lg border bg-white px-3 text-sm"
                        >
                          {TOUR_DEPARTURE_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter className="shrink-0 border-t px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving || loading}
            onClick={() => void save()}
            className="bg-[#00b074] font-semibold text-white hover:bg-[#009b66]"
          >
            {saving ? 'Saving...' : 'Save package'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
