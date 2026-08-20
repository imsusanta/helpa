'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useTotalUnread } from '@/hooks/use-total-unread';
import { hasMinRole, type AccountRole } from '@/lib/auth/roles';
import { getIndustryModule } from '@/modules/registry';
import {
  Crown,
  GitBranch,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Radio,
  Megaphone,
  Settings,
  Shield,
  User,
  UserCog,
  Users,
  UsersRound,
  Workflow,
  X,
  Zap,
  Brain,
  Hospital,
  Calendar,
  Clock,
  UserCheck,
  FileText,
  CreditCard,
  Home,
  Compass,
  GraduationCap,
  Utensils,
  Dumbbell,
  ShoppingBag,
  Bot,
  BarChart3,
  Building2,
  Plane,
  BookOpen,
  BookOpenCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ROLE_CHIP: Record<
  AccountRole,
  { icon: typeof Crown; label: string; className: string }
> = {
  owner: {
    icon: Crown,
    label: 'Owner',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  },
  admin: {
    icon: Shield,
    label: 'Admin',
    className: 'border-primary/40 bg-primary/10 text-primary',
  },
  agent: {
    icon: UserCog,
    label: 'Agent',
    className: 'border-border bg-muted text-foreground',
  },
  viewer: {
    icon: User,
    label: 'Viewer',
    className: 'border-border bg-card text-muted-foreground',
  },
};

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  beta?: boolean;
  roleMin?: AccountRole;
}

interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

const INDUSTRY_ICON: Record<string, LucideIcon> = {
  hospital_clinic: Hospital,
  coaching: GraduationCap,
  real_estate: Building2,
  travel: Plane,
  gym: Dumbbell,
  restaurant: Utensils,
  solo_teacher: BookOpenCheck,
  salon: Sparkles,
  general: Bot,
};

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

const ICON_COMPONENTS: Record<string, LucideIcon> = {
  LayoutDashboard,
  MessageSquare,
  Users,
  UserCheck,
  Calendar,
  Clock,
  FileText,
  Megaphone,
  Brain,
  Settings,
  Hospital,
  Home,
  Compass,
  GraduationCap,
  Utensils,
  Dumbbell,
  ShoppingBag,
  Bot,
  BarChart3,
  Building2,
  Plane,
  BookOpen,
  CreditCard,
  Radio,
  GitBranch,
  Zap,
  Workflow,
  BookOpenCheck,
  UsersRound,
  Sparkles,
};

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const {
    profile,
    profileLoading,
    account,
    accountRole,
    signOut,
    isSuperAdmin,
  } = useAuth();
  const totalUnread = useTotalUnread();

  const activeModule = getIndustryModule(account?.industry);

  // 1. Identify primary contact entity
  const contactItem = activeModule.sidebar.find((item) =>
    [
      '/patients',
      '/customers',
      '/students',
      '/members',
      '/leads',
      '/contacts',
    ].includes(item.href)
  ) || { href: '/contacts', label: 'Contacts', iconName: 'Users' };

  // 2. Identify primary booking/appointment entity
  const appointmentItem = activeModule.sidebar.find((item) =>
    [
      '/appointments',
      '/bookings',
      '/site-visits',
      '/reservations',
      '/admissions',
    ].includes(item.href)
  ) || { href: '/appointments', label: 'Appointments', iconName: 'Calendar' };

  // 3. Extract secondary catalog & business records
  const secondaryBusinessItems = activeModule.sidebar.filter(
    (item) =>
      ![
        '/dashboard',
        '/inbox',
        '/contacts',
        '/patients',
        '/customers',
        '/students',
        '/members',
        '/leads',
        '/appointments',
        '/bookings',
        '/site-visits',
        '/reservations',
        '/admissions',
        '/broadcasts',
        '/knowledge-base',
        '/settings',
        '/billing',
        '/automations',
        '/pipelines',
      ].includes(item.href)
  );

  const groups: NavGroup[] = [
    {
      id: 'main',
      title: 'MAIN',
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/inbox', label: 'Messages', icon: MessageSquare },
        {
          href: contactItem.href,
          label: contactItem.label,
          icon: ICON_COMPONENTS[contactItem.iconName] || Users,
        },
      ],
    },
    {
      id: 'business',
      title: 'BUSINESS',
      items: [
        { href: '/pipelines', label: 'Inquiries & CRM', icon: GitBranch },
        {
          href: appointmentItem.href,
          label: appointmentItem.label,
          icon: ICON_COMPONENTS[appointmentItem.iconName] || Calendar,
        },
        ...secondaryBusinessItems.map((item) => ({
          href: item.href,
          label: item.label,
          icon: ICON_COMPONENTS[item.iconName] || FileText,
          roleMin: item.roleMin,
        })),
      ],
    },
    {
      id: 'ai_automation',
      title: 'AI & AUTOMATION',
      items: [
        {
          href: '/settings?tab=ai',
          label: 'AI Receptionist',
          icon: Bot,
          roleMin: 'admin',
        },
        {
          href: '/knowledge-base',
          label: 'Business Info & FAQs',
          icon: BookOpen,
        },
        {
          href: '/automations',
          label: 'Auto-Reminders',
          icon: Zap,
          roleMin: 'admin',
        },
      ],
    },
    {
      id: 'team_account',
      title: 'TEAM & ACCOUNT',
      items: [
        {
          href: '/settings?tab=members',
          label: 'Staff & Team',
          icon: UsersRound,
          roleMin: 'admin',
        },
        {
          href: '/settings?tab=billing',
          label: 'Subscription & Billing',
          icon: CreditCard,
          roleMin: 'admin',
        },
        {
          href: '/settings',
          label: 'Settings',
          icon: Settings,
          roleMin: 'admin',
        },
      ],
    },
  ];

  const visibleGroups = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (
          item.roleMin &&
          (!accountRole || !hasMinRole(accountRole, item.roleMin))
        ) {
          return false;
        }
        return true;
      }),
    }))
    .filter((g) => g.items.length > 0);

  const showAccountStrip =
    !profileLoading && !!account?.name && account.name !== profile?.full_name;

  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const isItemActive = (href: string) => {
    if (href.includes('?tab=')) {
      const tab = href.split('?tab=')[1];
      return (
        pathname === '/settings' &&
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('tab') === tab
      );
    }
    if (href === '/settings') {
      return (
        pathname === '/settings' &&
        (typeof window === 'undefined' ||
          !new URLSearchParams(window.location.search).get('tab') ||
          ['profile', 'whatsapp'].includes(
            new URLSearchParams(window.location.search).get('tab') || ''
          ))
      );
    }
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={cn(
          'bg-background/70 fixed inset-0 z-30 backdrop-blur-sm transition-opacity lg:hidden',
          open
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        )}
      />

      <aside
        className={cn(
          'border-border bg-card fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r',
          'transition-transform duration-200 ease-out will-change-transform',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:static lg:z-0 lg:w-60 lg:translate-x-0 lg:transition-none'
        )}
        aria-label="Primary"
      >
        {/* Logo row */}
        <div className="border-border flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
          <Link
            href="/dashboard"
            className="flex min-w-0 flex-1 items-center gap-2.5"
          >
            {(() => {
              const LogoIcon = INDUSTRY_ICON[activeModule.id] || Bot;
              return (
                <div className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-xs">
                  <LogoIcon className="h-4 w-4" />
                </div>
              );
            })()}
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-sm leading-tight font-bold">
                {activeModule.name}
              </p>
              <p className="text-muted-foreground mt-0.5 truncate text-[10px] leading-none font-medium">
                Helpa Studio
              </p>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-9 w-9 items-center justify-center rounded-md lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Grouped navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-4">
            {visibleGroups.map((group) => (
              <div key={group.id} className="space-y-1">
                <p className="text-muted-foreground/70 px-3 text-[10px] font-bold tracking-wider uppercase">
                  {group.title}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const active = isItemActive(item.href);
                    const showUnreadDot =
                      item.href === '/inbox' && totalUnread > 0 && !active;

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2',
                            active
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.beta && (
                            <span
                              aria-label="Beta feature"
                              className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-amber-300 uppercase"
                            >
                              Beta
                            </span>
                          )}
                          {showUnreadDot && (
                            <span
                              aria-label={`${totalUnread} unread conversation${totalUnread === 1 ? '' : 's'}`}
                              className="relative flex h-2 w-2"
                            >
                              <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                              <span className="bg-primary relative inline-flex h-2 w-2 rounded-full" />
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {isSuperAdmin && (
            <>
              <div className="border-border my-4 border-t" />
              <ul className="flex flex-col gap-1">
                <li>
                  <Link
                    href="/admin"
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2',
                      pathname.startsWith('/admin')
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Shield className="h-4 w-4" />
                    Super Admin
                  </Link>
                </li>
              </ul>
            </>
          )}
        </nav>

        {/* User footer section */}
        <div className="border-border shrink-0 border-t p-3">
          {showAccountStrip && account?.name ? (
            <div className="text-muted-foreground mb-2 flex items-center gap-2 px-3 text-xs">
              <UsersRound className="size-3.5 shrink-0" />
              <span className="truncate" title={account.name}>
                {account.name}
              </span>
              {accountRole
                ? (() => {
                    const meta = ROLE_CHIP[accountRole];
                    const Icon = meta.icon;
                    return (
                      <span
                        className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium tracking-wider uppercase ${meta.className}`}
                      >
                        <Icon className="size-3" />
                        {meta.label}
                      </span>
                    );
                  })()
                : null}
            </div>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger className="hover:bg-muted/60 focus:bg-muted/60 data-popup-open:bg-muted/60 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors focus:outline-none">
              <Avatar className="size-8 shrink-0">
                {profile?.avatar_url ? (
                  <AvatarImage
                    src={profile.avatar_url}
                    alt={profile.full_name ?? 'Avatar'}
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                  {profile?.full_name?.charAt(0)?.toUpperCase() ??
                    profile?.email?.charAt(0)?.toUpperCase() ??
                    'U'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-medium">
                  {profile?.full_name ?? 'User'}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {profile?.email ?? ''}
                </p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              sideOffset={6}
              className="bg-popover text-popover-foreground ring-border min-w-56"
            >
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=profile"
                    onClick={onClose}
                    className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                  />
                }
              >
                <User className="size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=whatsapp"
                    onClick={onClose}
                    className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                  />
                }
              >
                <Settings className="size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={signOut}
                className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
              >
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
