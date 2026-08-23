import {
  BadgeDollarSign,
  Bot,
  Home,
  LayoutGrid,
  LineChart,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Package,
  Settings,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import type { SidebarNavItem } from './sidebar-navigation';
import type { NavigationFeatureStatus } from './sidebar-navigation';

export const NAVIGATION_FEATURE_STATUSES: Record<
  string,
  NavigationFeatureStatus
> = {
  services: 'PLACEHOLDER',
  whatsapp_setup: 'CREDENTIAL_GATED',
  integrations: 'CREDENTIAL_GATED',
};

/**
 * The product navigation registry. Visibility, role, route, and terminology
 * policy are applied by buildVisibleNavigation; renderers must not maintain
 * their own menu arrays.
 */
export const NAVIGATION_REGISTRY: SidebarNavItem<React.ElementType>[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: Home },
  {
    id: 'sales',
    label: 'Patient CRM',
    icon: LineChart,
    children: [
      { id: 'sales-leads', label: 'Leads', href: '/leads' },
      { id: 'sales-customers', label: 'Customers', href: '/customers' },
      { id: 'sales-deals', label: 'Deals', href: '/pipelines' },
      { id: 'sales-quotations', label: 'Quotations', href: '/quotations' },
    ],
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: MessageCircle,
    children: [
      {
        id: 'whatsapp-patient-list',
        label: 'Patient List',
        href: '/patients',
        hospitalOnly: true,
        activeHrefs: ['/contacts'],
      },
      { id: 'whatsapp-campaigns', label: 'Campaigns', href: '/broadcasts' },
      {
        id: 'whatsapp-api',
        label: 'WhatsApp API',
        href: '/settings?tab=whatsapp',
        roleMin: 'admin',
        featureKey: 'whatsapp_setup',
        badge: 'setup-required',
      },
    ],
  },
  {
    id: 'conversations',
    label: 'Conversations',
    icon: MessageSquare,
    children: [
      { id: 'conversations-inbox', label: 'Inbox', href: '/inbox' },
      {
        id: 'conversations-follow-ups',
        label: 'Follow-ups',
        href: '/follow-ups',
      },
      {
        id: 'conversations-meetings',
        label: 'Meetings',
        href: '/appointments',
      },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    children: [
      { id: 'marketing-campaigns', label: 'Campaigns', href: '/broadcasts' },
      {
        id: 'marketing-reports',
        label: 'Campaign Reports',
        href: '/campaign-reports',
      },
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
      {
        id: 'automation-assistant',
        label: 'AI Assistant',
        href: '/ai-assistant',
      },
      { id: 'automation-rules', label: 'Automations', href: '/automations' },
      {
        id: 'automation-knowledge',
        label: 'AI Knowledge Base',
        href: '/knowledge-base',
      },
    ],
  },
  {
    id: 'services',
    label: 'Products / Services',
    href: '/services',
    icon: Package,
    featureKey: 'services',
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
      },
    ],
  },
  {
    id: 'manage-tags',
    label: 'Tags',
    href: '/settings?tab=tags',
    icon: Settings2,
  },
  {
    id: 'integrations',
    label: 'Integrations & Channels',
    icon: LayoutGrid,
    children: [
      {
        id: 'integrations-catalog',
        label: 'Integration Catalog',
        href: '/integrations',
        roleMin: 'admin',
        featureKey: 'integrations',
        badge: 'setup-required',
      },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    children: [
      {
        id: 'settings-profile',
        label: 'Profile',
        href: '/settings?tab=profile',
      },
      {
        id: 'settings-team',
        label: 'Team Members',
        href: '/settings?tab=team',
      },
    ],
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
      {
        id: 'admin-subscriptions',
        label: 'Subscriptions',
        href: '/admin/subscriptions',
      },
      { id: 'admin-ai', label: 'AI Infrastructure', href: '/admin/ai' },
      { id: 'admin-payments', label: 'Payments', href: '/admin/payments' },
      {
        id: 'admin-whatsapp',
        label: 'WhatsApp Numbers',
        href: '/admin/whatsapp',
      },
      {
        id: 'admin-settings',
        label: 'System Settings',
        href: '/admin/settings',
      },
    ],
  },
];
