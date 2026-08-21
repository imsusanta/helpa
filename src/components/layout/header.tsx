'use client';

import { useAuth } from '@/hooks/use-auth';
import {
  AlertCircle,
  Bell,
  Gift,
  LogOut,
  Menu,
  Phone,
  Plus,
  RotateCw,
  Search,
  Settings as SettingsIcon,
  TrendingUp,
  User,
  Zap,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  onOpenSidebar?: () => void;
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const { profile, signOut } = useAuth();
  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ||
    profile?.email?.charAt(0)?.toUpperCase() ||
    'SU';
  const fullName = profile?.full_name || 'susanta lohar';

  return (
    <header className="z-20 flex h-[72px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-2xs lg:px-6">
      {/* Left: Hamburger + Search + Quick Create */}
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open navigation"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          type="button"
          aria-label="Toggle navigation"
          onClick={onOpenSidebar}
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:flex"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Search Input Box */}
        <div className="relative hidden w-[285px] sm:block">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Search"
            placeholder="Search leads, contacts, acc..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pr-16 pl-9 text-xs font-medium text-slate-800 shadow-2xs placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
          />
          <span className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
            Ctrl+K
          </span>
        </div>

        {/* Quick Create Button */}
        <button className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[#00b074] px-3.5 text-xs font-bold text-white shadow-2xs transition hover:bg-[#009b66]">
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Quick Create</span>
        </button>
      </div>

      {/* Center-Right: Usage/Balance Capsule & Action Icons */}
      <div className="flex items-center gap-3">
        {/* Usage Capsule */}
        <div className="hidden items-center gap-2.5 rounded-xl border border-slate-200/90 bg-[#f8fafc] px-3 py-1.5 shadow-2xs xl:flex">
          {/* WhatsApp Pill */}
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-[#eff6ff] px-2 py-0.5 text-[11px] font-bold text-[#2563eb]">
              <Zap className="h-3 w-3 fill-current" />
              WhatsApp
            </span>
            <span className="text-xs font-bold text-[#0f172a]">0.00</span>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          {/* Calling Pill */}
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-[#ecfdf5] px-2 py-0.5 text-[11px] font-bold text-[#059669]">
              <Phone className="h-3 w-3 fill-current" />
              Calling
            </span>
            <span className="text-xs font-bold text-[#0f172a]">0.00</span>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          {/* Offer Pill */}
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-[#faf5ff] px-2 py-0.5 text-[11px] font-bold text-[#9333ea]">
              <Gift className="h-3 w-3" />
              Offer
            </span>
            <span className="text-xs font-bold text-[#0f172a]">0.00</span>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          {/* TOTAL Section */}
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-[#10b981]" />
            <div className="text-left leading-tight">
              <span className="mr-1 text-[9px] font-extrabold tracking-wider text-slate-400 uppercase">
                TOTAL
              </span>
              <span className="text-xs font-extrabold text-[#10b981]">
                0.00
              </span>
            </div>
          </div>

          {/* Low Pill */}
          <span className="inline-flex items-center gap-1 rounded-md border border-[#fef3c7] bg-[#fffbeb] px-2 py-0.5 text-[10px] font-bold text-[#d97706]">
            <AlertCircle className="h-3 w-3" />
            Low
          </span>
        </div>

        {/* Refresh Icon */}
        <button
          type="button"
          aria-label="Refresh"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
        >
          <RotateCw className="h-4 w-4" />
        </button>

        {/* Notification Bell */}
        <button
          type="button"
          aria-label="Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
        >
          <Bell className="h-[18px] w-[18px]" />
        </button>

        {/* User Avatar & Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center rounded-full outline-none focus:ring-2 focus:ring-emerald-500/20">
            <Avatar className="h-9 w-9">
              {profile?.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt={fullName} />
              ) : null}
              <AvatarFallback className="bg-[#10b981] text-xs font-bold text-white">
                {initial === 'U' ? 'SU' : initial}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="min-w-52 rounded-xl border-slate-200 bg-white p-1.5 shadow-xl"
          >
            <div className="px-2.5 py-2">
              <p className="text-sm font-bold text-slate-900">{fullName}</p>
              <p className="truncate text-xs text-slate-500">
                {profile?.email || ''}
              </p>
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
      </div>
    </header>
  );
}
