import { ModuleNavItem } from '../types';

export const sidebarConfig: ModuleNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', iconName: 'LayoutDashboard' },
  { href: '/inbox', label: 'Inbox', iconName: 'MessageSquare' },
  { href: '/leads', label: 'Leads', iconName: 'Users' },
  { href: '/properties', label: 'Properties', iconName: 'Building' },
  { href: '/agents', label: 'Agents', iconName: 'UserCheck' },
  { href: '/site-visits', label: 'Site Visits', iconName: 'Calendar' },
  {
    href: '/broadcasts',
    label: 'Campaigns',
    iconName: 'Megaphone',
    roleMin: 'admin',
  },
  { href: '/knowledge-base', label: 'Knowledge Base', iconName: 'FileText' },
  { href: '/dashboard/analytics', label: 'AI Assistant', iconName: 'Brain' },
  { href: '/settings', label: 'Settings', iconName: 'Settings' },
];
