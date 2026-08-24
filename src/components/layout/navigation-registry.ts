import {
  BadgeDollarSign,
  Bot,
  Home,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { SidebarNavItem, NavigationFeatureStatus } from './sidebar-navigation';

export const NAVIGATION_FEATURE_STATUSES: Record<string, NavigationFeatureStatus> = {
  services: 'PLACEHOLDER',
  whatsapp_setup: 'CREDENTIAL_GATED',
  integrations: 'CREDENTIAL_GATED',
};

/** Canonical product navigation organized around the customer workflow. */
export const NAVIGATION_REGISTRY: SidebarNavItem<React.ElementType>[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: Home },
  {
    id: 'conversations',
    label: 'Conversations',
    icon: MessageSquare,
    children: [
      { id: 'conversations-inbox', label: 'Inbox', href: '/inbox' },
      { id: 'conversations-follow-ups', label: 'Follow-ups', href: '/follow-ups' },
      { id: 'conversations-appointments', label: 'Appointments', href: '/appointments' },
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: Users,
    children: [
      { id: 'crm-leads', label: 'Leads', href: '/leads' },
      { id: 'crm-contacts', label: 'Contacts', href: '/customers' },
      { id: 'crm-pipelines', label: 'Pipelines', href: '/pipelines' },
      { id: 'crm-quotations', label: 'Quotations', href: '/quotations' },
      { id: 'crm-tags', label: 'Tags', href: '/settings?tab=tags', roleMin: 'admin' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    children: [
      { id: 'marketing-campaigns', label: 'Campaigns', href: '/broadcasts' },
      { id: 'marketing-reports', label: 'Campaign Reports', href: '/campaign-reports' },
      { id: 'marketing-lead-forms', label: 'Lead Forms', href: '/lead-forms' },
    ],
  },
  {
    id: 'automation-ai',
    label: 'Automation & AI',
    icon: Bot,
    children: [
      { id: 'automation-chatbot', label: 'Chatbot', href: '/chatbot' },
      { id: 'automation-faq', label: 'FAQ Bot', href: '/faq-bot' },
      { id: 'automation-rules', label: 'Automations', href: '/automations' },
      { id: 'automation-knowledge', label: 'Knowledge Base', href: '/knowledge-base' },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    href: '/integrations',
    icon: MessageCircle,
    roleMin: 'admin',
    featureKey: 'integrations',
    badge: 'setup-required',
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: BadgeDollarSign,
    children: [
      { id: 'billing-invoices', label: 'Invoices', href: '/invoices' },
      {
        id: 'billing-settings',
        label: 'Billing Settings',
        href: '/settings?tab=billing',
        roleMin: 'admin',
      },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings?tab=profile',
    icon: Settings,
  },
  {
    id: 'admin',
    label: 'Admin Panel',
    icon: ShieldCheck,
    href: '/admin',
    superAdminOnly: true,
    children: [
      { id: 'admin-overview', label: 'Overview', href: '/admin' },
      { id: 'admin-tenants', label: 'Tenants', href: '/admin/tenants' },
      { id: 'admin-subscriptions', label: 'Subscriptions', href: '/admin/subscriptions' },
      { id: 'admin-ai', label: 'AI Infrastructure', href: '/admin/ai' },
      { id: 'admin-payments', label: 'Payments', href: '/admin/payments' },
      { id: 'admin-whatsapp', label: 'WhatsApp Numbers', href: '/admin/whatsapp' },
      { id: 'admin-settings', label: 'System Settings', href: '/admin/settings' },
    ],
  },
];
