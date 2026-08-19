'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  Database,
  Zap,
  Cpu,
  Lock,
  CheckCircle2,
  AlertCircle,
  Sliders,
} from 'lucide-react';
import { AdminNav } from './admin-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface PlatformConfig {
  default_trial_days: string;
  max_workspace_users_default: string;
  max_workspace_contacts_default: string;
  maintenance_mode: string;
}

export function AdminSettingsClient() {
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>({
    default_trial_days: '14',
    max_workspace_users_default: '5',
    max_workspace_contacts_default: '1000',
    maintenance_mode: 'false',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) {
        throw new Error('Failed to load platform settings');
      }
      const data = await res.json();
      if (data.settings) {
        setPlatformConfig({
          default_trial_days: data.settings.default_trial_days || '14',
          max_workspace_users_default:
            data.settings.max_workspace_users_default || '5',
          max_workspace_contacts_default:
            data.settings.max_workspace_contacts_default || '1000',
          maintenance_mode: data.settings.maintenance_mode || 'false',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading settings';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: platformConfig }),
      });

      if (!res.ok) {
        throw new Error('Failed to save settings');
      }

      toast.success('Platform quotas & defaults updated successfully');
      await fetchSettings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminNav onRefresh={fetchSettings} loading={loading} />

      {error ? (
        <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-center gap-3 rounded-2xl border p-4 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchSettings}
            className="ml-auto h-7 rounded-lg text-xs"
          >
            Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="text-primary h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Infrastructure Health & Platform Readiness Status */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border-border/60 bg-card/80 flex items-center justify-between rounded-2xl border p-3.5 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px]">
                    Database Platform
                  </span>
                  <p className="text-foreground flex items-center gap-1 text-xs font-semibold">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />{' '}
                    Connected
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-emerald-500/20 bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
              >
                Active
              </Badge>
            </div>

            <div className="border-border/60 bg-card/80 flex items-center justify-between rounded-2xl border p-3.5 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px]">
                    WhatsApp Cloud API
                  </span>
                  <p className="text-foreground flex items-center gap-1 text-xs font-semibold">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />{' '}
                    Operational
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-emerald-500/20 bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
              >
                v21.0
              </Badge>
            </div>

            <div className="border-border/60 bg-card/80 flex items-center justify-between rounded-2xl border p-3.5 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Cpu className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px]">
                    AI Routing Engine
                  </span>
                  <p className="text-foreground flex items-center gap-1 text-xs font-semibold">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Ready
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-purple-500/20 bg-purple-500/10 text-[10px] font-semibold text-purple-600 dark:text-purple-400"
              >
                Multi-Model
              </Badge>
            </div>

            <div className="border-border/60 bg-card/80 flex items-center justify-between rounded-2xl border p-3.5 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px]">
                    Secret Encryption
                  </span>
                  <p className="text-foreground flex items-center gap-1 text-xs font-semibold">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />{' '}
                    AES-256-GCM
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-blue-500/20 bg-blue-500/10 text-[10px] font-semibold text-blue-600 dark:text-blue-400"
              >
                Secured
              </Badge>
            </div>
          </div>

          {/* Platform Defaults & Quotas Settings Form */}
          <div className="border-border/60 bg-card/80 mx-auto max-w-2xl rounded-[1.35rem] border p-6 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)]">
            <div className="space-y-1 pb-4">
              <div className="flex items-center gap-2">
                <Sliders className="text-primary h-4 w-4" />
                <h3 className="text-foreground text-sm font-semibold">
                  Global Tenant Quotas & Defaults
                </h3>
              </div>
              <p className="text-muted-foreground text-xs">
                Set baseline quotas for new subscriber workspaces and trial
                duration.
              </p>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-foreground text-xs font-medium">
                  Default Trial Period (Days)
                </Label>
                <Input
                  type="number"
                  value={platformConfig.default_trial_days}
                  onChange={(e) =>
                    setPlatformConfig((prev) => ({
                      ...prev,
                      default_trial_days: e.target.value,
                    }))
                  }
                  className="border-border/80 h-9 rounded-xl text-xs"
                />
                <p className="text-muted-foreground text-[11px]">
                  Number of days allocated to new signups before requiring a
                  paid plan.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground text-xs font-medium">
                  Default Workspace Max Members
                </Label>
                <Input
                  type="number"
                  value={platformConfig.max_workspace_users_default}
                  onChange={(e) =>
                    setPlatformConfig((prev) => ({
                      ...prev,
                      max_workspace_users_default: e.target.value,
                    }))
                  }
                  className="border-border/80 h-9 rounded-xl text-xs"
                />
                <p className="text-muted-foreground text-[11px]">
                  Maximum team members a trial account can invite.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground text-xs font-medium">
                  Default Workspace Max Contacts
                </Label>
                <Input
                  type="number"
                  value={platformConfig.max_workspace_contacts_default}
                  onChange={(e) =>
                    setPlatformConfig((prev) => ({
                      ...prev,
                      max_workspace_contacts_default: e.target.value,
                    }))
                  }
                  className="border-border/80 h-9 rounded-xl text-xs"
                />
                <p className="text-muted-foreground text-[11px]">
                  Maximum CRM contacts stored before tier upgrade is prompted.
                </p>
              </div>

              <div className="border-border flex justify-end border-t pt-4">
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving}
                  className="h-9 rounded-xl px-5 text-xs font-semibold"
                >
                  {saving && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  )}
                  Save Platform Defaults
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
