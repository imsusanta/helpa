import { IndustryModule } from '../types';
import { sidebarConfig } from './sidebar';
import { dashboardConfig } from './dashboard';
import { systemPromptConfig } from './system-prompt';
import { knowledgeTemplateConfig } from './knowledge-template';
import { campaignTemplateConfig } from './campaign-template';
import { copilotConfig } from './copilot';
import { workflowsConfig } from './workflows';

export const soloTeacherModule: IndustryModule = {
  id: 'solo_teacher',
  name: 'Solo Tutor',
  description: 'AI Teaching Assistant for Solo Tutors & Educators',
  status: 'COMING_SOON',
  aiRole: 'AI Teaching Assistant',
  terminology: {
    contact: 'Student',
    contacts: 'Students',
    booking: 'Enrollment',
    bookings: 'Enrollments',
    staff: 'Teacher',
    staffMembers: 'Teachers',
    service: 'Course',
    services: 'Courses',
  },
  features: {
    students: true,
    courses: true,
    classes: true,
    enrollments: true,
    patients: false,
    doctors: false,
    properties: false,
    services: false,
  },
  allowedRoutes: [
    '/dashboard',
    '/inbox',
    '/students',
    '/contacts',
    '/pipelines',
    '/courses',
    '/classes',
    '/broadcasts',
    '/knowledge-base',
    '/dashboard/analytics',
    '/settings',
    '/admin',
    '/billing',
    '/automations',
  ],
  sidebar: sidebarConfig,
  dashboardMetrics: dashboardConfig,
  systemPrompt: systemPromptConfig,
  kbTemplates: knowledgeTemplateConfig,
  campaignTemplates: campaignTemplateConfig,
  copilotConfig: copilotConfig,
  workflows: workflowsConfig,
  pipelineStages: [
    { name: 'New Enquiry', position: 1, color: '#3b82f6' },
    { name: 'Interested', position: 2, color: '#f59e0b' },
    { name: 'Confirmed', position: 3, color: '#8b5cf6' },
    { name: 'Enrolled', position: 4, color: '#10b981' },
    { name: 'Completed', position: 5, color: '#06b6d4' },
    { name: 'Cancelled', position: 6, color: '#ef4444' },
  ],
  entityConfigs: {
    contacts: {
      tableName: 'contacts',
      label: 'Student',
      pluralLabel: 'Students',
      fields: [
        { key: 'student_id', label: 'Student ID', type: 'text' },
        { key: 'parent_name', label: 'Parent Name', type: 'text' },
        { key: 'parent_mobile', label: 'Parent Mobile', type: 'text' },
        { key: 'school_college', label: 'School / College', type: 'text' },
        { key: 'class_grade', label: 'Class / Grade', type: 'text' },
        { key: 'course', label: 'Course', type: 'text' },
        { key: 'batch', label: 'Batch', type: 'text' },
      ],
    },
  },
};
export * from './sidebar';
export * from './dashboard';
export * from './entities';
export * from './system-prompt';
export * from './knowledge-template';
export * from './campaign-template';
export * from './copilot';
export * from './workflows';
