import { ModuleNavItem } from '../types';
import { getIndustryTerminology } from '../terminology';
const terms = getIndustryTerminology('travel');

export const sidebarConfig: ModuleNavItem[] = [
  { href: '/dashboard', label: 'Home', iconName: 'LayoutDashboard' },
  { href: '/inbox', label: 'Messages', iconName: 'MessageSquare' },
  { href: '/contacts', label: terms.contacts, iconName: 'Users' },
  { href: '/tour-packages', label: 'Tour Packages', iconName: 'FileText' },
  { href: '/booking-trip', label: 'Booking Trip', iconName: 'Calendar' },
  {
    href: '/broadcasts',
    label: 'Campaigns',
    iconName: 'Megaphone',
    roleMin: 'admin',
  },
  { href: '/knowledge-base', label: 'Knowledge', iconName: 'FileText' },
  { href: '/settings', label: 'Settings', iconName: 'Settings' },
];
