import { ModuleNavItem } from '../types';

export const sidebarConfig: ModuleNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', iconName: 'LayoutDashboard' },
  { href: '/inbox', label: 'WhatsApp Chats', iconName: 'MessageSquare' },
  { href: '/contacts', label: 'Students', iconName: 'Users' },
  { href: '/teachers', label: 'Teachers', iconName: 'UserCheck' },
  { href: '/courses', label: 'Courses', iconName: 'FileText' },
  { href: '/admissions', label: 'Admissions', iconName: 'Calendar' },
  { href: '/broadcasts', label: 'Campaigns', iconName: 'Megaphone', roleMin: 'admin' },
  { href: '/knowledge-base', label: 'Knowledge', iconName: 'FileText' },
  { href: '/dashboard/analytics', label: 'AI Analytics', iconName: 'Brain' },
  { href: '/settings', label: 'Settings', iconName: 'Settings' },
];
