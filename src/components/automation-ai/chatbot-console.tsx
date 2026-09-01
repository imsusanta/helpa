'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Bot,
  Loader2,
  Save,
  Wand2,
  MessageSquare,
  Gauge,
  Power,
  Lock,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { getIndustryAiPreset } from '@/lib/ai/industry-ai-presets';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import { ModuleHeader } from './module-header';
import { AiStatCard } from './ai-stat-card';
import { useAiStats } from './use-ai-stats';

type ResponseStyle = 'concise' | 'balanced' | 'detailed';

interface AiConfig {
  account_name: string;
  ai_available: boolean;
  usage_requests: number;
  max_requests: number;
  ai_system_prompt: string;
  welcome_message: string;
  chatbot_enabled: boolean;
  response_style: ResponseStyle;
}

const STYLE_LABELS: Record<ResponseStyle, string> = {
  concise: 'Concise — short, direct replies',
  balanced: 'Balanced — clear and friendly',
  detailed: 'Detailed — thorough with next steps',
};

export function ChatbotConsole({ embedded = false }: { embedded?: boolean }) {
  const { account, canEditSettings, profileLoading } = useAuth();
  const preset = getIndustryAiPreset(account?.industry);
  const {
    ai: aiStats,
    loading: statsLoading,
    refresh: refreshStats,
  } = useAiStats();

  // Editable configuration (admin+ only, sourced from /api/account/ai).
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [style, setStyle] = useState<ResponseStyle>('balanced');
  const [welcome, setWelcome] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/account/ai');
      if (!res.ok) {
        // Non-admins are forbidden here by design; fall back to the
        // read-only status shown from the stats endpoint.
        setConfig(null);
        return;
      }
      const data = (await res.json()) as AiConfig;
      setConfig(data);
      setEnabled(Boolean(data.chatbot_enabled));
      setStyle((data.response_style as ResponseStyle) || 'balanced');
      setWelcome(data.welcome_message || '');
      setPrompt(data.ai_system_prompt || '');
    } catch {
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profileLoading) return;
    if (canEditSettings) {
      void loadConfig();
    } else {
      setLoading(false);
    }
  }, [profileLoading, canEditSettings, loadConfig]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/account/ai', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ai_chatbot_enabled: enabled,
          ai_response_style: style,
          welcome_message: welcome,
          ai_system_prompt: prompt,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data?.error || `Failed to save ${preset.assistantRole} settings`
        );
      }
      toast.success(`${preset.assistantRole} settings saved`);
      if (data) {
        setConfig(data as AiConfig);
      }
      void refreshStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  // Effective status for the header badge / read-only view: the editable
  // state if we loaded config, otherwise the real value from stats.
  const effectiveEnabled = config
    ? enabled
    : (aiStats?.chatbot_enabled ?? true);

  return (
    <div className="space-y-6">
      {!embedded ? (
        <ModuleHeader
          icon={Bot}
          title={preset.assistantRole}
          description={`Your WhatsApp ${preset.assistantRole.toLowerCase()} replies automatically using the knowledge base and system prompt.`}
          badge={
            statsLoading && !config ? null : (
              <Badge variant={effectiveEnabled ? 'default' : 'secondary'}>
                {effectiveEnabled ? 'Active' : 'Paused'}
              </Badge>
            )
          }
        />
      ) : (
        <div className="space-y-1">
          <h2 className="text-foreground flex items-center gap-2 text-lg font-semibold">
            {preset.assistantRole}
            {statsLoading && !config ? null : (
              <Badge variant={effectiveEnabled ? 'default' : 'secondary'}>
                {effectiveEnabled ? 'Active' : 'Paused'}
              </Badge>
            )}
          </h2>
          <p className="text-muted-foreground text-sm">
            System prompt, welcome message, and auto-reply for WhatsApp.
          </p>
        </div>
      )}

      {/* Real overview metrics (viewer-readable). */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AiStatCard
          icon={Gauge}
          label="AI requests this month"
          value={
            aiStats
              ? `${aiStats.ai_requests_used.toLocaleString()} / ${aiStats.ai_requests_limit.toLocaleString()}`
              : '—'
          }
          sublabel={
            aiStats
              ? `${aiStats.ai_requests_remaining.toLocaleString()} remaining`
              : undefined
          }
          loading={statsLoading}
          accent="emerald"
        />
        <AiStatCard
          icon={MessageSquare}
          label="Conversations"
          value={aiStats ? aiStats.conversations.toLocaleString() : '—'}
          loading={statsLoading}
          accent="blue"
        />
        <AiStatCard
          icon={Power}
          label="Auto-reply status"
          value={effectiveEnabled ? 'On' : 'Off'}
          sublabel={aiStats ? STYLE_LABELS[aiStats.response_style] : undefined}
          loading={statsLoading}
          accent={effectiveEnabled ? 'violet' : 'amber'}
        />
      </div>

      {!canEditSettings ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4" /> {preset.assistantRole} configuration
            </CardTitle>
            <CardDescription>
              The auto-reply is currently{' '}
              <strong>{effectiveEnabled ? 'active' : 'paused'}</strong> with a{' '}
              <strong>{aiStats?.response_style ?? 'balanced'}</strong> response
              style. Only workspace admins and owners can change the{' '}
              {preset.assistantRole.toLowerCase()} configuration.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Auto-reply</CardTitle>
              <CardDescription>
                Master switch for the WhatsApp AI auto-reply. When off, incoming
                messages are never answered by AI — your team replies manually.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    Enable AI auto-reply
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Customers messaging your WhatsApp get instant AI answers.
                  </p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(v) => setEnabled(!!v)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Response style</Label>
                <Select
                  value={style}
                  onValueChange={(v) => v && setStyle(v as ResponseStyle)}
                >
                  <SelectTrigger className="w-full sm:w-80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STYLE_LABELS) as ResponseStyle[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STYLE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Welcome message</CardTitle>
              <CardDescription>
                Sent when a customer starts a new conversation. Leave blank to
                let the AI greet naturally.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={welcome}
                onChange={(e) => setWelcome(e.target.value)}
                rows={3}
                placeholder={preset.suggestedGreeting}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setWelcome(preset.suggestedGreeting)}
              >
                <Wand2 className="mr-2 h-4 w-4" />
                Use suggested greeting
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">System prompt</CardTitle>
              <CardDescription>
                Instructions that shape how your AI answers. Your knowledge base
                entries are automatically included at reply time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
              <div className="text-muted-foreground text-xs">
                <span className="text-foreground font-medium">
                  What your {preset.assistantRole.toLowerCase()} can do:
                </span>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {preset.capabilities.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save {preset.assistantRole} settings
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
