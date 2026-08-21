'use client';

import { useMemo, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { SettingsRail } from '@/components/settings/settings-rail';
import { SettingsOverview } from '@/components/settings/settings-overview';
import { ProfileForm } from '@/components/settings/profile-form';
import { SecurityPanel } from '@/components/settings/security-panel';
import { AppearancePanel } from '@/components/settings/appearance-panel';
import { WhatsAppConfig } from '@/components/settings/whatsapp-config';
import { TemplateManager } from '@/components/settings/template-manager';
import { FieldsAndTagsPanel } from '@/components/settings/fields-and-tags-panel';
import { DealsSettings } from '@/components/settings/deals-settings';
import { MembersTab } from '@/components/settings/members-tab';
import { AiPanel } from '@/components/settings/ai-panel';
import { KbPanel } from '@/components/settings/kb-panel';
import { BillingPanel } from '@/components/settings/billing-panel';
import { InsurancePanel } from '@/components/settings/insurance-panel';
import { ReminderPanel } from '@/components/settings/reminder-panel';
import { WelcomePanel } from '@/components/settings/welcome-panel';
import { BookingFormPanel } from '@/components/settings/booking-form-panel';
import {
  resolveSection,
  type SettingsSection,
} from '@/components/settings/settings-sections';

interface SettingsViewProps {
  initialTab?: string;
}

export function SettingsView({ initialTab }: SettingsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { defaultCurrency } = useAuth();
  const { mode } = useTheme();

  // URL query param `?tab=` takes priority if present, otherwise initialTab from route slug
  const queryTab = searchParams.get('tab');
  const section = resolveSection(queryTab || initialTab || null);

  const go = (next: SettingsSection) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  };

  const hints: Partial<Record<SettingsSection, ReactNode>> = useMemo(
    () => ({
      appearance: mode.charAt(0).toUpperCase() + mode.slice(1),
      deals: defaultCurrency,
    }),
    [mode, defaultCurrency]
  );

  const panel: Record<SettingsSection, ReactNode> = {
    overview: <SettingsOverview onSelect={go} />,
    profile: <ProfileForm />,
    security: <SecurityPanel />,
    appearance: <AppearancePanel />,
    whatsapp: <WhatsAppConfig />,
    welcome: <WelcomePanel />,
    templates: <TemplateManager />,
    fields: <FieldsAndTagsPanel />,
    deals: <DealsSettings />,
    members: <MembersTab />,
    ai: <AiPanel />,
    kb: <KbPanel />,
    billing: <BillingPanel />,
    insurance: <InsurancePanel />,
    reminders: <ReminderPanel />,
    booking_form: <BookingFormPanel />,
  };

  return (
    <div>
      <div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Everything in one place — your account and your workspace. Pick a
          section to manage it.
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[236px_minmax(0,1fr)] lg:items-start">
        <SettingsRail active={section} onSelect={go} hints={hints} />
        <div className="min-w-0">{panel[section]}</div>
      </div>
    </div>
  );
}
