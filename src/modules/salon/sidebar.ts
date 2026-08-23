import { ModuleNavItem } from '../types';
import { getIndustryTerminology } from '../terminology';

const terms = getIndustryTerminology('salon');

export const sidebarConfig: ModuleNavItem[] = [
  { href: '/dashboard', label: 'Home', iconName: 'LayoutDashboard' },
  { href: '/inbox', label: 'Messages', iconName: 'MessageSquare' },
  { href: '/customers', label: terms.contacts, iconName: 'Users' },
  { href: '/services', label: terms.services, iconName: 'Sparkles' },
  { href: '/staff', label: terms.staffMembers, iconName: 'UserCheck' },
  { href: '/appointments', label: terms.meetings, iconName: 'Calendar' },
  {
    href: '/broadcasts',
    label: 'Campaigns',
    iconName: 'Megaphone',
    roleMin: 'admin',
  },
  { href: '/knowledge-base', label: 'Knowledge', iconName: 'FileText' },
  { href: '/settings', label: 'Settings', iconName: 'Settings' },
];
