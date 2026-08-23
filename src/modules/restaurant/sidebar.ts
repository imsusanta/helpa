import { ModuleNavItem } from '../types';
import { getIndustryTerminology } from '../terminology';

const terms = getIndustryTerminology('restaurant');

export const sidebarConfig: ModuleNavItem[] = [
  { href: '/dashboard', label: 'Home', iconName: 'LayoutDashboard' },
  { href: '/inbox', label: 'Messages', iconName: 'MessageSquare' },
  { href: '/reservations', label: terms.bookings, iconName: 'Calendar' },
  { href: '/tables', label: 'Tables', iconName: 'FileText' },
  { href: '/orders', label: 'Orders', iconName: 'FileText' },
  { href: '/contacts', label: terms.contacts, iconName: 'Users' },
  {
    href: '/broadcasts',
    label: 'Campaigns',
    iconName: 'Megaphone',
    roleMin: 'admin',
  },
  { href: '/knowledge-base', label: 'Knowledge', iconName: 'FileText' },
  { href: '/settings', label: 'Settings', iconName: 'Settings' },
];
