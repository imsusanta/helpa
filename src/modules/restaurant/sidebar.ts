import { ModuleNavItem } from '../types';

export const sidebarConfig: ModuleNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', iconName: 'LayoutDashboard' },
  { href: '/inbox', label: 'WhatsApp Chats', iconName: 'MessageSquare' },
  { href: '/reservations', label: 'Reservations', iconName: 'Calendar' },
  { href: '/tables', label: 'Tables', iconName: 'FileText' },
  { href: '/orders', label: 'Orders', iconName: 'FileText' },
  { href: '/contacts', label: 'Customers', iconName: 'Users' },
  { href: '/broadcasts', label: 'Campaigns', iconName: 'Megaphone', roleMin: 'admin' },
  { href: '/knowledge-base', label: 'Knowledge', iconName: 'FileText' },
  { href: '/settings', label: 'Settings', iconName: 'Settings' },
];
