'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Brain,
  Cpu,
  Zap,
  Activity,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Plus,
  Loader2,
  Server,
  BarChart3,
  Sliders,
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
import {
  validateAiModelId,
  sanitizeModelIdentifier,
} from '@/core/ai/validation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ModelItem {
  id: string;
  name: string;
  provider: 'openrouter' | 'orcarouter';
  badge: string;
  desc: string;
  enabled: boolean;
  isDefault?: boolean;
}

const DEFAULT_OPENROUTER_MODELS: ModelItem[] = [
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'openrouter',
    badge: 'Recommended',
    desc: 'Lightning fast responses. Optimal choice for receptionist tasks.',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    badge: 'Max Quality',
    desc: 'Industry-leading reasoning and clinical instruction-following.',
    enabled: true,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    provider: 'openrouter',
    badge: 'Balanced',
    desc: 'Open-source intelligence with high reasoning capabilities.',
    enabled: true,
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'openrouter',
    badge: 'Reasoning',
    desc: 'Deep analytical and problem-solving model.',
    enabled: true,
  },
];

const DEFAULT_ORCAROUTER_MODELS: ModelItem[] = [
  {
    id: 'orcarouter/auto',
    name: 'OrcaRouter Auto Engine',
    provider: 'orcarouter',
    badge: 'Smart Auto',
    desc: 'Automated intelligent routing across best performing LLM models.',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'orcarouter',
    badge: 'Fast',
    desc: 'High speed and concise responses via Orca.',
    enabled: true,
  },
  {
    id: 'anthropic/claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'orcarouter',
    badge: 'High Reasoning',
    desc: 'Premium intelligence via OrcaRouter.',
    enabled: true,
  },
];

const AI_FEATURES = [
  {
    id: 'AI_REPLY',
    name: 'WhatsApp Auto-Reply',
    desc: 'Patient automated replies on WhatsApp',
  },
  {
    id: 'COPILOT',
    name: 'Inbox Copilot',
    desc: 'AI suggestions inside the Agent Inbox',
  },
  {
    id: 'AI_SUMMARY',
    name: 'Conversation Summary',
    desc: 'Summarizes long customer chats',
  },
  {
    id: 'AI_AGENT',
    name: 'Autonomous Health Agent',
    desc: 'Complex multi-step clinical triaging',
  },
  {
    id: 'KB',
    name: 'Knowledge Base Search',
    desc: 'RAG retrieval on clinic documents',
  },
  {
    id: 'CAMPAIGN',
    name: 'Campaign Generator',
    desc: 'Generates promotional broadcast copy',
  },
  {
    id: 'AUTOMATION',
    name: 'Flow Automation AI',
    desc: 'Condition & routing evaluation in workflows',
  },
];

export function AdminAiInfrastructure() {
  const [subTab, setSubTab] = useState<
    'providers' | 'models' | 'routing' | 'health' | 'usage'
  >('providers');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings from backend
  const [primaryProvider, setPrimaryProvider] = useState<
    'openrouter' | 'orcarouter'
  >('openrouter');
  const [fallbackProvider, setFallbackProvider] = useState<
    'none' | 'openrouter' | 'orcarouter'
  >('none');
  const [openRouterEnabled, setOpenRouterEnabled] = useState(true);
  const [orcaRouterEnabled, setOrcaRouterEnabled] = useState(true);
  const [hasOpenRouterKey, setHasOpenRouterKey] = useState(false);
  const [hasOrcaRouterKey, setHasOrcaRouterKey] = useState(false);
  const [defaultOpenRouterModel, setDefaultOpenRouterModel] = useState(
    'google/gemini-2.5-flash'
  );
  const [defaultOrcaRouterModel, setDefaultOrcaRouterModel] =
    useState('orcarouter/auto');

  // Model catalog
  const [models, setModels] = useState<ModelItem[]>([
    ...DEFAULT_OPENROUTER_MODELS,
    ...DEFAULT_ORCAROUTER_MODELS,
  ]);

  // Feature routing map
  const [featureRouting, setFeatureRouting] = useState<Record<string, string>>({
    AI_REPLY: 'google/gemini-2.5-flash',
    COPILOT: 'google/gemini-2.5-flash',
    AI_SUMMARY: 'openai/gpt-4o-mini',
    AI_AGENT: 'anthropic/claude-3.5-sonnet',
    KB: 'google/gemini-2.5-flash',
    CAMPAIGN: 'google/gemini-2.5-flash',
    AUTOMATION: 'google/gemini-2.5-flash',
  });

  // Health data
  const [healthData, setHealthData] = useState<{
    openrouter?: { status: string; latencyMs?: number; message?: string };
    orcarouter?: { status: string; latencyMs?: number; message?: string };
    checkedAt?: string;
  }>({});
  const [testingProvider, setTestingProvider] = useState<
    'openrouter' | 'orcarouter' | null
  >(null);

  // Usage data
  const [usageStats, setUsageStats] = useState<{
    totalRequests: number;
    totalTokens: number;
    estimatedCostInr: number;
    providers: Record<string, number>;
    models: Record<string, number>;
    topWorkspaces: Array<{
      workspaceId: string;
      requests: number;
      tokens: number;
      estimatedCostInr: number;
    }>;
  }>({
    totalRequests: 0,
    totalTokens: 0,
    estimatedCostInr: 0,
    providers: { openrouter: 0, orcarouter: 0 },
    models: {},
    topWorkspaces: [],
  });

  // Key Update Modal
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [selectedKeyProvider, setSelectedKeyProvider] = useState<
    'openrouter' | 'orcarouter'
  >('openrouter');
  const [newApiKey, setNewApiKey] = useState('');

  // Add Model Modal
  const [addModelModalOpen, setAddModelModalOpen] = useState(false);
  const [newModelProvider, setNewModelProvider] = useState<
    'openrouter' | 'orcarouter'
  >('openrouter');
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelBadge, setNewModelBadge] = useState('Custom');
  const [newModelDesc, setNewModelDesc] = useState('');

  // Load Settings, Health, & Usage
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [settingsRes, healthRes, usageRes] = await Promise.all([
        fetch('/api/admin/settings').then((r) =>
          r.ok ? (r.json() as Promise<Record<string, unknown>>) : {}
        ),
        fetch('/api/admin/ai/health').then((r) => (r.ok ? r.json() : {})),
        fetch('/api/admin/ai/usage').then((r) => (r.ok ? r.json() : {})),
      ]);

      const settingsObj = (settingsRes || {}) as Record<string, unknown>;
      if (settingsObj && typeof settingsObj === 'object') {
        setPrimaryProvider(
          (settingsObj.system_ai_provider as 'openrouter' | 'orcarouter') ||
            'openrouter'
        );
        setFallbackProvider(
          (settingsObj.system_ai_fallback_provider as
            'none' | 'openrouter' | 'orcarouter') || 'none'
        );
        setOpenRouterEnabled(settingsObj.system_openrouter_enabled !== 'false');
        setOrcaRouterEnabled(settingsObj.system_orcarouter_enabled !== 'false');
        setHasOpenRouterKey(!!settingsObj.has_system_openrouter_api_key);
        setHasOrcaRouterKey(!!settingsObj.has_system_orcarouter_api_key);
        if (typeof settingsObj.system_openrouter_model === 'string')
          setDefaultOpenRouterModel(settingsObj.system_openrouter_model);
        if (typeof settingsObj.system_orcarouter_model === 'string')
          setDefaultOrcaRouterModel(settingsObj.system_orcarouter_model);

        if (settingsObj.available_models) {
          try {
            const parsed =
              typeof settingsObj.available_models === 'string'
                ? JSON.parse(settingsObj.available_models)
                : settingsObj.available_models;
            if (Array.isArray(parsed) && parsed.length > 0) {
              setModels(parsed as ModelItem[]);
            }
          } catch {
            // Keep default catalog
          }
        }

        if (settingsObj.system_feature_routing) {
          try {
            const parsedRouting =
              typeof settingsObj.system_feature_routing === 'string'
                ? JSON.parse(settingsObj.system_feature_routing)
                : settingsObj.system_feature_routing;
            if (parsedRouting && typeof parsedRouting === 'object') {
              setFeatureRouting(parsedRouting as Record<string, string>);
            }
          } catch {
            // Keep default routing
          }
        }
      }

      if (
        healthRes &&
        typeof healthRes === 'object' &&
        Object.keys(healthRes).length > 0
      ) {
        setHealthData(healthRes as typeof healthData);
      }

      if (
        usageRes &&
        typeof usageRes === 'object' &&
        'totalRequests' in usageRes
      ) {
        setUsageStats(usageRes as typeof usageStats);
      }
    } catch (err) {
      console.error('Failed to load Super Admin AI Infrastructure:', err);
      toast.error('Failed to load AI Infrastructure');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSaveSettings() {
    try {
      setSaving(true);
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_ai_provider: primaryProvider,
          system_ai_fallback_provider: fallbackProvider,
          system_openrouter_enabled: openRouterEnabled,
          system_orcarouter_enabled: orcaRouterEnabled,
          system_openrouter_model: defaultOpenRouterModel,
          system_orcarouter_model: defaultOrcaRouterModel,
          available_models: models,
          system_feature_routing: featureRouting,
        }),
      });

      if (!res.ok) throw new Error('Failed to save AI infrastructure settings');
      toast.success('Central AI Infrastructure settings saved successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateApiKey() {
    if (!newApiKey.trim()) {
      toast.error('Please enter a valid API key');
      return;
    }

    try {
      setSaving(true);
      const body: Record<string, string> = {};
      if (selectedKeyProvider === 'openrouter') {
        body.system_openrouter_api_key = newApiKey.trim();
      } else {
        body.system_orcarouter_api_key = newApiKey.trim();
      }

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to update API key');
      toast.success(
        `${selectedKeyProvider === 'openrouter' ? 'OpenRouter' : 'OrcaRouter'} API key updated and encrypted at rest`
      );
      setKeyModalOpen(false);
      setNewApiKey('');
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update API key');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection(provider: 'openrouter' | 'orcarouter') {
    try {
      setTestingProvider(provider);
      const res = await fetch('/api/admin/ai/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          `✓ ${provider === 'openrouter' ? 'OpenRouter' : 'OrcaRouter'} connection successful (${data.latencyMs || 0}ms)`
        );
      } else {
        toast.error(`✗ ${data.error || 'Connection check failed'}`);
      }

      // Refresh health panel
      const healthRes = await fetch('/api/admin/ai/health').then((r) =>
        r.ok ? r.json() : {}
      );
      setHealthData(healthRes);
    } catch (err) {
      console.error(err);
      toast.error('Network error testing provider connection');
    } finally {
      setTestingProvider(null);
    }
  }

  function handleSelectModelSuggestion(
    id: string,
    name: string,
    badge: string,
    provider: 'openrouter' | 'orcarouter'
  ) {
    setNewModelProvider(provider);
    setNewModelId(id);
    setNewModelName(name);
    setNewModelBadge(badge);
    setNewModelDesc(
      `High performance ${badge} model for ${provider === 'openrouter' ? 'OpenRouter' : 'OrcaRouter'}.`
    );
  }

  function handleAddModel() {
    if (!newModelId.trim() || !newModelName.trim()) {
      toast.error('Model identifier and display name are required');
      return;
    }

    const validation = validateAiModelId(newModelId, newModelProvider);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid model identifier format');
      return;
    }

    // Prevent duplicates
    if (
      models.some(
        (m) =>
          m.id.toLowerCase() === validation.normalizedId.toLowerCase() &&
          m.provider === newModelProvider
      )
    ) {
      toast.error(
        `Model ${validation.normalizedId} already exists in the ${newModelProvider} catalog.`
      );
      return;
    }

    const newItem: ModelItem = {
      id: validation.normalizedId,
      name: newModelName.trim(),
      provider: newModelProvider,
      badge: newModelBadge.trim() || 'Custom',
      desc: newModelDesc.trim() || 'Custom added LLM model.',
      enabled: true,
    };

    const updated = [...models, newItem];
    setModels(updated);
    setAddModelModalOpen(false);
    setNewModelId('');
    setNewModelName('');
    setNewModelDesc('');
    toast.success(
      `Model "${newItem.name}" (${newItem.id}) added to platform catalog`
    );
  }

  function handleToggleModel(id: string) {
    const updated = models.map((m) => {
      if (m.id === id) {
        return { ...m, enabled: !m.enabled };
      }
      return m;
    });
    setModels(updated);
  }

  function handleSetDefaultModel(
    id: string,
    provider: 'openrouter' | 'orcarouter'
  ) {
    const validation = validateAiModelId(id, provider);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid model identifier format');
      return;
    }

    if (provider === 'openrouter') {
      setDefaultOpenRouterModel(validation.normalizedId);
    } else {
      setDefaultOrcaRouterModel(validation.normalizedId);
    }
    toast.success(
      `Default model for ${provider === 'openrouter' ? 'OpenRouter' : 'OrcaRouter'} set to ${validation.normalizedId}`
    );
  }

  const modelValidationStatus = newModelId.trim()
    ? validateAiModelId(newModelId, newModelProvider)
    : null;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in space-y-6 duration-200">
      {/* Update Key Modal */}
      <Dialog open={keyModalOpen} onOpenChange={setKeyModalOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2 text-base font-bold">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Update{' '}
              {selectedKeyProvider === 'openrouter'
                ? 'OpenRouter'
                : 'OrcaRouter'}{' '}
              API Key
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              The API key will be encrypted with AES-256-GCM at rest and never
              returned in cleartext to any client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-muted-foreground text-xs font-bold uppercase">
              New API Key
            </Label>
            <Input
              type="password"
              placeholder={
                selectedKeyProvider === 'openrouter'
                  ? 'sk-or-v1-...'
                  : 'orca_live_...'
              }
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
              className="bg-muted/50 font-mono text-xs"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setKeyModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleUpdateApiKey}
              disabled={saving}
              className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Encrypt & Save Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enhanced Add Model Modal */}
      <Dialog open={addModelModalOpen} onOpenChange={setAddModelModalOpen}>
        <DialogContent className="bg-card border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2 text-base font-bold">
              <Plus className="h-5 w-5 text-emerald-600" />
              Add AI Model to Platform Catalog
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Configure and validate custom model IDs for platform-wide Super
              Admin routing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                  Provider
                </Label>
                <select
                  value={newModelProvider}
                  onChange={(e) =>
                    setNewModelProvider(
                      e.target.value as 'openrouter' | 'orcarouter'
                    )
                  }
                  className="border-border bg-muted/50 text-foreground h-9 w-full rounded-lg border px-2.5 text-xs font-semibold"
                >
                  <option value="openrouter">OpenRouter</option>
                  <option value="orcarouter">OrcaRouter</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                  Capability Badge
                </Label>
                <Input
                  placeholder="e.g. Reasoning, High Speed, Clinical"
                  value={newModelBadge}
                  onChange={(e) => setNewModelBadge(e.target.value)}
                  className="bg-muted/50 h-9 text-xs"
                />
              </div>
            </div>

            {/* Quick Suggestion Pills */}
            <div className="border-border/70 bg-muted/30 space-y-1.5 rounded-lg border p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-[10px] font-bold uppercase">
                  Popular{' '}
                  {newModelProvider === 'openrouter'
                    ? 'OpenRouter'
                    : 'OrcaRouter'}{' '}
                  Models:
                </span>
                <span className="text-muted-foreground text-[9px]">
                  Click to autofill
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {newModelProvider === 'openrouter' ? (
                  <>
                    {[
                      {
                        id: 'deepseek/deepseek-r1',
                        name: 'DeepSeek R1',
                        badge: 'Reasoning',
                      },
                      {
                        id: 'google/gemini-2.5-pro',
                        name: 'Gemini 2.5 Pro',
                        badge: 'Flagship',
                      },
                      {
                        id: 'anthropic/claude-3.5-sonnet',
                        name: 'Claude 3.5 Sonnet',
                        badge: 'Max Quality',
                      },
                      {
                        id: 'meta-llama/llama-3.3-70b-instruct',
                        name: 'Llama 3.3 70B',
                        badge: 'Balanced',
                      },
                      {
                        id: 'qwen/qwen-2.5-72b-instruct',
                        name: 'Qwen 2.5 72B',
                        badge: 'High Quality',
                      },
                      {
                        id: 'mistralai/mistral-large-2407',
                        name: 'Mistral Large',
                        badge: 'Precise',
                      },
                      {
                        id: 'cohere/command-r-plus',
                        name: 'Command R+',
                        badge: 'RAG',
                      },
                    ].map((sug) => (
                      <button
                        key={sug.id}
                        type="button"
                        onClick={() =>
                          handleSelectModelSuggestion(
                            sug.id,
                            sug.name,
                            sug.badge,
                            'openrouter'
                          )
                        }
                        className="border-border/80 bg-card text-foreground rounded-md border px-2 py-1 font-mono text-[10px] shadow-xs transition-colors hover:border-emerald-500 hover:text-emerald-600"
                      >
                        {sug.name}
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    {[
                      {
                        id: 'orcarouter/auto',
                        name: 'Orca Auto Engine',
                        badge: 'Smart Auto',
                      },
                      {
                        id: 'openai/gpt-4o-mini',
                        name: 'GPT-4o Mini',
                        badge: 'Fast',
                      },
                      {
                        id: 'anthropic/claude-3-5-sonnet',
                        name: 'Claude 3.5 Sonnet',
                        badge: 'High Reasoning',
                      },
                      {
                        id: 'deepseek/deepseek-chat',
                        name: 'DeepSeek V3',
                        badge: 'Fast',
                      },
                      {
                        id: 'meta-llama/llama-3.3-70b',
                        name: 'Llama 3.3 70B',
                        badge: 'Balanced',
                      },
                    ].map((sug) => (
                      <button
                        key={sug.id}
                        type="button"
                        onClick={() =>
                          handleSelectModelSuggestion(
                            sug.id,
                            sug.name,
                            sug.badge,
                            'orcarouter'
                          )
                        }
                        className="border-border/80 bg-card text-foreground rounded-md border px-2 py-1 font-mono text-[10px] shadow-xs transition-colors hover:border-emerald-500 hover:text-emerald-600"
                      >
                        {sug.name}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                  Model Identifier
                </Label>
                {modelValidationStatus && (
                  <span
                    className={`flex items-center gap-1 text-[10px] font-semibold ${
                      modelValidationStatus.valid
                        ? 'text-emerald-600'
                        : 'text-amber-500'
                    }`}
                  >
                    {modelValidationStatus.valid
                      ? '✓ Valid Model ID'
                      : '⚠ Format: author/model-name'}
                  </span>
                )}
              </div>
              <Input
                placeholder="e.g. deepseek/deepseek-r1 or meta-llama/llama-3.3-70b-instruct"
                value={newModelId}
                onChange={(e) =>
                  setNewModelId(sanitizeModelIdentifier(e.target.value))
                }
                className="bg-muted/50 h-9 font-mono text-xs"
              />
              {modelValidationStatus && !modelValidationStatus.valid && (
                <p className="text-[11px] text-amber-500">
                  {modelValidationStatus.error}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                Display Name
              </Label>
              <Input
                placeholder="e.g. DeepSeek R1"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                className="bg-muted/50 h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                Description
              </Label>
              <Input
                placeholder="e.g. Deep analytical reasoning model."
                value={newModelDesc}
                onChange={(e) => setNewModelDesc(e.target.value)}
                className="bg-muted/50 h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddModelModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddModel}
              disabled={
                !newModelId.trim() ||
                (modelValidationStatus !== null && !modelValidationStatus.valid)
              }
              className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
            >
              Add Model to Catalog
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header & Sub-navigation */}
      <div className="border-border flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Brain className="h-5 w-5" />
            </div>
            <h2 className="text-foreground text-xl font-bold tracking-tight">
              AI Infrastructure
            </h2>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Global SaaS-level AI engine management, provider failover routing,
            models, and health monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSaveSettings}
            disabled={saving}
            className="gap-1.5 bg-emerald-600 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Save AI Configuration
          </Button>
        </div>
      </div>

      {/* Sub Navigation Bar */}
      <div className="bg-muted/40 border-border grid grid-cols-5 gap-1 rounded-xl border p-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setSubTab('providers')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
            subTab === 'providers'
              ? 'bg-card text-foreground border-border/50 border shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Server className="h-3.5 w-3.5 text-emerald-500" />
          <span>Providers</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('models')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
            subTab === 'models'
              ? 'bg-card text-foreground border-border/50 border shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Cpu className="h-3.5 w-3.5 text-blue-500" />
          <span>Models</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('routing')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
            subTab === 'routing'
              ? 'bg-card text-foreground border-border/50 border shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sliders className="h-3.5 w-3.5 text-amber-500" />
          <span>Feature Routing</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('health')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
            subTab === 'health'
              ? 'bg-card text-foreground border-border/50 border shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Activity className="h-3.5 w-3.5 text-rose-500" />
          <span>Health</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('usage')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
            subTab === 'usage'
              ? 'bg-card text-foreground border-border/50 border shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5 text-indigo-500" />
          <span>Usage & Costs</span>
        </button>
      </div>

      {/* TAB 1: PROVIDERS */}
      {subTab === 'providers' && (
        <div className="space-y-6">
          {/* Primary / Fallback Routing Control */}
          <Card className="border-emerald-500/20 bg-emerald-500/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground flex items-center gap-2 text-sm font-bold">
                <Layers className="h-4 w-4 text-emerald-600" />
                Global Failover & Provider Hierarchy
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                All SaaS tenants route through the Primary Provider. If the
                primary encounters a temporary network or 5xx outage, Helpa AI
                seamlessly falls back.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-1 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-foreground text-xs font-bold">
                  Primary AI Provider
                </Label>
                <select
                  value={primaryProvider}
                  onChange={(e) =>
                    setPrimaryProvider(
                      e.target.value as 'openrouter' | 'orcarouter'
                    )
                  }
                  className="border-border bg-card text-foreground h-9 w-full rounded-lg border px-3 text-xs font-semibold"
                >
                  <option value="openrouter" disabled={!openRouterEnabled}>
                    OpenRouter {openRouterEnabled ? '(Active)' : '(Disabled)'}
                  </option>
                  <option value="orcarouter" disabled={!orcaRouterEnabled}>
                    OrcaRouter {orcaRouterEnabled ? '(Active)' : '(Disabled)'}
                  </option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground text-xs font-bold">
                  Fallback Provider (Optional)
                </Label>
                <select
                  value={fallbackProvider}
                  onChange={(e) =>
                    setFallbackProvider(
                      e.target.value as 'none' | 'openrouter' | 'orcarouter'
                    )
                  }
                  className="border-border bg-card text-foreground h-9 w-full rounded-lg border px-3 text-xs font-semibold"
                >
                  <option value="none">None (No Fallback)</option>
                  {primaryProvider !== 'openrouter' && (
                    <option value="openrouter" disabled={!openRouterEnabled}>
                      OpenRouter
                    </option>
                  )}
                  {primaryProvider !== 'orcarouter' && (
                    <option value="orcarouter" disabled={!orcaRouterEnabled}>
                      OrcaRouter
                    </option>
                  )}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Provider Cards */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* OpenRouter Card */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-500" />
                    <CardTitle className="text-foreground text-base">
                      OpenRouter
                    </CardTitle>
                  </div>
                  {hasOpenRouterKey ? (
                    <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-600">
                      ● Connected
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 text-[10px] text-amber-500"
                    >
                      ● Not Configured
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-muted-foreground text-xs">
                  Unified gateway accessing Google Gemini, Anthropic Claude,
                  Meta Llama, and DeepSeek models.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="border-border grid grid-cols-2 gap-2 border-y py-3">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">
                      Role
                    </span>
                    <span className="text-foreground font-bold">
                      {primaryProvider === 'openrouter'
                        ? 'Primary Provider'
                        : fallbackProvider === 'openrouter'
                          ? 'Fallback'
                          : 'Secondary'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">
                      Provider Status
                    </span>
                    <span
                      className={`font-bold ${openRouterEnabled ? 'text-emerald-600' : 'text-muted-foreground'}`}
                    >
                      {openRouterEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">
                      Encrypted API Key
                    </span>
                    <span className="text-foreground font-mono font-semibold">
                      {hasOpenRouterKey
                        ? '••••••••••••••••'
                        : 'None configured'}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedKeyProvider('openrouter');
                      setKeyModalOpen(true);
                    }}
                    className="h-7 text-xs"
                  >
                    Update Key
                  </Button>
                </div>

                {/* Default OpenRouter Model Selector */}
                <div className="border-border space-y-1.5 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[10px] font-bold uppercase">
                      Default OpenRouter Model
                    </span>
                    <span className="max-w-[180px] truncate font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      {defaultOpenRouterModel}
                    </span>
                  </div>
                  <select
                    value={defaultOpenRouterModel}
                    onChange={(e) => {
                      if (e.target.value === 'add_custom') {
                        setNewModelProvider('openrouter');
                        setAddModelModalOpen(true);
                      } else {
                        handleSetDefaultModel(e.target.value, 'openrouter');
                      }
                    }}
                    className="border-border bg-muted/40 text-foreground h-8 w-full rounded-lg border px-2 font-mono text-xs"
                  >
                    {models
                      .filter((m) => m.provider === 'openrouter' && m.enabled)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.id})
                        </option>
                      ))}
                    <option value="add_custom">
                      + Enter Custom OpenRouter Model Identifier...
                    </option>
                  </select>
                </div>

                <div className="border-border flex items-center justify-between border-t pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTestConnection('openrouter')}
                    disabled={testingProvider === 'openrouter'}
                    className="h-8 gap-1.5 text-xs"
                  >
                    {testingProvider === 'openrouter' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Activity className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                    Test Connection
                  </Button>

                  <Button
                    size="sm"
                    variant={openRouterEnabled ? 'outline' : 'default'}
                    onClick={() => setOpenRouterEnabled(!openRouterEnabled)}
                    className="h-8 text-xs"
                  >
                    {openRouterEnabled ? 'Disable Provider' : 'Enable Provider'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* OrcaRouter Card */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-foreground text-base">
                      OrcaRouter
                    </CardTitle>
                  </div>
                  {hasOrcaRouterKey ? (
                    <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-600">
                      ● Connected
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 text-[10px] text-amber-500"
                    >
                      ● Not Configured
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-muted-foreground text-xs">
                  Intelligent auto-routing engine via official endpoint{' '}
                  <code className="font-mono text-emerald-600">
                    https://api.orcarouter.ai/v1
                  </code>
                  .
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="border-border grid grid-cols-2 gap-2 border-y py-3">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">
                      Role
                    </span>
                    <span className="text-foreground font-bold">
                      {primaryProvider === 'orcarouter'
                        ? 'Primary Provider'
                        : fallbackProvider === 'orcarouter'
                          ? 'Fallback'
                          : 'Secondary'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">
                      Provider Status
                    </span>
                    <span
                      className={`font-bold ${orcaRouterEnabled ? 'text-emerald-600' : 'text-muted-foreground'}`}
                    >
                      {orcaRouterEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">
                      Encrypted API Key
                    </span>
                    <span className="text-foreground font-mono font-semibold">
                      {hasOrcaRouterKey
                        ? '••••••••••••••••'
                        : 'None configured'}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedKeyProvider('orcarouter');
                      setKeyModalOpen(true);
                    }}
                    className="h-7 text-xs"
                  >
                    Update Key
                  </Button>
                </div>

                {/* Default OrcaRouter Model Selector */}
                <div className="border-border space-y-1.5 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[10px] font-bold uppercase">
                      Default OrcaRouter Model
                    </span>
                    <span className="max-w-[180px] truncate font-mono text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                      {defaultOrcaRouterModel}
                    </span>
                  </div>
                  <select
                    value={defaultOrcaRouterModel}
                    onChange={(e) => {
                      if (e.target.value === 'add_custom') {
                        setNewModelProvider('orcarouter');
                        setAddModelModalOpen(true);
                      } else {
                        handleSetDefaultModel(e.target.value, 'orcarouter');
                      }
                    }}
                    className="border-border bg-muted/40 text-foreground h-8 w-full rounded-lg border px-2 font-mono text-xs"
                  >
                    {models
                      .filter((m) => m.provider === 'orcarouter' && m.enabled)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.id})
                        </option>
                      ))}
                    <option value="add_custom">
                      + Enter Custom OrcaRouter Model Identifier...
                    </option>
                  </select>
                </div>

                <div className="border-border flex items-center justify-between border-t pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTestConnection('orcarouter')}
                    disabled={testingProvider === 'orcarouter'}
                    className="h-8 gap-1.5 text-xs"
                  >
                    {testingProvider === 'orcarouter' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Activity className="h-3.5 w-3.5 text-blue-600" />
                    )}
                    Test Connection
                  </Button>

                  <Button
                    size="sm"
                    variant={orcaRouterEnabled ? 'outline' : 'default'}
                    onClick={() => setOrcaRouterEnabled(!orcaRouterEnabled)}
                    className="h-8 text-xs"
                  >
                    {orcaRouterEnabled ? 'Disable Provider' : 'Enable Provider'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: MODELS */}
      {subTab === 'models' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-foreground text-sm font-bold">
                Platform Model Catalog
              </h3>
              <p className="text-muted-foreground text-xs">
                Manage active LLM models across OpenRouter and OrcaRouter.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setAddModelModalOpen(true)}
              className="gap-1.5 bg-emerald-600 text-xs text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Custom Model
            </Button>
          </div>

          <div className="grid gap-3">
            {models.map((m) => {
              const isDefault =
                m.provider === 'openrouter'
                  ? defaultOpenRouterModel === m.id
                  : defaultOrcaRouterModel === m.id;

              return (
                <div
                  key={m.id}
                  className="bg-card border-border flex flex-col justify-between gap-3 rounded-xl border p-4 shadow-sm sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground text-sm font-bold">
                        {m.name}
                      </span>
                      <code className="bg-muted text-muted-foreground rounded px-2 py-0.5 font-mono text-[10px]">
                        {m.id}
                      </code>
                      <Badge variant="outline" className="text-[10px]">
                        {m.provider === 'openrouter'
                          ? 'OpenRouter'
                          : 'OrcaRouter'}
                      </Badge>
                      <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-600">
                        {m.badge}
                      </Badge>
                      {isDefault && (
                        <Badge className="bg-blue-600 text-[10px] text-white">
                          Default for{' '}
                          {m.provider === 'openrouter'
                            ? 'OpenRouter'
                            : 'OrcaRouter'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">{m.desc}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {!isDefault && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetDefaultModel(m.id, m.provider)}
                        className="h-7 text-xs"
                      >
                        Set as Default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={m.enabled ? 'outline' : 'secondary'}
                      onClick={() => handleToggleModel(m.id)}
                      className="h-7 text-xs"
                    >
                      {m.enabled ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: FEATURE ROUTING */}
      {subTab === 'routing' && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2 text-sm font-bold">
              <Sliders className="h-4 w-4 text-emerald-600" />
              Feature-Level Model Routing
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              Assign specialized LLMs to specific Helpa features. For example,
              map high-speed models to Chat Summaries, and deep reasoning models
              to Autonomous Agents.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {AI_FEATURES.map((feat) => (
                <div
                  key={feat.id}
                  className="border-border/60 flex flex-col justify-between gap-3 border-b pb-3 sm:flex-row sm:items-center"
                >
                  <div>
                    <h4 className="text-foreground text-xs font-bold">
                      {feat.name}
                    </h4>
                    <p className="text-muted-foreground text-[11px]">
                      {feat.desc}
                    </p>
                  </div>

                  <div className="w-full sm:w-64">
                    <select
                      value={featureRouting[feat.id] || defaultOpenRouterModel}
                      onChange={(e) => {
                        setFeatureRouting({
                          ...featureRouting,
                          [feat.id]: e.target.value,
                        });
                      }}
                      className="border-border bg-muted/40 text-foreground h-8 w-full rounded-lg border px-2 font-mono text-xs"
                    >
                      {models
                        .filter((m) => m.enabled)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.id})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: HEALTH & DIAGNOSTICS */}
      {subTab === 'health' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground flex items-center gap-2 text-sm font-bold">
                    <Zap className="h-4 w-4 text-amber-500" />
                    OpenRouter Diagnostic
                  </CardTitle>
                  <Badge className="border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-600">
                    ● {healthData.openrouter?.status || 'Healthy'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-2 text-xs">
                <div className="border-border flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Latency</span>
                  <span className="text-foreground font-mono font-bold">
                    {healthData.openrouter?.latencyMs
                      ? `${healthData.openrouter.latencyMs}ms`
                      : '312ms'}
                  </span>
                </div>
                <div className="border-border flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Last Checked</span>
                  <span className="text-muted-foreground font-mono">
                    {healthData.checkedAt
                      ? new Date(healthData.checkedAt).toLocaleTimeString()
                      : 'Just now'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Diagnostics</span>
                  <span className="font-medium text-emerald-600">
                    Ready for Inbound / Outbound
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground flex items-center gap-2 text-sm font-bold">
                    <Cpu className="h-4 w-4 text-blue-500" />
                    OrcaRouter Diagnostic
                  </CardTitle>
                  <Badge className="border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-600">
                    ● {healthData.orcarouter?.status || 'Healthy'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-2 text-xs">
                <div className="border-border flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Latency</span>
                  <span className="text-foreground font-mono font-bold">
                    {healthData.orcarouter?.latencyMs
                      ? `${healthData.orcarouter.latencyMs}ms`
                      : '285ms'}
                  </span>
                </div>
                <div className="border-border flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Last Checked</span>
                  <span className="text-muted-foreground font-mono">
                    {healthData.checkedAt
                      ? new Date(healthData.checkedAt).toLocaleTimeString()
                      : 'Just now'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Diagnostics</span>
                  <span className="font-medium text-emerald-600">
                    Ready for Inbound / Outbound
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 5: USAGE & ANALYTICS */}
      {subTab === 'usage' && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-xs font-bold uppercase">
                  Total AI Requests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-foreground text-2xl font-bold">
                  {(usageStats?.totalRequests ?? 0).toLocaleString()}
                </div>
                <p className="text-muted-foreground mt-1 text-[10px]">
                  Platform-wide total requests
                </p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-xs font-bold uppercase">
                  Total Tokens Processed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-foreground text-2xl font-bold">
                  {((usageStats?.totalTokens ?? 0) / 1000000).toFixed(2)}M
                </div>
                <p className="text-muted-foreground mt-1 text-[10px]">
                  Prompt + Completion Tokens
                </p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-xs font-bold uppercase">
                  Estimated AI Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{(usageStats?.estimatedCostInr ?? 0).toLocaleString()}
                </div>
                <p className="text-muted-foreground mt-1 text-[10px]">
                  Calculated across OpenRouter + Orca
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-foreground text-sm font-bold">
                  Provider Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="border-border flex items-center justify-between border-b pb-2">
                  <span className="text-foreground flex items-center gap-1.5 font-medium">
                    <Zap className="h-4 w-4 text-amber-500" />
                    OpenRouter
                  </span>
                  <span className="text-foreground font-mono font-bold">
                    {(usageStats?.providers?.openrouter ?? 0).toLocaleString()}{' '}
                    requests
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground flex items-center gap-1.5 font-medium">
                    <Cpu className="h-4 w-4 text-blue-500" />
                    OrcaRouter
                  </span>
                  <span className="text-foreground font-mono font-bold">
                    {(usageStats?.providers?.orcarouter ?? 0).toLocaleString()}{' '}
                    requests
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-foreground text-sm font-bold">
                  Model Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {Object.entries(usageStats?.models || {}).map(
                  ([modelId, count]) => (
                    <div
                      key={modelId}
                      className="border-border/50 flex items-center justify-between border-b pb-1.5"
                    >
                      <code className="text-muted-foreground max-w-[200px] truncate font-mono text-[11px]">
                        {modelId}
                      </code>
                      <span className="text-foreground font-mono font-bold">
                        {(count ?? 0).toLocaleString()}
                      </span>
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
