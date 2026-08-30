import { ModuleNavItem } from '../types';
import { getIndustryTerminology } from '../terminology';
const terms = getIndustryTerminology('gym');

export const sidebarConfig: ModuleNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', iconName: 'LayoutDashboard' },
  { href: '/inbox', label: 'WhatsApp Chats', iconName: 'MessageSquare' },
  { href: '/contacts', label: terms.contacts, iconName: 'Users' },
  { href: '/trainers', label: terms.staffMembers, iconName: 'UserCheck' },
  { href: '/memberships', label: 'Memberships', iconName: 'FileText' },
  { href: '/classes', label: 'Classes', iconName: 'Calendar' },
  {
    href: '/broadcasts',
    label: 'Campaigns',
    iconName: 'Megaphone',
    roleMin: 'admin',
  },
  { href: '/knowledge-base', label: 'Knowledge Base', iconName: 'FileText' },
  { href: '/settings', label: 'Settings', iconName: 'Settings' },
];
