'use client';

import { useWorkspace } from '@/hooks/use-workspace';
import { useState, useEffect, useCallback } from 'react';
import type { SavedFilter } from '@/types';
import { Bookmark, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface SavedFilterBarProps {
  entityType: 'contacts' | 'leads' | 'deals' | 'tasks' | 'appointments';
  currentFilters: Record<string, unknown>;
  activeFilterId: string | null;
  onSelectFilter: (
    filterId: string | null,
    filters: Record<string, unknown> | null
  ) => void;
}

export function SavedFilterBar({
  entityType,
  currentFilters,
  activeFilterId,
  onSelectFilter,
}: SavedFilterBarProps) {
  const { terminology } = useWorkspace();
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [_loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchFilters = useCallback(async () => {
    try {
      const res = await fetch(`/api/saved-filters?entity_type=${entityType}`);
      if (res.ok) {
        const json = await res.json();
        setSavedFilters(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch saved filters:', err);
    } finally {
      setLoading(false);
    }
  }, [entityType]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  const handleSaveFilter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filterName.trim()) {
      toast.error('Please enter a filter name');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/saved-filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: filterName.trim(),
          entity_type: entityType,
          filters: currentFilters,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save filter');
      }

      const json = await res.json();
      toast.success(`Filter "${filterName}" saved!`);
      setModalOpen(false);
      setFilterName('');
      await fetchFilters();
      if (json.data?.id) {
        onSelectFilter(json.data.id, currentFilters);
      }
    } catch (err) {
      toast.error((err as Error).message || 'Failed to save filter');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFilter = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/saved-filters?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete filter');
      toast.success('Saved filter removed');
      if (activeFilterId === id) {
        onSelectFilter(null, null);
      }
      fetchFilters();
    } catch {
      toast.error('Failed to delete filter');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1 text-xs">
      <div className="text-muted-foreground mr-1 flex items-center gap-1 text-[11px] font-medium">
        <Bookmark className="text-primary size-3" />
        <span>Views:</span>
      </div>

      {/* Default All View */}
      <button
        onClick={() => onSelectFilter(null, null)}
        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
          activeFilterId === null
            ? 'bg-primary text-primary-foreground shadow-xs'
            : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        All
      </button>

      {/* User Saved Filters */}
      {savedFilters.map((sf) => (
        <div
          key={sf.id}
          onClick={() => onSelectFilter(sf.id, sf.filters)}
          className={`group flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            activeFilterId === sf.id
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <span>{sf.name}</span>
          <button
            onClick={(e) => handleDeleteFilter(sf.id, e)}
            className="hover:text-destructive opacity-0 transition-opacity group-hover:opacity-100"
            title="Delete saved view"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      ))}

      {/* Save current view button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setModalOpen(true)}
        className="text-muted-foreground hover:text-foreground border-border hover:border-primary/50 h-6 gap-1 border border-dashed px-2 text-[11px]"
      >
        <Plus className="size-3" />
        Save Current View
      </Button>

      {/* Save Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveFilter}>
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold">
                Save Current Filter Preset
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-3">
              <p className="text-muted-foreground text-xs">
                Save your active search query and filters as a quick-access
                preset for easy retrieval anytime.
              </p>
              <Input
                placeholder={`e.g. VIP ${terminology.contacts}, Hot ${terminology.pipelineItems}, ${terminology.followUp} Pending`}
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                autoFocus
                required
                className="text-xs"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : null}
                Save View
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
