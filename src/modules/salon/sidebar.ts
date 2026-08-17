import { ModuleNavItem } from '../types';

export const sidebarConfig: ModuleNavItem[] = [
  { href: '/dashboard', label: 'Home', iconName: 'LayoutDashboard' },
  { href: '/inbox', label: 'Messages', iconName: 'MessageSquare' },
  { href: '/customers', label: 'Customers', iconName: 'Users' },
  { href: '/services', label: 'Services', iconName: 'Sparkles' },
  { href: '/staff', label: 'Staff', iconName: 'UserCheck' },
  { href: '/appointments', label: 'Bookings', iconName: 'Calendar' },
  {
    href: '/broadcasts',
    label: 'Campaigns',
    iconName: 'Megaphone',
    roleMin: 'admin',
  },
  { href: '/knowledge-base', label: 'Knowledge', iconName: 'FileText' },
  { href: '/settings', label: 'Settings', iconName: 'Settings' },
];
