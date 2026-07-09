'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';

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

interface WhatsAppStatus {
  configured: boolean;
  connected: boolean;
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
  const [resetting, setResetting] = useState(false);

  const handleResetOnboarding = async () => {
    if (!confirm('Are you sure you want to change your workspace business type? This will allow you to select a new industry template, which will reset your sidebar modules, pipeline stages, knowledge base, and campaign templates.')) {
      return;
    }

    setResetting(true);
    try {
      const response = await fetch('/api/account/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to reset workspace template');

      toast.success('Workspace template reset successfully! Redirecting...');
      await refreshProfile();
      await refreshModules();
      window.location.href = '/dashboard'; // Force full page reload
    } catch (err: any) {
      toast.error(err.message || 'Reset failed.');
    } finally {
      setResetting(false);
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
          disabled={resetting}
          onClick={handleResetOnboarding}
          className="cursor-pointer text-xs flex items-center gap-1 border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-red-900/30 dark:hover:bg-red-900/10 text-red-500 font-semibold"
        >
          {resetting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
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
    </section>
  );
}
