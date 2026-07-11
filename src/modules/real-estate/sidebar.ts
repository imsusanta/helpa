import { ModuleNavItem } from '../types';

export const sidebarConfig: ModuleNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', iconName: 'LayoutDashboard' },
  { href: '/inbox', label: 'WhatsApp Chats', iconName: 'MessageSquare' },
  { href: '/leads', label: 'Leads', iconName: 'Users' },
  { href: '/contacts', label: 'Contacts', iconName: 'UsersRound' },
  { href: '/properties', label: 'Properties', iconName: 'FileText' },
  { href: '/agents', label: 'Agents', iconName: 'UserCheck' },
  { href: '/site-visits', label: 'Site Visits', iconName: 'Calendar' },
  { href: '/broadcasts', label: 'Campaigns', iconName: 'Megaphone', roleMin: 'admin' },
  { href: '/knowledge-base', label: 'Knowledge', iconName: 'FileText' },
  { href: '/dashboard/analytics', label: 'AI Analytics', iconName: 'Brain' },
  { href: '/settings', label: 'Settings', iconName: 'Settings' },
];
