'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  ChevronRight,
  Loader2,
  X,
  CheckCircle2,
  Circle,
  Building2,
  Stethoscope,
  Plane,
  GraduationCap,
  Utensils,
  Dumbbell,
  HelpCircle,
  BookOpenCheck,
  Sparkles,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { THEMES } from '@/lib/themes';
import { CURRENCIES } from '@/lib/currency';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import {
  SECTION_META,
  isSectionVisible,
  type SettingsSection,
} from './settings-sections';
import { SettingsChip, StatusDot } from './settings-chip';
import { ROLE_META } from './role-meta';

interface OverviewCounts {
  members: number | null;
  pendingInvites: number | null;
  templates: number | null;
  templatesPending: number | null;
  tags: number | null;
  customFields: number | null;
}

interface PilotReadiness {
  clinic: { name: string; industry: string | null };
  environment: string;
  integration: { whatsapp: { connected: boolean; provider: string | null } };
  config: {
    members: number | null;
    doctors: number | null;
    automations: number | null;
    knowledgeBaseArticles: number | null;
  };
  errors: {
    webhookDeadLetters: number | null;
    outboundFailed: number | null;
  };
  blockers: string[];
}

interface IndustryItem {
  id: string;
  name: string;
  description: string;
  features: string[];
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  border: string;
}

const INDUSTRIES: IndustryItem[] = [
  {
    id: 'hospital_clinic',
    name: 'Hospital & Clinic',
    description: 'AI Hospital Receptionist',
    features: [
      'Patient Communication',
      'Appointment Booking',
      'Doctor Directory',
      'AI Receptionist',
    ],
    icon: Stethoscope,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/5 hover:bg-emerald-500/10',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
  },
  {
    id: 'coaching',
    name: 'Coaching Institute',
    description: 'AI Admission Assistant',
    features: [
      'Student Communication',
      'Course Enquiries',
      'Admission Management',
      'AI Counselor',
    ],
    icon: GraduationCap,
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/5 hover:bg-indigo-500/10',
    border: 'border-indigo-500/20 hover:border-indigo-500/40',
  },
  {
    id: 'real_estate',
    name: 'Real Estate',
    description: 'AI Property Consultant',
    features: [
      'Lead Management',
      'Property Enquiries',
      'Site Visits',
      'AI Sales Assistant',
    ],
    icon: Building2,
    color: 'text-blue-500',
    bg: 'bg-blue-500/5 hover:bg-blue-500/10',
    border: 'border-blue-500/20 hover:border-blue-500/40',
  },
  {
    id: 'travel',
    name: 'Travel Agency',
    description: 'AI Travel Assistant',
    features: ['Booking Support', 'Tour Packages', 'Customer Communication'],
    icon: Plane,
    color: 'text-sky-500',
    bg: 'bg-sky-500/5 hover:bg-sky-500/10',
    border: 'border-sky-500/20 hover:border-sky-500/40',
  },
  {
    id: 'gym',
    name: 'Gym & Fitness',
    description: 'AI Membership Assistant',
    features: ['Member Support', 'Memberships', 'Class Booking'],
    icon: Dumbbell,
    color: 'text-red-500',
    bg: 'bg-red-500/5 hover:bg-red-500/10',
    border: 'border-red-500/20 hover:border-red-500/40',
  },
  {
    id: 'restaurant',
    name: 'Restaurant',
    description: 'AI Reservation Assistant',
    features: ['Table Reservation', 'Customer Communication', 'Order Support'],
    icon: Utensils,
    color: 'text-orange-500',
    bg: 'bg-orange-500/5 hover:bg-orange-500/10',
    border: 'border-orange-500/20 hover:border-orange-500/40',
  },
  {
    id: 'solo_teacher',
    name: 'Solo Teacher',
    description: 'AI Teaching Assistant',
    features: [
      'Student Communication',
      'Course Management',
      'Enrollment Tracking',
      'AI Tutor',
    ],
    icon: BookOpenCheck,
    color: 'text-violet-500',
    bg: 'bg-violet-500/5 hover:bg-violet-500/10',
    border: 'border-violet-500/20 hover:border-violet-500/40',
  },
  {
    id: 'salon',
    name: 'Salon & Spa',
    description: 'AI Salon Receptionist',
    features: [
      'Client Management',
      'Service Booking',
      'Stylist Directory',
      'AI Salon Receptionist',
    ],
    icon: Sparkles,
    color: 'text-pink-500',
    bg: 'bg-pink-500/5 hover:bg-pink-500/10',
    border: 'border-pink-500/20 hover:border-pink-500/40',
  },
  {
    id: 'other',
    name: 'Other Business',
    description: 'Create a custom workspace.',
    features: ['Custom Layouts', 'Flexible CRM Tools'],
    icon: HelpCircle,
    color: 'text-muted-foreground',
    bg: 'bg-muted/30 hover:bg-muted/60',
    border: 'border-border hover:border-muted-foreground/30',
  },
];

interface WhatsAppStatus {
  configured: boolean;
  connected: boolean;
}

interface ChecklistItem {
  label: string;
  status: 'idle' | 'loading' | 'done';
}

export function SettingsOverview({
  onSelect,
}: {
  onSelect: (section: SettingsSection) => void;
}) {
  const {
    user,
    profile,
    account,
    accountId,
    accountRole,
    defaultCurrency,
    canManageMembers,
  } = useAuth();
  const { mode, theme } = useTheme();

  const [counts, setCounts] = useState<OverviewCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);
  const [businessName, setBusinessName] = useState('');
  const [updatingName, setUpdatingName] = useState(false);
  const [whatsapp, setWhatsapp] = useState<WhatsAppStatus | null>(null);
  const [whatsappLoading, setWhatsappLoading] = useState(true);
  const [pilot, setPilot] = useState<PilotReadiness | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [installationStep, setInstallationStep] = useState<'idle' | 'installing' | 'done'>('idle');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { label: 'Installing modules', status: 'idle' },
    { label: 'Creating dashboard', status: 'idle' },
    { label: 'Configuring AI', status: 'idle' },
    { label: 'Preparing Knowledge Base', status: 'idle' },
    { label: 'Preparing Campaign Templates', status: 'idle' },
    { label: 'Almost Ready...', status: 'idle' },
  ]);

  const updateChecklistItem = (index: number, status: 'idle' | 'loading' | 'done') => {
    setChecklist((prev) => prev.map((item, i) => (i === index ? { ...item, status } : item)));
  };

  const handleOpenModal = () => {
    setSelectedIndustry(account?.industry || 'hospital_clinic');
    setInstallationStep('idle');
    setChecklist([
      { label: 'Installing modules', status: 'idle' },
      { label: 'Creating dashboard', status: 'idle' },
      { label: 'Configuring AI', status: 'idle' },
      { label: 'Preparing Knowledge Base', status: 'idle' },
      { label: 'Preparing Campaign Templates', status: 'idle' },
      { label: 'Almost Ready...', status: 'idle' },
    ]);
    setModalOpen(true);
  };

  const handleApplyTemplate = async () => {
    if (!selectedIndustry) {
      toast.error('Selecting a template is mandatory.');
      return;
    }

    setInstallationStep('installing');

    try {
      updateChecklistItem(0, 'loading');
      const onboardPromise = fetch('/api/account/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ industry: selectedIndustry }),
      });

      await new Promise((r) => setTimeout(r, 400));
      updateChecklistItem(0, 'done');
      updateChecklistItem(1, 'loading');
      await new Promise((r) => setTimeout(r, 400));
      updateChecklistItem(1, 'done');
      updateChecklistItem(2, 'loading');
      await new Promise((r) => setTimeout(r, 400));
      updateChecklistItem(2, 'done');
      updateChecklistItem(3, 'loading');
      await new Promise((r) => setTimeout(r, 400));
      updateChecklistItem(3, 'done');
      updateChecklistItem(4, 'loading');

      const response = await onboardPromise;
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to apply workspace template');
      }

      updateChecklistItem(4, 'done');
      updateChecklistItem(5, 'loading');
      await new Promise((r) => setTimeout(r, 300));
      updateChecklistItem(5, 'done');

      toast.success('Workspace updated successfully!');
      setModalOpen(false);
      setInstallationStep('idle');
      window.location.reload();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Template application failed.');
      setInstallationStep('idle');
    }
  };

  useEffect(() => {
    if (account?.name) setBusinessName(account.name);
  }, [account]);

  const handleUpdateBusinessName = async () => {
    if (!businessName.trim() || !accountId) return;
    setUpdatingName(true);
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: businessName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update business name');
      toast.success('Business name updated successfully!');
      window.location.reload();
    } catch (err: unknown) {
      toast.error('Failed to update business name: ' + (err as Error).message);
    } finally {
      setUpdatingName(false);
    }
  };

  useEffect(() => {
    if (!user || !accountId) return;
    let cancelled = false;

    (async () => {
      setCountsLoading(true);
      try {
        const res = await fetch('/api/settings/overview', { cache: 'no-store', credentials: 'include' });
        if (cancelled) return;
        if (res.ok) {
          const json = await res.json();
          if (json?.counts) setCounts(json.counts);
        }
      } catch (err) {
        console.warn('Failed to fetch settings overview counts:', err);
      } finally {
        if (!cancelled) setCountsLoading(false);
      }
    })();

    (async () => {
      setWhatsappLoading(true);
      try {
        const healthRes = await fetch('/api/whatsapp/config', { cache: 'no-store', credentials: 'include' });
        if (cancelled) return;
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          const healthConfig = healthData?.config as Record<string, unknown> | undefined;
          const isConfigured = Boolean(
            healthConfig?.phone_number_id ||
              healthConfig?.phoneNumberId ||
              healthData?.configured ||
              healthData?.status === 'connected' ||
              (healthData?.connected && healthData?.reason !== 'no_config')
          );
          const isConnected = Boolean(
            healthData?.connected === true ||
              healthData?.status === 'connected' ||
              healthConfig?.status === 'connected'
          );
          setWhatsapp({ configured: isConfigured, connected: isConnected });
        }
      } catch (err) {
        console.warn('Failed to fetch whatsapp status in settings:', err);
      } finally {
        if (!cancelled) setWhatsappLoading(false);
      }
    })();

    if (canManageMembers) {
      void (async () => {
        try {
          const res = await fetch('/api/pilot/readiness', { cache: 'no-store', credentials: 'include' });
          if (cancelled || !res.ok) return;
          const json = (await res.json()) as PilotReadiness;
          setPilot(json);
        } catch (err) {
          console.warn('Failed to fetch clinic readiness:', err);
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [user, accountId, canManageMembers]);

  const displayName = profile?.full_name || profile?.email || 'Your account';
  const initial = (profile?.full_name || profile?.email || 'U').charAt(0).toUpperCase();
  const roleMeta = accountRole ? ROLE_META[accountRole] : null;
  const RoleIcon = roleMeta?.icon;
  const currencyLabel = CURRENCIES.find((c) => c.code === defaultCurrency)?.label ?? defaultCurrency;
  const themeName = THEMES.find((t) => t.id === theme)?.name ?? theme;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const tiles: { section: SettingsSection; loading: boolean; subtitle: ReactNode }[] = [
    {
      section: 'whatsapp',
      loading: whatsappLoading,
      subtitle: !whatsapp?.configured ? 'Not set up yet' : whatsapp.connected ? <><StatusDot tone="ok" /> Connected</> : <><StatusDot tone="muted" /> Needs reconnecting</>,
    },
    {
      section: 'members',
      loading: countsLoading,
      subtitle: counts?.members == null ? 'View team members' : `${counts.members} member${counts.members === 1 ? '' : 's'}${counts.pendingInvites ? ` · ${counts.pendingInvites} pending invite${counts.pendingInvites === 1 ? '' : 's'}` : ''}`,
    },
    {
      section: 'templates',
      loading: countsLoading,
      subtitle: counts?.templates == null ? 'Manage message templates' : `${counts.templates} template${counts.templates === 1 ? '' : 's'}${counts.templatesPending ? ` · ${counts.templatesPending} pending review` : ''}`,
    },
    { section: 'deals', loading: false, subtitle: `${defaultCurrency} — ${currencyLabel}` },
    {
      section: 'fields',
      loading: countsLoading,
      subtitle: counts?.tags == null && counts?.customFields == null ? 'Tags and custom fields' : `${counts?.tags ?? 0} tag${counts?.tags === 1 ? '' : 's'} · ${counts?.customFields ?? 0} custom field${counts?.customFields === 1 ? '' : 's'}`,
    },
    { section: 'appearance', loading: false, subtitle: `${cap(mode)} mode · ${themeName} accent` },
    { section: 'insurance', loading: false, subtitle: 'Configure cashless claims & requirements' },
  ];

  return (
    <section className="animate-in fade-in-50 duration-200">
      <Card className="flex-row items-center gap-4 px-5 py-5">
        <Avatar size="lg" className="size-14">
          {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={displayName} /> : null}
          <AvatarFallback className="bg-primary/10 text-primary text-xl">{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="text-foreground truncate text-base font-semibold">{displayName}</div>
          {profile?.email ? <div className="text-muted-foreground truncate text-sm">{profile.email}</div> : null}
        </div>
        {roleMeta && RoleIcon ? <SettingsChip variant={roleMeta.variant}><RoleIcon />{roleMeta.label}</SettingsChip> : null}
      </Card>

      <Card className="bg-card border-border mt-4 space-y-4 rounded-xl border p-5 shadow-sm">
        <div>
          <h4 className="text-foreground text-sm font-semibold">Business Details</h4>
          <p className="text-muted-foreground mt-0.5 text-xs">This name appears in your automated PDF slips, WhatsApp bookings, and team invitations.</p>
        </div>
        <div className="flex max-w-md items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="workspace-name" className="text-muted-foreground text-xs font-semibold">Business / Workspace Name</Label>
            <Input id="workspace-name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Apollo Diagnostics" />
          </div>
          <Button size="sm" onClick={handleUpdateBusinessName} disabled={updatingName || businessName.trim() === (account?.name || '')} className="cursor-pointer rounded-lg bg-indigo-600 px-4 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{updatingName ? 'Saving...' : 'Save Name'}</Button>
        </div>
      </Card>

      {pilot ? (
        <Card className="bg-card border-border mt-4 space-y-3 rounded-xl border p-5 shadow-sm">
          <div>
            <h4 className="text-foreground text-sm font-semibold">Clinic readiness</h4>
            <p className="text-muted-foreground mt-0.5 text-xs">Operational status for this workspace. Counts only — no patient details.</p>
          </div>
          <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Clinic</dt><dd className="text-foreground truncate font-medium">{pilot.clinic.name}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Environment</dt><dd className="text-foreground font-medium capitalize">{pilot.environment}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">WhatsApp</dt><dd className="text-foreground flex items-center gap-1 font-medium"><StatusDot tone={pilot.integration.whatsapp.connected ? 'ok' : 'muted'} />{pilot.integration.whatsapp.connected ? `Connected${pilot.integration.whatsapp.provider ? ` · ${pilot.integration.whatsapp.provider}` : ''}` : 'Not connected'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Config</dt><dd className="text-foreground font-medium">{pilot.config.doctors ?? '—'} doctors · {pilot.config.automations ?? '—'} automations · {pilot.config.knowledgeBaseArticles ?? '—'} KB</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Errors</dt><dd className="text-foreground font-medium">{pilot.errors.webhookDeadLetters ?? 0} webhook · {pilot.errors.outboundFailed ?? 0} outbound</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Support needs</dt><dd className="text-foreground font-medium">{pilot.blockers.length ? pilot.blockers.join(', ') : 'None flagged'}</dd></div>
          </dl>
        </Card>
      ) : null}

      <Card className="bg-card border-border mt-4 flex flex-row items-center justify-between rounded-xl border px-5 py-4 shadow-sm">
        <div>
          <h4 className="text-foreground text-sm font-semibold">Workspace Business Template</h4>
          <p className="text-muted-foreground mt-0.5 text-xs">Active industry configuration: <span className="font-bold text-indigo-600 capitalize dark:text-indigo-400">{account?.industry?.replace('_', ' ') || 'General'}</span></p>
        </div>
        <Button variant="outline" size="sm" onClick={handleOpenModal} className="flex cursor-pointer items-center gap-1 border-red-200 text-xs font-semibold text-red-500 hover:bg-red-50 hover:text-red-600 dark:border-red-900/30 dark:hover:bg-red-900/10">Change Workspace Template</Button>
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.filter(({ section }) => isSectionVisible(section, account?.industry)).map(({ section, loading, subtitle }) => {
          const meta = SECTION_META[section];
          const Icon = meta.icon;
          return (
            <button key={section} type="button" onClick={() => onSelect(section)} className={cn('group border-border bg-card flex items-start gap-3.5 rounded-xl border p-4 text-left transition-colors', 'hover:border-primary-soft-2 hover:bg-card-2')}>
              <span className="bg-primary-soft text-primary flex size-9 shrink-0 items-center justify-center rounded-lg"><Icon className="size-4" /></span>
              <span className="min-w-0 flex-1"><span className="text-foreground block text-sm font-semibold">{meta.label}</span><span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">{loading ? <><Loader2 className="size-3 animate-spin" /> Loading…</> : subtitle}</span></span>
              <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </button>
          );
        })}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm sm:p-6">
          <div className="flex max-h-[92vh] w-full max-w-[980px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-7 py-5">
              <div className="min-w-0 pr-4">
                <h3 className="text-xl font-extrabold tracking-tight text-slate-900">Change Workspace Business Template</h3>
                <p className="mt-1 text-sm leading-5 text-slate-500">Select a business type to automatically re-configure your workspace layout, AI assistant, and pipeline stages.</p>
              </div>
              {installationStep === 'idle' && (
                <button type="button" onClick={() => setModalOpen(false)} aria-label="Close" className="shrink-0 rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"><X className="h-5 w-5" /></button>
              )}
            </div>

            {installationStep === 'idle' ? (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {INDUSTRIES.map((ind) => {
                      const Icon = ind.icon;
                      const isSelected = selectedIndustry === ind.id;
                      return (
                        <button
                          key={ind.id}
                          type="button"
                          onClick={() => setSelectedIndustry(ind.id)}
                          className={cn(
                            'group relative flex min-h-[174px] flex-col gap-3 rounded-2xl border p-5 text-left transition-all outline-none',
                            ind.bg,
                            ind.border,
                            isSelected ? 'ring-2 ring-emerald-500 border-emerald-400 shadow-[0_8px_24px_rgba(16,185,129,0.12)]' : 'hover:-translate-y-0.5 hover:shadow-sm'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border bg-white shadow-sm', ind.color, 'border-slate-200/80')}>
                              <Icon className="h-5 w-5" />
                            </div>
                            {isSelected && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                          </div>
                          <div>
                            <h4 className="text-[16px] font-bold leading-5 text-slate-900">{ind.name}</h4>
                            <p className="mt-1 text-[12px] leading-4 text-slate-500">{ind.description}</p>
                          </div>
                          <div className="mt-auto border-t border-slate-200/80 pt-3">
                            <div className="flex flex-wrap gap-1.5">
                              {ind.features.slice(0, 3).map((feat) => <span key={feat} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold leading-none text-slate-500">{feat}</span>)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/70 px-7 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-[560px] text-[11px] leading-4 text-slate-500 italic">* Changing templates resets existing default workflow automations.</p>
                  <div className="flex shrink-0 items-center justify-end gap-3">
                    <Button variant="outline" size="sm" onClick={() => setModalOpen(false)} className="rounded-xl px-4">Cancel</Button>
                    <Button size="sm" disabled={!selectedIndustry} onClick={handleApplyTemplate} className="min-w-[190px] rounded-xl bg-indigo-600 px-5 font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">Apply Template Configuration</Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="mx-auto w-full max-w-md space-y-5 px-7 py-10 text-center">
                <div className="space-y-1.5"><h4 className="text-lg font-bold text-slate-900">Setting up your new workspace...</h4><p className="text-sm text-slate-500">Please wait while we install the selected dynamic module templates.</p></div>
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left">{checklist.map((item, idx) => <div key={idx} className="flex items-center justify-between text-sm"><span className={cn('font-semibold', item.status === 'done' ? 'text-slate-900' : item.status === 'loading' ? 'animate-pulse font-bold text-indigo-600' : 'text-slate-500')}>{item.label}</span><div>{item.status === 'done' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : item.status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> : <Circle className="h-4 w-4 text-slate-300" />}</div></div>)}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
