'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Shield,
  Loader2,
  Database,
  Zap,
  Cpu,
  Lock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { AdminNav } from './admin-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
        <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-center gap-3 rounded-xl border p-4 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchSettings}
            className="ml-auto h-7 text-xs"
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
            <Card className="border-border bg-card shadow-none">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-lg">
                    <Database className="text-muted-foreground h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">
                      Database Platform
                    </span>
                    <p className="text-foreground mt-0.5 flex items-center gap-1 text-xs font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />{' '}
                      Connected
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 text-[10px] text-emerald-600 dark:text-emerald-400"
                >
                  Active
                </Badge>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-lg">
                    <Zap className="text-muted-foreground h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">
                      Meta Cloud API
                    </span>
                    <p className="text-foreground mt-0.5 flex items-center gap-1 text-xs font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />{' '}
                      Operational
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 text-[10px] text-emerald-600 dark:text-emerald-400"
                >
                  v21.0
                </Badge>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-lg">
                    <Cpu className="text-muted-foreground h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">
                      AI Routing Engine
                    </span>
                    <p className="text-foreground mt-0.5 flex items-center gap-1 text-xs font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />{' '}
                      Ready
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 text-[10px] text-emerald-600 dark:text-emerald-400"
                >
                  Multi-Model
                </Badge>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-lg">
                    <Lock className="text-muted-foreground h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">
                      Secret Encryption
                    </span>
                    <p className="text-foreground mt-0.5 flex items-center gap-1 text-xs font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />{' '}
                      AES-256-GCM
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-blue-500/30 text-[10px] text-blue-600 dark:text-blue-400"
                >
                  Secured
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Global Workspace Quotas & Settings */}
          <Card className="border-border bg-card max-w-2xl shadow-none">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-foreground text-sm font-semibold">
                Default Workspace Defaults & Limits
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                Default configuration automatically applied to newly provisioned
                subscriber workspaces
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label
                      htmlFor="trialDays"
                      className="text-muted-foreground text-xs font-medium"
                    >
                      Default Trial Days
                    </Label>
                    <Input
                      id="trialDays"
                      type="number"
                      value={platformConfig.default_trial_days}
                      onChange={(e) =>
                        setPlatformConfig((prev) => ({
                          ...prev,
                          default_trial_days: e.target.value,
                        }))
                      }
                      className="border-border bg-background text-foreground text-xs"
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label
                      htmlFor="defaultUsers"
                      className="text-muted-foreground text-xs font-medium"
                    >
                      Default Max Members
                    </Label>
                    <Input
                      id="defaultUsers"
                      type="number"
                      value={platformConfig.max_workspace_users_default}
                      onChange={(e) =>
                        setPlatformConfig((prev) => ({
                          ...prev,
                          max_workspace_users_default: e.target.value,
                        }))
                      }
                      className="border-border bg-background text-foreground text-xs"
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label
                      htmlFor="defaultContacts"
                      className="text-muted-foreground text-xs font-medium"
                    >
                      Default Max Contacts
                    </Label>
                    <Input
                      id="defaultContacts"
                      type="number"
                      value={platformConfig.max_workspace_contacts_default}
                      onChange={(e) =>
                        setPlatformConfig((prev) => ({
                          ...prev,
                          max_workspace_contacts_default: e.target.value,
                        }))
                      }
                      className="border-border bg-background text-foreground text-xs"
                    />
                  </div>
                </div>

                <div className="border-border flex items-center justify-between border-t pt-3">
                  <div className="flex items-center gap-2">
                    <Shield className="text-muted-foreground h-4 w-4" />
                    <span className="text-muted-foreground text-xs">
                      Platform Owner:{' '}
                      <strong className="text-foreground">Susanta Lohar</strong>
                    </span>
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={saving}
                    className="h-8 text-xs font-medium"
                  >
                    {saving && (
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    )}
                    Save Quotas
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
