import { ModuleNavItem } from '../types';
import { getIndustryTerminology } from '../terminology';

const terms = getIndustryTerminology('real_estate');

export const sidebarConfig: ModuleNavItem[] = [
  { href: '/dashboard', label: 'Home', iconName: 'LayoutDashboard' },
  { href: '/inbox', label: 'Messages', iconName: 'MessageSquare' },
  { href: '/leads', label: terms.contacts, iconName: 'Users' },
  { href: '/properties', label: terms.services, iconName: 'Building' },
  { href: '/agents', label: terms.staffMembers, iconName: 'UserCheck' },
  { href: '/site-visits', label: terms.meetings, iconName: 'Calendar' },
  {
    href: '/broadcasts',
    label: 'Campaigns',
    iconName: 'Megaphone',
    roleMin: 'admin',
  },
  { href: '/knowledge-base', label: 'Knowledge', iconName: 'FileText' },
  { href: '/settings', label: 'Settings', iconName: 'Settings' },
];
