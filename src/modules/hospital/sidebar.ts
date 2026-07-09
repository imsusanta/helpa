import { ModuleNavItem } from '../types';

export const sidebarConfig: ModuleNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', iconName: 'LayoutDashboard' },
  { href: '/inbox', label: 'WhatsApp Chats', iconName: 'MessageSquare' },
  { href: '/patients', label: 'Patients', iconName: 'Users' },
  { href: '/doctors', label: 'Doctors', iconName: 'UserCheck' },
  { href: '/appointments', label: 'Appointments', iconName: 'Calendar' },
  { href: '/broadcasts', label: 'Campaigns', iconName: 'Megaphone', roleMin: 'admin' },
  { href: '/knowledge-base', label: 'Knowledge', iconName: 'FileText' },
  { href: '/dashboard/analytics', label: 'AI Analytics', iconName: 'Brain' },
  { href: '/settings', label: 'Settings', iconName: 'Settings' },
];
