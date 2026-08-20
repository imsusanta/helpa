'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  Bell,
  CalendarPlus,
  ChevronDown,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  User,
  Settings as SettingsIcon,
  LogOut,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/inbox': 'Conversations',
  '/contacts': 'Customers',
  '/customers': 'Customers',
  '/patients': 'Patients',
  '/students': 'Students',
  '/members': 'Members',
  '/appointments': 'Appointments',
  '/bookings': 'Bookings',
  '/follow-ups': 'Follow-ups',
  '/doctors': 'Doctors',
  '/broadcasts': 'Campaigns',
  '/automations': 'Automation & AI',
  '/billing': 'Billing',
  '/settings': 'Settings',
  '/knowledge-base': 'Business Info & FAQs',
  '/dashboard/analytics': 'Analytics',
};

function getPageTitle(pathname: string) {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const match = Object.entries(pageTitles).find(([path]) => pathname.startsWith(path));
  return match ? match[1] : 'Dashboard';
}

interface HeaderProps {
  onOpenSidebar?: () => void;
}

function UsagePill({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: 'blue' | 'teal' | 'purple';
  icon: React.ReactNode;
}) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700',
    teal: 'bg-teal-50 text-teal-700',
    purple: 'bg-purple-50 text-purple-700',
  }[tone];

  return (
    <div className="hidden h-9 items-center gap-2 whitespace-nowrap px-3 md:flex">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}>
        {icon}
        {label}
      </span>
      <span className="text-sm font-bold text-slate-800">{value}</span>
    </div>
  );
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();

  const title = getPageTitle(pathname);
  const initial = profile?.full_name?.charAt(0)?.toUpperCase() || profile?.email?.charAt(0)?.toUpperCase() || 'U';
  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  return (
    <header className="z-20 flex h-[62px] shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:px-4 lg:px-6">
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label="Open navigation"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden shrink-0 items-center gap-2 xl:flex">
        <span className="text-sm font-semibold text-slate-500">{title}</span>
      </div>

      <div className="relative min-w-0 flex-1 lg:max-w-[430px]">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          aria-label="Search"
          placeholder="Search leads, contacts, appointments..."
          className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-20 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
        />
        <span className="absolute top-1/2 right-2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-400 sm:block">
          Ctrl+K
        </span>
      </div>

      <button className="hidden h-10 shrink-0 items-center gap-2 rounded-xl bg-[#22c55e] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#16a34a] lg:flex">
        <Plus className="h-4 w-4" />
        Quick Create
      </button>

      <div className="ml-auto flex shrink-0 items-center rounded-xl border border-amber-300 bg-white shadow-sm">
        <UsagePill label="WhatsApp" value="0.00" tone="blue" icon={<Sparkles className="h-3.5 w-3.5" />} />
        <div className="hidden h-7 w-px bg-slate-200 md:block" />
        <UsagePill label="Calling" value="0.00" tone="teal" icon={<CalendarPlus className="h-3.5 w-3.5" />} />
        <div className="hidden h-7 w-px bg-slate-200 md:block" />
        <UsagePill label="Offer" value="0.00" tone="purple" icon={<Sparkles className="h-3.5 w-3.5" />} />
        <div className="hidden h-7 w-px bg-slate-200 md:block" />
        <div className="hidden items-center gap-2 px-3 lg:flex">
          <div className="text-right leading-tight">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total</div>
            <div className="text-sm font-extrabold text-emerald-600">0.00</div>
          </div>
          <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-600">Low</span>
        </div>
      </div>

      <button aria-label="Refresh" className="hidden h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 sm:flex">
        <RefreshCw className="h-4 w-4" />
      </button>
      <button aria-label="Notifications" className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
        <Bell className="h-[18px] w-[18px]" />
        <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center rounded-full outline-none focus:ring-2 focus:ring-emerald-500/20">
          <Avatar className="h-9 w-9 border border-slate-200">
            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={profile.full_name || 'Avatar'} /> : null}
            <AvatarFallback className="bg-emerald-500 text-xs font-bold text-white">{initial}</AvatarFallback>
          </Avatar>
          <ChevronDown className="ml-1 hidden h-3.5 w-3.5 text-slate-400 sm:block" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="min-w-52 rounded-xl border-slate-200 bg-white p-1.5 shadow-xl">
          <div className="px-2.5 py-2">
            <p className="text-sm font-bold text-slate-900">{profile?.full_name || firstName}</p>
            <p className="truncate text-xs text-slate-500">{profile?.email || ''}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<a href="/settings?tab=profile" />}>
            <User className="h-4 w-4" /> Profile
          </DropdownMenuItem>
          <DropdownMenuItem render={<a href="/settings" />}>
            <SettingsIcon className="h-4 w-4" /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
