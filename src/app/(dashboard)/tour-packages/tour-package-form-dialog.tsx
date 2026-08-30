'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, MapPin, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
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
  emptySimpleTourPackageForm,
  simpleFormToWriteInput,
  validateSimpleTourPackageForm,
  type SimpleTourPackageForm,
} from '@/lib/travel/simple-form';

function fromDetail(pkg: TourPackageDetail): SimpleTourPackageForm {
  const priceType = TOUR_PRICE_TYPES.includes(
    (pkg.price_type || pkg.pricing[0]?.pricing_name || '') as never
  )
    ? (pkg.price_type || pkg.pricing[0]?.pricing_name || 'Per Person')
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
    cover_image_url: pkg.cover_image_url,
    itineraries: pkg.itineraries.map((day) => ({
      day_number: day.day_number,
      title: day.title || '',
      description: day.description || day.activities || '',
    })),
  };
}

const fieldClass = 'mt-1.5 h-11 rounded-xl text-sm';

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

  useEffect(() => {
    if (!open) return;
    if (!packageId) {
      setForm(emptySimpleTourPackageForm());
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,780px)] w-full max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="flex size-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <MapPin />
            </span>
            {packageId ? 'Edit package' : 'Create package'}
          </DialogTitle>
          <DialogDescription>
            Add the basic details. You can attach a cover and itinerary if you
            have them.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-12 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-600">
                  Cover image
                  <span className="ml-1 font-normal text-slate-400">
                    Optional
                  </span>
                </Label>
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
                    'mt-1.5 flex h-36 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition',
                    dragOver
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-slate-200 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50/40',
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
                    <div className="flex flex-col items-center gap-1.5 text-slate-500">
                      {uploading ? (
                        <Upload className="animate-pulse" />
                      ) : (
                        <ImagePlus />
                      )}
                      <p className="text-sm font-medium">
                        {uploading
                          ? 'Uploading…'
                          : 'Drop a photo or click to upload'}
                      </p>
                      <p className="text-xs text-slate-400">
                        JPG, PNG or WebP · up to 5MB
                      </p>
                    </div>
                  )}
                </button>
                {form.cover_image_url ? (
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-slate-500 hover:text-rose-600"
                    onClick={() => setField('cover_image_url', null)}
                  >
                    Remove cover
                  </button>
                ) : null}
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-600">
                  Package name *
                </Label>
                <Input
                  value={form.name}
                  onChange={(event) => setField('name', event.target.value)}
                  placeholder="Kashmir Family Holiday"
                  className={fieldClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs font-semibold text-slate-600">
                    Destination *
                  </Label>
                  <Input
                    value={form.destination}
                    onChange={(event) =>
                      setField('destination', event.target.value)
                    }
                    placeholder="Kashmir"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600">
                    Duration *
                  </Label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 rounded-xl border bg-white px-3">
                      <Input
                        type="number"
                        min="1"
                        value={form.duration_days}
                        onChange={(event) =>
                          setDays(Number(event.target.value) || 1)
                        }
                        className="h-11 border-0 px-0 shadow-none focus-visible:ring-0"
                      />
                      <span className="text-xs font-medium text-slate-500">
                        days
                      </span>
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border bg-white px-3">
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
                        className="h-11 border-0 px-0 shadow-none focus-visible:ring-0"
                      />
                      <span className="text-xs font-medium text-slate-500">
                        nights
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs font-semibold text-slate-600">
                    Price *
                  </Label>
                  <div className="mt-1.5 flex overflow-hidden rounded-xl border bg-white">
                    <select
                      value={form.currency}
                      onChange={(event) =>
                        setField('currency', event.target.value)
                      }
                      className="h-11 border-0 bg-slate-50 px-3 text-xs font-semibold text-slate-600 outline-none"
                    >
                      {TOUR_PACKAGE_CURRENCIES.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
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
                      className="h-11 rounded-none border-0 focus-visible:ring-0"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600">
                    Price type *
                  </Label>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    {TOUR_PRICE_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setField('price_type', type)}
                        className={cn(
                          'h-8 rounded-lg text-xs font-semibold transition',
                          form.price_type === type
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-600">
                  Short description *
                </Label>
                <Textarea
                  value={form.description}
                  onChange={(event) =>
                    setField('description', event.target.value)
                  }
                  placeholder="5 days in Kashmir with hotel, breakfast, and sightseeing."
                  className="mt-1.5 min-h-24 rounded-xl"
                />
              </div>

              <div className="rounded-2xl border bg-slate-50/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">
                      Itinerary
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Optional. Add a short plan for each day.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setField('itineraries', [
                        ...form.itineraries,
                        {
                          day_number: form.itineraries.length + 1,
                          title: '',
                          description: '',
                        },
                      ])
                    }
                  >
                    <Plus data-icon="inline-start" />
                    Add day
                  </Button>
                </div>
                {form.itineraries.length > 0 ? (
                  <div className="mt-3 flex flex-col gap-2">
                    {form.itineraries.map((day, index) => (
                      <div
                        key={`${day.day_number}-${index}`}
                        className="flex flex-col gap-2 rounded-xl border bg-white p-3"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-emerald-700">
                            Day {index + 1}
                          </p>
                          <button
                            type="button"
                            className="text-slate-400 hover:text-rose-600"
                            onClick={() =>
                              setField(
                                'itineraries',
                                form.itineraries.filter((_, i) => i !== index)
                              )
                            }
                            aria-label={`Remove day ${index + 1}`}
                          >
                            <Trash2 />
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
                          className="h-9 rounded-lg"
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
                          className="min-h-16 rounded-lg"
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 rounded-none border-t bg-white px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving || loading || uploading}
            onClick={() => void save()}
            className="bg-[#00b074] font-semibold text-white hover:bg-[#009b66]"
          >
            {saving ? 'Saving…' : packageId ? 'Save changes' : 'Save package'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
