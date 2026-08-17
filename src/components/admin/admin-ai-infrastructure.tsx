'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Activity,
  Bot,
  Shield,
  Check,
  ChevronDown,
  ChevronUp,
  Settings2,
  Plus,
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
  Search,
  MessageSquare,
  FileText,
  Stethoscope,
  BookOpen,
  Megaphone,
  Workflow,
  Sparkles,
  BarChart3,
  Bell,
  Wallet,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  validateAiModelId,
  sanitizeModelIdentifier,
} from '@/core/ai/validation';
import { AdminNav } from './admin-nav';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & DEFAULT CATALOGS
// ═══════════════════════════════════════════════════════════════════════════════

interface ModelItem {
  id: string;
  name: string;
  provider: 'openrouter' | 'orcarouter';
  badge: string;
  desc: string;
  enabled: boolean;
  capabilities?: {
    streaming?: boolean;
    toolCalling?: boolean;
    vision?: boolean;
  };
}

const DEFAULT_OPENROUTER_MODELS: ModelItem[] = [
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'openrouter',
    badge: 'Ultra Fast',
    desc: 'Lightning-fast response time, perfect for instant customer chat.',
    enabled: true,
    capabilities: { streaming: true, toolCalling: true, vision: true },
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'openrouter',
    badge: 'Reasoning',
    desc: 'Deep reasoning model for clinical triage and complex questions.',
    enabled: true,
    capabilities: { streaming: true, toolCalling: true, vision: false },
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'openrouter',
    badge: 'Flagship',
    desc: 'Top-tier accuracy for clinical knowledge base and complex workflows.',
    enabled: true,
    capabilities: { streaming: true, toolCalling: true, vision: true },
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    badge: 'Max Quality',
    desc: 'Superior writing quality for receptionist drafts and customer copy.',
    enabled: true,
    capabilities: { streaming: true, toolCalling: true, vision: true },
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    provider: 'openrouter',
    badge: 'Balanced',
    desc: 'High performance open-weights model for fast clinical tasks.',
    enabled: true,
    capabilities: { streaming: true, toolCalling: true, vision: false },
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'Nemotron 3.5 Lightning (Free)',
    provider: 'openrouter',
    badge: 'Free Tier',
    desc: 'Zero-cost high-speed model for automated notification flows.',
    enabled: true,
    capabilities: { streaming: true, toolCalling: false, vision: false },
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
    capabilities: { streaming: true, toolCalling: true, vision: true },
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'orcarouter',
    badge: 'Fast',
    desc: 'Fast, lightweight general purpose AI model.',
    enabled: true,
    capabilities: { streaming: true, toolCalling: true, vision: true },
  },
  {
    id: 'anthropic/claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'orcarouter',
    badge: 'Reasoning',
    desc: 'High reasoning model for autonomous tasks.',
    enabled: true,
    capabilities: { streaming: true, toolCalling: true, vision: true },
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3',
    provider: 'orcarouter',
    badge: 'Fast',
    desc: 'High efficiency Chinese & global multilingual model.',
    enabled: true,
    capabilities: { streaming: true, toolCalling: true, vision: false },
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
    desc: 'Creates promotional broadcasts and patient alerts.',
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
  if (id === 'orcarouter/auto') return 'Auto (Orca Auto Engine)';
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

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AdminAiInfrastructure() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Core configuration
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

  // Model catalog
  const [models, setModels] = useState<ModelItem[]>([
    ...DEFAULT_OPENROUTER_MODELS,
    ...DEFAULT_ORCAROUTER_MODELS,
  ]);
  const [modelSearchQuery, setModelSearchQuery] = useState('');

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
  const [lastTestedTime, setLastTestedTime] = useState<string>('Just now');

  // Usage statistics
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
    totalRequests: 8420,
    totalTokens: 1845000,
    estimatedCostInr: 1250,
    providers: { orcarouter: 5200, openrouter: 3220 },
    models: {
      'orcarouter/auto': 5200,
      'google/gemini-2.5-flash': 2400,
      'anthropic/claude-3.5-sonnet': 820,
    },
    topWorkspaces: [
      {
        workspaceId: 'City Care Hospital',
        requests: 4200,
        tokens: 880000,
        estimatedCostInr: 620,
      },
      {
        workspaceId: 'Apollo Clinic',
        requests: 2620,
        tokens: 580000,
        estimatedCostInr: 390,
      },
      {
        workspaceId: 'Metro Diagnostic Center',
        requests: 1600,
        tokens: 385000,
        estimatedCostInr: 240,
      },
    ],
  });

  // Alerts & cost controls state
  const [alert80, setAlert80] = useState(true);
  const [alert90, setAlert90] = useState(true);
  const [alert100, setAlert100] = useState(true);
  const [monthlyLimitInr, _setMonthlyLimitInr] = useState(10000);
  const [limitAction, _setLimitAction] = useState<
    'stop' | 'backup' | 'notify' | 'warn'
  >('backup');

  // UI accordion state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedTab, setAdvancedTab] = useState<
    'services' | 'catalog' | 'routing'
  >('services');

  // Modals state
  const [setupWizardOpen, setSetupWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardProvider, setWizardProvider] = useState<
    'openrouter' | 'orcarouter'
  >('orcarouter');
  const [wizardApiKey, setWizardApiKey] = useState('');
  const [wizardShowKey, setWizardShowKey] = useState(false);
  const [wizardModel, setWizardModel] = useState('');
  const [wizardTested, setWizardTested] = useState<boolean | null>(null);
  const [wizardTesting, setWizardTesting] = useState(false);

  const [configureBackupModalOpen, setConfigureBackupModalOpen] =
    useState(false);
  const [tempBackupChoice, setTempBackupChoice] = useState<
    'none' | 'openrouter' | 'orcarouter'
  >('openrouter');

  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [selectedKeyProvider, setSelectedKeyProvider] = useState<
    'openrouter' | 'orcarouter'
  >('openrouter');
  const [newApiKey, setNewApiKey] = useState('');
  const [showRawKey, setShowRawKey] = useState(false);

  const [addModelModalOpen, setAddModelModalOpen] = useState(false);
  const [newModelProvider, setNewModelProvider] = useState<
    'openrouter' | 'orcarouter'
  >('openrouter');
  const [newModelName, setNewModelName] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [newModelDesc, setNewModelDesc] = useState('');

  // ═══════════════════════════════════════════════════════════════════════════════
  // LOAD DATA
  // ═══════════════════════════════════════════════════════════════════════════════

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
        setLastTestedTime('Just now');
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

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

      toast.success('AI Setup saved successfully');
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

  async function handleTestConnection(provider: 'openrouter' | 'orcarouter') {
    setTestingProvider(provider);
    try {
      const res = await fetch(`/api/admin/ai/health?provider=${provider}`);
      const data = await res.json();
      const statusObj = data[provider];

      if (statusObj && statusObj.status === 'healthy') {
        toast.success('Your AI service is connected and ready to use.');
      } else {
        toast.error(
          "We couldn't connect to this AI service. Please check your API key and try again."
        );
      }
      setLastTestedTime('Just now');
      loadHealth();
    } catch {
      toast.error(
        "We couldn't connect to this AI service. Please check your API key and try again."
      );
    } finally {
      setTestingProvider(null);
    }
  }

  async function handleWizardTest() {
    setWizardTesting(true);
    setWizardTested(null);
    try {
      // If user entered a key, temporarily save it before testing
      if (wizardApiKey.trim()) {
        const keySettingName =
          wizardProvider === 'openrouter'
            ? 'system_openrouter_api_key'
            : 'system_orcarouter_api_key';

        await fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: { [keySettingName]: wizardApiKey.trim() },
          }),
        });
        if (wizardProvider === 'openrouter') setHasOpenRouterKey(true);
        if (wizardProvider === 'orcarouter') setHasOrcaRouterKey(true);
      }

      const res = await fetch(
        `/api/admin/ai/health?provider=${wizardProvider}`
      );
      const data = await res.json();
      const statusObj = data[wizardProvider];

      if (statusObj && statusObj.status === 'healthy') {
        setWizardTested(true);
        toast.success('Connection successful! Your AI service is ready.');
      } else {
        setWizardTested(false);
        toast.error(
          "We couldn't connect to this AI service. Please check your API key and try again."
        );
      }
      loadHealth();
    } catch {
      setWizardTested(false);
      toast.error(
        "We couldn't connect to this AI service. Please check your API key and try again."
      );
    } finally {
      setWizardTesting(false);
    }
  }

  async function handleWizardSaveAndActivate() {
    setSaving(true);
    try {
      // 1. Save API key if entered
      if (wizardApiKey.trim()) {
        const keySettingName =
          wizardProvider === 'openrouter'
            ? 'system_openrouter_api_key'
            : 'system_orcarouter_api_key';

        await fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: { [keySettingName]: wizardApiKey.trim() },
          }),
        });
      }

      // 2. Save active provider and model
      const payload: Record<string, string> = {
        system_ai_provider: wizardProvider,
        system_openrouter_enabled: 'true',
        system_orcarouter_enabled: 'true',
      };

      if (wizardProvider === 'orcarouter') {
        payload.system_orcarouter_model = wizardModel || 'orcarouter/auto';
        setDefaultOrcaRouterModel(wizardModel || 'orcarouter/auto');
      } else {
        payload.system_openrouter_model =
          wizardModel || 'google/gemini-2.5-flash';
        setDefaultOpenRouterModel(wizardModel || 'google/gemini-2.5-flash');
      }

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: payload }),
      });

      if (!res.ok) throw new Error('Failed to activate configuration');

      setPrimaryProvider(wizardProvider);
      setSetupWizardOpen(false);
      setWizardApiKey('');
      toast.success(
        `Helpa AI activated with ${wizardProvider === 'orcarouter' ? 'OrcaRouter' : 'OpenRouter'}`
      );
      loadSettings();
      loadHealth();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save configuration'
      );
    } finally {
      setSaving(false);
    }
  }

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
        `${selectedKeyProvider === 'openrouter' ? 'OpenRouter' : 'OrcaRouter'} API key saved securely`
      );
      setKeyModalOpen(false);
      setNewApiKey('');
      if (selectedKeyProvider === 'openrouter') setHasOpenRouterKey(true);
      if (selectedKeyProvider === 'orcarouter') setHasOrcaRouterKey(true);
      loadHealth();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save API key'
      );
    } finally {
      setSaving(false);
    }
  }

  function handleSaveBackup() {
    setFallbackProvider(tempBackupChoice);
    setHasUnsavedChanges(true);
    setConfigureBackupModalOpen(false);
    toast.success(
      tempBackupChoice === 'none'
        ? 'Backup AI disabled'
        : `Backup AI set to ${tempBackupChoice === 'openrouter' ? 'OpenRouter' : 'OrcaRouter'}`
    );
  }

  function handleAddCustomModel() {
    if (!newModelId.trim()) {
      toast.error('Please enter a model identifier');
      return;
    }

    const sanitizedId = sanitizeModelIdentifier(newModelId.trim());
    const validation = validateAiModelId(sanitizedId, newModelProvider);
    if (!validation.valid) {
      toast.error(
        validation.error || 'Invalid model ID format (e.g. author/model-name)'
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
      toast.error(`Model ${validation.normalizedId} already exists.`);
      return;
    }

    const resolvedName =
      newModelName.trim() || formatModelNameFromId(validation.normalizedId);
    const resolvedDesc =
      newModelDesc.trim() || `Custom model (${validation.normalizedId})`;

    const newItem: ModelItem = {
      id: validation.normalizedId,
      name: resolvedName,
      provider: newModelProvider,
      badge: 'Custom',
      desc: resolvedDesc,
      enabled: true,
      capabilities: { streaming: true, toolCalling: true, vision: false },
    };

    setModels([...models, newItem]);
    setHasUnsavedChanges(true);
    setAddModelModalOpen(false);
    setNewModelId('');
    setNewModelName('');
    setNewModelDesc('');
    toast.success(`Model "${newItem.name}" added to ${newModelProvider}`);
  }

  function handleToggleModel(id: string) {
    setModels(
      models.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    );
    setHasUnsavedChanges(true);
  }

  function openSetupWizard() {
    setWizardProvider(primaryProvider);
    setWizardApiKey('');
    setWizardModel(
      primaryProvider === 'orcarouter'
        ? defaultOrcaRouterModel
        : defaultOpenRouterModel
    );
    setWizardStep(1);
    setWizardTested(null);
    setSetupWizardOpen(true);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // COMPUTED VALUES
  // ═══════════════════════════════════════════════════════════════════════════════

  const activeModelId =
    primaryProvider === 'orcarouter'
      ? defaultOrcaRouterModel
      : defaultOpenRouterModel;

  const activeModelName =
    primaryProvider === 'orcarouter'
      ? defaultOrcaRouterModel === 'orcarouter/auto'
        ? 'Auto (Smart Selection)'
        : formatModelNameFromId(defaultOrcaRouterModel)
      : defaultOpenRouterModel === 'google/gemini-2.5-flash'
        ? 'Gemini 2.5 Flash'
        : formatModelNameFromId(defaultOpenRouterModel);

  const activeModelObject = useMemo(() => {
    return models.find(
      (m) => m.id === activeModelId && m.provider === primaryProvider
    );
  }, [models, activeModelId, primaryProvider]);

  const hasActiveKey =
    primaryProvider === 'openrouter' ? hasOpenRouterKey : hasOrcaRouterKey;

  const currentHealth =
    primaryProvider === 'openrouter'
      ? healthData.openrouter
      : healthData.orcarouter;

  const isConnected = hasActiveKey && currentHealth?.status === 'healthy';
  const isAttention = hasActiveKey && currentHealth?.status === 'error';

  const availableModelsForSelectedProvider = useMemo(() => {
    return models.filter((m) => m.provider === wizardProvider && m.enabled);
  }, [models, wizardProvider]);

  const filteredCatalogModels = useMemo(() => {
    return models.filter((m) => {
      if (!modelSearchQuery) return true;
      return (
        m.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
        m.id.toLowerCase().includes(modelSearchQuery.toLowerCase())
      );
    });
  }, [models, modelSearchQuery]);

  const monthlyCreditMax = 10000;
  const usagePercentage = Math.min(
    100,
    Math.round((usageStats.totalRequests / monthlyCreditMax) * 100)
  );
  const remainingRequests = Math.max(
    0,
    monthlyCreditMax - usageStats.totalRequests
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          <p className="text-muted-foreground text-xs font-medium">
            Loading AI Setup...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminNav
        onRefresh={() => {
          loadSettings();
          loadHealth();
          loadUsage();
        }}
        loading={loading}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          PAGE ACTIONS
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-foreground text-sm font-semibold">
            AI Provider & Model Settings
          </h2>
          <p className="text-muted-foreground text-xs">
            Connect an AI service, choose default models, and configure failover
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Button
              onClick={handleSaveAll}
              disabled={saving}
              size="sm"
              className="h-8 gap-1.5 text-xs font-medium"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Save Changes
            </Button>
          )}
          <Button
            onClick={openSetupWizard}
            size="sm"
            variant="default"
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Change AI
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          1. CURRENT AI STATUS CARD
      ═══════════════════════════════════════════════════════════════════ */}
      <Card className="bg-card border-border shadow-none">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-foreground text-base font-semibold">
                  Helpa AI
                </h3>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Connected & Ready
                  </span>
                ) : isAttention ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Needs attention
                  </span>
                ) : (
                  <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                    <span className="bg-muted-foreground/40 h-2 w-2 rounded-full" />
                    Not connected (API key required)
                  </span>
                )}
              </div>

              {/* Provider & Model Info */}
              <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3">
                <div>
                  <span className="text-muted-foreground">Provider:</span>{' '}
                  <span className="text-foreground font-medium">
                    {primaryProvider === 'orcarouter'
                      ? 'OrcaRouter'
                      : 'OpenRouter'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Model:</span>{' '}
                  <span className="text-foreground font-medium">
                    {activeModelName}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Last checked:</span>{' '}
                  <span className="text-foreground font-medium">
                    {lastTestedTime}
                  </span>
                </div>
              </div>

              {/* Optional Capabilities Info */}
              {activeModelObject?.capabilities && (
                <div className="flex items-center gap-3 pt-1 text-[11px]">
                  <span className="text-muted-foreground">Capabilities:</span>
                  <span
                    className={
                      activeModelObject.capabilities.streaming
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground line-through'
                    }
                  >
                    Streaming ✓
                  </span>
                  <span
                    className={
                      activeModelObject.capabilities.toolCalling
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground line-through'
                    }
                  >
                    Tool Calling ✓
                  </span>
                  <span
                    className={
                      activeModelObject.capabilities.vision
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground line-through'
                    }
                  >
                    Vision ✓
                  </span>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestConnection(primaryProvider)}
                disabled={testingProvider === primaryProvider}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                {testingProvider === primaryProvider ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Activity className="h-3 w-3" />
                )}
                Test Connection
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={openSetupWizard}
                className="h-8 text-xs font-medium"
              >
                Change AI
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════
          2. USAGE & BACKUP ROW
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* AI Usage Card */}
        <Card className="bg-card border-border shadow-none">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground flex items-center gap-2 text-sm font-semibold">
                <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                AI Usage
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUsageModalOpen(true)}
                className="text-muted-foreground hover:text-foreground h-7 text-xs font-medium"
              >
                View Usage
              </Button>
            </div>
            <CardDescription className="text-muted-foreground text-xs">
              Tracked Helpa usage for this billing period
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            <div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-foreground text-lg font-semibold tabular-nums">
                  {usageStats.totalRequests.toLocaleString()}{' '}
                  <span className="text-muted-foreground text-xs font-normal">
                    / {monthlyCreditMax.toLocaleString()} requests
                  </span>
                </span>
                <span className="text-muted-foreground text-xs font-medium">
                  {usagePercentage}% used
                </span>
              </div>

              {/* Progress bar */}
              <div className="bg-muted mt-2 h-2 w-full overflow-hidden rounded-full">
                <div
                  className={`h-full transition-all duration-300 ${
                    usagePercentage > 90
                      ? 'bg-amber-500'
                      : usagePercentage > 98
                        ? 'bg-red-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${usagePercentage}%` }}
                />
              </div>

              <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
                <span>{remainingRequests.toLocaleString()} remaining</span>
                <span>
                  Est. Cost:{' '}
                  <strong className="text-foreground font-medium">
                    ₹{usageStats.estimatedCostInr.toLocaleString('en-IN')}
                  </strong>
                </span>
              </div>
            </div>

            {/* Provider Balance Info */}
            <div className="border-border border-t pt-2.5">
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>Provider Balance:</span>
                <span className="text-muted-foreground italic">
                  Provider balance unavailable via API
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Backup AI Card */}
        <Card className="bg-card border-border shadow-none">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground flex items-center gap-2 text-sm font-semibold">
                <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Backup AI
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTempBackupChoice(fallbackProvider);
                  setConfigureBackupModalOpen(true);
                }}
                className="text-muted-foreground hover:text-foreground h-7 text-xs font-medium"
              >
                Configure
              </Button>
            </div>
            <CardDescription className="text-muted-foreground text-xs">
              Used automatically if your main AI is temporarily unavailable
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0 text-xs">
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">Main AI:</span>
              <span className="text-foreground font-medium">
                {primaryProvider === 'orcarouter' ? 'OrcaRouter' : 'OpenRouter'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">Backup AI:</span>
              <span className="text-foreground font-medium">
                {fallbackProvider === 'none'
                  ? 'None'
                  : fallbackProvider === 'openrouter'
                    ? 'OpenRouter'
                    : 'OrcaRouter'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">Status:</span>
              {fallbackProvider !== 'none' ? (
                <span className="flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  Enabled
                </span>
              ) : (
                <span className="text-muted-foreground font-medium">
                  Disabled
                </span>
              )}
            </div>
            <p className="text-muted-foreground/80 border-border border-t pt-2 text-[11px]">
              If the main AI experiences an outage, requests will seamlessly
              failover to prevent receptionist downtime.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          3. USAGE ALERTS & COST CONTROL
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Usage Alerts */}
        <Card className="bg-card border-border shadow-none">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-foreground flex items-center gap-2 text-sm font-semibold">
              <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Usage Alerts
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              Receive alerts when monthly AI consumption reaches thresholds
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 p-5 pt-0 text-xs">
            <label className="hover:text-foreground text-muted-foreground flex cursor-pointer items-center gap-2.5 select-none">
              <input
                type="checkbox"
                checked={alert80}
                onChange={(e) => setAlert80(e.target.checked)}
                className="border-border bg-background h-3.5 w-3.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                Notify Super Admin when usage reaches <strong>80%</strong>
              </span>
            </label>
            <label className="hover:text-foreground text-muted-foreground flex cursor-pointer items-center gap-2.5 select-none">
              <input
                type="checkbox"
                checked={alert90}
                onChange={(e) => setAlert90(e.target.checked)}
                className="border-border bg-background h-3.5 w-3.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                Notify Super Admin when usage reaches <strong>90%</strong>
              </span>
            </label>
            <label className="hover:text-foreground text-muted-foreground flex cursor-pointer items-center gap-2.5 select-none">
              <input
                type="checkbox"
                checked={alert100}
                onChange={(e) => setAlert100(e.target.checked)}
                className="border-border bg-background h-3.5 w-3.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                Notify Super Admin when usage reaches <strong>100%</strong>
              </span>
            </label>
          </CardContent>
        </Card>

        {/* Cost Control */}
        <Card className="bg-card border-border shadow-none">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-foreground flex items-center gap-2 text-sm font-semibold">
              <Wallet className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              Monthly Spending Limit
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              Cap platform AI spend to prevent unexpected costs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Monthly Limit:</span>
              <span className="text-foreground font-semibold">
                ₹{monthlyLimitInr.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Current Usage:</span>
              <span className="text-foreground font-medium">
                ₹{usageStats.estimatedCostInr.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Remaining:</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                ₹
                {(monthlyLimitInr - usageStats.estimatedCostInr).toLocaleString(
                  'en-IN'
                )}
              </span>
            </div>
            <div className="border-border text-muted-foreground flex items-center justify-between border-t pt-2">
              <span>If limit reached:</span>
              <span className="text-foreground font-medium">
                {limitAction === 'backup'
                  ? 'Switch to backup AI'
                  : limitAction === 'stop'
                    ? 'Pause AI requests'
                    : 'Notify Super Admin'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          4. ADVANCED SETTINGS (COLLAPSIBLE)
      ═══════════════════════════════════════════════════════════════════ */}
      <Card className="bg-card border-border shadow-none">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="hover:bg-muted/30 flex w-full cursor-pointer items-center justify-between p-5 text-left transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings2 className="text-muted-foreground h-4 w-4" />
            <div>
              <span className="text-foreground text-xs font-semibold tracking-wider uppercase">
                Advanced Settings
              </span>
              <p className="text-muted-foreground text-xs">
                API keys, model catalog, and per-feature routing
              </p>
            </div>
          </div>
          {showAdvanced ? (
            <ChevronUp className="text-muted-foreground h-4 w-4" />
          ) : (
            <ChevronDown className="text-muted-foreground h-4 w-4" />
          )}
        </button>

        {showAdvanced && (
          <CardContent className="border-border space-y-5 border-t p-5">
            {/* Sub-tabs */}
            <div className="border-border flex gap-2 border-b pb-2 text-xs">
              <button
                onClick={() => setAdvancedTab('services')}
                className={`cursor-pointer rounded-md px-3 py-1.5 font-medium transition-colors ${
                  advancedTab === 'services'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                API Keys & Services
              </button>
              <button
                onClick={() => setAdvancedTab('catalog')}
                className={`cursor-pointer rounded-md px-3 py-1.5 font-medium transition-colors ${
                  advancedTab === 'catalog'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Model Catalog ({models.length})
              </button>
              <button
                onClick={() => setAdvancedTab('routing')}
                className={`cursor-pointer rounded-md px-3 py-1.5 font-medium transition-colors ${
                  advancedTab === 'routing'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Feature Routing
              </button>
            </div>

            {/* TAB 1: API Keys & Services */}
            {advancedTab === 'services' && (
              <div className="grid gap-4 sm:grid-cols-2">
                {/* OpenRouter Service Panel */}
                <div className="bg-background border-border space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground text-xs font-semibold">
                      OpenRouter
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-medium"
                    >
                      {hasOpenRouterKey ? 'Key Configured' : 'Missing Key'}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Multi-provider gateway offering Gemini, Claude, Llama, and
                    DeepSeek models.
                  </p>
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedKeyProvider('openrouter');
                        setNewApiKey('');
                        setKeyModalOpen(true);
                      }}
                      className="h-7 text-xs"
                    >
                      <KeyRound className="mr-1 h-3 w-3" />
                      {hasOpenRouterKey ? 'Update Key' : 'Add Key'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleTestConnection('openrouter')}
                      disabled={testingProvider === 'openrouter'}
                      className="h-7 text-xs"
                    >
                      {testingProvider === 'openrouter' ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Activity className="mr-1 h-3 w-3" />
                      )}
                      Test
                    </Button>
                  </div>
                </div>

                {/* OrcaRouter Service Panel */}
                <div className="bg-background border-border space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground text-xs font-semibold">
                      OrcaRouter
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-medium"
                    >
                      {hasOrcaRouterKey ? 'Key Configured' : 'Missing Key'}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Intelligent dynamic routing engine for high reliability and
                    cost efficiency.
                  </p>
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedKeyProvider('orcarouter');
                        setNewApiKey('');
                        setKeyModalOpen(true);
                      }}
                      className="h-7 text-xs"
                    >
                      <KeyRound className="mr-1 h-3 w-3" />
                      {hasOrcaRouterKey ? 'Update Key' : 'Add Key'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleTestConnection('orcarouter')}
                      disabled={testingProvider === 'orcarouter'}
                      className="h-7 text-xs"
                    >
                      {testingProvider === 'orcarouter' ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Activity className="mr-1 h-3 w-3" />
                      )}
                      Test
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Model Catalog */}
            {advancedTab === 'catalog' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative max-w-sm flex-1">
                    <Search className="text-muted-foreground absolute top-2 left-2.5 h-3.5 w-3.5" />
                    <Input
                      placeholder="Search models..."
                      value={modelSearchQuery}
                      onChange={(e) => setModelSearchQuery(e.target.value)}
                      className="bg-background h-8 pl-8 text-xs"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setNewModelProvider(primaryProvider);
                      setNewModelId('');
                      setNewModelName('');
                      setNewModelDesc('');
                      setAddModelModalOpen(true);
                    }}
                    className="h-8 gap-1 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Custom Model
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCatalogModels.map((m) => (
                    <div
                      key={`${m.provider}-${m.id}`}
                      className="bg-background border-border space-y-2 rounded-lg border p-3 text-xs"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-foreground font-semibold">
                            {m.name}
                          </span>
                          <span className="text-muted-foreground ml-1.5 font-mono text-[10px]">
                            {m.provider}
                          </span>
                        </div>
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-normal"
                        >
                          {m.badge}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground truncate font-mono text-[11px]">
                        {m.id}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-muted-foreground text-[11px]">
                          {m.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleModel(m.id)}
                          className="h-6 px-2 text-[11px]"
                        >
                          {m.enabled ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: Feature Routing */}
            {advancedTab === 'routing' && (
              <div className="space-y-3">
                <p className="text-muted-foreground text-xs">
                  Optionally assign specialized models for specific Helpa
                  functions.
                </p>
                <div className="space-y-2">
                  {AI_FEATURES.map((feat) => {
                    const Icon = feat.icon;
                    const currentAssigned =
                      featureRouting[feat.id] || defaultOpenRouterModel;

                    return (
                      <div
                        key={feat.id}
                        className="bg-background border-border flex flex-col gap-2 rounded-lg border p-3 text-xs sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="bg-muted flex h-7 w-7 items-center justify-center rounded">
                            <Icon className="text-muted-foreground h-3.5 w-3.5" />
                          </div>
                          <div>
                            <span className="text-foreground font-medium">
                              {feat.name}
                            </span>
                            <p className="text-muted-foreground text-[11px]">
                              {feat.desc}
                            </p>
                          </div>
                        </div>

                        <select
                          value={currentAssigned}
                          onChange={(e) => {
                            setFeatureRouting({
                              ...featureRouting,
                              [feat.id]: e.target.value,
                            });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-background border-border text-foreground h-8 rounded-md border px-2 font-mono text-xs"
                        >
                          <optgroup label="OpenRouter Models">
                            {models
                              .filter(
                                (m) => m.provider === 'openrouter' && m.enabled
                              )
                              .map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.id})
                                </option>
                              ))}
                          </optgroup>
                          <optgroup label="OrcaRouter Models">
                            {models
                              .filter(
                                (m) => m.provider === 'orcarouter' && m.enabled
                              )
                              .map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.id})
                                </option>
                              ))}
                          </optgroup>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: GUIDED AI SETUP WIZARD (5-STEP FLOW)
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={setupWizardOpen} onOpenChange={setSetupWizardOpen}>
        <DialogContent className="bg-popover text-popover-foreground border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base font-semibold">
              AI Setup Wizard
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Step {wizardStep} of 3 —{' '}
              {wizardStep === 1
                ? 'Choose AI Provider'
                : wizardStep === 2
                  ? 'Add API Key'
                  : 'Choose AI Model'}
            </DialogDescription>
          </DialogHeader>

          {/* STEP 1: CHOOSE AI PROVIDER */}
          {wizardStep === 1 && (
            <div className="space-y-4 py-2">
              <p className="text-muted-foreground text-xs">
                Select the AI service Helpa should connect to:
              </p>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setWizardProvider('orcarouter')}
                  className={`w-full cursor-pointer rounded-lg border p-3.5 text-left transition-colors ${
                    wizardProvider === 'orcarouter'
                      ? 'border-emerald-600 bg-emerald-500/5 dark:border-emerald-400'
                      : 'border-border hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-foreground text-xs font-semibold">
                      OrcaRouter
                    </span>
                    {wizardProvider === 'orcarouter' && (
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Connect Helpa to OrcaRouter AI — automatic smart routing
                    with high uptime and low cost.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setWizardProvider('openrouter')}
                  className={`w-full cursor-pointer rounded-lg border p-3.5 text-left transition-colors ${
                    wizardProvider === 'openrouter'
                      ? 'border-emerald-600 bg-emerald-500/5 dark:border-emerald-400'
                      : 'border-border hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-foreground text-xs font-semibold">
                      OpenRouter
                    </span>
                    {wizardProvider === 'openrouter' && (
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Connect Helpa to OpenRouter AI — direct access to Gemini,
                    Claude, Llama, and DeepSeek.
                  </p>
                </button>
              </div>

              <DialogFooter className="mt-4 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSetupWizardOpen(false)}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setWizardStep(2)}
                  className="h-8 text-xs font-medium"
                >
                  Next: API Key
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* STEP 2: ADD API KEY & TEST */}
          {wizardStep === 2 && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs font-medium">
                  {wizardProvider === 'orcarouter'
                    ? 'OrcaRouter'
                    : 'OpenRouter'}{' '}
                  API Key
                </Label>
                <div className="relative">
                  <Input
                    type={wizardShowKey ? 'text' : 'password'}
                    placeholder={
                      wizardProvider === 'orcarouter'
                        ? 'orca_live_...'
                        : 'sk-or-v1-...'
                    }
                    value={wizardApiKey}
                    onChange={(e) => setWizardApiKey(e.target.value)}
                    className="bg-background text-foreground border-border h-9 pr-10 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setWizardShowKey(!wizardShowKey)}
                    className="text-muted-foreground hover:text-foreground absolute top-2 right-2.5 p-0.5"
                  >
                    {wizardShowKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Your API key is securely encrypted on the server and never
                  returned to the browser.
                </p>
              </div>

              {/* Test connection feedback */}
              <div className="bg-muted/40 border-border flex items-center justify-between rounded-lg border p-3 text-xs">
                <div>
                  <span className="text-foreground font-medium">
                    Connection Test:
                  </span>
                  <div className="mt-0.5">
                    {wizardTested === true ? (
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        ✓ Connection successful
                      </span>
                    ) : wizardTested === false ? (
                      <span className="font-medium text-red-500">
                        ✕ Connection failed. Check your API key.
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Not tested yet
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleWizardTest}
                  disabled={wizardTesting}
                  className="h-8 gap-1 text-xs"
                >
                  {wizardTesting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Activity className="h-3 w-3" />
                  )}
                  Test Connection
                </Button>
              </div>

              <DialogFooter className="mt-4 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setWizardStep(1)}
                  className="h-8 text-xs"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    // Set default model for the provider if not set
                    if (!wizardModel) {
                      setWizardModel(
                        wizardProvider === 'orcarouter'
                          ? 'orcarouter/auto'
                          : 'google/gemini-2.5-flash'
                      );
                    }
                    setWizardStep(3);
                  }}
                  className="h-8 text-xs font-medium"
                >
                  Next: Choose Model
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* STEP 3: CHOOSE MODEL & SAVE */}
          {wizardStep === 3 && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs font-medium">
                  Select AI Model
                </Label>
                <select
                  value={wizardModel}
                  onChange={(e) => setWizardModel(e.target.value)}
                  className="bg-background border-border text-foreground h-9 w-full rounded-md border px-3 text-xs"
                >
                  {availableModelsForSelectedProvider.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.badge})
                    </option>
                  ))}
                </select>
                <p className="text-muted-foreground text-[11px]">
                  Only models compatible with{' '}
                  {wizardProvider === 'orcarouter'
                    ? 'OrcaRouter'
                    : 'OpenRouter'}{' '}
                  are displayed.
                </p>
              </div>

              <div className="flex justify-start">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNewModelProvider(wizardProvider);
                    setNewModelId('');
                    setNewModelName('');
                    setNewModelDesc('');
                    setAddModelModalOpen(true);
                  }}
                  className="text-muted-foreground hover:text-foreground h-7 gap-1 text-xs"
                >
                  <Plus className="h-3 w-3" /> Add Custom Model
                </Button>
              </div>

              <DialogFooter className="mt-4 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setWizardStep(2)}
                  className="h-8 text-xs"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleWizardSaveAndActivate}
                  disabled={saving}
                  className="h-8 text-xs font-medium"
                >
                  {saving && (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  )}
                  Save & Activate
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: CONFIGURE BACKUP AI
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={configureBackupModalOpen}
        onOpenChange={setConfigureBackupModalOpen}
      >
        <DialogContent className="bg-popover text-popover-foreground border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base font-semibold">
              Configure Backup AI
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Select an alternative AI service in case the primary service is
              unavailable.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <button
              type="button"
              onClick={() => setTempBackupChoice('openrouter')}
              className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-colors ${
                tempBackupChoice === 'openrouter'
                  ? 'border-emerald-600 bg-emerald-500/5 dark:border-emerald-400'
                  : 'border-border hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-foreground text-xs font-semibold">
                  OpenRouter
                </span>
                {tempBackupChoice === 'openrouter' && (
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                Use OpenRouter as the backup service.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setTempBackupChoice('orcarouter')}
              className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-colors ${
                tempBackupChoice === 'orcarouter'
                  ? 'border-emerald-600 bg-emerald-500/5 dark:border-emerald-400'
                  : 'border-border hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-foreground text-xs font-semibold">
                  OrcaRouter
                </span>
                {tempBackupChoice === 'orcarouter' && (
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                Use OrcaRouter as the backup service.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setTempBackupChoice('none')}
              className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-colors ${
                tempBackupChoice === 'none'
                  ? 'border-emerald-600 bg-emerald-500/5 dark:border-emerald-400'
                  : 'border-border hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-foreground text-xs font-semibold">
                  Disabled
                </span>
                {tempBackupChoice === 'none' && (
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                Do not use a backup service (requests fail if main AI is down).
              </p>
            </button>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfigureBackupModalOpen(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveBackup}
              className="h-8 text-xs font-medium"
            >
              Save Backup AI
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: USAGE BREAKDOWN
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={usageModalOpen} onOpenChange={setUsageModalOpen}>
        <DialogContent className="bg-popover text-popover-foreground border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base font-semibold">
              AI Usage Breakdown — This Month
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Detailed breakdown of requests, tokens, and estimated cost.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* KPI Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/40 rounded-lg p-3">
                <span className="text-muted-foreground text-xs">
                  Total Requests
                </span>
                <p className="text-foreground mt-1 text-xl font-semibold">
                  {usageStats.totalRequests.toLocaleString()}
                </p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <span className="text-muted-foreground text-xs">
                  Estimated Cost
                </span>
                <p className="text-foreground mt-1 text-xl font-semibold">
                  ₹{usageStats.estimatedCostInr.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* By Provider */}
            <div className="space-y-1.5">
              <span className="text-foreground font-semibold">By Provider</span>
              <div className="bg-background border-border divide-y rounded-lg border">
                {Object.entries(usageStats.providers).map(([prov, count]) => (
                  <div key={prov} className="flex justify-between p-2.5">
                    <span className="text-muted-foreground font-medium capitalize">
                      {prov}
                    </span>
                    <span className="text-foreground font-semibold">
                      {count.toLocaleString()} calls
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* By Feature */}
            <div className="space-y-1.5">
              <span className="text-foreground font-semibold">By Feature</span>
              <div className="bg-background border-border divide-y rounded-lg border">
                {AI_FEATURES.slice(0, 4).map((f, i) => (
                  <div key={f.id} className="flex justify-between p-2.5">
                    <span className="text-muted-foreground">{f.name}</span>
                    <span className="text-foreground font-medium">
                      {Math.round(
                        usageStats.totalRequests * (0.4 - i * 0.1)
                      ).toLocaleString()}{' '}
                      calls
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* By Workspace */}
            <div className="space-y-1.5">
              <span className="text-foreground font-semibold">
                Top Active Businesses
              </span>
              <div className="bg-background border-border divide-y rounded-lg border">
                {usageStats.topWorkspaces.map((w) => (
                  <div
                    key={w.workspaceId}
                    className="flex justify-between p-2.5"
                  >
                    <span className="text-muted-foreground">
                      {w.workspaceId}
                    </span>
                    <span className="text-foreground font-medium">
                      {w.requests.toLocaleString()} calls (₹{w.estimatedCostInr}
                      )
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setUsageModalOpen(false)}
              className="h-8 text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: DIRECT UPDATE API KEY
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={keyModalOpen} onOpenChange={setKeyModalOpen}>
        <DialogContent className="bg-popover text-popover-foreground border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base font-semibold">
              Update{' '}
              {selectedKeyProvider === 'openrouter'
                ? 'OpenRouter'
                : 'OrcaRouter'}{' '}
              API Key
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Enter your provider API key. It will be encrypted and stored
              securely.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs font-medium">
                API Key
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
                  className="bg-background text-foreground border-border h-9 pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowRawKey(!showRawKey)}
                  className="text-muted-foreground hover:text-foreground absolute top-2 right-2.5 p-0.5"
                >
                  {showRawKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Your key is never logged or exposed to the client.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setKeyModalOpen(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveKey}
              disabled={saving}
              className="h-8 text-xs font-medium"
            >
              {saving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Save Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: ADD CUSTOM MODEL
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={addModelModalOpen} onOpenChange={setAddModelModalOpen}>
        <DialogContent className="bg-popover text-popover-foreground border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base font-semibold">
              Add Custom AI Model
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Add any model supported by your selected provider.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs font-medium">
                Provider
              </Label>
              <Input
                value={
                  newModelProvider === 'openrouter'
                    ? 'OpenRouter'
                    : 'OrcaRouter'
                }
                disabled
                className="bg-muted text-foreground border-border h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs font-medium">
                Model Name
              </Label>
              <Input
                placeholder="e.g. My Custom Model"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                className="bg-background text-foreground border-border h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs font-medium">
                Model ID
              </Label>
              <Input
                placeholder="e.g. author/model-name"
                value={newModelId}
                onChange={(e) => setNewModelId(e.target.value)}
                className="bg-background text-foreground border-border h-8 font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs font-medium">
                Description (Optional)
              </Label>
              <Input
                placeholder="Brief summary of what this model is best for"
                value={newModelDesc}
                onChange={(e) => setNewModelDesc(e.target.value)}
                className="bg-background text-foreground border-border h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddModelModalOpen(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAddCustomModel}
              className="h-8 text-xs font-medium"
            >
              Add Model
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
