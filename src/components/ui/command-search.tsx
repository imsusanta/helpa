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
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export interface CommandSearchProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
    label: 'Patients Directory',
    href: '/patients',
    icon: Users,
    category: 'Clinical',
  },
  {
    label: 'Doctors Roster',
    href: '/doctors',
    icon: UserPlus,
    category: 'Clinical',
  },
  {
    label: 'Appointments & OPD Queue',
    href: '/appointments',
    icon: Calendar,
    category: 'Clinical',
  },
  {
    label: 'Patient Follow-ups',
    href: '/follow-ups',
    icon: Clock,
    category: 'Clinical',
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
  const router = useRouter();

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

  const filteredItems = COMMAND_NAV_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (href: string) => {
    setOpen(false);
    setQuery('');
    router.push(href);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="bg-card border-border overflow-hidden p-0 shadow-2xl sm:max-w-[540px]">
        <DialogTitle className="sr-only">Quick Command Search</DialogTitle>
        <div className="border-border flex items-center border-b px-3.5 py-2.5">
          <Search className="text-muted-foreground mr-2.5 h-4 w-4 shrink-0" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search workspace..."
            className="h-8 border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
          />
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

        <div className="max-h-[320px] overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-xs">
              No matching commands or pages found.
            </p>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item) => {
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

        <div className="border-border text-muted-foreground bg-muted/30 flex items-center justify-between border-t px-3.5 py-2 text-[11px]">
          <span>Navigate with mouse or keyboard</span>
          <span className="bg-background border-border rounded border px-1.5 py-0.5 font-mono text-[10px]">
            ESC to close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
