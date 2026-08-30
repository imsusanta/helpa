'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import {
  AlertCircle,
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
  Users,
  Receipt,
  MapPin,
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
import { NotificationCenter } from '@/components/notifications/notification-center';
import { CommandSearch } from '@/components/ui/command-search';

interface HeaderProps {
  onOpenSidebar?: () => void;
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const { profile, signOut } = useAuth();
  const { terminology } = useWorkspace();
  const [searchOpen, setSearchOpen] = useState(false);
  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ||
    profile?.email?.charAt(0)?.toUpperCase() ||
    'SU';
  const fullName = profile?.full_name || 'susanta lohar';

  return (
    <header className="animate-header-in z-20 flex h-[72px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-2xs lg:px-6">
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
        <div
          onClick={() => setSearchOpen(true)}
          className="relative hidden w-[285px] cursor-pointer sm:block"
        >
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            readOnly
            aria-label="Search"
            placeholder={`Search ${terminology.pipelineItems.toLowerCase()}, ${terminology.people.toLowerCase()}...`}
            className="h-10 w-full cursor-pointer rounded-xl border border-slate-200 bg-white pr-16 pl-9 text-xs font-medium text-slate-800 shadow-2xs placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none"
          />
          <span className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
            Ctrl+K
          </span>
        </div>

        {/* Quick Create Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[#00b074] px-3.5 text-xs font-bold text-white shadow-2xs transition hover:-translate-y-0.5 hover:bg-[#009b66] hover:shadow-md active:translate-y-0">
                <Plus className="h-4 w-4 stroke-[2.5]" />
                <span>Quick Create</span>
              </button>
            }
          />
          <DropdownMenuContent align="start" className="w-52 p-1 text-xs">
            <DropdownMenuItem
              render={
                <Link
                  href="/leads"
                  className="flex items-center gap-2 font-medium"
                />
              }
            >
              <User className="h-4 w-4 text-blue-500" />
              New {terminology.pipelineItem}
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <Link
                  href="/customers"
                  className="flex items-center gap-2 font-medium"
                />
              }
            >
              <Users className="h-4 w-4 text-indigo-500" />
              New {terminology.person}
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <Link
                  href="/pipelines"
                  className="flex items-center gap-2 font-medium"
                />
              }
            >
              <TrendingUp className="h-4 w-4 text-purple-500" />
              New {terminology.pipelineItem} / {terminology.pipeline}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <Link
                  href="/tour-packages"
                  className="flex items-center gap-2 font-medium"
                />
              }
            >
              <MapPin className="h-4 w-4 text-emerald-500" />
              New Tour Package
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <Link
                  href="/quotations"
                  className="flex items-center gap-2 font-medium"
                />
              }
            >
              <Receipt className="h-4 w-4 text-teal-500" />
              New Quotation
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <Link
                  href="/invoices"
                  className="flex items-center gap-2 font-medium"
                />
              }
            >
              <Receipt className="h-4 w-4 text-emerald-500" />
              New Invoice
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <Link
                  href="/inbox"
                  className="flex items-center gap-2 font-medium"
                />
              }
            >
              <Zap className="h-4 w-4 text-amber-500" />
              New Message
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
          className="group flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
        >
          <RotateCw className="h-4 w-4 transition-transform duration-500 group-hover:rotate-180" />
        </button>

        {/* Live Notification Center */}
        <NotificationCenter />

        {/* User Avatar & Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center rounded-full transition-transform outline-none hover:scale-105 focus:ring-2 focus:ring-emerald-500/20">
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
            <DropdownMenuItem render={<Link href="/settings?tab=profile" />}>
              <User className="h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/settings" />}>
              <SettingsIcon className="h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
