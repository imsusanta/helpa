import { ModuleNavItem } from '../types';
import { getIndustryTerminology } from '../terminology';

const terms = getIndustryTerminology('hospital_clinic');

/**
 * Only routes that are truly clinic-specific belong in Clinic Operations.
 * Shared product features are provided by the canonical global navigation.
 */
export const sidebarConfig: ModuleNavItem[] = [
  { href: '/patients', label: terms.people, iconName: 'Users' },
  { href: '/doctors', label: terms.staffMembers, iconName: 'UserCheck' },
  {
    href: '/lab-reports?scope=patients',
    label: 'Patient Reports',
    iconName: 'FileText',
  },
  { href: '/website', label: 'Website', iconName: 'Globe' },
];
