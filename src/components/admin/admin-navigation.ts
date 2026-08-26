export type AdminNavIconName =
  | 'LayoutDashboard'
  | 'Building2'
  | 'CreditCard'
  | 'Receipt'
  | 'IndianRupee'
  | 'Bot'
  | 'MessageSquare'
  | 'Settings';

export interface AdminNavItem {
  id: string;
  href: string;
  label: string;
  icon: AdminNavIconName;
  exact?: boolean;
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    title: 'OVERVIEW',
    items: [
      {
        id: 'dashboard',
        href: '/admin',
        label: 'Dashboard',
        icon: 'LayoutDashboard',
        exact: true,
      },
    ],
  },
  {
    title: 'BUSINESSES',
    items: [
      {
        id: 'businesses',
        href: '/admin/subscribers',
        label: 'Businesses',
        icon: 'Building2',
      },
    ],
  },
  {
    title: 'REVENUE',
    items: [
      {
        id: 'plans',
        href: '/admin/plans',
        label: 'Plans & Pricing',
        icon: 'CreditCard',
      },
      {
        id: 'subscriptions',
        href: '/admin/subscriptions',
        label: 'Subscriptions',
        icon: 'Receipt',
      },
      {
        id: 'payments',
        href: '/admin/payments',
        label: 'Payments',
        icon: 'IndianRupee',
      },
    ],
  },
  {
    title: 'AI & WHATSAPP',
    items: [
      {
        id: 'ai',
        href: '/admin/ai',
        label: 'AI Settings',
        icon: 'Bot',
      },
      {
        id: 'whatsapp',
        href: '/admin/whatsapp',
        label: 'WhatsApp Accounts',
        icon: 'MessageSquare',
      },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      {
        id: 'settings',
        href: '/admin/settings',
        label: 'Settings',
        icon: 'Settings',
      },
    ],
  },
];

export const ADMIN_ROUTE_DESCRIPTIONS: Record<
  string,
  { title: string; description: string }
> = {
  '/admin': {
    title: 'Dashboard',
    description:
      'Platform health metrics, multi-tenant subscription revenue, and active workspace overview.',
  },
  '/admin/subscribers': {
    title: 'Businesses',
    description:
      'Manage registered tenant organizations, subscription states, and workspace overrides.',
  },
  '/admin/plans': {
    title: 'Plans & Pricing',
    description:
      'Configure subscription tiers, setup fees, usage limits, and commercial feature flags.',
  },
  '/admin/subscriptions': {
    title: 'Subscriptions',
    description: 'Manage business subscriptions, renewals and payment status.',
  },
  '/admin/payments': {
    title: 'Payments',
    description: 'Track payments received from businesses using Helpa.',
  },
  '/admin/ai': {
    title: 'AI Settings',
    description:
      'Configure global AI providers, model endpoints, rate limits, and fallback routing.',
  },
  '/admin/whatsapp': {
    title: 'WhatsApp Accounts',
    description: 'Monitor WhatsApp connections for businesses using Helpa.',
  },
  '/admin/settings': {
    title: 'Settings',
    description:
      'Super Admin platform controls, maintenance mode, system keys, and administrative audit logs.',
  },
};

export const ADMIN_LEGACY_ROUTES: Record<string, string> = {
  '/admin/tenants': '/admin/subscribers',
};

export const ADMIN_ROUTE_PATHS = ADMIN_NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => item.href)
);

export function isAdminNavItemActive(pathname: string, item: AdminNavItem) {
  if (item.exact) return pathname === item.href;
  if (ADMIN_LEGACY_ROUTES[pathname] === item.href) return true;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function getAdminRouteDescription(pathname: string) {
  const canonicalPath = ADMIN_LEGACY_ROUTES[pathname] ?? pathname;
  return ADMIN_ROUTE_DESCRIPTIONS[canonicalPath];
}
