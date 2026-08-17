import { ModuleNavItem } from '../types';

export const sidebarConfig: ModuleNavItem[] = [
  { href: '/dashboard', label: 'Home', iconName: 'LayoutDashboard' },
  { href: '/inbox', label: 'Messages', iconName: 'MessageSquare' },
  { href: '/students', label: 'Students', iconName: 'Users' },
  { href: '/teachers', label: 'Teachers', iconName: 'UserCheck' },
  { href: '/courses', label: 'Courses', iconName: 'BookOpen' },
  { href: '/admissions', label: 'Admissions', iconName: 'GraduationCap' },
  {
    href: '/broadcasts',
    label: 'Campaigns',
    iconName: 'Megaphone',
    roleMin: 'admin',
  },
  { href: '/knowledge-base', label: 'Knowledge', iconName: 'FileText' },
  { href: '/settings', label: 'Settings', iconName: 'Settings' },
];
