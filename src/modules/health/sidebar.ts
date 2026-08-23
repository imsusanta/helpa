import { ModuleNavItem } from '../types';
import { getIndustryTerminology } from '../terminology';

const terms = getIndustryTerminology('hospital_clinic');

export const sidebarConfig: ModuleNavItem[] = [
  { href: '/dashboard', label: 'Home', iconName: 'LayoutDashboard' },
  { href: '/inbox', label: 'Messages', iconName: 'MessageSquare' },
  { href: '/patients', label: terms.contacts, iconName: 'Users' },
  { href: '/pipelines', label: terms.pipelineItems, iconName: 'GitBranch' },
  { href: '/doctors', label: terms.staffMembers, iconName: 'UserCheck' },
  { href: '/appointments', label: terms.meetings, iconName: 'Calendar' },
  { href: '/follow-ups', label: terms.followUps, iconName: 'Clock' },
  { href: '/lab-reports', label: terms.reports, iconName: 'FileText' },
  {
    href: '/broadcasts',
    label: 'Campaigns',
    iconName: 'Megaphone',
    roleMin: 'admin',
  },
  { href: '/knowledge-base', label: 'Knowledge', iconName: 'BookOpen' },
  { href: '/settings', label: 'Settings', iconName: 'Settings' },
];
