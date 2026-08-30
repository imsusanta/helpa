'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, Plus, Search, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import {
  deleteTourPackageRequest,
  fetchTourPackages,
  setTourPackageStatusRequest,
} from '@/lib/travel/api-client';
import { formatMoney } from '@/lib/travel/matching';
import type { TourPackage } from '@/lib/travel/types';
import { TourPackageFormDialog } from './tour-package-form-dialog';

export function TourPackagesClient() {
  const [rows, setRows] = useState<TourPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTourPackages({
        search: search.trim() || undefined,
        status,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to load tour packages');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  const toggleStatus = async (pkg: TourPackage) => {
    try {
      await setTourPackageStatusRequest(
        pkg.id,
        pkg.status === 'active' ? 'inactive' : 'active'
      );
      toast.success(
        pkg.status === 'active' ? 'Package deactivated' : 'Package activated'
      );
      await load();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to update status');
    }
  };

  const remove = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteTourPackageRequest(deleteId);
      toast.success('Package deleted');
      setDeleteId(null);
      await load();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to delete package');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1536px] space-y-6 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tour Packages</h1>
          <p className="mt-1 text-sm text-slate-500">
            Maintain this workplace&apos;s official packages. WhatsApp and AI
            answers use only these records.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setFormOpen(true);
          }}
          className="rounded-xl bg-[#00b074] font-bold text-white hover:bg-[#009b66]"
        >
          <Plus className="mr-2 h-4 w-4" /> Create package
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Total packages</p>
          <p className="mt-1 text-2xl font-bold">{rows.length}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Active</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {rows.filter((row) => row.status === 'active').length}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Featured</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {rows.filter((row) => row.featured).length}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or destination..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'active', 'inactive'].map((value) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize ${
                status === value
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {value}
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
            <h3 className="mt-3 font-semibold">No tour packages yet</h3>
            <p className="mt-1 text-xs text-slate-500">
              Create the packages your travellers will be quoted from.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3.5">Package</th>
                  <th className="px-5 py-3.5">Destination</th>
                  <th className="px-5 py-3.5">Duration</th>
                  <th className="px-5 py-3.5">Price</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {pkg.cover_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={pkg.cover_image_url}
                            alt=""
                            className="size-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                            <MapPin className="size-4" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <b>{pkg.name}</b>
                            {pkg.featured ? (
                              <Star className="h-3.5 w-3.5 text-amber-500" />
                            ) : null}
                          </div>
                          <div className="max-w-xs truncate text-[10px] text-slate-400">
                            {pkg.description ||
                              pkg.price_type ||
                              'Tour package'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">{pkg.destination}</td>
                    <td className="px-5 py-4">
                      {pkg.duration_days}D / {pkg.duration_nights}N
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-extrabold">
                        {formatMoney(pkg.starting_price, pkg.currency) || '—'}
                      </div>
                      {pkg.price_type ? (
                        <div className="text-[10px] text-slate-400">
                          {pkg.price_type}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${
                          pkg.status === 'active'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        {pkg.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingId(pkg.id);
                            setFormOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void toggleStatus(pkg)}
                        >
                          {pkg.status === 'active' ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-rose-600"
                          onClick={() => setDeleteId(pkg.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TourPackageFormDialog
        open={formOpen}
        packageId={editingId}
        onOpenChange={setFormOpen}
        onSaved={() => void load()}
      />
      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete tour package"
        description="This removes the package and its itinerary, hotels, pricing, and departures. AI will no longer be able to recommend it."
        onConfirm={() => void remove()}
        loading={deleting}
      />
    </div>
  );
}
