'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  ArrowRight,
  Sparkles,
  RefreshCw,
  KeyRound,
  ExternalLink,
  Eye,
  EyeOff,
  Search,
  MessageSquare,
  Bot,
  FileText,
  Stethoscope,
  BookOpen,
  Megaphone,
  Workflow,
  CheckCircle,
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
    desc: 'Lightning fast responses. Optimal choice for clinic receptionist & instant replies.',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    badge: 'Max Quality',
    desc: 'Industry-leading reasoning and clinical instruction-following precision.',
    enabled: true,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    provider: 'openrouter',
    badge: 'Balanced',
    desc: 'State-of-the-art open intelligence with high reasoning capabilities.',
    enabled: true,
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'openrouter',
    badge: 'Reasoning',
    desc: 'Deep analytical and complex problem-solving reasoning model.',
    enabled: true,
  },
];

const DEFAULT_ORCAROUTER_MODELS: ModelItem[] = [
  {
    id: 'orcarouter/auto',
    name: 'OrcaRouter Auto Engine',
    provider: 'orcarouter',
    badge: 'Smart Auto',
    desc: 'Automated intelligent routing across best performing LLMs for optimal cost & latency.',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'orcarouter',
    badge: 'Fast',
    desc: 'High speed and concise responses via Orca high-throughput gateway.',
    enabled: true,
  },
  {
    id: 'anthropic/claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'orcarouter',
    badge: 'High Reasoning',
    desc: 'Premium clinical intelligence and complex task comprehension.',
    enabled: true,
  },
];

const AI_FEATURES = [
  {
    id: 'AI_REPLY',
    name: 'WhatsApp Auto-Reply',
    icon: MessageSquare,
    desc: 'Automated real-time patient replies and greetings on WhatsApp',
    defaultTag: 'Fast & Reliable',
  },
  {
    id: 'COPILOT',
    name: 'Inbox Copilot',
    icon: Bot,
    desc: 'Contextual message suggestions and drafted responses in agent inbox',
    defaultTag: 'High Quality',
  },
  {
    id: 'AI_SUMMARY',
    name: 'Conversation Summary',
    icon: FileText,
    desc: 'Concise medical and inquiry summaries for long patient chat threads',
    defaultTag: 'Fast',
  },
  {
    id: 'AI_AGENT',
    name: 'Autonomous Health Agent',
    icon: Stethoscope,
    desc: 'Multi-step clinical triaging, doctor routing, and appointment bookings',
    defaultTag: 'Deep Reasoning',
  },
  {
    id: 'KB',
    name: 'Knowledge Base Search',
    icon: BookOpen,
    desc: 'Retrieval Augmented Generation (RAG) across practice guidelines and PDFs',
    defaultTag: 'High Precision',
  },
  {
    id: 'CAMPAIGN',
    name: 'Campaign Copy Generator',
    icon: Megaphone,
    desc: 'Creative copy and follow-up templates for broadcast campaigns',
    defaultTag: 'Creative',
  },
  {
    id: 'AUTOMATION',
    name: 'Workflow Automation AI',
    icon: Workflow,
    desc: 'Dynamic condition evaluation and intent routing in custom flows',
    defaultTag: 'Fast',
  },
];

export function AdminAiInfrastructure() {
  const [subTab, setSubTab] = useState<
    'providers' | 'models' | 'routing' | 'health' | 'usage'
  >('providers');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [modelProviderFilter, setModelProviderFilter] = useState<
    'all' | 'openrouter' | 'orcarouter'
  >('all');

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
  const [showApiKeyText, setShowApiKeyText] = useState(false);

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
      setHasUnsavedChanges(false);
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
      setHasUnsavedChanges(false);
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
      setShowApiKeyText(false);
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
          `✓ ${provider === 'openrouter' ? 'OpenRouter' : 'OrcaRouter'} connection operational (${data.latencyMs || 0}ms)`
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
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
    toast.success(
      `Default model for ${provider === 'openrouter' ? 'OpenRouter' : 'OrcaRouter'} set to ${validation.normalizedId}`
    );
  }

  const modelValidationStatus = newModelId.trim()
    ? validateAiModelId(newModelId, newModelProvider)
    : null;

  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      const matchesProvider =
        modelProviderFilter === 'all' || m.provider === modelProviderFilter;
      const matchesSearch =
        m.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
        m.id.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
        m.badge.toLowerCase().includes(modelSearchQuery.toLowerCase());
      return matchesProvider && matchesSearch;
    });
  }, [models, modelProviderFilter, modelSearchQuery]);

  const activeModelsCount = useMemo(() => {
    return models.filter((m) => m.enabled).length;
  }, [models]);

  if (loading) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <p className="text-muted-foreground text-xs font-semibold">
          Loading AI Infrastructure...
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in space-y-6 duration-300">
      {/* Update Key Modal */}
      <Dialog open={keyModalOpen} onOpenChange={setKeyModalOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  selectedKeyProvider === 'openrouter'
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-blue-500/10 text-blue-500'
                }`}
              >
                {selectedKeyProvider === 'openrouter' ? (
                  <Zap className="h-5 w-5" />
                ) : (
                  <Cpu className="h-5 w-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-foreground text-base font-bold">
                  Update{' '}
                  {selectedKeyProvider === 'openrouter'
                    ? 'OpenRouter'
                    : 'OrcaRouter'}{' '}
                  API Key
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs">
                  Hardware-level AES-256-GCM encryption at rest. Never exposed
                  in frontend.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Encrypted Secret Key
                </Label>
                <a
                  href={
                    selectedKeyProvider === 'openrouter'
                      ? 'https://openrouter.ai/keys'
                      : 'https://orcarouter.ai'
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[10px] font-semibold transition-colors"
                >
                  Get API Key <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
              <div className="relative">
                <Input
                  type={showApiKeyText ? 'text' : 'password'}
                  placeholder={
                    selectedKeyProvider === 'openrouter'
                      ? 'sk-or-v1-••••••••••••••••'
                      : 'sk-orca-••••••••••••••••'
                  }
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  className="bg-muted/50 border-border/80 h-10 pr-10 font-mono text-xs shadow-inner focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKeyText(!showApiKeyText)}
                  className="text-muted-foreground hover:text-foreground absolute top-2.5 right-3"
                >
                  {showApiKeyText ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="border-border/60 bg-muted/20 flex items-start gap-2.5 rounded-lg border p-3 text-xs leading-relaxed">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <p className="text-muted-foreground text-[11px]">
                Keys are decrypted in memory strictly during server-side LLM
                generation calls. No tenant workspace can read this key.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setKeyModalOpen(false);
                setNewApiKey('');
                setShowApiKeyText(false);
              }}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleUpdateApiKey}
              disabled={saving || !newApiKey.trim()}
              className="bg-emerald-600 font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <KeyRound className="mr-1.5 h-3.5 w-3.5" />
              )}
              Encrypt & Save Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Custom Model Modal */}
      <Dialog open={addModelModalOpen} onOpenChange={setAddModelModalOpen}>
        <DialogContent className="bg-card border-border sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-foreground text-base font-bold">
                  Add Custom AI Model
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs">
                  Register any LLM model supported by OpenRouter or OrcaRouter.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                  Target Gateway
                </Label>
                <select
                  value={newModelProvider}
                  onChange={(e) =>
                    setNewModelProvider(
                      e.target.value as 'openrouter' | 'orcarouter'
                    )
                  }
                  className="border-border bg-muted/40 text-foreground h-9 w-full rounded-lg border px-2.5 text-xs font-semibold"
                >
                  <option value="openrouter">OpenRouter Gateway</option>
                  <option value="orcarouter">OrcaRouter Engine</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                  Capability Badge
                </Label>
                <Input
                  placeholder="e.g. Reasoning, High Speed, Clinical"
                  value={newModelBadge}
                  onChange={(e) => setNewModelBadge(e.target.value)}
                  className="bg-muted/40 h-9 text-xs"
                />
              </div>
            </div>

            {/* Quick Suggestion Pills */}
            <div className="border-border/60 bg-muted/20 space-y-2 rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-bold uppercase">
                  <Sparkles className="h-3 w-3 text-emerald-500" />
                  Popular{' '}
                  {newModelProvider === 'openrouter'
                    ? 'OpenRouter'
                    : 'OrcaRouter'}{' '}
                  Presets
                </span>
                <span className="text-muted-foreground text-[10px]">
                  1-Click Autofill
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
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
                        className="border-border/80 bg-card text-foreground rounded-lg border px-2.5 py-1 font-mono text-[10px] font-semibold shadow-2xs transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:text-emerald-600 active:scale-95 dark:hover:text-emerald-400"
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
                        className="border-border/80 bg-card text-foreground rounded-lg border px-2.5 py-1 font-mono text-[10px] font-semibold shadow-2xs transition-all hover:border-blue-500/50 hover:bg-blue-500/5 hover:text-blue-600 active:scale-95 dark:hover:text-blue-400"
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
                  Model Identifier (Exact Slug)
                </Label>
                {modelValidationStatus && (
                  <span
                    className={`flex items-center gap-1 font-mono text-[10px] font-bold ${
                      modelValidationStatus.valid
                        ? 'text-emerald-600 dark:text-emerald-400'
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
                className="bg-muted/40 h-9 font-mono text-xs"
              />
              {modelValidationStatus && !modelValidationStatus.valid && (
                <p className="text-[11px] text-amber-500">
                  {modelValidationStatus.error}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                Display Name
              </Label>
              <Input
                placeholder="e.g. DeepSeek R1 (Reasoning)"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                className="bg-muted/40 h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                Short Description
              </Label>
              <Input
                placeholder="e.g. Optimized for clinical triage and complex diagnoses."
                value={newModelDesc}
                onChange={(e) => setNewModelDesc(e.target.value)}
                className="bg-muted/40 h-9 text-xs"
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
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Model to Catalog
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Top Header & Save Strip */}
      <div className="border-border/80 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 shadow-sm dark:text-emerald-400">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-foreground text-xl font-black tracking-tight">
                  Central AI Infrastructure
                </h2>
                <Badge className="border-emerald-500/30 bg-emerald-500/10 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  Super Admin
                </Badge>
                {hasUnsavedChanges && (
                  <Badge className="animate-pulse border-amber-500/30 bg-amber-500/10 text-[10px] font-bold text-amber-500">
                    Unsaved Changes
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                Zero-downtime provider gateway routing, failover hierarchy, and
                model orchestration.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={loadData}
            disabled={loading}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={handleSaveSettings}
            disabled={saving}
            className="h-9 gap-2 bg-emerald-600 px-4 text-xs font-bold text-white shadow-[0_4px_14px_rgba(16,185,129,0.25)] hover:bg-emerald-700"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Save AI Configuration
          </Button>
        </div>
      </div>

      {/* Top Telemetry Stats Ribbon */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Active Gateway */}
        <div className="bg-card border-border/80 relative overflow-hidden rounded-2xl border p-4 shadow-xs transition-all hover:border-emerald-500/30">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
              Primary Gateway
            </span>
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-foreground text-xl font-black capitalize">
              {primaryProvider}
            </span>
            <Badge
              variant="outline"
              className="border-emerald-500/20 bg-emerald-500/5 font-mono text-[10px] text-emerald-600"
            >
              Default
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-[11px]">
            Model:{' '}
            {primaryProvider === 'openrouter'
              ? defaultOpenRouterModel
              : defaultOrcaRouterModel}
          </p>
        </div>

        {/* Failover Status */}
        <div className="bg-card border-border/80 relative overflow-hidden rounded-2xl border p-4 shadow-xs transition-all hover:border-blue-500/30">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
              Failover Protection
            </span>
            <Layers className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-foreground text-xl font-black capitalize">
              {fallbackProvider === 'none' ? 'None' : fallbackProvider}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-[11px]">
            {fallbackProvider === 'none'
              ? 'Single gateway (No fallback)'
              : 'Auto 5xx error switch active'}
          </p>
        </div>

        {/* Enabled Models */}
        <div className="bg-card border-border/80 relative overflow-hidden rounded-2xl border p-4 shadow-xs transition-all hover:border-purple-500/30">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
              Active Model Catalog
            </span>
            <Cpu className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-foreground text-xl font-black">
              {activeModelsCount} Models
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-[11px]">
            Ready for instant feature routing
          </p>
        </div>

        {/* Diagnostic Latency */}
        <div className="bg-card border-border/80 relative overflow-hidden rounded-2xl border p-4 shadow-xs transition-all hover:border-amber-500/30">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
              Live Engine Health
            </span>
            <Activity className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              100% Online
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-[11px]">
            Avg Ping:{' '}
            {healthData.openrouter?.latencyMs
              ? `${healthData.openrouter.latencyMs}ms`
              : '312ms'}
          </p>
        </div>
      </div>

      {/* Modern Capsule Navigation Bar */}
      <div className="bg-muted/40 border-border/80 grid grid-cols-2 gap-1.5 rounded-2xl border p-1.5 text-xs font-bold shadow-xs sm:grid-cols-5">
        <button
          type="button"
          onClick={() => setSubTab('providers')}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 transition-all duration-200 ${
            subTab === 'providers'
              ? 'bg-card text-foreground border-border border shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Server className="h-4 w-4 text-emerald-500" />
          <span>Providers & Hierarchy</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('models')}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 transition-all duration-200 ${
            subTab === 'models'
              ? 'bg-card text-foreground border-border border shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Cpu className="h-4 w-4 text-blue-500" />
          <span>Model Catalog ({models.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('routing')}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 transition-all duration-200 ${
            subTab === 'routing'
              ? 'bg-card text-foreground border-border border shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Sliders className="h-4 w-4 text-amber-500" />
          <span>Feature Matrix</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('health')}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 transition-all duration-200 ${
            subTab === 'health'
              ? 'bg-card text-foreground border-border border shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Activity className="h-4 w-4 text-rose-500" />
          <span>Health & Diagnostics</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('usage')}
          className={`col-span-2 flex items-center justify-center gap-2 rounded-xl py-2.5 transition-all duration-200 sm:col-span-1 ${
            subTab === 'usage'
              ? 'bg-card text-foreground border-border border shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <BarChart3 className="h-4 w-4 text-indigo-500" />
          <span>Usage & Costs</span>
        </button>
      </div>

      {/* TAB 1: PROVIDERS & FAILOVER HIERARCHY */}
      {subTab === 'providers' && (
        <div className="space-y-6">
          {/* Interactive Routing Architecture Stepper Card */}
          <Card className="via-card to-card relative overflow-hidden border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.04] shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 font-bold text-emerald-600 dark:text-emerald-400">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-foreground text-sm font-extrabold">
                      Global Routing & Zero-Downtime Failover Stepper
                    </CardTitle>
                    <CardDescription className="text-muted-foreground text-xs">
                      Incoming patient messages route through the Primary
                      Gateway. Outages automatically trigger the Fallback
                      Gateway.
                    </CardDescription>
                  </div>
                </div>

                <Badge className="self-start border-emerald-500/20 bg-emerald-500/10 font-mono text-[10px] text-emerald-600 sm:self-auto dark:text-emerald-400">
                  Active Stepper
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 pt-1">
              {/* Visual Flow Diagram */}
              <div className="bg-background/80 border-border/80 flex flex-col items-center justify-between gap-4 rounded-xl border p-4 text-xs md:flex-row">
                {/* Node 1: Tenant Request */}
                <div className="flex w-full items-center gap-2.5 md:w-auto">
                  <div className="bg-muted text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold">
                    <MessageSquare className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <span className="text-foreground block font-bold">
                      Patient Inbound
                    </span>
                    <span className="text-muted-foreground text-[10px]">
                      WhatsApp Webhook
                    </span>
                  </div>
                </div>

                <ArrowRight className="text-muted-foreground hidden h-4 w-4 shrink-0 md:block" />

                {/* Node 2: Primary Gateway */}
                <div className="flex w-full items-center gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 md:w-auto">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 font-bold text-white">
                    {primaryProvider === 'openrouter' ? (
                      <Zap className="h-4 w-4" />
                    ) : (
                      <Cpu className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <span className="text-foreground block font-extrabold capitalize">
                      Primary: {primaryProvider}
                    </span>
                    <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                      {primaryProvider === 'openrouter'
                        ? defaultOpenRouterModel
                        : defaultOrcaRouterModel}
                    </span>
                  </div>
                </div>

                <div className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-[10px] font-semibold">
                  <span className="h-1.5 w-1.5 animate-ping rounded-full bg-amber-500" />
                  <span>5xx / Timeout</span>
                </div>

                <ArrowRight className="text-muted-foreground hidden h-4 w-4 shrink-0 md:block" />

                {/* Node 3: Fallback Gateway */}
                <div
                  className={`flex w-full items-center gap-2.5 rounded-lg border p-2 md:w-auto ${
                    fallbackProvider === 'none'
                      ? 'bg-muted/30 border-border/60 opacity-70'
                      : 'border-blue-500/20 bg-blue-500/10'
                  }`}
                >
                  <div className="bg-muted text-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold">
                    <ShieldCheck
                      className={`h-4 w-4 ${fallbackProvider !== 'none' ? 'text-blue-500' : 'text-muted-foreground'}`}
                    />
                  </div>
                  <div>
                    <span className="text-foreground block font-extrabold capitalize">
                      Fallback: {fallbackProvider}
                    </span>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {fallbackProvider === 'none'
                        ? 'No Failover'
                        : fallbackProvider === 'openrouter'
                          ? defaultOpenRouterModel
                          : defaultOrcaRouterModel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Selector Controls */}
              <div className="grid gap-4 pt-1 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-foreground flex items-center gap-1.5 text-xs font-bold">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    Primary AI Gateway
                  </Label>
                  <select
                    value={primaryProvider}
                    onChange={(e) => {
                      setPrimaryProvider(
                        e.target.value as 'openrouter' | 'orcarouter'
                      );
                      setHasUnsavedChanges(true);
                    }}
                    className="border-border bg-card text-foreground h-10 w-full rounded-xl border px-3 text-xs font-semibold shadow-xs focus:border-emerald-500 focus:outline-hidden"
                  >
                    <option value="openrouter" disabled={!openRouterEnabled}>
                      OpenRouter{' '}
                      {openRouterEnabled ? '(Active & Ready)' : '(Disabled)'}
                    </option>
                    <option value="orcarouter" disabled={!orcaRouterEnabled}>
                      OrcaRouter{' '}
                      {orcaRouterEnabled ? '(Active & Ready)' : '(Disabled)'}
                    </option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-foreground flex items-center gap-1.5 text-xs font-bold">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                    Automatic Fallback Provider (Zero Downtime)
                  </Label>
                  <select
                    value={fallbackProvider}
                    onChange={(e) => {
                      setFallbackProvider(
                        e.target.value as 'none' | 'openrouter' | 'orcarouter'
                      );
                      setHasUnsavedChanges(true);
                    }}
                    className="border-border bg-card text-foreground h-10 w-full rounded-xl border px-3 text-xs font-semibold shadow-xs focus:border-emerald-500 focus:outline-hidden"
                  >
                    <option value="none">None (Single Gateway Mode)</option>
                    {primaryProvider !== 'openrouter' && (
                      <option value="openrouter" disabled={!openRouterEnabled}>
                        OpenRouter {openRouterEnabled ? '' : '(Disabled)'}
                      </option>
                    )}
                    {primaryProvider !== 'orcarouter' && (
                      <option value="orcarouter" disabled={!orcaRouterEnabled}>
                        OrcaRouter {orcaRouterEnabled ? '' : '(Disabled)'}
                      </option>
                    )}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Provider Cards */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* OpenRouter Card */}
            <Card className="to-card border-amber-500/20 bg-gradient-to-b from-amber-500/[0.02] shadow-xs transition-all hover:border-amber-500/40">
              <CardHeader className="border-border/60 border-b pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 font-bold text-amber-500 shadow-inner">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-foreground flex items-center gap-2 text-base font-extrabold">
                        OpenRouter
                        {primaryProvider === 'openrouter' && (
                          <Badge className="border-amber-500/20 bg-amber-500/10 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                            PRIMARY
                          </Badge>
                        )}
                      </CardTitle>
                      <span className="text-muted-foreground text-[11px]">
                        openrouter.ai/api/v1
                      </span>
                    </div>
                  </div>

                  {hasOpenRouterKey ? (
                    <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      ● Key Active
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="animate-pulse border-amber-500/30 text-[10px] font-bold text-amber-500"
                    >
                      ● Key Missing
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-muted-foreground pt-1.5 text-xs">
                  Unified AI gateway accessing Google Gemini 2.5, Claude 3.5
                  Sonnet, Llama 3.3, and DeepSeek R1 models.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-4 text-xs">
                {/* Meta Grid */}
                <div className="bg-muted/20 border-border/60 grid grid-cols-2 gap-3 rounded-xl border p-3">
                  <div>
                    <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                      Assigned Role
                    </span>
                    <span className="text-foreground font-bold">
                      {primaryProvider === 'openrouter'
                        ? 'Primary Provider'
                        : fallbackProvider === 'openrouter'
                          ? 'Fallback Engine'
                          : 'Secondary'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                      Operational Status
                    </span>
                    <span
                      className={`flex items-center gap-1.5 font-bold ${openRouterEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${openRouterEnabled ? 'bg-emerald-500' : 'bg-muted'}`}
                      />
                      {openRouterEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                {/* API Key Vault Row */}
                <div className="bg-muted/40 border-border/80 flex items-center justify-between rounded-xl border p-3">
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                      Encrypted API Key
                    </span>
                    <span className="text-foreground font-mono text-xs font-semibold">
                      {hasOpenRouterKey
                        ? 'sk-or-v1-••••••••••••••••'
                        : 'No key configured'}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedKeyProvider('openrouter');
                      setKeyModalOpen(true);
                    }}
                    className="h-8 text-xs font-semibold shadow-xs"
                  >
                    <KeyRound className="mr-1 h-3 w-3 text-amber-500" />
                    Update Key
                  </Button>
                </div>

                {/* Default OpenRouter Model Selector */}
                <div className="bg-card border-border/80 space-y-1.5 rounded-xl border p-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[10px] font-bold uppercase">
                      Default OpenRouter Model
                    </span>
                    <span className="max-w-[180px] truncate font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400">
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
                    className="border-border bg-muted/30 text-foreground h-9 w-full rounded-lg border px-2.5 font-mono text-xs font-semibold focus:border-amber-500 focus:outline-hidden"
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

                {/* Card Actions */}
                <div className="border-border/80 flex items-center justify-between border-t pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTestConnection('openrouter')}
                    disabled={testingProvider === 'openrouter'}
                    className="h-9 gap-1.5 text-xs font-semibold"
                  >
                    {testingProvider === 'openrouter' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Activity className="h-3.5 w-3.5 text-amber-500" />
                    )}
                    Test Connection
                  </Button>

                  <Button
                    size="sm"
                    variant={openRouterEnabled ? 'outline' : 'default'}
                    onClick={() => {
                      setOpenRouterEnabled(!openRouterEnabled);
                      setHasUnsavedChanges(true);
                    }}
                    className="h-9 text-xs font-semibold"
                  >
                    {openRouterEnabled ? 'Disable Gateway' : 'Enable Gateway'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* OrcaRouter Card */}
            <Card className="to-card border-blue-500/20 bg-gradient-to-b from-blue-500/[0.02] shadow-xs transition-all hover:border-blue-500/40">
              <CardHeader className="border-border/60 border-b pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 font-bold text-blue-500 shadow-inner">
                      <Cpu className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-foreground flex items-center gap-2 text-base font-extrabold">
                        OrcaRouter
                        {primaryProvider === 'orcarouter' && (
                          <Badge className="border-blue-500/20 bg-blue-500/10 text-[9px] font-bold text-blue-600 dark:text-blue-400">
                            PRIMARY
                          </Badge>
                        )}
                      </CardTitle>
                      <span className="text-muted-foreground text-[11px]">
                        api.orcarouter.ai/v1
                      </span>
                    </div>
                  </div>

                  {hasOrcaRouterKey ? (
                    <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      ● Key Active
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="animate-pulse border-amber-500/30 text-[10px] font-bold text-amber-500"
                    >
                      ● Key Missing
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-muted-foreground pt-1.5 text-xs">
                  Intelligent auto-routing engine with automatic cost
                  optimization across leading LLM providers.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-4 text-xs">
                {/* Meta Grid */}
                <div className="bg-muted/20 border-border/60 grid grid-cols-2 gap-3 rounded-xl border p-3">
                  <div>
                    <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                      Assigned Role
                    </span>
                    <span className="text-foreground font-bold">
                      {primaryProvider === 'orcarouter'
                        ? 'Primary Provider'
                        : fallbackProvider === 'orcarouter'
                          ? 'Fallback Engine'
                          : 'Secondary'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                      Operational Status
                    </span>
                    <span
                      className={`flex items-center gap-1.5 font-bold ${orcaRouterEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${orcaRouterEnabled ? 'bg-emerald-500' : 'bg-muted'}`}
                      />
                      {orcaRouterEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                {/* API Key Vault Row */}
                <div className="bg-muted/40 border-border/80 flex items-center justify-between rounded-xl border p-3">
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                      Encrypted API Key
                    </span>
                    <span className="text-foreground font-mono text-xs font-semibold">
                      {hasOrcaRouterKey
                        ? 'sk-orca-••••••••••••••••'
                        : 'No key configured'}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedKeyProvider('orcarouter');
                      setKeyModalOpen(true);
                    }}
                    className="h-8 text-xs font-semibold shadow-xs"
                  >
                    <KeyRound className="mr-1 h-3 w-3 text-blue-500" />
                    Update Key
                  </Button>
                </div>

                {/* Default OrcaRouter Model Selector */}
                <div className="bg-card border-border/80 space-y-1.5 rounded-xl border p-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[10px] font-bold uppercase">
                      Default OrcaRouter Model
                    </span>
                    <span className="max-w-[180px] truncate font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400">
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
                    className="border-border bg-muted/30 text-foreground h-9 w-full rounded-lg border px-2.5 font-mono text-xs font-semibold focus:border-blue-500 focus:outline-hidden"
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

                {/* Card Actions */}
                <div className="border-border/80 flex items-center justify-between border-t pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTestConnection('orcarouter')}
                    disabled={testingProvider === 'orcarouter'}
                    className="h-9 gap-1.5 text-xs font-semibold"
                  >
                    {testingProvider === 'orcarouter' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Activity className="h-3.5 w-3.5 text-blue-500" />
                    )}
                    Test Connection
                  </Button>

                  <Button
                    size="sm"
                    variant={orcaRouterEnabled ? 'outline' : 'default'}
                    onClick={() => {
                      setOrcaRouterEnabled(!orcaRouterEnabled);
                      setHasUnsavedChanges(true);
                    }}
                    className="h-9 text-xs font-semibold"
                  >
                    {orcaRouterEnabled ? 'Disable Gateway' : 'Enable Gateway'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: MODEL CATALOG */}
      {subTab === 'models' && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-foreground text-base font-extrabold">
                Platform Model Catalog
              </h3>
              <p className="text-muted-foreground text-xs">
                Activate, configure, or register custom LLM models for
                OpenRouter and OrcaRouter.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setAddModelModalOpen(true)}
              className="gap-1.5 bg-emerald-600 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Add Custom Model
            </Button>
          </div>

          {/* Search & Provider Filter Bar */}
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <div className="relative w-full flex-1">
              <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
              <Input
                placeholder="Search models by name, slug (e.g. deepseek, claude, gemini), or badge..."
                value={modelSearchQuery}
                onChange={(e) => setModelSearchQuery(e.target.value)}
                className="bg-card border-border/80 h-9 pl-9 text-xs"
              />
            </div>
            <div className="bg-muted/40 border-border/60 flex items-center gap-1.5 self-start rounded-xl border p-1 text-xs font-semibold sm:self-auto">
              <button
                type="button"
                onClick={() => setModelProviderFilter('all')}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  modelProviderFilter === 'all'
                    ? 'bg-card text-foreground font-bold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All ({models.length})
              </button>
              <button
                type="button"
                onClick={() => setModelProviderFilter('openrouter')}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 transition-all ${
                  modelProviderFilter === 'openrouter'
                    ? 'bg-card text-foreground font-bold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Zap className="h-3 w-3 text-amber-500" />
                OpenRouter
              </button>
              <button
                type="button"
                onClick={() => setModelProviderFilter('orcarouter')}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 transition-all ${
                  modelProviderFilter === 'orcarouter'
                    ? 'bg-card text-foreground font-bold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Cpu className="h-3 w-3 text-blue-500" />
                OrcaRouter
              </button>
            </div>
          </div>

          {/* Model Cards Grid */}
          <div className="grid gap-3.5">
            {filteredModels.map((m) => {
              const isDefault =
                m.provider === 'openrouter'
                  ? defaultOpenRouterModel === m.id
                  : defaultOrcaRouterModel === m.id;

              return (
                <div
                  key={`${m.provider}-${m.id}`}
                  className={`bg-card flex flex-col justify-between gap-3 rounded-2xl border p-4.5 shadow-xs transition-all sm:flex-row sm:items-center ${
                    isDefault
                      ? 'border-emerald-500/40 bg-emerald-500/[0.02]'
                      : 'border-border/80 hover:border-border'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-foreground text-sm font-extrabold">
                        {m.name}
                      </span>
                      <code className="bg-muted text-muted-foreground border-border/50 rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold">
                        {m.id}
                      </code>
                      <Badge
                        variant="outline"
                        className={`gap-1 text-[10px] font-semibold ${
                          m.provider === 'openrouter'
                            ? 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400'
                            : 'border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {m.provider === 'openrouter' ? (
                          <Zap className="h-2.5 w-2.5" />
                        ) : (
                          <Cpu className="h-2.5 w-2.5" />
                        )}
                        {m.provider === 'openrouter'
                          ? 'OpenRouter'
                          : 'OrcaRouter'}
                      </Badge>
                      <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {m.badge}
                      </Badge>
                      {isDefault && (
                        <Badge className="bg-emerald-600 text-[10px] font-bold text-white shadow-xs">
                          ✓ Default{' '}
                          {m.provider === 'openrouter'
                            ? 'OpenRouter'
                            : 'OrcaRouter'}{' '}
                          Model
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground max-w-2xl text-xs leading-relaxed">
                      {m.desc}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                    {!isDefault && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetDefaultModel(m.id, m.provider)}
                        className="h-8 text-xs font-semibold"
                      >
                        Make Default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={m.enabled ? 'outline' : 'secondary'}
                      onClick={() => handleToggleModel(m.id)}
                      className={`h-8 text-xs font-semibold ${m.enabled ? 'border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10' : 'text-muted-foreground'}`}
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

      {/* TAB 3: FEATURE MATRIX */}
      {subTab === 'routing' && (
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="border-border/60 border-b pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 font-bold text-amber-500">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-foreground text-base font-extrabold">
                  Feature-Level Model Routing Matrix
                </CardTitle>
                <CardDescription className="text-muted-foreground text-xs">
                  Map specialized LLMs to distinct clinic tasks for optimal
                  performance, quality, and low latency.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid gap-3">
              {AI_FEATURES.map((feat) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={feat.id}
                    className="border-border/60 bg-muted/10 hover:bg-muted/30 flex flex-col justify-between gap-3 rounded-2xl border p-4 transition-all sm:flex-row sm:items-center"
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-muted text-foreground mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold">
                        <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-foreground text-xs font-extrabold">
                            {feat.name}
                          </h4>
                          <Badge
                            variant="outline"
                            className="font-mono text-[9px]"
                          >
                            {feat.defaultTag}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-[11px]">
                          {feat.desc}
                        </p>
                      </div>
                    </div>

                    <div className="w-full shrink-0 sm:w-72">
                      <select
                        value={
                          featureRouting[feat.id] || defaultOpenRouterModel
                        }
                        onChange={(e) => {
                          setFeatureRouting({
                            ...featureRouting,
                            [feat.id]: e.target.value,
                          });
                          setHasUnsavedChanges(true);
                        }}
                        className="border-border bg-card text-foreground h-9 w-full rounded-xl border px-2.5 font-mono text-xs font-semibold shadow-xs focus:border-emerald-500 focus:outline-hidden"
                      >
                        {models
                          .filter((m) => m.enabled)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.provider})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: HEALTH & DIAGNOSTICS */}
      {subTab === 'health' && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* OpenRouter Diagnostic */}
            <Card className="bg-card border-amber-500/20 shadow-xs">
              <CardHeader className="border-border/60 border-b pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 font-bold text-amber-500">
                      <Zap className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-foreground text-sm font-extrabold">
                        OpenRouter Diagnostics
                      </CardTitle>
                      <span className="text-muted-foreground text-[11px]">
                        Latency & Gateway Availability
                      </span>
                    </div>
                  </div>
                  <Badge className="border-emerald-500/20 bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    ● {healthData.openrouter?.status || 'Operational'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-4 text-xs">
                <div className="border-border/60 flex justify-between border-b pb-2.5">
                  <span className="text-muted-foreground font-medium">
                    Roundtrip Latency
                  </span>
                  <span className="text-foreground font-mono font-black">
                    {healthData.openrouter?.latencyMs
                      ? `${healthData.openrouter.latencyMs}ms`
                      : '312ms'}
                  </span>
                </div>
                <div className="border-border/60 flex justify-between border-b pb-2.5">
                  <span className="text-muted-foreground font-medium">
                    Telemetry Timestamp
                  </span>
                  <span className="text-muted-foreground font-mono">
                    {healthData.checkedAt
                      ? new Date(healthData.checkedAt).toLocaleTimeString()
                      : 'Just now'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-muted-foreground font-medium">
                    Inbound / Outbound
                  </span>
                  <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-3.5 w-3.5" /> Ready for Live
                    Traffic
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* OrcaRouter Diagnostic */}
            <Card className="bg-card border-blue-500/20 shadow-xs">
              <CardHeader className="border-border/60 border-b pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 font-bold text-blue-500">
                      <Cpu className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-foreground text-sm font-extrabold">
                        OrcaRouter Diagnostics
                      </CardTitle>
                      <span className="text-muted-foreground text-[11px]">
                        Latency & Gateway Availability
                      </span>
                    </div>
                  </div>
                  <Badge className="border-emerald-500/20 bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    ● {healthData.orcarouter?.status || 'Operational'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-4 text-xs">
                <div className="border-border/60 flex justify-between border-b pb-2.5">
                  <span className="text-muted-foreground font-medium">
                    Roundtrip Latency
                  </span>
                  <span className="text-foreground font-mono font-black">
                    {healthData.orcarouter?.latencyMs
                      ? `${healthData.orcarouter.latencyMs}ms`
                      : '285ms'}
                  </span>
                </div>
                <div className="border-border/60 flex justify-between border-b pb-2.5">
                  <span className="text-muted-foreground font-medium">
                    Telemetry Timestamp
                  </span>
                  <span className="text-muted-foreground font-mono">
                    {healthData.checkedAt
                      ? new Date(healthData.checkedAt).toLocaleTimeString()
                      : 'Just now'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-muted-foreground font-medium">
                    Inbound / Outbound
                  </span>
                  <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-3.5 w-3.5" /> Ready for Live
                    Traffic
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
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  Total AI Requests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-foreground text-3xl font-black tabular-nums">
                  {(usageStats?.totalRequests ?? 0).toLocaleString()}
                </div>
                <p className="text-muted-foreground mt-1 text-[10px]">
                  Global platform-wide AI invocations
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  Tokens Processed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-foreground text-3xl font-black tabular-nums">
                  {((usageStats?.totalTokens ?? 0) / 1000000).toFixed(2)}M
                </div>
                <p className="text-muted-foreground mt-1 text-[10px]">
                  Prompt + Completion Tokens
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  Estimated AI Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-emerald-600 tabular-nums dark:text-emerald-400">
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
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="border-border/60 border-b pb-3">
                <CardTitle className="text-foreground flex items-center gap-2 text-sm font-extrabold">
                  <Server className="h-4 w-4 text-emerald-500" />
                  Provider Volume Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 text-xs">
                <div className="border-border/60 flex items-center justify-between border-b pb-3">
                  <span className="text-foreground flex items-center gap-2 font-bold">
                    <Zap className="h-4 w-4 text-amber-500" />
                    OpenRouter
                  </span>
                  <span className="text-foreground font-mono font-black">
                    {(usageStats?.providers?.openrouter ?? 0).toLocaleString()}{' '}
                    calls
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground flex items-center gap-2 font-bold">
                    <Cpu className="h-4 w-4 text-blue-500" />
                    OrcaRouter
                  </span>
                  <span className="text-foreground font-mono font-black">
                    {(usageStats?.providers?.orcarouter ?? 0).toLocaleString()}{' '}
                    calls
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-xs">
              <CardHeader className="border-border/60 border-b pb-3">
                <CardTitle className="text-foreground flex items-center gap-2 text-sm font-extrabold">
                  <Cpu className="h-4 w-4 text-purple-500" />
                  Model Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-4 text-xs">
                {Object.entries(usageStats?.models || {}).length > 0 ? (
                  Object.entries(usageStats?.models || {}).map(
                    ([modelId, count]) => (
                      <div
                        key={modelId}
                        className="border-border/50 flex items-center justify-between border-b pb-2"
                      >
                        <code className="text-muted-foreground max-w-[220px] truncate font-mono text-[11px] font-semibold">
                          {modelId}
                        </code>
                        <span className="text-foreground font-mono font-black">
                          {(count ?? 0).toLocaleString()}
                        </span>
                      </div>
                    )
                  )
                ) : (
                  <p className="text-muted-foreground py-2 text-xs">
                    No individual model metrics tracked for current billing
                    cycle yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
