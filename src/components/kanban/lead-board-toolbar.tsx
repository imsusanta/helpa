'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, RefreshCw, X, Filter } from 'lucide-react';

export interface LeadFilterState {
  search: string;
  channel: string;
  service: string;
  score: string;
}

interface LeadBoardToolbarProps {
  filters: LeadFilterState;
  onFilterChange: (key: keyof LeadFilterState, value: string) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
  isLoading?: boolean;
  totalLeadsCount: number;
  filteredLeadsCount: number;
}

export function LeadBoardToolbar({
  filters,
  onFilterChange,
  onClearFilters,
  onRefresh,
  isLoading = false,
  totalLeadsCount,
  filteredLeadsCount,
}: LeadBoardToolbarProps) {
  const activeFiltersCount =
    (filters.search ? 1 : 0) +
    (filters.channel !== 'all' ? 1 : 0) +
    (filters.service !== 'all' ? 1 : 0) +
    (filters.score !== 'all' ? 1 : 0);

  return (
    <div className="bg-card border-border space-y-3 rounded-xl border p-4 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative min-w-[240px] flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
          <Input
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            placeholder="Search leads by patient name, phone, or service..."
            className="bg-background border-border pl-9 text-sm"
          />
          {filters.search && (
            <button
              onClick={() => onFilterChange('search', '')}
              className="text-muted-foreground hover:text-foreground absolute top-2.5 right-3"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Channel Select */}
          <Select
            value={filters.channel}
            onValueChange={(val) => onFilterChange('channel', val ?? 'all')}
          >
            <SelectTrigger className="bg-background border-border h-9 w-[130px] text-xs">
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="voice">Voice</SelectItem>
            </SelectContent>
          </Select>

          {/* Service Select */}
          <Select
            value={filters.service}
            onValueChange={(val) => onFilterChange('service', val ?? 'all')}
          >
            <SelectTrigger className="bg-background border-border h-9 w-[140px] text-xs">
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              <SelectItem value="General OPD">General OPD</SelectItem>
              <SelectItem value="Dental / Invisalign">
                Dental / Invisalign
              </SelectItem>
              <SelectItem value="Cardiology">Cardiology</SelectItem>
              <SelectItem value="Orthopedics">Orthopedics</SelectItem>
              <SelectItem value="Dermatology">Dermatology</SelectItem>
            </SelectContent>
          </Select>

          {/* Score Select */}
          <Select
            value={filters.score}
            onValueChange={(val) => onFilterChange('score', val ?? 'all')}
          >
            <SelectTrigger className="bg-background border-border h-9 w-[120px] text-xs">
              <SelectValue placeholder="Lead Score" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Scores</SelectItem>
              <SelectItem value="hot">Hot 🔥</SelectItem>
              <SelectItem value="warm">Warm 🌤</SelectItem>
              <SelectItem value="cold">Cold ❄️</SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="border-border bg-background text-muted-foreground hover:text-foreground h-9"
          >
            <RefreshCw
              className={`mr-1 h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Active Filter Indicators */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-muted-foreground flex items-center text-xs font-medium">
            <Filter className="mr-1 h-3 w-3" />
            Active Filters ({filteredLeadsCount} of {totalLeadsCount} leads):
          </span>

          {filters.search && (
            <Badge variant="secondary" className="gap-1 text-[11px]">
              Query: &quot;{filters.search}&quot;
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFilterChange('search', '')}
              />
            </Badge>
          )}

          {filters.channel !== 'all' && (
            <Badge variant="secondary" className="gap-1 text-[11px] capitalize">
              Channel: {filters.channel}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFilterChange('channel', 'all')}
              />
            </Badge>
          )}

          {filters.service !== 'all' && (
            <Badge variant="secondary" className="gap-1 text-[11px]">
              Service: {filters.service}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFilterChange('service', 'all')}
              />
            </Badge>
          )}

          {filters.score !== 'all' && (
            <Badge variant="secondary" className="gap-1 text-[11px] capitalize">
              Score: {filters.score}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFilterChange('score', 'all')}
              />
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground hover:text-foreground h-6 px-2 text-[11px]"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
