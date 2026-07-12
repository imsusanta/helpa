import { ModuleNavItem } from '../types';

export const sidebarConfig: ModuleNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', iconName: 'LayoutDashboard' },
  { href: '/inbox', label: 'WhatsApp Chats', iconName: 'MessageSquare' },
  { href: '/contacts', label: 'Members', iconName: 'Users' },
  { href: '/trainers', label: 'Trainers', iconName: 'UserCheck' },
  { href: '/memberships', label: 'Memberships', iconName: 'FileText' },
  { href: '/classes', label: 'Classes', iconName: 'Calendar' },
  { href: '/broadcasts', label: 'Campaigns', iconName: 'Megaphone', roleMin: 'admin' },
  { href: '/knowledge-base', label: 'Knowledge', iconName: 'FileText' },
  { href: '/settings', label: 'Settings', iconName: 'Settings' },
];
