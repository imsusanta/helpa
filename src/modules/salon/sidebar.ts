import { ModuleNavItem } from '../types';

export const sidebarConfig: ModuleNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', iconName: 'LayoutDashboard' },
  { href: '/inbox', label: 'WhatsApp Chats', iconName: 'MessageSquare' },
  { href: '/customers', label: 'Customers', iconName: 'Users' },
  { href: '/services', label: 'Services & Menu', iconName: 'Sparkles' },
  { href: '/staff', label: 'Stylists & Staff', iconName: 'UserCheck' },
  { href: '/appointments', label: 'Appointments', iconName: 'Calendar' },
  {
    href: '/broadcasts',
    label: 'Campaigns',
    iconName: 'Megaphone',
    roleMin: 'admin',
  },
  { href: '/knowledge-base', label: 'Knowledge Base', iconName: 'FileText' },
  { href: '/settings', label: 'Settings', iconName: 'Settings' },
];
