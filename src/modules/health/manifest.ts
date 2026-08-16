import { IndustryModule } from '../types';
import { sidebarConfig } from './sidebar';
import { dashboardConfig } from './dashboard';
import { systemPromptConfig } from './system-prompt';
import { knowledgeTemplateConfig } from './knowledge-template';
import { campaignTemplateConfig } from './campaign-template';
import { copilotConfig } from './copilot';
import { workflowsConfig } from './workflows';

export const healthManifest: IndustryModule = {
  id: 'hospital_clinic',
  name: 'Health & Clinic',
  description: 'AI WhatsApp Receptionist for Hospitals & Clinics',
  aiRole: 'AI Hospital Receptionist',
  terminology: {
    contact: 'Patient',
    contacts: 'Patients',
    booking: 'Appointment',
    bookings: 'Appointments',
    staff: 'Doctor',
    staffMembers: 'Doctors',
    service: 'Consultation',
    services: 'Consultations',
  },
  features: {
    patients: true,
    doctors: true,
    appointments: true,
    lab_reports: true,
    follow_ups: true,
    courses: false,
    properties: false,
    services: false,
  },
  allowedRoutes: [
    '/dashboard',
    '/inbox',
    '/patients',
    '/contacts',
    '/doctors',
    '/appointments',
    '/follow-ups',
    '/lab-reports',
    '/broadcasts',
    '/knowledge-base',
    '/dashboard/analytics',
    '/settings',
  ],
  sidebar: sidebarConfig,
  dashboardMetrics: dashboardConfig,
  systemPrompt: systemPromptConfig,
  kbTemplates: knowledgeTemplateConfig,
  campaignTemplates: campaignTemplateConfig,
  copilotConfig: copilotConfig,
  workflows: workflowsConfig,
  pipelineStages: [
    { name: 'New Patient Registration', position: 1, color: '#3b82f6' },
    { name: 'Doctor Consultation Triage', position: 2, color: '#f59e0b' },
    { name: 'Diagnostic Testing / Labs', position: 3, color: '#ec4899' },
    { name: 'Treatment & Pharmacy', position: 4, color: '#8b5cf6' },
    { name: 'Discharged / Checked Out', position: 5, color: '#10b981' },
  ],
  entityConfigs: {
    contacts: {
      tableName: 'contacts',
      label: 'Patient',
      pluralLabel: 'Patients',
      fields: [
        { key: 'patient_id', label: 'Patient ID', type: 'text' },
        {
          key: 'blood_group',
          label: 'Blood Group',
          type: 'select',
          options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        },
        { key: 'age', label: 'Age', type: 'number' },
        { key: 'emergency_contact', label: 'Emergency Contact', type: 'text' },
        {
          key: 'insurance_provider',
          label: 'Insurance Provider',
          type: 'text',
        },
        { key: 'insurance_number', label: 'Insurance Number', type: 'text' },
        { key: 'preferred_doctor', label: 'Preferred Doctor', type: 'text' },
        {
          key: 'preferred_department',
          label: 'Preferred Department',
          type: 'text',
        },
        { key: 'allergies', label: 'Allergies', type: 'text' },
        { key: 'medical_notes', label: 'Medical Notes', type: 'text' },
      ],
    },
  },
};

export const healthModule = healthManifest;
