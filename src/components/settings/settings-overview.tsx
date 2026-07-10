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
  BookOpenCheck
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { THEMES } from '@/lib/themes';
import { CURRENCIES } from '@/lib/currency';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
    features: ['Patient Communication', 'Appointment Booking', 'Doctor Directory', 'AI Receptionist'],
    icon: Stethoscope,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/5 hover:bg-emerald-500/10',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
  },
  {
    id: 'coaching',
    name: 'Coaching Institute',
    description: 'AI Admission Assistant',
    features: ['Student Communication', 'Course Enquiries', 'Admission Management', 'AI Counselor'],
    icon: GraduationCap,
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/5 hover:bg-indigo-500/10',
    border: 'border-indigo-500/20 hover:border-indigo-500/40',
  },
  {
    id: 'real_estate',
    name: 'Real Estate',
    description: 'AI Property Consultant',
    features: ['Lead Management', 'Property Enquiries', 'Site Visits', 'AI Sales Assistant'],
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
    features: ['Student Communication', 'Course Management', 'Enrollment Tracking', 'AI Tutor'],
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
  const { user, profile, account, accountId, accountRole, defaultCurrency, canManageMembers, refreshProfile, refreshModules } =
    useAuth();
  const { mode, theme } = useTheme();

  const [counts, setCounts] = useState<OverviewCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);
  const [whatsapp, setWhatsapp] = useState<WhatsAppStatus | null>(null);
  const [whatsappLoading, setWhatsappLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [installationStep, setInstallationStep] = useState<'idle' | 'installing' | 'done'>('idle');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { label: 'Installing modules', status: 'idle' },
    { label: 'Creating dashboard', status: 'idle' },
    { label: 'Configuring AI', status: 'idle' },
    { label: 'Preparing Knowledge Base', status: 'idle' },
    { label: 'Preparing Campaign Templates', status: 'idle' },
    { label: 'Almost Ready...', status: 'idle' }
  ]);

  const updateChecklistItem = (index: number, status: 'idle' | 'loading' | 'done') => {
    setChecklist(prev => prev.map((item, i) => i === index ? { ...item, status } : item));
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
      { label: 'Almost Ready...', status: 'idle' }
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
      await new Promise(r => setTimeout(r, 800));
      updateChecklistItem(0, 'done');

      updateChecklistItem(1, 'loading');
      await new Promise(r => setTimeout(r, 800));
      updateChecklistItem(1, 'done');

      updateChecklistItem(2, 'loading');
      await new Promise(r => setTimeout(r, 850));
      updateChecklistItem(2, 'done');

      updateChecklistItem(3, 'loading');
      await new Promise(r => setTimeout(r, 800));
      updateChecklistItem(3, 'done');

      updateChecklistItem(4, 'loading');

      const response = await fetch('/api/account/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: selectedIndustry
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to apply workspace template');

      updateChecklistItem(4, 'done');

      updateChecklistItem(5, 'loading');
      await new Promise(r => setTimeout(r, 800));
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
    if (!user || !accountId) return;
    let cancelled = false;
    const supabase = createClient();
    const userId = user.id;
    const acctId = accountId;

    // Cheap counts — resolve fast, render immediately.
    (async () => {
      setCountsLoading(true);
      const [membersRes, invitesRes, templatesTotal, templatesPending, tagsRes, fieldsRes] =
        await Promise.allSettled([
          fetch('/api/account/members', { cache: 'no-store' }).then((r) => r.json()),
          canManageMembers
            ? fetch('/api/account/invitations', { cache: 'no-store' }).then((r) =>
                r.json(),
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
          supabase.from('custom_fields').select('id', { count: 'exact', head: true }),
        ]);

      if (cancelled) return;

      const members =
        membersRes.status === 'fulfilled' && Array.isArray(membersRes.value?.members)
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
            ? templatesTotal.value.count ?? null
            : null,
        templatesPending:
          templatesPending.status === 'fulfilled'
            ? templatesPending.value.count ?? null
            : null,
        tags: tagsRes.status === 'fulfilled' ? tagsRes.value.count ?? null : null,
        customFields:
          fieldsRes.status === 'fulfilled' ? fieldsRes.value.count ?? null : null,
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
        fetch('/api/whatsapp/config', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      if (cancelled) return;
      setWhatsapp({
        configured: row.status === 'fulfilled' && !!row.value.data?.phone_number_id,
        connected: health.status === 'fulfilled' && !!health.value?.connected,
      });
      setWhatsappLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, accountId, canManageMembers]);

  const displayName = profile?.full_name || profile?.email || 'Your account';
  const initial = (profile?.full_name || profile?.email || 'U').charAt(0).toUpperCase();
  const roleMeta = accountRole ? ROLE_META[accountRole] : null;
  const RoleIcon = roleMeta?.icon;

  const currencyLabel =
    CURRENCIES.find((c) => c.code === defaultCurrency)?.label ?? defaultCurrency;
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
          <AvatarFallback className="bg-primary/10 text-xl text-primary">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-foreground">
            {displayName}
          </div>
          {profile?.email ? (
            <div className="truncate text-sm text-muted-foreground">
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

      {/* Workspace Switcher / Reset Template */}
      <Card className="mt-4 flex flex-row items-center justify-between px-5 py-4 bg-card border border-border rounded-xl shadow-sm">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Workspace Business Template</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active industry configuration: <span className="font-bold text-indigo-600 dark:text-indigo-400 capitalize">{account?.industry?.replace('_', ' ') || 'General'}</span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenModal}
          className="cursor-pointer text-xs flex items-center gap-1 border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-red-900/30 dark:hover:bg-red-900/10 text-red-500 font-semibold"
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
                'group flex items-start gap-3.5 rounded-xl border border-border bg-card p-4 text-left transition-colors',
                'hover:border-primary-soft-2 hover:bg-card-2',
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {meta.label}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {loading ? (
                    <>
                      <Loader2 className="size-3 animate-spin" /> Loading…
                    </>
                  ) : (
                    subtitle
                  )}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          );
        })}
      </div>

      {/* Customize Dialog Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl p-6 flex flex-col gap-5 text-left animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">Change Workspace Business Template</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select a business type to automatically re-configure your workspace layout, AI assistant, and pipeline stages.
                </p>
              </div>
              {installationStep === 'idle' && (
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Modal Body */}
            {installationStep === 'idle' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[350px] overflow-y-auto pr-1">
                  {INDUSTRIES.map((ind) => {
                    const Icon = ind.icon;
                    const isSelected = selectedIndustry === ind.id;
                    return (
                      <button
                        key={ind.id}
                        onClick={() => setSelectedIndustry(ind.id)}
                        className={cn(
                          "text-left p-3.5 rounded-xl border flex flex-col gap-2 transition cursor-pointer relative group outline-none",
                          ind.bg, ind.border,
                          isSelected ? "ring-2 ring-primary border-primary shadow-sm scale-[1.01]" : "hover:scale-[1.01]"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className={cn("p-1.5 rounded-lg bg-background border border-border/50", ind.color)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          {isSelected && (
                            <div className="h-3.5 w-3.5 rounded-full bg-primary flex items-center justify-center text-[9px] text-primary-foreground font-bold">
                              ✓
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground group-hover:text-primary transition-colors text-xs">
                            {ind.name}
                          </h4>
                          <p className="text-muted-foreground text-[10px] leading-relaxed mt-0.5">
                            {ind.description}
                          </p>
                        </div>
                        <div className="space-y-1 border-t border-border/40 pt-1.5 mt-1">
                          <div className="flex flex-wrap gap-1">
                            {ind.features.slice(0, 3).map((feat) => (
                              <span key={feat} className="text-[8px] bg-background border border-border/50 text-muted-foreground px-1 py-0.2 rounded font-semibold">
                                {feat}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between border-t border-border pt-4">
                  <p className="text-[10px] text-muted-foreground italic">
                    * Changing templates resets existing default workflow automations.
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
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 font-semibold cursor-pointer disabled:opacity-50"
                    >
                      Apply Template Configuration
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="max-w-md mx-auto w-full py-6 space-y-5 text-center">
                <div className="space-y-1.5">
                  <h4 className="text-base font-bold text-foreground">Setting up your new workspace...</h4>
                  <p className="text-xs text-muted-foreground">Please wait while we install the selected dynamic module templates.</p>
                </div>
                <div className="bg-muted/30 border border-border/50 rounded-xl p-5 text-left space-y-3">
                  {checklist.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className={cn(
                        "font-semibold",
                        item.status === 'done' ? 'text-foreground' : item.status === 'loading' ? 'text-indigo-600 dark:text-indigo-400 font-bold animate-pulse' : 'text-muted-foreground'
                      )}>
                        {item.label}
                      </span>
                      <div>
                        {item.status === 'done' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : item.status === 'loading' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground/30" />
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
