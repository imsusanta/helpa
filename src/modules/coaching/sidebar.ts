import { ModuleNavItem } from '../types';

export const sidebarConfig: ModuleNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', iconName: 'LayoutDashboard' },
  { href: '/inbox', label: 'Inbox', iconName: 'MessageSquare' },
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
  { href: '/knowledge-base', label: 'Knowledge Base', iconName: 'FileText' },
  { href: '/dashboard/analytics', label: 'AI Assistant', iconName: 'Brain' },
  { href: '/settings', label: 'Settings', iconName: 'Settings' },
];
