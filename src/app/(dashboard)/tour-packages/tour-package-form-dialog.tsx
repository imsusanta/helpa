'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ImagePlus, MapPin, Plus, Trash2, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { createTourPackageRequest, fetchTourPackage, updateTourPackageRequest } from '@/lib/travel/api-client';
import { uploadAccountMedia } from '@/lib/storage/upload-media';
import { TOUR_PACKAGE_CATEGORIES, TOUR_PACKAGE_CURRENCIES, TOUR_PACKAGE_TYPES, type TourPackageDetail, type TourPackageWriteInput } from '@/lib/travel/types';

type FormState = TourPackageWriteInput & {
  image_url?: string | null;
  min_people?: number | null;
  max_people?: number | null;
  price_for?: string;
};

const INCLUDED = ['Hotel Stay', 'Transport (Car/Bus)', 'Food (Meals)', 'Sightseeing', 'Activities', 'Tour Guide', 'Airport Pick-up', 'Entry Tickets', 'Other'];
const EXCLUDED = ['Flight / Train Tickets', 'Personal Expenses', 'Travel Insurance', 'Visa Fees', 'Other'];

function emptyForm(): FormState {
  return {
    name: '', destination: '', description: '', package_type: 'Family', category: 'Domestic', duration_days: 5, duration_nights: 4,
    starting_price: 0, currency: 'INR', price_for: 'Per Person', status: 'active', featured: false, valid_from: '', valid_until: '',
    booking_notes: '', terms_and_conditions: '', image_url: null, min_people: 2, max_people: 20,
    itineraries: Array.from({ length: 5 }, (_, i) => ({ day_number: i + 1, title: '', description: '', activities: '', meals: '', hotel: '', overnight_location: '' })),
    inclusions: [], exclusions: [], hotels: [], pricing: [], departures: [],
  };
}

function fromDetail(pkg: TourPackageDetail & Partial<FormState>): FormState {
  return { ...emptyForm(), ...pkg, itineraries: pkg.itineraries?.length ? pkg.itineraries : emptyForm().itineraries, inclusions: pkg.inclusions || [], exclusions: pkg.exclusions || [], hotels: pkg.hotels || [], pricing: pkg.pricing || [], departures: pkg.departures || [] };
}

export function TourPackageFormDialog({ open, packageId, onOpenChange, onSaved }: { open: boolean; packageId: string | null; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (!packageId) { setForm(emptyForm()); return; }
    fetchTourPackage(packageId).then((pkg) => setForm(fromDetail(pkg as TourPackageDetail & Partial<FormState>))).catch((e) => toast.error((e as Error).message || 'Failed to load package'));
  }, [open, packageId]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const updateArray = <K extends 'itineraries' | 'inclusions' | 'exclusions'>(key: K, value: FormState[K]) => setField(key, value);

  const choosePhoto = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please choose an image');
    if (file.size > 5 * 1024 * 1024) return toast.error('Photo must be 5MB or smaller');
    setUploading(true);
    try {
      const uploaded = await uploadAccountMedia('tour-package-media', file);
      setField('image_url', uploaded.publicUrl);
    } catch (e) { toast.error((e as Error).message || 'Photo upload failed'); }
    finally { setUploading(false); }
  };

  const save = async () => {
    if (!form.name.trim() || !form.destination.trim()) return toast.error('Package name and destination are required');
    if (form.min_people && form.max_people && form.max_people < form.min_people) return toast.error('Maximum people cannot be less than minimum people');
    setSaving(true);
    try {
      const payload = form as TourPackageWriteInput;
      if (packageId) await updateTourPackageRequest(packageId, payload); else await createTourPackageRequest(payload);
      toast.success(packageId ? 'Package updated' : 'Package created'); onSaved(); onOpenChange(false);
    } catch (e) { toast.error((e as Error).message || 'Failed to save package'); }
    finally { setSaving(false); }
  };

  const addDay = () => updateArray('itineraries', [...(form.itineraries || []), { day_number: (form.itineraries || []).length + 1, title: '', description: '', activities: '', meals: '', hotel: '', overnight_location: '' }]);
  const toggleItem = (key: 'inclusions' | 'exclusions', item: string) => {
    const current = (form[key] || []) as Array<{ item: string }>;
    const exists = current.some((row) => row.item === item);
    updateArray(key, exists ? current.filter((row) => row.item !== item) : [...current, { item }]);
  };
  const fieldClass = 'h-9 rounded-lg border-slate-200 bg-white text-sm';
  const cardClass = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[96vh] w-[98vw] max-w-[1280px] flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
          <div><h2 className="text-xl font-bold text-slate-900">{packageId ? 'Edit Tour Package' : 'Create Tour Package'}</h2><p className="mt-0.5 text-xs text-slate-500">Fill in the details below to add a new tour package.</p></div>
          <div className="flex items-center gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => void save()} disabled={saving || uploading} className="bg-emerald-500 font-bold text-white hover:bg-emerald-600">{saving ? 'Saving...' : 'Save Package'}</Button></div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/50 p-5">
          <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
            <div className={cardClass}>
              <h3 className="font-bold text-slate-900">Basic Details</h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div><Label>Package Name <span className="text-rose-500">*</span></Label><Input className={fieldClass} placeholder="e.g. Darjeeling 4 Nights 5 Days" value={form.name} onChange={(e) => setField('name', e.target.value)} /></div>
                <div><Label>Where is it? <span className="text-rose-500">*</span></Label><div className="relative"><MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><Input className={`${fieldClass} pl-9`} placeholder="Select place" value={form.destination} onChange={(e) => setField('destination', e.target.value)} /></div></div>
                <div><Label>How many days? <span className="text-rose-500">*</span></Label><select className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={form.duration_days} onChange={(e) => setField('duration_days', Number(e.target.value))}>{Array.from({ length: 30 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} Days</option>)}</select></div>
                <div><Label>How many nights?</Label><select className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={form.duration_nights} onChange={(e) => setField('duration_nights', Number(e.target.value))}>{Array.from({ length: 30 }, (_, i) => <option key={i} value={i}>{i} Nights</option>)}</select></div>
                <div><Label>Price (₹) <span className="text-rose-500">*</span></Label><Input className={fieldClass} type="number" min="0" placeholder="e.g. 15000" value={form.starting_price ?? ''} onChange={(e) => setField('starting_price', e.target.value === '' ? null : Number(e.target.value))}/></div>
                <div><Label>Price for <span className="text-rose-500">*</span></Label><select className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={form.price_for || 'Per Person'} onChange={(e) => setField('price_for', e.target.value)}><option>Per Person</option><option>Per Couple</option><option>Per Group</option></select></div>
                <div className="col-span-2"><Label>Short details about this package <span className="text-rose-500">*</span></Label><textarea maxLength={200} className="mt-1 min-h-[110px] w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-100" placeholder="Write a few lines about this package..." value={form.description || ''} onChange={(e) => setField('description', e.target.value)}/><div className="text-right text-[10px] text-slate-400">{(form.description || '').length}/200</div></div>
              </div>
            </div>

            <div className="space-y-4">
              <div className={cardClass}><h3 className="font-bold text-slate-900">Package Photo</h3><p className="text-xs text-slate-500">Add a nice photo of this tour.</p><button type="button" onClick={() => fileRef.current?.click()} className="mt-3 flex h-44 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100">
                {form.image_url ? <img src={form.image_url} alt="Package preview" className="h-full w-full rounded-xl object-cover"/> : <><ImagePlus className="h-8 w-8 text-slate-400"/><span className="mt-2 text-sm text-slate-600">Drag and drop an image here</span><span className="text-xs text-slate-400">or</span><span className="mt-2 rounded-lg border bg-white px-4 py-2 text-xs font-semibold">{uploading ? 'Uploading...' : 'Choose Photo'}</span><span className="mt-2 text-[10px] text-slate-400">Recommended size: 1200x800px</span></>}
              </button><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void choosePhoto(e.target.files?.[0])}/></div>
              <div className={cardClass}><h3 className="font-bold text-slate-900">When can people travel?</h3><div className="mt-3 grid grid-cols-2 gap-3"><div><Label>Available From</Label><div className="relative"><CalendarDays className="absolute right-3 top-2.5 h-4 w-4 text-slate-400"/><Input className={fieldClass} type="date" value={form.valid_from || ''} onChange={(e) => setField('valid_from', e.target.value)}/></div></div><div><Label>Available Until</Label><div className="relative"><CalendarDays className="absolute right-3 top-2.5 h-4 w-4 text-slate-400"/><Input className={fieldClass} type="date" value={form.valid_until || ''} onChange={(e) => setField('valid_until', e.target.value)}/></div></div></div></div>
              <div className={cardClass}><h3 className="font-bold text-slate-900">For how many people?</h3><div className="mt-3 grid grid-cols-2 gap-3"><div><Label>Minimum People</Label><div className="relative"><Users className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><Input className={`${fieldClass} pl-9`} type="number" min="1" value={form.min_people ?? ''} onChange={(e) => setField('min_people', e.target.value === '' ? null : Number(e.target.value))}/></div></div><div><Label>Maximum People</Label><Input className={fieldClass} type="number" min="1" value={form.max_people ?? ''} onChange={(e) => setField('max_people', e.target.value === '' ? null : Number(e.target.value))}/></div></div></div>
            </div>

            <div className={cardClass}><h3 className="font-bold text-slate-900">What's Included? <span className="text-xs font-normal text-slate-500">(This package has)</span></h3><p className="text-xs text-slate-500">Tick all that apply.</p><div className="mt-3 flex flex-wrap gap-2">{INCLUDED.map((item) => { const active = form.inclusions?.some((x) => x.item === item); return <button key={item} type="button" onClick={() => toggleItem('inclusions', item)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${active ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}>{active ? '✓ ' : ''}{item}</button>; })}</div></div>
            <div className={cardClass}><h3 className="font-bold text-slate-900">Plan for Each Day</h3><p className="text-xs text-slate-500">Tell us what people will do each day.</p><div className="mt-3 space-y-2">{(form.itineraries || []).map((day, index) => <div key={index} className="grid grid-cols-[60px_1fr_1fr_1fr_34px] items-center gap-2"><span className="rounded-lg bg-slate-50 px-2 py-2 text-center text-xs font-bold text-slate-600">Day {index + 1}</span><Input className={fieldClass} placeholder="e.g. Arrival and check-in at hotel" value={day.title || ''} onChange={(e) => updateArray('itineraries', form.itineraries!.map((r, i) => i === index ? { ...r, title: e.target.value } : r))}/><Input className={fieldClass} placeholder="Activities" value={day.activities || ''} onChange={(e) => updateArray('itineraries', form.itineraries!.map((r, i) => i === index ? { ...r, activities: e.target.value } : r))}/><Input className={fieldClass} placeholder="Meals / hotel" value={`${day.meals || ''}${day.hotel ? ` · ${day.hotel}` : ''}`} onChange={(e) => updateArray('itineraries', form.itineraries!.map((r, i) => i === index ? { ...r, meals: e.target.value } : r))}/><button type="button" disabled={form.itineraries!.length <= 1} onClick={() => updateArray('itineraries', form.itineraries!.filter((_, i) => i !== index).map((r, i) => ({ ...r, day_number: i + 1 })))} className="rounded-lg p-2 text-rose-500 disabled:opacity-30"><Trash2 className="h-4 w-4"/></button></div>)}<Button type="button" variant="outline" size="sm" onClick={addDay} className="mt-1"><Plus className="mr-1 h-4 w-4"/> Add Day</Button></div></div>

            <div className={cardClass}><h3 className="font-bold text-slate-900">What's Not Included? <span className="text-xs font-normal text-slate-500">(This package does not have)</span></h3><p className="text-xs text-slate-500">Tick all that apply.</p><div className="mt-3 flex flex-wrap gap-2">{EXCLUDED.map((item) => { const active = form.exclusions?.some((x) => x.item === item); return <button key={item} type="button" onClick={() => toggleItem('exclusions', item)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${active ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-600'}`}>{active ? '✓ ' : ''}{item}</button>; })}</div></div>
            <div className={cardClass}><h3 className="font-bold text-slate-900">Category & Tags</h3><p className="text-xs text-slate-500">Help people find your package easily.</p><div className="mt-3 grid grid-cols-2 gap-3"><div><Label>Category</Label><select className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={form.category || ''} onChange={(e) => setField('category', e.target.value)}>{TOUR_PACKAGE_CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select></div><div><Label>Tags <span className="font-normal text-slate-400">(Optional)</span></Label><Input className={fieldClass} placeholder="e.g. Hill Station, Family, Weekend" value={form.booking_notes || ''} onChange={(e) => setField('booking_notes', e.target.value)}/></div></div></div>

            <div className={`${cardClass} lg:col-span-2`}><div className="grid gap-3 sm:grid-cols-3"><div><Label>Package Type</Label><select className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={form.package_type || ''} onChange={(e) => setField('package_type', e.target.value)}>{TOUR_PACKAGE_TYPES.map((x) => <option key={x}>{x}</option>)}</select></div><div><Label>Currency</Label><select className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={form.currency || 'INR'} onChange={(e) => setField('currency', e.target.value)}>{TOUR_PACKAGE_CURRENCIES.map((x) => <option key={x}>{x}</option>)}</select></div><div><Label>Package Status</Label><select className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={form.status || 'active'} onChange={(e) => setField('status', e.target.value as 'active' | 'inactive')}><option value="active">Active</option><option value="inactive">Inactive</option></select></div></div></div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
