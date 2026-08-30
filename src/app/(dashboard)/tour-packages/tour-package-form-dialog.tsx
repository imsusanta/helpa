'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ImagePlus,
  MapPin,
  Plus,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  createTourPackageRequest,
  fetchTourPackage,
  updateTourPackageRequest,
} from '@/lib/travel/api-client';
import { uploadAccountMedia } from '@/lib/storage/upload-media';
import {
  TOUR_PACKAGE_CURRENCIES,
  TOUR_PRICE_TYPES,
  type TourPackageDetail,
} from '@/lib/travel/types';
import {
  DEFAULT_MAX_PEOPLE,
  DEFAULT_MIN_PEOPLE,
  SIMPLE_DESCRIPTION_MAX,
  emptySimpleTourPackageForm,
  simpleFormToWriteInput,
  validateSimpleTourPackageForm,
  type SimpleTourPackageForm,
} from '@/lib/travel/simple-form';

const PRICE_TYPE_SHORT: Record<string, string> = {
  'Per Person': 'Person',
  'Per Couple': 'Couple',
  'Per Package': 'Package',
  'Per Night': 'Night',
};

const CURRENCY_SYMBOL: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  BDT: '৳',
  AED: 'AED',
};

const DAY_OPTIONS = Array.from({ length: 21 }, (_, index) => index + 1);
const NIGHT_OPTIONS = Array.from({ length: 21 }, (_, index) => index);

function dateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

function withCurrent(options: number[], current: number): number[] {
  if (options.includes(current)) return options;
  return [...options, current].sort((a, b) => a - b);
}

function fromDetail(pkg: TourPackageDetail): SimpleTourPackageForm {
  const priceType = TOUR_PRICE_TYPES.includes(
    (pkg.price_type ||
      pkg.price_for ||
      pkg.pricing[0]?.pricing_name ||
      '') as never
  )
    ? pkg.price_type ||
      pkg.price_for ||
      pkg.pricing[0]?.pricing_name ||
      'Per Person'
    : 'Per Person';
  return {
    name: pkg.name,
    destination: pkg.destination,
    description: pkg.description || '',
    duration_days: pkg.duration_days,
    duration_nights: pkg.duration_nights,
    starting_price: pkg.starting_price,
    currency: pkg.currency || 'INR',
    price_type: priceType,
    cover_image_url: pkg.cover_image_url || pkg.image_url || null,
    valid_from: dateInputValue(pkg.valid_from),
    valid_until: dateInputValue(pkg.valid_until),
    min_people: pkg.min_people ?? DEFAULT_MIN_PEOPLE,
    max_people: pkg.max_people ?? DEFAULT_MAX_PEOPLE,
    itineraries: pkg.itineraries.map((day) => ({
      day_number: day.day_number,
      title: day.title || '',
      description: day.description || day.activities || '',
    })),
  };
}

const fieldClass =
  'h-9 rounded-lg border-emerald-100 text-sm focus-visible:border-emerald-300 focus-visible:ring-emerald-200';
const selectClass =
  'h-9 w-full rounded-lg border border-emerald-100 bg-white px-2.5 text-sm outline-none focus-visible:border-emerald-300 focus-visible:ring-3 focus-visible:ring-emerald-200';

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-emerald-100 bg-white p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="h-4 w-0.5 rounded-full bg-[#00b074]" />
        {icon}
        <h3 className="font-heading text-sm font-semibold text-emerald-700">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<SimpleTourPackageForm>(
    emptySimpleTourPackageForm()
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [itineraryOpen, setItineraryOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!packageId) {
      setForm(emptySimpleTourPackageForm());
      setItineraryOpen(false);
      return;
    }
    setLoading(true);
    fetchTourPackage(packageId)
      .then((detail) => {
        const next = fromDetail(detail);
        setForm(next);
        setItineraryOpen(next.itineraries.length > 0);
      })
      .catch((error) =>
        toast.error((error as Error).message || 'Failed to load package')
      )
      .finally(() => setLoading(false));
  }, [open, packageId]);

  const setField = <K extends keyof SimpleTourPackageForm>(
    key: K,
    value: SimpleTourPackageForm[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const setDays = (days: number) => {
    const nextDays = Math.max(1, days);
    setForm((current) => ({
      ...current,
      duration_days: nextDays,
      duration_nights: Math.max(0, nextDays - 1),
    }));
  };

  const uploadCover = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a JPG, PNG, or WebP image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Cover image must be 5MB or smaller');
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadAccountMedia('chat-media', file);
      setField('cover_image_url', uploaded.publicUrl);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to upload cover image');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const error = validateSimpleTourPackageForm(form);
    if (error) return toast.error(error);
    setSaving(true);
    try {
      const payload = simpleFormToWriteInput(form);
      if (packageId) await updateTourPackageRequest(packageId, payload);
      else await createTourPackageRequest(payload);
      toast.success(packageId ? 'Package updated' : 'Package created');
      onSaved();
      onOpenChange(false);
    } catch (saveError) {
      toast.error((saveError as Error).message || 'Failed to save package');
    } finally {
      setSaving(false);
    }
  };

  const descriptionCount = form.description.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(90vh,680px)] w-full max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[780px]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50 px-4 py-3">
          <div className="min-w-0">
            <DialogTitle className="font-heading text-base font-semibold text-emerald-700">
              {packageId ? 'Edit Tour Package' : 'Create Tour Package'}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-xs text-emerald-700/70">
              {packageId
                ? 'Update this package in your catalog'
                : 'Add a new travel package to your catalog'}
            </DialogDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-slate-600"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving || loading || uploading}
              onClick={() => void save()}
              className="bg-[#00b074] font-semibold text-white hover:bg-[#009b66]"
            >
              {saving ? 'Saving…' : 'Save Package'}
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-28 animate-pulse rounded-xl bg-emerald-50"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.15fr_0.85fr]">
                <SectionCard title="Basic Details">
                  <div className="flex flex-col gap-2.5">
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-600">
                        Package Name *
                      </Label>
                      <Input
                        value={form.name}
                        onChange={(event) =>
                          setField('name', event.target.value)
                        }
                        placeholder="Kashmir Family Holiday"
                        className={cn('mt-1', fieldClass)}
                      />
                    </div>

                    <div>
                      <Label className="text-[11px] font-semibold text-slate-600">
                        Destination *
                      </Label>
                      <div className="relative mt-1">
                        <MapPin className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-emerald-600" />
                        <Input
                          value={form.destination}
                          onChange={(event) =>
                            setField('destination', event.target.value)
                          }
                          placeholder="Where is it?"
                          className={cn(fieldClass, 'pl-8')}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-600">
                          Days *
                        </Label>
                        <select
                          value={form.duration_days}
                          onChange={(event) =>
                            setDays(Number(event.target.value) || 1)
                          }
                          className={cn('mt-1', selectClass)}
                        >
                          {withCurrent(DAY_OPTIONS, form.duration_days).map(
                            (days) => (
                              <option key={days} value={days}>
                                {days} {days === 1 ? 'day' : 'days'}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-600">
                          Nights
                        </Label>
                        <select
                          value={form.duration_nights}
                          onChange={(event) =>
                            setField(
                              'duration_nights',
                              Math.max(0, Number(event.target.value) || 0)
                            )
                          }
                          className={cn('mt-1', selectClass)}
                        >
                          {withCurrent(NIGHT_OPTIONS, form.duration_nights).map(
                            (nights) => (
                              <option key={nights} value={nights}>
                                {nights} {nights === 1 ? 'night' : 'nights'}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] font-semibold text-slate-600">
                        Package Price *
                      </Label>
                      <div className="mt-1 flex overflow-hidden rounded-lg border border-emerald-100 bg-white">
                        <select
                          value={form.currency}
                          onChange={(event) =>
                            setField('currency', event.target.value)
                          }
                          className="h-9 border-0 bg-emerald-50 px-2 text-xs font-semibold text-emerald-700 outline-none"
                        >
                          {TOUR_PACKAGE_CURRENCIES.map((currency) => (
                            <option key={currency} value={currency}>
                              {CURRENCY_SYMBOL[currency] || currency} {currency}
                            </option>
                          ))}
                        </select>
                        <Input
                          type="number"
                          min="1"
                          value={form.starting_price ?? ''}
                          onChange={(event) =>
                            setField(
                              'starting_price',
                              event.target.value === ''
                                ? null
                                : Number(event.target.value)
                            )
                          }
                          placeholder="29999"
                          className="h-9 rounded-none border-0 focus-visible:ring-emerald-200"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] font-semibold text-slate-600">
                        Price for *
                      </Label>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {TOUR_PRICE_TYPES.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setField('price_type', type)}
                            className={cn(
                              'h-8 flex-1 rounded-lg px-2 text-xs font-semibold transition',
                              form.price_type === type
                                ? 'bg-[#00b074] text-white'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            )}
                          >
                            {PRICE_TYPE_SHORT[type] || type}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] font-semibold text-slate-600">
                          Short details *
                        </Label>
                        <span
                          className={cn(
                            'text-[10px]',
                            descriptionCount > SIMPLE_DESCRIPTION_MAX
                              ? 'font-semibold text-rose-600'
                              : 'text-slate-400'
                          )}
                        >
                          {descriptionCount}/{SIMPLE_DESCRIPTION_MAX}
                        </span>
                      </div>
                      <Textarea
                        value={form.description}
                        maxLength={SIMPLE_DESCRIPTION_MAX}
                        onChange={(event) =>
                          setField('description', event.target.value)
                        }
                        placeholder="Hotel, breakfast, and sightseeing included."
                        className="mt-1 min-h-[72px] rounded-lg border-emerald-100 text-sm focus-visible:border-emerald-300 focus-visible:ring-emerald-200"
                      />
                    </div>
                  </div>
                </SectionCard>

                <div className="flex flex-col gap-3">
                  <SectionCard title="Package Photo">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadCover(file);
                        event.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDragOver(false);
                        const file = event.dataTransfer.files?.[0];
                        if (file) void uploadCover(file);
                      }}
                      className={cn(
                        'flex h-28 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition',
                        dragOver
                          ? 'border-[#00b074] bg-emerald-50'
                          : 'border-emerald-200 bg-white hover:bg-emerald-50',
                        uploading && 'opacity-70'
                      )}
                    >
                      {form.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={form.cover_image_url}
                          alt="Package cover"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-emerald-700">
                          {uploading ? (
                            <Upload className="size-5 animate-pulse" />
                          ) : (
                            <ImagePlus className="size-5" />
                          )}
                          <p className="text-xs font-medium">
                            {uploading
                              ? 'Uploading…'
                              : 'Drop a photo or click to upload'}
                          </p>
                          <p className="text-[10px] text-emerald-700/60">
                            JPG, PNG or WebP · up to 5MB
                          </p>
                        </div>
                      )}
                    </button>
                    {form.cover_image_url ? (
                      <button
                        type="button"
                        className="mt-1.5 text-[11px] font-medium text-slate-500 hover:text-rose-600"
                        onClick={() => setField('cover_image_url', null)}
                      >
                        Remove photo
                      </button>
                    ) : null}
                  </SectionCard>

                  <SectionCard
                    title="When can people travel?"
                    icon={
                      <CalendarDays className="size-3.5 text-emerald-600" />
                    }
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-600">
                          Available From
                        </Label>
                        <Input
                          type="date"
                          value={form.valid_from}
                          onChange={(event) =>
                            setField('valid_from', event.target.value)
                          }
                          className={cn('mt-1', fieldClass)}
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-600">
                          Until
                        </Label>
                        <Input
                          type="date"
                          value={form.valid_until}
                          onChange={(event) =>
                            setField('valid_until', event.target.value)
                          }
                          className={cn('mt-1', fieldClass)}
                        />
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="For how many people?"
                    icon={<Users className="size-3.5 text-emerald-600" />}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-600">
                          Minimum
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          value={form.min_people ?? ''}
                          onChange={(event) =>
                            setField(
                              'min_people',
                              event.target.value === ''
                                ? null
                                : Math.max(1, Number(event.target.value) || 1)
                            )
                          }
                          className={cn('mt-1', fieldClass)}
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-600">
                          Maximum
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          value={form.max_people ?? ''}
                          onChange={(event) =>
                            setField(
                              'max_people',
                              event.target.value === ''
                                ? null
                                : Math.max(1, Number(event.target.value) || 1)
                            )
                          }
                          className={cn('mt-1', fieldClass)}
                        />
                      </div>
                    </div>
                  </SectionCard>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-white">
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setItineraryOpen((openState) => !openState)}
                    className="flex min-w-0 items-center gap-2 text-left"
                  >
                    <ChevronDown
                      className={cn(
                        'size-4 shrink-0 text-emerald-600 transition-transform',
                        itineraryOpen && 'rotate-180'
                      )}
                    />
                    <span className="font-heading text-sm font-semibold text-emerald-700">
                      Itinerary
                    </span>
                    <span className="truncate text-[11px] text-slate-400">
                      Optional
                      {form.itineraries.length
                        ? ` · ${form.itineraries.length} day${
                            form.itineraries.length === 1 ? '' : 's'
                          }`
                        : ''}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      setItineraryOpen(true);
                      setField('itineraries', [
                        ...form.itineraries,
                        {
                          day_number: form.itineraries.length + 1,
                          title: '',
                          description: '',
                        },
                      ]);
                    }}
                    className="border-emerald-100 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Plus data-icon="inline-start" />
                    Add day
                  </Button>
                </div>
                {itineraryOpen ? (
                  <div className="border-t border-emerald-100 px-3 py-2">
                    {form.itineraries.length === 0 ? (
                      <p className="py-2 text-center text-[11px] text-slate-400">
                        Add a short plan for each day if you have one.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {form.itineraries.map((day, index) => (
                          <div
                            key={`${day.day_number}-${index}`}
                            className="flex flex-col gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50/40 p-2"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-bold text-emerald-700">
                                Day {index + 1}
                              </p>
                              <button
                                type="button"
                                className="text-slate-400 hover:text-rose-600"
                                onClick={() =>
                                  setField(
                                    'itineraries',
                                    form.itineraries.filter(
                                      (_, itemIndex) => itemIndex !== index
                                    )
                                  )
                                }
                                aria-label={`Remove day ${index + 1}`}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                            <Input
                              value={day.title}
                              onChange={(event) =>
                                setField(
                                  'itineraries',
                                  form.itineraries.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, title: event.target.value }
                                      : item
                                  )
                                )
                              }
                              placeholder="Arrival in Srinagar"
                              className={fieldClass}
                            />
                            <Textarea
                              value={day.description}
                              onChange={(event) =>
                                setField(
                                  'itineraries',
                                  form.itineraries.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          description: event.target.value,
                                        }
                                      : item
                                  )
                                )
                              }
                              placeholder="What happens on this day"
                              className="min-h-14 rounded-lg border-emerald-100 text-sm focus-visible:ring-emerald-200"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
