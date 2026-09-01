'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  LayoutDashboard,
  MessageSquare,
  Users,
  UserPlus,
  Calendar,
  Clock,
  Send,
  BookOpen,
  Settings,
  X,
  Loader2,
  DollarSign,
  User,
  MapPin,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/hooks/use-workspace';

export interface CommandSearchProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface SearchEntityResults {
  contacts: Array<{
    id: string;
    name?: string;
    phone?: string;
    email?: string;
    company?: string;
  }>;
  deals: Array<{
    id: string;
    name: string;
    value?: number;
    currency?: string;
    status?: string;
  }>;
  appointments: Array<{
    id: string;
    starts_at: string;
    status: string;
    notes?: string;
    contact?: { name?: string; phone?: string };
  }>;
}

const COMMAND_NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    category: 'Navigation',
  },
  {
    label: 'Inbox Workspace',
    href: '/inbox',
    icon: MessageSquare,
    category: 'Navigation',
  },
  {
    label: 'Contacts Directory',
    href: '/contacts',
    icon: Users,
    category: 'CRM',
  },
  {
    label: 'Tour Packages',
    href: '/tour-packages',
    icon: MapPin,
    category: 'CRM',
  },
  {
    label: 'Trip Proposals',
    href: '/trip-proposals',
    icon: MapPin,
    category: 'CRM',
  },
  {
    label: 'Leads Kanban',
    href: '/leads',
    icon: UserPlus,
    category: 'Sales',
  },
  {
    label: 'Sales Pipelines & Deals',
    href: '/pipelines',
    icon: DollarSign,
    category: 'Sales',
  },
  {
    label: 'Appointments & OPD Queue',
    href: '/appointments',
    icon: Calendar,
    category: 'Clinical',
  },
  {
    label: 'Tasks & Follow-ups',
    href: '/follow-ups',
    icon: Clock,
    category: 'CRM',
  },
  {
    label: 'Campaigns & Broadcasts',
    href: '/broadcasts',
    icon: Send,
    category: 'Engagement',
  },
  {
    label: 'Knowledge Base',
    href: '/knowledge-base',
    icon: BookOpen,
    category: 'AI & Knowledge',
  },
  {
    label: 'AI Receptionist & System Prompt',
    href: '/knowledge-base?tab=receptionist',
    icon: BookOpen,
    category: 'AI & Knowledge',
  },
  {
    label: 'FAQ Bot',
    href: '/knowledge-base?tab=faq',
    icon: BookOpen,
    category: 'AI & Knowledge',
  },
  {
    label: 'Settings & Workspace Rules',
    href: '/settings',
    icon: Settings,
    category: 'Configuration',
  },
];

export function CommandSearch({
  open: externalOpen,
  onOpenChange,
}: CommandSearchProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [entityResults, setEntityResults] = React.useState<SearchEntityResults>(
    {
      contacts: [],
      deals: [],
      appointments: [],
    }
  );
  const router = useRouter();
  const { terminology, isRouteAllowed } = useWorkspace();

  const commandNavItems = React.useMemo(
    () =>
      COMMAND_NAV_ITEMS.map((item) => {
        if (item.href === '/contacts')
          return {
            ...item,
            label: `${terminology.people} Directory`,
            category: 'CRM',
          };
        if (item.href === '/leads')
          return {
            ...item,
            label: `${terminology.pipelineItems} Board`,
            category: 'CRM',
          };
        if (item.href === '/pipelines')
          return {
            ...item,
            label: `${terminology.pipelines} & ${terminology.pipelineItems}`,
            category: 'CRM',
          };
        if (item.href === '/appointments')
          return {
            ...item,
            label: terminology.meetings,
            category: 'Scheduling',
          };
        if (item.href === '/follow-ups')
          return { ...item, label: `Tasks & ${terminology.followUps}` };
        if (item.href === '/broadcasts')
          return { ...item, label: `${terminology.campaigns} & Broadcasts` };
        return item;
      }).filter((item) => isRouteAllowed(item.href)),
    [isRouteAllowed, terminology]
  );

  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;

  const setOpen = React.useCallback(
    (value: boolean) => {
      if (onOpenChange) {
        onOpenChange(value);
      } else {
        setInternalOpen(value);
      }
    },
    [onOpenChange]
  );

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(!isOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setOpen]);

  // Live entity search with debounce
  React.useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setEntityResults({ contacts: [], deals: [], appointments: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    // Abort in-flight requests when the query changes so a slow earlier
    // response can never overwrite results for a newer query.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/global?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const json = await res.json();
          setEntityResults(
            json.data || { contacts: [], deals: [], appointments: [] }
          );
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        console.warn('[CommandSearch] Live search failed:', err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const filteredNavItems = commandNavItems.filter(
    (item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (href: string) => {
    setOpen(false);
    setQuery('');
    router.push(href);
  };

  const hasEntityResults =
    entityResults.contacts.length > 0 ||
    entityResults.deals.length > 0 ||
    entityResults.appointments.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="bg-card border-border overflow-hidden p-0 shadow-2xl sm:max-w-[560px]">
        <DialogTitle className="sr-only">Quick Command Search</DialogTitle>
        <div className="border-border flex items-center border-b px-3.5 py-2.5">
          <Search className="text-muted-foreground mr-2.5 h-4 w-4 shrink-0" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${terminology.people.toLowerCase()}, ${terminology.pipelineItems.toLowerCase()}, ${terminology.meetings.toLowerCase()}...`}
            className="h-8 border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
          />
          {loading && (
            <Loader2 className="text-primary mr-2 size-3.5 animate-spin" />
          )}
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-muted-foreground hover:text-foreground p-1"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="max-h-[380px] space-y-3 overflow-y-auto p-2">
          {/* Entity: Contacts */}
          {entityResults.contacts.length > 0 && (
            <div>
              <span className="text-primary block px-2 py-1 text-[10px] font-bold tracking-wider uppercase">
                {terminology.people} ({entityResults.contacts.length})
              </span>
              <div className="mt-1 space-y-1">
                {entityResults.contacts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() =>
                      handleSelect(
                        `/contacts?search=${encodeURIComponent(c.phone || c.name || '')}`
                      )
                    }
                    className="hover:bg-muted/70 focus:bg-muted/70 group flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-xs transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <User className="size-3.5 shrink-0 text-emerald-500" />
                      <span className="text-foreground truncate font-semibold">
                        {c.name || 'Unnamed'}
                      </span>
                      <span className="text-muted-foreground font-mono text-[11px]">
                        {c.phone}
                      </span>
                    </div>
                    {c.company && (
                      <span className="text-muted-foreground max-w-[120px] truncate text-[10px]">
                        {c.company}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Entity: Deals */}
          {entityResults.deals.length > 0 && (
            <div>
              <span className="text-primary block px-2 py-1 text-[10px] font-bold tracking-wider uppercase">
                {terminology.pipelineItems} ({entityResults.deals.length})
              </span>
              <div className="mt-1 space-y-1">
                {entityResults.deals.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => handleSelect('/pipelines')}
                    className="hover:bg-muted/70 focus:bg-muted/70 group flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-xs transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <DollarSign className="size-3.5 shrink-0 text-emerald-600" />
                      <span className="text-foreground truncate font-semibold">
                        {d.name}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {d.currency || '₹'} {d.value || 0}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Entity: Appointments */}
          {entityResults.appointments.length > 0 && (
            <div>
              <span className="text-primary block px-2 py-1 text-[10px] font-bold tracking-wider uppercase">
                {terminology.meetings} ({entityResults.appointments.length})
              </span>
              <div className="mt-1 space-y-1">
                {entityResults.appointments.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => handleSelect('/appointments')}
                    className="hover:bg-muted/70 focus:bg-muted/70 group flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-xs transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Calendar className="size-3.5 shrink-0 text-blue-500" />
                      <span className="text-foreground truncate font-medium">
                        {a.contact?.name || terminology.meeting} —{' '}
                        {a.notes || 'No notes'}
                      </span>
                    </div>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {new Date(a.starts_at).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Items */}
          <div>
            {hasEntityResults && (
              <span className="text-muted-foreground block px-2 py-1 text-[10px] font-bold tracking-wider uppercase">
                Pages & Workspaces
              </span>
            )}
            {filteredNavItems.length === 0 && !hasEntityResults ? (
              <p className="text-muted-foreground py-8 text-center text-xs">
                No matching records or pages found.
              </p>
            ) : (
              <div className="mt-1 space-y-1">
                {filteredNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.href}
                      onClick={() => handleSelect(item.href)}
                      className="hover:bg-muted/70 focus:bg-muted/70 group flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs transition-colors"
                    >
                      <div className="text-foreground flex items-center gap-2.5">
                        <Icon className="text-muted-foreground group-hover:text-primary h-4 w-4 transition-colors" />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <span className="text-muted-foreground font-mono text-[10px] tracking-wider uppercase">
                        {item.category}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="border-border text-muted-foreground bg-muted/30 flex items-center justify-between border-t px-3.5 py-2 text-[11px]">
          <span>Search CRM records or navigate with keyboard</span>
          <span className="bg-background border-border rounded border px-1.5 py-0.5 font-mono text-[10px]">
            ESC to close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
