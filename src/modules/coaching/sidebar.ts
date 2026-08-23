import { ModuleNavItem } from '../types';
import { getIndustryTerminology } from '../terminology';
const terms = getIndustryTerminology('coaching');

export const sidebarConfig: ModuleNavItem[] = [
  { href: '/dashboard', label: 'Home', iconName: 'LayoutDashboard' },
  { href: '/inbox', label: 'Messages', iconName: 'MessageSquare' },
  { href: '/students', label: terms.contacts, iconName: 'Users' },
  { href: '/teachers', label: terms.staffMembers, iconName: 'UserCheck' },
  { href: '/courses', label: terms.services, iconName: 'BookOpen' },
  {
    href: '/admissions',
    label: terms.pipelineItems,
    iconName: 'GraduationCap',
  },
  {
    href: '/broadcasts',
    label: 'Campaigns',
    iconName: 'Megaphone',
    roleMin: 'admin',
  },
  { href: '/knowledge-base', label: 'Knowledge', iconName: 'FileText' },
  { href: '/settings', label: 'Settings', iconName: 'Settings' },
];
