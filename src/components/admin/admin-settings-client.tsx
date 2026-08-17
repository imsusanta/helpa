'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Shield,
  Database,
  Cpu,
  Lock,
  Loader2,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AdminNav } from './admin-nav';

export function AdminSettingsClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [platformConfig, setPlatformConfig] = useState({
    default_trial_days: '14',
    max_workspace_users_default: '5',
    max_workspace_contacts_default: '1000',
    maintenance_mode: 'false',
  });

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        const s = data.settings || {};
        setPlatformConfig({
          default_trial_days: s.default_trial_days || '14',
          max_workspace_users_default: s.max_workspace_users_default || '5',
          max_workspace_contacts_default:
            s.max_workspace_contacts_default || '1000',
          maintenance_mode: s.maintenance_mode || 'false',
        });
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: platformConfig }),
      });

      if (res.ok) {
        toast.success('System settings updated successfully');
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update system settings');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error saving system settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminNav onRefresh={loadData} loading={loading} />

      <div className="space-y-6">
        <div>
          <h3 className="text-foreground text-sm font-semibold">
            System Diagnostics & Governance
          </h3>
          <p className="text-muted-foreground text-xs">
            Global platform parameters, default workspace quotas, and core infrastructure health
          </p>
        </div>

        {/* System Health Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card border-border shadow-none">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-lg">
                  <Database className="text-muted-foreground h-4 w-4" />
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Database (Appwrite)</span>
                  <p className="text-foreground text-xs font-semibold flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Connected
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px]">
                Active
              </Badge>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-none">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-lg">
                  <Zap className="text-muted-foreground h-4 w-4" />
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Meta Cloud API</span>
                  <p className="text-foreground text-xs font-semibold flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Operational
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px]">
                v21.0
              </Badge>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-none">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-lg">
                  <Cpu className="text-muted-foreground h-4 w-4" />
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">AI Routing Engine</span>
                  <p className="text-foreground text-xs font-semibold flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Ready
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px]">
                Multi-Model
              </Badge>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-none">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-lg">
                  <Lock className="text-muted-foreground h-4 w-4" />
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Secret Encryption</span>
                  <p className="text-foreground text-xs font-semibold flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> AES-256-GCM
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="border-blue-500/30 text-blue-600 dark:text-blue-400 text-[10px]">
                Secured
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Global Workspace Quotas */}
        <Card className="bg-card border-border max-w-2xl shadow-none">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-foreground text-sm font-semibold">
              Default Workspace Defaults & Limits
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              Default configuration applied to newly provisioned tenant workspaces
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
                    className="bg-background text-foreground border-border text-xs"
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
                    className="bg-background text-foreground border-border text-xs"
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
                    className="bg-background text-foreground border-border text-xs"
                  />
                </div>
              </div>

              <div className="border-border border-t pt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground text-xs">
                    Platform Owner: <strong className="text-foreground">Susanta Lohar</strong>
                  </span>
                </div>

                <Button
                  type="submit"
                  size="sm"
                  disabled={saving}
                  className="h-8 text-xs font-medium"
                >
                  {saving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                  Save Quotas
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
