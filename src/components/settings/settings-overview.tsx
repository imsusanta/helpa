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
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
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
import { useRouter } from 'next/navigation';

import { SECTION_META, type SettingsSection } from './settings-sections';
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

interface IndustryItem {
  id: string;
  name: string;
  description: string;
  features: string[];
  icon: React.ComponentType<any>;
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
    refreshProfile,
    refreshModules,
  } = useAuth();
  const { mode, theme } = useTheme();

  const [counts, setCounts] = useState<OverviewCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);
  const [businessName, setBusinessName] = useState('');
  const [updatingName, setUpdatingName] = useState(false);
  const [whatsapp, setWhatsapp] = useState<WhatsAppStatus | null>(null);
  const [whatsappLoading, setWhatsappLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [installationStep, setInstallationStep] = useState<
    'idle' | 'installing' | 'done'
  >('idle');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { label: 'Installing modules', status: 'idle' },
    { label: 'Creating dashboard', status: 'idle' },
    { label: 'Configuring AI', status: 'idle' },
    { label: 'Preparing Knowledge Base', status: 'idle' },
    { label: 'Preparing Campaign Templates', status: 'idle' },
    { label: 'Almost Ready...', status: 'idle' },
  ]);

  const updateChecklistItem = (
    index: number,
    status: 'idle' | 'loading' | 'done'
  ) => {
    setChecklist((prev) =>
      prev.map((item, i) => (i === index ? { ...item, status } : item))
    );
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
      await new Promise((r) => setTimeout(r, 800));
      updateChecklistItem(0, 'done');

      updateChecklistItem(1, 'loading');
      await new Promise((r) => setTimeout(r, 800));
      updateChecklistItem(1, 'done');

      updateChecklistItem(2, 'loading');
      await new Promise((r) => setTimeout(r, 850));
      updateChecklistItem(2, 'done');

      updateChecklistItem(3, 'loading');
      await new Promise((r) => setTimeout(r, 800));
      updateChecklistItem(3, 'done');

      updateChecklistItem(4, 'loading');

      const response = await fetch('/api/account/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: selectedIndustry,
        }),
      });

      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'Failed to apply workspace template');

      updateChecklistItem(4, 'done');

      updateChecklistItem(5, 'loading');
      await new Promise((r) => setTimeout(r, 800));
      updateChecklistItem(5, 'done');

      toast.success('Workspace updated successfully!');
      setModalOpen(false);
      setInstallationStep('idle');

      // Reload page to force recalculating sidebar items and clean context layouts
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Template application failed.');
      setInstallationStep('idle');
    }
  };

  useEffect(() => {
    if (account?.name) {
      setBusinessName(account.name);
    }
  }, [account]);

  const handleUpdateBusinessName = async () => {
    if (!businessName.trim() || !accountId) return;
    setUpdatingName(true);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ name: businessName.trim() })
        .eq('id', accountId);
      if (error) throw error;
      toast.success('Business name updated successfully!');
      window.location.reload();
    } catch (err: any) {
      toast.error('Failed to update business name: ' + err.message);
    } finally {
      setUpdatingName(false);
    }
  };

  useEffect(() => {
    if (!user || !accountId) return;
    let cancelled = false;
    const supabase = createClient();
    const userId = user.id;
    const acctId = accountId;

    // Cheap counts — resolve fast, render immediately.
    (async () => {
      setCountsLoading(true);
      const [
        membersRes,
        invitesRes,
        templatesTotal,
        templatesPending,
        tagsRes,
        fieldsRes,
      ] = await Promise.allSettled([
        fetch('/api/account/members', { cache: 'no-store' }).then((r) =>
          r.json()
        ),
        canManageMembers
          ? fetch('/api/account/invitations', { cache: 'no-store' }).then((r) =>
              r.json()
            )
          : Promise.resolve(null),
        supabase
          .from('message_templates')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        supabase
          .from('message_templates')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'PENDING'),
        supabase
          .from('tags')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        supabase
          .from('custom_fields')
          .select('id', { count: 'exact', head: true }),
      ]);

      if (cancelled) return;

      const members =
        membersRes.status === 'fulfilled' &&
        Array.isArray(membersRes.value?.members)
          ? membersRes.value.members.length
          : null;
      const pendingInvites =
        invitesRes.status === 'fulfilled' &&
        invitesRes.value &&
        Array.isArray(invitesRes.value.invitations)
          ? invitesRes.value.invitations.length
          : null;

      setCounts({
        members,
        pendingInvites,
        templates:
          templatesTotal.status === 'fulfilled'
            ? (templatesTotal.value.count ?? null)
            : null,
        templatesPending:
          templatesPending.status === 'fulfilled'
            ? (templatesPending.value.count ?? null)
            : null,
        tags:
          tagsRes.status === 'fulfilled' ? (tagsRes.value.count ?? null) : null,
        customFields:
          fieldsRes.status === 'fulfilled'
            ? (fieldsRes.value.count ?? null)
            : null,
      });
      setCountsLoading(false);
    })();

    // WhatsApp connection status — slower, independent.
    (async () => {
      setWhatsappLoading(true);
      const [row, health] = await Promise.allSettled([
        supabase
          .from('whatsapp_config')
          .select('phone_number_id')
          .eq('account_id', acctId)
          .maybeSingle(),
        fetch('/api/whatsapp/config', { cache: 'no-store' }).then((r) =>
          r.json()
        ),
      ]);
      if (cancelled) return;
      setWhatsapp({
        configured:
          row.status === 'fulfilled' && !!row.value.data?.phone_number_id,
        connected: health.status === 'fulfilled' && !!health.value?.connected,
      });
      setWhatsappLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, accountId, canManageMembers]);

  const displayName = profile?.full_name || profile?.email || 'Your account';
  const initial = (profile?.full_name || profile?.email || 'U')
    .charAt(0)
    .toUpperCase();
  const roleMeta = accountRole ? ROLE_META[accountRole] : null;
  const RoleIcon = roleMeta?.icon;

  const currencyLabel =
    CURRENCIES.find((c) => c.code === defaultCurrency)?.label ??
    defaultCurrency;
  const themeName = THEMES.find((t) => t.id === theme)?.name ?? theme;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // Per-tile loading + subtitle. `null` counts render as a graceful
  // fallback so a single failed query never blanks a tile.
  const tiles: {
    section: SettingsSection;
    loading: boolean;
    subtitle: ReactNode;
  }[] = [
    {
      section: 'whatsapp',
      loading: whatsappLoading,
      subtitle: !whatsapp?.configured ? (
        'Not set up yet'
      ) : whatsapp.connected ? (
        <>
          <StatusDot tone="ok" /> Connected
        </>
      ) : (
        <>
          <StatusDot tone="muted" /> Needs reconnecting
        </>
      ),
    },
    {
      section: 'members',
      loading: countsLoading,
      subtitle:
        counts?.members == null
          ? 'View team members'
          : `${counts.members} member${counts.members === 1 ? '' : 's'}${
              counts.pendingInvites
                ? ` · ${counts.pendingInvites} pending invite${
                    counts.pendingInvites === 1 ? '' : 's'
                  }`
                : ''
            }`,
    },
    {
      section: 'templates',
      loading: countsLoading,
      subtitle:
        counts?.templates == null
          ? 'Manage message templates'
          : `${counts.templates} template${counts.templates === 1 ? '' : 's'}${
              counts.templatesPending
                ? ` · ${counts.templatesPending} pending review`
                : ''
            }`,
    },
    {
      section: 'deals',
      loading: false,
      subtitle: `${defaultCurrency} — ${currencyLabel}`,
    },
    {
      section: 'fields',
      loading: countsLoading,
      subtitle:
        counts?.tags == null && counts?.customFields == null
          ? 'Tags and custom fields'
          : `${counts?.tags ?? 0} tag${counts?.tags === 1 ? '' : 's'} · ${
              counts?.customFields ?? 0
            } custom field${counts?.customFields === 1 ? '' : 's'}`,
    },
    {
      section: 'appearance',
      loading: false,
      subtitle: `${cap(mode)} mode · ${themeName} accent`,
    },
    {
      section: 'insurance',
      loading: false,
      subtitle: 'Configure cashless claims & requirements',
    },
  ];

  return (
    <section className="animate-in fade-in-50 duration-200">
      {/* Identity */}
      <Card className="flex-row items-center gap-4 px-5 py-5">
        <Avatar size="lg" className="size-14">
          {profile?.avatar_url ? (
            <AvatarImage src={profile.avatar_url} alt={displayName} />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-primary text-xl">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="text-foreground truncate text-base font-semibold">
            {displayName}
          </div>
          {profile?.email ? (
            <div className="text-muted-foreground truncate text-sm">
              {profile.email}
            </div>
          ) : null}
        </div>
        {roleMeta && RoleIcon ? (
          <SettingsChip variant={roleMeta.variant}>
            <RoleIcon />
            {roleMeta.label}
          </SettingsChip>
        ) : null}
      </Card>

      {/* Business Details Editor */}
      <Card className="bg-card border-border mt-4 space-y-4 rounded-xl border p-5 shadow-sm">
        <div>
          <h4 className="text-foreground text-sm font-semibold">
            Business Details
          </h4>
          <p className="text-muted-foreground mt-0.5 text-xs">
            This name appears in your automated PDF slips, WhatsApp bookings,
            and team invitations.
          </p>
        </div>
        <div className="flex max-w-md items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <Label
              htmlFor="workspace-name"
              className="text-muted-foreground text-xs font-semibold"
            >
              Business / Workspace Name
            </Label>
            <Input
              id="workspace-name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Apollo Diagnostics"
            />
          </div>
          <Button
            size="sm"
            onClick={handleUpdateBusinessName}
            disabled={
              updatingName || businessName.trim() === (account?.name || '')
            }
            className="cursor-pointer rounded-lg bg-indigo-600 px-4 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {updatingName ? 'Saving...' : 'Save Name'}
          </Button>
        </div>
      </Card>

      {/* Workspace Switcher / Reset Template */}
      <Card className="bg-card border-border mt-4 flex flex-row items-center justify-between rounded-xl border px-5 py-4 shadow-sm">
        <div>
          <h4 className="text-foreground text-sm font-semibold">
            Workspace Business Template
          </h4>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Active industry configuration:{' '}
            <span className="font-bold text-indigo-600 capitalize dark:text-indigo-400">
              {account?.industry?.replace('_', ' ') || 'General'}
            </span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenModal}
          className="flex cursor-pointer items-center gap-1 border-red-200 text-xs font-semibold text-red-500 hover:bg-red-50 hover:text-red-600 dark:border-red-900/30 dark:hover:bg-red-900/10"
        >
          Change Workspace Template
        </Button>
      </Card>

      {/* Status tiles */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map(({ section, loading, subtitle }) => {
          const meta = SECTION_META[section];
          const Icon = meta.icon;
          return (
            <button
              key={section}
              type="button"
              onClick={() => onSelect(section)}
              className={cn(
                'group border-border bg-card flex items-start gap-3.5 rounded-xl border p-4 text-left transition-colors',
                'hover:border-primary-soft-2 hover:bg-card-2'
              )}
            >
              <span className="bg-primary-soft text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-foreground block text-sm font-semibold">
                  {meta.label}
                </span>
                <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                  {loading ? (
                    <>
                      <Loader2 className="size-3 animate-spin" /> Loading…
                    </>
                  ) : (
                    subtitle
                  )}
                </span>
              </span>
              <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </button>
          );
        })}
      </div>

      {/* Customize Dialog Modal */}
      {modalOpen && (
        <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 backdrop-blur-sm">
          <div className="bg-card border-border animate-in fade-in zoom-in flex w-full max-w-4xl flex-col gap-5 rounded-2xl border p-6 text-left shadow-2xl duration-150">
            {/* Modal Header */}
            <div className="border-border flex items-start justify-between border-b pb-3">
              <div>
                <h3 className="text-foreground text-lg font-bold">
                  Change Workspace Business Template
                </h3>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Select a business type to automatically re-configure your
                  workspace layout, AI assistant, and pipeline stages.
                </p>
              </div>
              {installationStep === 'idle' && (
                <button
                  onClick={() => setModalOpen(false)}
                  className="hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer rounded-lg p-1.5 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Modal Body */}
            {installationStep === 'idle' ? (
              <>
                <div className="grid max-h-[350px] grid-cols-1 gap-4 overflow-y-auto pr-1 md:grid-cols-2 lg:grid-cols-3">
                  {INDUSTRIES.map((ind) => {
                    const Icon = ind.icon;
                    const isSelected = selectedIndustry === ind.id;
                    return (
                      <button
                        key={ind.id}
                        onClick={() => setSelectedIndustry(ind.id)}
                        className={cn(
                          'group relative flex cursor-pointer flex-col gap-2 rounded-xl border p-3.5 text-left transition outline-none',
                          ind.bg,
                          ind.border,
                          isSelected
                            ? 'ring-primary border-primary scale-[1.01] shadow-sm ring-2'
                            : 'hover:scale-[1.01]'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div
                            className={cn(
                              'bg-background border-border/50 rounded-lg border p-1.5',
                              ind.color
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          {isSelected && (
                            <div className="bg-primary text-primary-foreground flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold">
                              ✓
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-foreground group-hover:text-primary text-xs font-bold transition-colors">
                            {ind.name}
                          </h4>
                          <p className="text-muted-foreground mt-0.5 text-[10px] leading-relaxed">
                            {ind.description}
                          </p>
                        </div>
                        <div className="border-border/40 mt-1 space-y-1 border-t pt-1.5">
                          <div className="flex flex-wrap gap-1">
                            {ind.features.slice(0, 3).map((feat) => (
                              <span
                                key={feat}
                                className="bg-background border-border/50 text-muted-foreground py-0.2 rounded border px-1 text-[8px] font-semibold"
                              >
                                {feat}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="border-border flex items-center justify-between border-t pt-4">
                  <p className="text-muted-foreground text-[10px] italic">
                    * Changing templates resets existing default workflow
                    automations.
                  </p>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setModalOpen(false)}
                      className="cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={!selectedIndustry}
                      onClick={handleApplyTemplate}
                      className="cursor-pointer rounded-lg bg-indigo-600 px-4 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Apply Template Configuration
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="mx-auto w-full max-w-md space-y-5 py-6 text-center">
                <div className="space-y-1.5">
                  <h4 className="text-foreground text-base font-bold">
                    Setting up your new workspace...
                  </h4>
                  <p className="text-muted-foreground text-xs">
                    Please wait while we install the selected dynamic module
                    templates.
                  </p>
                </div>
                <div className="bg-muted/30 border-border/50 space-y-3 rounded-xl border p-5 text-left">
                  {checklist.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs"
                    >
                      <span
                        className={cn(
                          'font-semibold',
                          item.status === 'done'
                            ? 'text-foreground'
                            : item.status === 'loading'
                              ? 'animate-pulse font-bold text-indigo-600 dark:text-indigo-400'
                              : 'text-muted-foreground'
                        )}
                      >
                        {item.label}
                      </span>
                      <div>
                        {item.status === 'done' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : item.status === 'loading' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                        ) : (
                          <Circle className="text-muted-foreground/30 h-4 w-4" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
