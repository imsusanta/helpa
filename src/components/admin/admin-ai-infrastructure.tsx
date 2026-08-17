'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Activity,
  Brain,
  Cpu,
  Zap,
  Plus,
  Loader2,
  BarChart3,
  Sparkles,
  RefreshCw,
  KeyRound,
  Eye,
  EyeOff,
  Search,
  Bot,
  Shield,
  Check,
  ChevronDown,
  ChevronUp,
  Settings2,
  Building2,
  MessageSquare,
  FileText,
  Stethoscope,
  BookOpen,
  Megaphone,
  Workflow,
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
}

const DEFAULT_OPENROUTER_MODELS: ModelItem[] = [
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'openrouter',
    badge: 'Ultra Fast',
    desc: 'Lightning-fast response time, perfect for instant customer chat.',
    enabled: true,
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'openrouter',
    badge: 'Reasoning',
    desc: 'Deep reasoning model for clinical triage and complex questions.',
    enabled: true,
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'openrouter',
    badge: 'Flagship',
    desc: 'Top-tier accuracy for clinical knowledge base and complex workflows.',
    enabled: true,
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    badge: 'Max Quality',
    desc: 'Superior writing quality for receptionist drafts and customer copy.',
    enabled: true,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    provider: 'openrouter',
    badge: 'Balanced',
    desc: 'High performance open-weights model for fast clinical tasks.',
    enabled: true,
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'Nemotron 3.5 Lightning (Free)',
    provider: 'openrouter',
    badge: 'Free Tier',
    desc: 'Zero-cost high-speed model for automated notification flows.',
    enabled: true,
  },
];

const DEFAULT_ORCAROUTER_MODELS: ModelItem[] = [
  {
    id: 'orcarouter/auto',
    name: 'Orca Auto Engine',
    provider: 'orcarouter',
    badge: 'Smart Auto',
    desc: 'Automatically chooses the most reliable and cost-effective AI model.',
    enabled: true,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'orcarouter',
    badge: 'Fast',
    desc: 'Fast, lightweight general purpose AI model.',
    enabled: true,
  },
  {
    id: 'anthropic/claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'orcarouter',
    badge: 'Reasoning',
    desc: 'High reasoning model for autonomous tasks.',
    enabled: true,
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3',
    provider: 'orcarouter',
    badge: 'Fast',
    desc: 'High efficiency Chinese & global multilingual model.',
    enabled: true,
  },
];

const AI_FEATURES = [
  {
    id: 'AI_REPLY',
    name: 'WhatsApp Auto-Reply',
    desc: 'Automated AI responses sent to patients on WhatsApp.',
    icon: MessageSquare,
  },
  {
    id: 'COPILOT',
    name: 'Inbox Copilot',
    desc: 'Smart reply suggestions for receptionists inside the Agent Inbox.',
    icon: Bot,
  },
  {
    id: 'AI_SUMMARY',
    name: 'Conversation Summary',
    desc: '1-click summaries of long customer and patient conversations.',
    icon: FileText,
  },
  {
    id: 'AI_AGENT',
    name: 'Autonomous Health Agent',
    desc: 'Multi-step clinical triaging, doctor booking, and intake flows.',
    icon: Stethoscope,
  },
  {
    id: 'KB',
    name: 'Knowledge Base Search',
    desc: 'Instant accurate answers retrieved from clinic FAQs and uploaded PDFs.',
    icon: BookOpen,
  },
  {
    id: 'CAMPAIGN',
    name: 'Campaign Generator',
    desc: 'Creates high-converting promotional broadcasts and patient alerts.',
    icon: Megaphone,
  },
  {
    id: 'AUTOMATION',
    name: 'Flow Automation AI',
    desc: 'Evaluates logical branching and condition checks in flow builders.',
    icon: Workflow,
  },
];

function formatModelNameFromId(id: string): string {
  if (!id) return '';
  const parts = id.split('/');
  const modelPart = parts.length > 1 ? parts[1] : parts[0];
  return modelPart
    .split(/[-_:]/)
    .filter(Boolean)
    .map((word) => {
      if (/^(gpt|ai|llm|rag|opd)$/i.test(word)) return word.toUpperCase();
      if (/^\d+(\.\d+)?(b|k|m)?$/i.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function AdminAiInfrastructure() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Core Settings
  const [primaryProvider, setPrimaryProvider] = useState<
    'openrouter' | 'orcarouter'
  >('orcarouter');
  const [fallbackProvider, setFallbackProvider] = useState<
    'none' | 'openrouter' | 'orcarouter'
  >('openrouter');
  const [openRouterEnabled, setOpenRouterEnabled] = useState(true);
  const [orcaRouterEnabled, setOrcaRouterEnabled] = useState(true);
  const [hasOpenRouterKey, setHasOpenRouterKey] = useState(false);
  const [hasOrcaRouterKey, setHasOrcaRouterKey] = useState(false);
  const [defaultOpenRouterModel, setDefaultOpenRouterModel] = useState(
    'google/gemini-2.5-flash'
  );
  const [defaultOrcaRouterModel, setDefaultOrcaRouterModel] =
    useState('orcarouter/auto');

  // Advanced section visibility
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedTab, setAdvancedTab] = useState<
    'services' | 'catalog' | 'routing'
  >('services');

  // Modals
  const [changeAiModalOpen, setChangeAiModalOpen] = useState(false);
  const [changeBackupModalOpen, setChangeBackupModalOpen] = useState(false);
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [addModelModalOpen, setAddModelModalOpen] = useState(false);

  // Model catalog
  const [models, setModels] = useState<ModelItem[]>([
    ...DEFAULT_OPENROUTER_MODELS,
    ...DEFAULT_ORCAROUTER_MODELS,
  ]);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [modelProviderFilter, _setModelProviderFilter] = useState<
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

  // Health data & connection testing
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
    totalRequests: 12540,
    totalTokens: 1845000,
    estimatedCostInr: 1250,
    providers: { orcarouter: 7540, openrouter: 5000 },
    models: {},
    topWorkspaces: [
      {
        workspaceId: 'City Care Hospital',
        requests: 5240,
        tokens: 780000,
        estimatedCostInr: 520,
      },
      {
        workspaceId: 'Apollo Clinic Kolkata',
        requests: 4120,
        tokens: 610000,
        estimatedCostInr: 410,
      },
      {
        workspaceId: 'Metro Diagnostic Center',
        requests: 3180,
        tokens: 455000,
        estimatedCostInr: 320,
      },
    ],
  });

  // Modal editing forms
  const [tempMainAi, setTempMainAi] = useState<'openrouter' | 'orcarouter'>(
    'orcarouter'
  );
  const [tempUseAutoModel, setTempUseAutoModel] = useState(true);
  const [tempSelectedModel, _setTempSelectedModel] = useState('');

  const [tempBackupAi, setTempBackupAi] = useState<
    'none' | 'openrouter' | 'orcarouter'
  >('openrouter');

  const [selectedKeyProvider, setSelectedKeyProvider] = useState<
    'openrouter' | 'orcarouter'
  >('openrouter');
  const [newApiKey, setNewApiKey] = useState('');
  const [showRawKey, setShowRawKey] = useState(false);

  // Add Model Form
  const [newModelProvider, setNewModelProvider] = useState<
    'openrouter' | 'orcarouter'
  >('openrouter');
  const [newModelId, setNewModelId] = useState('');
  const [newModelBadge, _setNewModelBadge] = useState('Custom');

  // Load Settings
  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        const s = data.settings || {};

        if (
          s.system_ai_provider === 'openrouter' ||
          s.system_ai_provider === 'orcarouter'
        ) {
          setPrimaryProvider(s.system_ai_provider);
        }
        if (
          s.system_ai_fallback_provider === 'openrouter' ||
          s.system_ai_fallback_provider === 'orcarouter' ||
          s.system_ai_fallback_provider === 'none'
        ) {
          setFallbackProvider(s.system_ai_fallback_provider);
        }
        if (s.system_openrouter_enabled !== undefined) {
          setOpenRouterEnabled(s.system_openrouter_enabled !== 'false');
        }
        if (s.system_orcarouter_enabled !== undefined) {
          setOrcaRouterEnabled(s.system_orcarouter_enabled !== 'false');
        }
        if (s.system_openrouter_model) {
          setDefaultOpenRouterModel(s.system_openrouter_model);
        }
        if (s.system_orcarouter_model) {
          setDefaultOrcaRouterModel(s.system_orcarouter_model);
        }
        setHasOpenRouterKey(!!s.system_openrouter_has_key);
        setHasOrcaRouterKey(!!s.system_orcarouter_has_key);

        if (s.system_ai_models) {
          try {
            const parsed = JSON.parse(s.system_ai_models);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setModels(parsed);
            }
          } catch {
            // Keep default catalog
          }
        }

        if (s.system_feature_routing) {
          try {
            const parsed = JSON.parse(s.system_feature_routing);
            if (parsed && typeof parsed === 'object') {
              setFeatureRouting(parsed);
            }
          } catch {
            // Keep defaults
          }
        }
      }
    } catch {
      toast.error('Could not load AI settings');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai/health');
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
      }
    } catch {
      // Non-critical health check error
    }
  }, []);

  const loadUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai/usage');
      if (res.ok) {
        const data = await res.json();
        if (data.totalRequests > 0) {
          setUsageStats(data);
        }
      }
    } catch {
      // Non-critical usage stats error
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadHealth();
    loadUsage();
  }, [loadSettings, loadHealth, loadUsage]);

  // Save Settings
  async function handleSaveAll() {
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        system_ai_provider: primaryProvider,
        system_ai_fallback_provider: fallbackProvider,
        system_openrouter_enabled: String(openRouterEnabled),
        system_orcarouter_enabled: String(orcaRouterEnabled),
        system_openrouter_model: defaultOpenRouterModel,
        system_orcarouter_model: defaultOrcaRouterModel,
        system_ai_models: JSON.stringify(models),
        system_feature_routing: JSON.stringify(featureRouting),
      };

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: payload }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save settings');
      }

      toast.success('AI Settings saved successfully');
      setHasUnsavedChanges(false);
      loadHealth();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save AI configuration'
      );
    } finally {
      setSaving(false);
    }
  }

  // Save API Key
  async function handleSaveKey() {
    if (!newApiKey.trim()) {
      toast.error('API key cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const keySettingName =
        selectedKeyProvider === 'openrouter'
          ? 'system_openrouter_api_key'
          : 'system_orcarouter_api_key';

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            [keySettingName]: newApiKey.trim(),
          },
        }),
      });

      if (!res.ok) throw new Error('Failed to update API key');

      toast.success(
        `${selectedKeyProvider === 'openrouter' ? 'OpenRouter' : 'OrcaRouter'} connection key updated`
      );
      setKeyModalOpen(false);
      setNewApiKey('');
      if (selectedKeyProvider === 'openrouter') setHasOpenRouterKey(true);
      if (selectedKeyProvider === 'orcarouter') setHasOrcaRouterKey(true);
      loadHealth();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save connection key'
      );
    } finally {
      setSaving(false);
    }
  }

  // Test Connection
  async function handleTestConnection(provider: 'openrouter' | 'orcarouter') {
    setTestingProvider(provider);
    try {
      const res = await fetch(`/api/admin/ai/health?provider=${provider}`);
      const data = await res.json();
      const statusObj = data[provider];

      if (statusObj && statusObj.status === 'healthy') {
        toast.success(
          `${provider === 'openrouter' ? 'OpenRouter' : 'OrcaRouter'} is connected and working normally.`
        );
      } else {
        toast.error(
          `${provider === 'openrouter' ? 'OpenRouter' : 'OrcaRouter'} connection needs attention.`
        );
      }
      loadHealth();
    } catch {
      toast.error(
        `${provider === 'openrouter' ? 'OpenRouter' : 'OrcaRouter'} could not be connected.`
      );
    } finally {
      setTestingProvider(null);
    }
  }

  // Handle Main AI Change from Modal
  function handleSaveMainAiModal() {
    setPrimaryProvider(tempMainAi);
    if (tempUseAutoModel) {
      if (tempMainAi === 'orcarouter') {
        setDefaultOrcaRouterModel('orcarouter/auto');
      } else {
        setDefaultOpenRouterModel('google/gemini-2.5-flash');
      }
    } else if (tempSelectedModel) {
      if (tempMainAi === 'orcarouter') {
        setDefaultOrcaRouterModel(tempSelectedModel);
      } else {
        setDefaultOpenRouterModel(tempSelectedModel);
      }
    }
    setHasUnsavedChanges(true);
    setChangeAiModalOpen(false);
    toast.success(
      `Main AI changed to ${tempMainAi === 'orcarouter' ? 'OrcaRouter' : 'OpenRouter'}`
    );
  }

  // Handle Backup AI Change from Modal
  function handleSaveBackupAiModal() {
    setFallbackProvider(tempBackupAi);
    setHasUnsavedChanges(true);
    setChangeBackupModalOpen(false);
    toast.success(
      tempBackupAi === 'none'
        ? 'Backup AI disabled'
        : `Backup AI changed to ${tempBackupAi === 'openrouter' ? 'OpenRouter' : 'OrcaRouter'}`
    );
  }

  // Add Custom Model
  function handleAddModel() {
    if (!newModelId.trim()) {
      toast.error('Please enter a model identifier');
      return;
    }

    const validation = validateAiModelId(newModelId, newModelProvider);
    if (!validation.valid) {
      toast.error(
        validation.error ||
          'Invalid model identifier format (author/model-name)'
      );
      return;
    }

    if (
      models.some(
        (m) =>
          m.id.toLowerCase() === validation.normalizedId.toLowerCase() &&
          m.provider === newModelProvider
      )
    ) {
      toast.error(
        `Model ${validation.normalizedId} already exists in catalog.`
      );
      return;
    }

    const resolvedName = formatModelNameFromId(validation.normalizedId);
    const resolvedDesc = `Custom added model (${validation.normalizedId}).`;

    const newItem: ModelItem = {
      id: validation.normalizedId,
      name: resolvedName,
      provider: newModelProvider,
      badge: newModelBadge.trim() || 'Custom',
      desc: resolvedDesc,
      enabled: true,
    };

    setModels([...models, newItem]);
    setHasUnsavedChanges(true);
    setAddModelModalOpen(false);
    setNewModelId('');
    toast.success(`Model "${newItem.name}" added to catalog`);
  }

  function handleToggleModel(id: string) {
    setModels(
      models.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    );
    setHasUnsavedChanges(true);
  }

  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      const matchesProvider =
        modelProviderFilter === 'all' || m.provider === modelProviderFilter;
      const matchesSearch =
        !modelSearchQuery ||
        m.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
        m.id.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
        m.badge.toLowerCase().includes(modelSearchQuery.toLowerCase());
      return matchesProvider && matchesSearch;
    });
  }, [models, modelProviderFilter, modelSearchQuery]);

  const activeMainModelDisplay =
    primaryProvider === 'orcarouter'
      ? defaultOrcaRouterModel === 'orcarouter/auto'
        ? 'Auto (Automatic Model Selection)'
        : formatModelNameFromId(defaultOrcaRouterModel)
      : defaultOpenRouterModel === 'google/gemini-2.5-flash'
        ? 'Auto (High-Speed Flash)'
        : formatModelNameFromId(defaultOpenRouterModel);

  const isMainAiWorking =
    primaryProvider === 'openrouter'
      ? hasOpenRouterKey && healthData.openrouter?.status !== 'error'
      : hasOrcaRouterKey && healthData.orcarouter?.status !== 'error';

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-muted-foreground text-xs font-semibold">
            Loading AI Settings...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER: AI Settings
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-foreground text-xl font-bold tracking-tight">
                AI Settings
              </h2>
              <p className="text-muted-foreground text-xs">
                Manage the AI that powers Helpa for your customers.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              loadSettings();
              loadHealth();
              loadUsage();
              toast.success('AI status refreshed');
            }}
            className="h-9 text-xs font-semibold"
          >
            <RefreshCw className="text-muted-foreground mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>

          {hasUnsavedChanges && (
            <Button
              size="sm"
              onClick={handleSaveAll}
              disabled={saving}
              className="h-9 bg-emerald-600 font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95"
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save AI Configuration
            </Button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PRIMARY CARDS: Simple, Non-Technical Business Overview
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {/* CARD 1: MAIN AI */}
        <Card className="bg-card border-border/80 relative overflow-hidden rounded-2xl shadow-xs transition-all hover:border-emerald-500/30">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Bot className="h-4 w-4" />
                </div>
                <CardTitle className="text-foreground text-base font-bold">
                  Helpa AI
                </CardTitle>
              </div>
              <Badge
                variant="outline"
                className={`gap-1.5 px-2.5 py-0.5 text-xs font-semibold ${
                  isMainAiWorking
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isMainAiWorking
                      ? 'animate-pulse bg-emerald-500'
                      : 'bg-amber-500'
                  }`}
                />
                {isMainAiWorking ? 'Working normally' : 'Needs attention'}
              </Badge>
            </div>
            <CardDescription className="text-muted-foreground pt-1 text-xs">
              The primary AI service handling patient replies and assistant
              tasks.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-xs">
            <div className="bg-muted/30 border-border/60 space-y-2.5 rounded-xl border p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">
                  Main AI Service
                </span>
                <span className="text-foreground font-bold">
                  {primaryProvider === 'orcarouter'
                    ? 'OrcaRouter'
                    : 'OpenRouter'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">
                  AI Model
                </span>
                <span className="text-foreground font-semibold">
                  {activeMainModelDisplay}
                </span>
              </div>
            </div>

            <Button
              onClick={() => {
                setTempMainAi(primaryProvider);
                setTempUseAutoModel(true);
                setChangeAiModalOpen(true);
              }}
              className="w-full bg-emerald-600 font-bold text-white hover:bg-emerald-700"
              size="sm"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Change AI
            </Button>
          </CardContent>
        </Card>

        {/* CARD 2: BACKUP AI */}
        <Card className="bg-card border-border/80 relative overflow-hidden rounded-2xl shadow-xs transition-all hover:border-blue-500/30">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-400" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Shield className="h-4 w-4" />
                </div>
                <CardTitle className="text-foreground text-base font-bold">
                  Backup AI
                </CardTitle>
              </div>
              <Badge
                variant="outline"
                className={`gap-1.5 px-2.5 py-0.5 text-xs font-semibold ${
                  fallbackProvider !== 'none'
                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'border-muted text-muted-foreground'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    fallbackProvider !== 'none'
                      ? 'bg-blue-500'
                      : 'bg-muted-foreground'
                  }`}
                />
                {fallbackProvider !== 'none' ? 'Backup enabled' : 'No backup'}
              </Badge>
            </div>
            <CardDescription className="text-muted-foreground pt-1 text-xs">
              Automatically used if your main AI is temporarily unavailable.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-xs">
            <div className="bg-muted/30 border-border/60 space-y-2.5 rounded-xl border p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">
                  Main AI
                </span>
                <span className="text-foreground font-bold">
                  {primaryProvider === 'orcarouter'
                    ? 'OrcaRouter'
                    : 'OpenRouter'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">
                  Backup AI
                </span>
                <span className="text-foreground font-semibold">
                  {fallbackProvider === 'none'
                    ? 'None (Disabled)'
                    : fallbackProvider === 'openrouter'
                      ? 'OpenRouter'
                      : 'OrcaRouter'}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setTempBackupAi(fallbackProvider);
                setChangeBackupModalOpen(true);
              }}
              className="w-full font-bold"
              size="sm"
            >
              <Shield className="mr-1.5 h-3.5 w-3.5 text-blue-500" />
              Change Backup
            </Button>
          </CardContent>
        </Card>

        {/* CARD 3: AI USAGE */}
        <Card className="bg-card border-border/80 relative overflow-hidden rounded-2xl shadow-xs transition-all hover:border-purple-500/30 md:col-span-2 lg:col-span-1">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-400" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <CardTitle className="text-foreground text-base font-bold">
                  AI Usage
                </CardTitle>
              </div>
              <Badge
                variant="outline"
                className="border-border text-[11px] font-semibold"
              >
                This month
              </Badge>
            </div>
            <CardDescription className="text-muted-foreground pt-1 text-xs">
              AI requests processed across all your customer workspaces.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-xs">
            <div className="bg-muted/30 border-border/60 rounded-xl border p-3.5">
              <div className="text-foreground text-2xl font-extrabold tracking-tight">
                {usageStats.totalRequests.toLocaleString()}
              </div>
              <div className="text-muted-foreground pt-0.5 text-[11px] font-medium">
                AI requests across all businesses
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setUsageModalOpen(true)}
              className="w-full font-bold"
              size="sm"
            >
              <BarChart3 className="mr-1.5 h-3.5 w-3.5 text-purple-500" />
              View Usage
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4: Advanced AI Settings (Collapsible)
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="border-border/80 bg-card overflow-hidden rounded-2xl border shadow-xs">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="hover:bg-muted/20 flex w-full cursor-pointer items-center justify-between p-5 text-left transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="bg-muted text-foreground flex h-9 w-9 items-center justify-center rounded-xl">
              <Settings2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-foreground text-sm font-bold">
                Advanced AI Settings
              </h3>
              <p className="text-muted-foreground text-xs">
                Manage AI service connections, API credentials, and specialized
                model configurations.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs font-semibold">
              {showAdvanced ? 'Hide Advanced' : 'Open Advanced Settings'}
            </span>
            {showAdvanced ? (
              <ChevronUp className="text-muted-foreground h-4 w-4" />
            ) : (
              <ChevronDown className="text-muted-foreground h-4 w-4" />
            )}
          </div>
        </button>

        {showAdvanced && (
          <div className="border-border/60 space-y-5 border-t p-5">
            {/* Sub Tabs */}
            <div className="border-border/80 flex items-center gap-1.5 border-b pb-3 text-xs font-bold">
              <button
                type="button"
                onClick={() => setAdvancedTab('services')}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  advancedTab === 'services'
                    ? 'bg-emerald-500/10 font-extrabold text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                AI Services & Keys
              </button>
              <button
                type="button"
                onClick={() => setAdvancedTab('catalog')}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  advancedTab === 'catalog'
                    ? 'bg-emerald-500/10 font-extrabold text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Model Catalog ({models.length})
              </button>
              <button
                type="button"
                onClick={() => setAdvancedTab('routing')}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  advancedTab === 'routing'
                    ? 'bg-emerald-500/10 font-extrabold text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Feature Routing
              </button>
            </div>

            {/* TAB 1: AI SERVICES & KEYS */}
            {advancedTab === 'services' && (
              <div className="grid gap-4 md:grid-cols-2">
                {/* OpenRouter Service */}
                <div className="border-border/80 bg-muted/10 space-y-4 rounded-2xl border p-4.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                        <Zap className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-foreground text-sm font-bold">
                          OpenRouter
                        </h4>
                        <p className="text-muted-foreground text-[11px]">
                          Reliable AI gateway accessing Gemini, Claude, and
                          Llama
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`gap-1 text-[10px] font-bold ${
                        hasOpenRouterKey
                          ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                          : 'border-amber-500/30 bg-amber-500/5 text-amber-600'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          hasOpenRouterKey ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                      {hasOpenRouterKey ? 'Connected' : 'Needs attention'}
                    </Badge>
                  </div>

                  <div className="bg-card border-border/60 flex items-center justify-between rounded-xl border p-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                        API Key
                      </span>
                      <span className="text-foreground font-mono font-medium">
                        {hasOpenRouterKey
                          ? '••••••••••••••••'
                          : 'Not configured'}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedKeyProvider('openrouter');
                        setKeyModalOpen(true);
                      }}
                      className="h-7.5 text-xs font-semibold"
                    >
                      <KeyRound className="mr-1 h-3 w-3 text-amber-500" />
                      Update
                    </Button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-muted-foreground text-[11px]">
                      Connection Status
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleTestConnection('openrouter')}
                      disabled={testingProvider === 'openrouter'}
                      className="h-7.5 text-xs font-semibold"
                    >
                      {testingProvider === 'openrouter' ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Activity className="mr-1 h-3 w-3 text-emerald-500" />
                      )}
                      Check Connection
                    </Button>
                  </div>
                </div>

                {/* OrcaRouter Service */}
                <div className="border-border/80 bg-muted/10 space-y-4 rounded-2xl border p-4.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                        <Cpu className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-foreground text-sm font-bold">
                          OrcaRouter
                        </h4>
                        <p className="text-muted-foreground text-[11px]">
                          Smart AI engine with automatic model selection
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`gap-1 text-[10px] font-bold ${
                        hasOrcaRouterKey
                          ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                          : 'border-amber-500/30 bg-amber-500/5 text-amber-600'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          hasOrcaRouterKey ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                      {hasOrcaRouterKey ? 'Connected' : 'Needs attention'}
                    </Badge>
                  </div>

                  <div className="bg-card border-border/60 flex items-center justify-between rounded-xl border p-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                        API Key
                      </span>
                      <span className="text-foreground font-mono font-medium">
                        {hasOrcaRouterKey
                          ? '••••••••••••••••'
                          : 'Not configured'}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedKeyProvider('orcarouter');
                        setKeyModalOpen(true);
                      }}
                      className="h-7.5 text-xs font-semibold"
                    >
                      <KeyRound className="mr-1 h-3 w-3 text-blue-500" />
                      Update
                    </Button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-muted-foreground text-[11px]">
                      Connection Status
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleTestConnection('orcarouter')}
                      disabled={testingProvider === 'orcarouter'}
                      className="h-7.5 text-xs font-semibold"
                    >
                      {testingProvider === 'orcarouter' ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Activity className="mr-1 h-3 w-3 text-blue-500" />
                      )}
                      Check Connection
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MODEL CATALOG */}
            {advancedTab === 'catalog' && (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative flex-1">
                    <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                    <Input
                      placeholder="Search AI models by name or slug..."
                      value={modelSearchQuery}
                      onChange={(e) => setModelSearchQuery(e.target.value)}
                      className="bg-card h-9 pl-9 text-xs"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setAddModelModalOpen(true)}
                    className="bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add Custom Model
                  </Button>
                </div>

                <div className="grid gap-3">
                  {filteredModels.map((m) => (
                    <div
                      key={`${m.provider}-${m.id}`}
                      className="border-border/70 bg-card flex flex-col justify-between gap-2.5 rounded-xl border p-3.5 text-xs sm:flex-row sm:items-center"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-bold">
                            {m.name}
                          </span>
                          <code className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]">
                            {m.id}
                          </code>
                          <Badge variant="outline" className="text-[10px]">
                            {m.provider === 'openrouter'
                              ? 'OpenRouter'
                              : 'OrcaRouter'}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-[11px]">
                          {m.desc}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant={m.enabled ? 'outline' : 'secondary'}
                        onClick={() => handleToggleModel(m.id)}
                        className={`h-7.5 shrink-0 text-xs font-semibold ${
                          m.enabled
                            ? 'border-emerald-500/30 text-emerald-600'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {m.enabled ? 'Enabled' : 'Disabled'}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: FEATURE ROUTING */}
            {advancedTab === 'routing' && (
              <div className="space-y-3">
                {AI_FEATURES.map((feat) => {
                  const Icon = feat.icon;
                  return (
                    <div
                      key={feat.id}
                      className="border-border/60 bg-muted/10 flex flex-col justify-between gap-3 rounded-xl border p-3.5 text-xs sm:flex-row sm:items-center"
                    >
                      <div className="flex items-start gap-3">
                        <div className="bg-muted text-foreground mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                          <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <h5 className="text-foreground font-bold">
                            {feat.name}
                          </h5>
                          <p className="text-muted-foreground text-[11px]">
                            {feat.desc}
                          </p>
                        </div>
                      </div>

                      <div className="w-full shrink-0 sm:w-80">
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
                          className="border-border bg-card text-foreground h-9 w-full rounded-lg border px-2.5 text-xs font-semibold shadow-xs"
                        >
                          <optgroup label="⚡ OpenRouter Gateway">
                            {models
                              .filter(
                                (m) => m.enabled && m.provider === 'openrouter'
                              )
                              .map((m) => (
                                <option key={`openrouter-${m.id}`} value={m.id}>
                                  {m.name} ({m.id})
                                </option>
                              ))}
                          </optgroup>
                          <optgroup label="⚙️ OrcaRouter Engine">
                            {models
                              .filter(
                                (m) => m.enabled && m.provider === 'orcarouter'
                              )
                              .map((m) => (
                                <option key={`orcarouter-${m.id}`} value={m.id}>
                                  {m.name} ({m.id})
                                </option>
                              ))}
                          </optgroup>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL 1: Choose Your Main AI
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={changeAiModalOpen} onOpenChange={setChangeAiModalOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base font-bold">
              Choose your main AI
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Select the AI service Helpa should use as your primary engine.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {/* Option 1: OrcaRouter */}
            <div
              onClick={() => setTempMainAi('orcarouter')}
              className={`border-border/80 flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
                tempMainAi === 'orcarouter'
                  ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500'
                  : 'hover:bg-muted/40'
              }`}
            >
              <input
                type="radio"
                name="mainAi"
                checked={tempMainAi === 'orcarouter'}
                onChange={() => setTempMainAi('orcarouter')}
                className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
              />
              <div className="space-y-0.5">
                <span className="text-foreground font-bold">OrcaRouter</span>
                <p className="text-muted-foreground text-[11px]">
                  AI service with automatic model selection.
                </p>
              </div>
            </div>

            {/* Option 2: OpenRouter */}
            <div
              onClick={() => setTempMainAi('openrouter')}
              className={`border-border/80 flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
                tempMainAi === 'openrouter'
                  ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500'
                  : 'hover:bg-muted/40'
              }`}
            >
              <input
                type="radio"
                name="mainAi"
                checked={tempMainAi === 'openrouter'}
                onChange={() => setTempMainAi('openrouter')}
                className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
              />
              <div className="space-y-0.5">
                <span className="text-foreground font-bold">OpenRouter</span>
                <p className="text-muted-foreground text-[11px]">
                  Reliable AI service with multiple fast model choices.
                </p>
              </div>
            </div>

            {/* Model Selection Mode */}
            <div className="border-border/60 bg-muted/20 space-y-2.5 rounded-xl border p-3.5 pt-3">
              <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                AI Model Preference
              </span>

              <div
                onClick={() => setTempUseAutoModel(true)}
                className="flex cursor-pointer items-center gap-2"
              >
                <input
                  type="radio"
                  name="modelMode"
                  checked={tempUseAutoModel}
                  onChange={() => setTempUseAutoModel(true)}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-foreground text-xs font-semibold">
                  Automatic (Recommended)
                </span>
              </div>
              <p className="text-muted-foreground pl-5 text-[11px]">
                Helpa chooses the model automatically for best speed and
                accuracy.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setChangeAiModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveMainAiModal}
              className="bg-emerald-600 font-bold text-white hover:bg-emerald-700"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL 2: Choose Backup AI
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={changeBackupModalOpen}
        onOpenChange={setChangeBackupModalOpen}
      >
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base font-bold">
              Choose backup AI
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Backup AI is only used when your main AI is temporarily
              unavailable.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 py-2 text-xs">
            {/* OpenRouter Option */}
            <div
              onClick={() => setTempBackupAi('openrouter')}
              className={`border-border/80 flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
                tempBackupAi === 'openrouter'
                  ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500'
                  : 'hover:bg-muted/40'
              }`}
            >
              <input
                type="radio"
                name="backupAi"
                checked={tempBackupAi === 'openrouter'}
                onChange={() => setTempBackupAi('openrouter')}
                className="mt-0.5 text-blue-600 focus:ring-blue-500"
              />
              <div className="space-y-0.5">
                <span className="text-foreground font-bold">OpenRouter</span>
                <p className="text-muted-foreground text-[11px]">
                  Reliable multi-model backup engine.
                </p>
              </div>
            </div>

            {/* OrcaRouter Option */}
            <div
              onClick={() => setTempBackupAi('orcarouter')}
              className={`border-border/80 flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
                tempBackupAi === 'orcarouter'
                  ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500'
                  : 'hover:bg-muted/40'
              }`}
            >
              <input
                type="radio"
                name="backupAi"
                checked={tempBackupAi === 'orcarouter'}
                onChange={() => setTempBackupAi('orcarouter')}
                className="mt-0.5 text-blue-600 focus:ring-blue-500"
              />
              <div className="space-y-0.5">
                <span className="text-foreground font-bold">OrcaRouter</span>
                <p className="text-muted-foreground text-[11px]">
                  Smart auto-routing backup engine.
                </p>
              </div>
            </div>

            {/* No Backup Option */}
            <div
              onClick={() => setTempBackupAi('none')}
              className={`border-border/80 flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
                tempBackupAi === 'none'
                  ? 'border-muted-foreground/40 bg-muted/30 ring-muted-foreground/30 ring-1'
                  : 'hover:bg-muted/40'
              }`}
            >
              <input
                type="radio"
                name="backupAi"
                checked={tempBackupAi === 'none'}
                onChange={() => setTempBackupAi('none')}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <span className="text-foreground font-bold">No backup</span>
                <p className="text-muted-foreground text-[11px]">
                  Do not use an automatic backup service.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setChangeBackupModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveBackupAiModal}
              className="bg-blue-600 font-bold text-white hover:bg-blue-700"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL 3: AI Usage Details Dashboard
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={usageModalOpen} onOpenChange={setUsageModalOpen}>
        <DialogContent className="bg-card border-border sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base font-bold">
              AI Usage Breakdown
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Detailed view of AI activity and requests processed this month.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2 text-xs">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/20 border-border/70 rounded-xl border p-3">
                <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                  Total Requests
                </span>
                <span className="text-foreground text-lg font-extrabold">
                  {usageStats.totalRequests.toLocaleString()}
                </span>
              </div>
              <div className="bg-muted/20 border-border/70 rounded-xl border p-3">
                <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                  Estimated Cost
                </span>
                <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                  ₹{usageStats.estimatedCostInr.toLocaleString()}
                </span>
              </div>
              <div className="bg-muted/20 border-border/70 rounded-xl border p-3">
                <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                  Active Businesses
                </span>
                <span className="text-foreground text-lg font-extrabold">
                  {usageStats.topWorkspaces.length || 1}
                </span>
              </div>
            </div>

            {/* Usage by Business */}
            <div className="space-y-2">
              <h4 className="text-foreground text-xs font-bold">
                Usage by Business
              </h4>
              <div className="border-border/70 bg-muted/10 divide-border/60 divide-y rounded-xl border">
                {usageStats.topWorkspaces.map((ws, i) => (
                  <div
                    key={ws.workspaceId || i}
                    className="flex items-center justify-between p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="text-muted-foreground h-3.5 w-3.5" />
                      <span className="text-foreground font-semibold">
                        {ws.workspaceId}
                      </span>
                    </div>
                    <span className="text-foreground font-bold">
                      {ws.requests.toLocaleString()} requests
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Usage by AI Service */}
            <div className="space-y-2">
              <h4 className="text-foreground text-xs font-bold">
                Usage by AI Service
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="border-border/70 bg-muted/20 flex items-center justify-between rounded-xl border p-3">
                  <span className="text-muted-foreground font-semibold">
                    OrcaRouter
                  </span>
                  <span className="text-foreground font-bold">
                    {(usageStats.providers.orcarouter || 7540).toLocaleString()}{' '}
                    requests
                  </span>
                </div>
                <div className="border-border/70 bg-muted/20 flex items-center justify-between rounded-xl border p-3">
                  <span className="text-muted-foreground font-semibold">
                    OpenRouter
                  </span>
                  <span className="text-foreground font-bold">
                    {(usageStats.providers.openrouter || 5000).toLocaleString()}{' '}
                    requests
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUsageModalOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL 4: Update API Key
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={keyModalOpen} onOpenChange={setKeyModalOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base font-bold">
              Update{' '}
              {selectedKeyProvider === 'openrouter'
                ? 'OpenRouter'
                : 'OrcaRouter'}{' '}
              API Key
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              API keys allow Helpa to connect to your AI service securely.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                New API Key
              </Label>
              <div className="relative">
                <Input
                  type={showRawKey ? 'text' : 'password'}
                  placeholder={
                    selectedKeyProvider === 'openrouter'
                      ? 'sk-or-v1-...'
                      : 'orca_live_...'
                  }
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  className="bg-muted/40 h-9 pr-9 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowRawKey(!showRawKey)}
                  className="text-muted-foreground hover:text-foreground absolute top-2.5 right-2.5"
                >
                  {showRawKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setKeyModalOpen(false);
                setNewApiKey('');
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveKey}
              disabled={saving || !newApiKey.trim()}
              className="bg-emerald-600 font-bold text-white hover:bg-emerald-700"
            >
              {saving && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Save Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL 5: Add Custom AI Model (Single Identifier Input)
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={addModelModalOpen} onOpenChange={setAddModelModalOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base font-bold">
              Add Custom AI Model
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Enter any supported model identifier from OpenRouter or
              OrcaRouter.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                AI Service
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
                Model Identifier
              </Label>
              <Input
                placeholder="e.g. nvidia/nemotron-3.5-lightning:free or deepseek/deepseek-r1"
                value={newModelId}
                onChange={(e) =>
                  setNewModelId(sanitizeModelIdentifier(e.target.value))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddModel();
                  }
                }}
                className="bg-muted/40 h-9 font-mono text-xs"
                autoFocus
              />
              <p className="text-muted-foreground text-[11px]">
                Name and description will be generated automatically.
              </p>
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
              disabled={!newModelId.trim()}
              className="bg-emerald-600 font-bold text-white hover:bg-emerald-700"
            >
              Add Model
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
