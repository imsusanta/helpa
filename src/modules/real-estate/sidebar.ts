import { ModuleNavItem } from '../types';

export const sidebarConfig: ModuleNavItem[] = [
  { href: '/dashboard', label: 'Home', iconName: 'LayoutDashboard' },
  { href: '/inbox', label: 'Messages', iconName: 'MessageSquare' },
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
  { href: '/knowledge-base', label: 'Knowledge', iconName: 'FileText' },
  { href: '/settings', label: 'Settings', iconName: 'Settings' },
];
