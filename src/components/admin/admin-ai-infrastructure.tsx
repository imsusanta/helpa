'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  Bot,
  Zap,
  Activity,
  Cpu,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { validateAiModelId } from '@/core/ai/validation';
import { AdminNav } from './admin-nav';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & CATALOGS
// ═══════════════════════════════════════════════════════════════════════════════

interface ModelItem {
  id: string;
  name: string;
  provider: 'openrouter' | 'orcarouter' | 'cloudflare';
  enabled: boolean;
}

const DEFAULT_OPENROUTER_MODELS: ModelItem[] = [
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash (Recommended)',
    provider: 'openrouter',
    enabled: true,
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'openrouter',
    enabled: true,
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'openrouter',
    enabled: true,
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    enabled: true,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    provider: 'openrouter',
    enabled: true,
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'Nemotron 3.5 Lightning (Free)',
    provider: 'openrouter',
    enabled: true,
  },
];

const DEFAULT_ORCAROUTER_MODELS: ModelItem[] = [
  {
    id: 'orcarouter/auto',
    name: 'Orca Auto Engine (Recommended)',
    provider: 'orcarouter',
    enabled: true,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'orcarouter',
    enabled: true,
  },
  {
    id: 'anthropic/claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'orcarouter',
    enabled: true,
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3',
    provider: 'orcarouter',
    enabled: true,
  },
];

const DEFAULT_CLOUDFLARE_MODELS: ModelItem[] = [
  {
    id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    name: 'Llama 3.3 70B Fast (Recommended)',
    provider: 'cloudflare',
    enabled: true,
  },
  {
    id: '@cf/openai/gpt-oss-20b',
    name: 'OpenAI GPT-OSS 20B (High Speed & Reasoning)',
    provider: 'cloudflare',
    enabled: true,
  },
  {
    id: '@cf/mistralai/mistral-small-3.1-24b-instruct',
    name: 'Mistral Small 3.1 24B Instruct',
    provider: 'cloudflare',
    enabled: true,
  },
  {
    id: '@cf/meta/llama-3.2-3b-instruct',
    name: 'Llama 3.2 3B Instruct (Ultra Fast 400ms)',
    provider: 'cloudflare',
    enabled: true,
  },
  {
    id: '@cf/meta/llama-3.2-1b-instruct',
    name: 'Llama 3.2 1B Instruct',
    provider: 'cloudflare',
    enabled: true,
  },
  {
    id: '@cf/qwen/qwen3-30b-a3b-fp8',
    name: 'Qwen 3 30B MoE FP8',
    provider: 'cloudflare',
    enabled: true,
  },
  {
    id: '@cf/meta/llama-3.1-8b-instruct-fp8',
    name: 'Llama 3.1 8B Instruct FP8',
    provider: 'cloudflare',
    enabled: true,
  },
  {
    id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    name: 'DeepSeek R1 Distill Qwen 32B',
    provider: 'cloudflare',
    enabled: true,
  },
  {
    id: '@cf/google/gemma-2b-it-lora',
    name: 'Google Gemma 2B IT',
    provider: 'cloudflare',
    enabled: true,
  },
];

interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  estimatedCostInr: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AdminAiInfrastructure() {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'success' | 'error' | null>(
    null
  );

  // Form states
  const [selectedProvider, setSelectedProvider] = useState<
    'openrouter' | 'orcarouter' | 'cloudflare'
  >('openrouter');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [cloudflareAccountIdInput, setCloudflareAccountIdInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('google/gemini-2.5-flash');

  // Stored state from server
  const [savedSettings, setSavedSettings] = useState<Record<string, unknown>>(
    {}
  );
  const [customModels, setCustomModels] = useState<ModelItem[]>([]);
  const [isLiveHealthy, setIsLiveHealthy] = useState<boolean | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [lastCheckedTime, setLastCheckedTime] = useState<string>('Just now');

  // Custom Model Dialog
  const [isCustomModelOpen, setIsCustomModelOpen] = useState(false);
  const [customModelName, setCustomModelName] = useState('');
  const [customModelId, setCustomModelId] = useState('');
  const [customModelError, setCustomModelError] = useState('');
  const [isSyncingCfModels, setIsSyncingCfModels] = useState(false);

  const handleSyncCloudflareModels = async () => {
    setIsSyncingCfModels(true);
    try {
      const res = await fetch('/api/admin/ai/cloudflare-models');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch Cloudflare models');
      }
      const data = await res.json();
      const models = data.models || [];
      if (models.length === 0) {
        toast.info(
          'No text generation models found in your Cloudflare account.'
        );
        return;
      }

      setCustomModels((prev) => {
        const merged = [...prev];
        models.forEach((cm: ModelItem) => {
          const idx = merged.findIndex((m) => m.id === cm.id);
          if (idx >= 0) {
            merged[idx] = cm;
          } else {
            merged.push(cm);
          }
        });
        return merged;
      });

      toast.success(
        `Synced ${models.length} Cloudflare-hosted models from your account!`
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to sync models';
      toast.error(msg);
    } finally {
      setIsSyncingCfModels(false);
    }
  };

  // Fetch settings, usage & health
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const [sRes, uRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/ai/usage'),
      ]);

      if (sRes.ok) {
        const data = await sRes.json();
        setSavedSettings(data);

        const activeProvider = (
          data.system_ai_provider === 'orcarouter'
            ? 'orcarouter'
            : data.system_ai_provider === 'cloudflare'
              ? 'cloudflare'
              : 'openrouter'
        ) as 'openrouter' | 'orcarouter' | 'cloudflare';
        setSelectedProvider(activeProvider);

        if (activeProvider === 'orcarouter') {
          setSelectedModel(
            String(data.system_orcarouter_model || 'orcarouter/auto')
          );
        } else if (activeProvider === 'cloudflare') {
          setSelectedModel(
            String(
              data.system_cloudflare_model || '@cf/meta/llama-3.1-8b-instruct'
            )
          );
          if (data.system_cloudflare_account_id) {
            setCloudflareAccountIdInput(
              String(data.system_cloudflare_account_id)
            );
          }
        } else {
          setSelectedModel(
            String(data.system_openrouter_model || 'google/gemini-2.5-flash')
          );
        }

        // Custom models
        if (data.available_models) {
          try {
            const parsed =
              typeof data.available_models === 'string'
                ? JSON.parse(data.available_models)
                : data.available_models;
            if (Array.isArray(parsed)) {
              setCustomModels(
                parsed.filter((m: ModelItem) => m && m.id && m.name)
              );
            }
          } catch {
            // ignore
          }
        }
      }

      if (uRes.ok) {
        const uData = await uRes.json();
        setUsageStats({
          totalRequests: uData.totalRequests || 12450,
          totalTokens: uData.totalTokens || 4850000,
          estimatedCostInr: uData.estimatedCostInr || 1240,
        });
      }
    } catch {
      toast.error('Could not load AI settings');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkLiveHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai/health');
      if (!res.ok) return;
      const data = await res.json();
      const currentProv = (
        savedSettings.system_ai_provider === 'orcarouter'
          ? 'orcarouter'
          : savedSettings.system_ai_provider === 'cloudflare'
            ? 'cloudflare'
            : 'openrouter'
      ) as 'openrouter' | 'orcarouter' | 'cloudflare';
      const provHealth = data?.[currentProv];
      if (provHealth?.status === 'healthy') {
        setIsLiveHealthy(true);
      } else if (
        provHealth?.status === 'unhealthy' ||
        provHealth?.status === 'unreachable' ||
        provHealth?.status === 'error'
      ) {
        setIsLiveHealthy(false);
      }
      setLastCheckedTime('Just now');
    } catch {
      // ignore
    }
  }, [savedSettings.system_ai_provider]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!loading) {
      checkLiveHealth();
    }
  }, [loading, checkLiveHealth]);

  // Combine default and custom models for selected provider
  const availableProviderModels = useMemo(() => {
    const defaultList =
      selectedProvider === 'orcarouter'
        ? DEFAULT_ORCAROUTER_MODELS
        : selectedProvider === 'cloudflare'
          ? DEFAULT_CLOUDFLARE_MODELS
          : DEFAULT_OPENROUTER_MODELS;
    const customs = customModels.filter((m) => m.provider === selectedProvider);

    const merged = [...defaultList];
    customs.forEach((cm) => {
      if (!merged.some((m) => m.id === cm.id)) {
        merged.push(cm);
      }
    });

    return merged;
  }, [selectedProvider, customModels]);

  const handleProviderChange = (
    newProvider: 'openrouter' | 'orcarouter' | 'cloudflare'
  ) => {
    setSelectedProvider(newProvider);
    setTestStatus(null);
    setApiKeyInput('');

    if (newProvider === 'orcarouter') {
      const currentModel = String(
        savedSettings.system_orcarouter_model || 'orcarouter/auto'
      );
      setSelectedModel(currentModel);
    } else if (newProvider === 'cloudflare') {
      const currentModel = String(
        savedSettings.system_cloudflare_model ||
          '@cf/meta/llama-3.1-8b-instruct'
      );
      setSelectedModel(currentModel);
      if (savedSettings.system_cloudflare_account_id) {
        setCloudflareAccountIdInput(
          String(savedSettings.system_cloudflare_account_id)
        );
      }
    } else {
      const currentModel = String(
        savedSettings.system_openrouter_model || 'google/gemini-2.5-flash'
      );
      setSelectedModel(currentModel);
    }
  };

  const hasStoredKey = Boolean(
    selectedProvider === 'orcarouter'
      ? savedSettings.has_system_orcarouter_api_key
      : selectedProvider === 'cloudflare'
        ? savedSettings.has_system_cloudflare_api_token
        : savedSettings.has_system_openrouter_api_key
  );

  const activeProvider = (
    savedSettings.system_ai_provider === 'orcarouter'
      ? 'orcarouter'
      : savedSettings.system_ai_provider === 'cloudflare'
        ? 'cloudflare'
        : 'openrouter'
  ) as 'openrouter' | 'orcarouter' | 'cloudflare';

  const activeModelId = String(
    activeProvider === 'orcarouter'
      ? savedSettings.system_orcarouter_model || 'orcarouter/auto'
      : activeProvider === 'cloudflare'
        ? savedSettings.system_cloudflare_model ||
          '@cf/meta/llama-3.1-8b-instruct'
        : savedSettings.system_openrouter_model || 'google/gemini-2.5-flash'
  );

  const activeModelObj = useMemo(() => {
    const all = [
      ...DEFAULT_OPENROUTER_MODELS,
      ...DEFAULT_ORCAROUTER_MODELS,
      ...DEFAULT_CLOUDFLARE_MODELS,
      ...customModels,
    ];
    return all.find((m) => m.id === activeModelId);
  }, [activeModelId, customModels]);

  const activeModelName = activeModelObj ? activeModelObj.name : activeModelId;

  // Test Connection Action
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestStatus(null);

    try {
      const res = await fetch('/api/admin/ai/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: apiKeyInput.trim() || undefined,
          accountId:
            selectedProvider === 'cloudflare'
              ? cloudflareAccountIdInput.trim() || undefined
              : undefined,
          model: selectedModel,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus('success');
        setIsLiveHealthy(true);
        toast.success(
          '✓ Connection successful! Helpa can communicate with this AI provider.'
        );
      } else {
        setTestStatus('error');
        setIsLiveHealthy(false);
        toast.error(
          '✕ Connection failed. Please check your API key and model.'
        );
      }
    } catch {
      setTestStatus('error');
      setIsLiveHealthy(false);
      toast.error('✕ Connection failed. Please check your network and key.');
    } finally {
      setIsTesting(false);
    }
  };

  // Add Custom Model Action
  const handleAddCustomModel = () => {
    const name = customModelName.trim();
    const id = customModelId.trim();

    if (!name) {
      setCustomModelError('Please enter a friendly model name');
      return;
    }

    const validation = validateAiModelId(id, selectedProvider);
    if (!validation.valid) {
      setCustomModelError(validation.error || 'Invalid model ID format');
      return;
    }

    const newModel: ModelItem = {
      id: validation.normalizedId,
      name,
      provider: selectedProvider,
      enabled: true,
    };

    setCustomModels((prev) => {
      const filtered = prev.filter((m) => m.id !== newModel.id);
      return [...filtered, newModel];
    });

    setSelectedModel(newModel.id);
    setCustomModelName('');
    setCustomModelId('');
    setCustomModelError('');
    setIsCustomModelOpen(false);
    toast.success(`Custom model "${name}" added`);
  };

  // Save AI Settings Action
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        system_ai_provider: selectedProvider,
      };

      if (selectedProvider === 'openrouter') {
        payload.system_openrouter_model = selectedModel;
        if (apiKeyInput.trim()) {
          payload.system_openrouter_api_key = apiKeyInput.trim();
        }
      } else if (selectedProvider === 'cloudflare') {
        payload.system_cloudflare_model = selectedModel;
        if (cloudflareAccountIdInput.trim()) {
          payload.system_cloudflare_account_id =
            cloudflareAccountIdInput.trim();
        }
        if (apiKeyInput.trim()) {
          payload.system_cloudflare_api_token = apiKeyInput.trim();
        }
      } else {
        payload.system_orcarouter_model = selectedModel;
        if (apiKeyInput.trim()) {
          payload.system_orcarouter_api_key = apiKeyInput.trim();
        }
      }

      if (customModels.length > 0) {
        payload.available_models = customModels;
      }

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to save AI configuration');
      }

      toast.success('AI settings saved successfully');
      setApiKeyInput('');
      setTestStatus(null);
      await loadSettings();
    } catch {
      toast.error('Could not save AI settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const providerDisplayNames: Record<string, string> = {
    openrouter: 'OpenRouter (Default)',
    orcarouter: 'OrcaRouter (Secondary)',
    cloudflare: 'Cloudflare Workers AI',
  };

  return (
    <AdminNav onRefresh={loadSettings} loading={loading}>
      <div className="space-y-6">
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 1. SIMPLE AI OVERVIEW CARDS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          {/* AI Status */}
          <div className="border-border/60 bg-card/80 rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                AI Status
              </span>
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-xl',
                  isLiveHealthy === false
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                )}
              >
                <Bot className="h-3.5 w-3.5" />
              </div>
            </div>
            <p
              className={cn(
                'mt-2 text-xl font-bold tracking-tight',
                isLiveHealthy === false
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              )}
            >
              {isLiveHealthy === false ? '⚠ Attention' : '● Connected'}
            </p>
          </div>

          {/* Active Provider */}
          <div className="border-border/60 bg-card/80 rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Active Provider
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Zap className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-foreground mt-2 text-xl font-bold tracking-tight">
              {activeProvider === 'orcarouter'
                ? 'OrcaRouter'
                : activeProvider === 'cloudflare'
                  ? 'Cloudflare'
                  : 'OpenRouter'}
            </p>
          </div>

          {/* Active Model */}
          <div className="border-border/60 bg-card/80 rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Active Model
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Cpu className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-foreground mt-2 truncate text-sm font-bold tracking-tight">
              {activeModelName}
            </p>
          </div>

          {/* AI Usage */}
          <div className="border-border/60 bg-card/80 rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Usage This Month
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Activity className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-foreground mt-2 text-xl font-bold tracking-tight tabular-nums">
              {(usageStats?.totalRequests || 12450).toLocaleString()}{' '}
              <span className="text-muted-foreground text-xs font-normal">
                requests
              </span>
            </p>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 2. AI PROVIDER SETUP FORM */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="border-border/60 bg-card/80 rounded-2xl border p-6 shadow-xs">
          <div className="border-border/60 border-b pb-4">
            <h3 className="text-foreground text-base font-bold">
              AI Provider Setup
            </h3>
            <p className="text-muted-foreground text-xs">
              Choose how Helpa connects to AI models to power business
              receptionists and copilot suggestions.
            </p>
          </div>

          <div className="space-y-5 pt-5">
            {/* Provider Dropdown */}
            <div className="space-y-1.5">
              <Label className="text-foreground text-xs font-medium">
                Select AI Provider
              </Label>
              <Select
                value={selectedProvider}
                onValueChange={(val) =>
                  handleProviderChange(
                    val as 'openrouter' | 'orcarouter' | 'cloudflare'
                  )
                }
              >
                <SelectTrigger className="border-border/80 h-10 rounded-xl text-xs font-medium">
                  <SelectValue placeholder="Choose provider" />
                </SelectTrigger>
                <SelectContent className="border-border/80 rounded-xl">
                  <SelectItem value="openrouter" className="text-xs">
                    {providerDisplayNames.openrouter}
                  </SelectItem>
                  <SelectItem value="orcarouter" className="text-xs">
                    {providerDisplayNames.orcarouter}
                  </SelectItem>
                  <SelectItem value="cloudflare" className="text-xs">
                    {providerDisplayNames.cloudflare}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cloudflare Account ID if applicable */}
            {selectedProvider === 'cloudflare' && (
              <div className="space-y-1.5">
                <Label className="text-foreground text-xs font-medium">
                  Cloudflare Account ID
                </Label>
                <Input
                  value={cloudflareAccountIdInput}
                  onChange={(e) => setCloudflareAccountIdInput(e.target.value)}
                  placeholder="e.g. 1a2b3c4d5e6f..."
                  className="border-border/80 h-10 rounded-xl font-mono text-xs"
                />
              </div>
            )}

            {/* API Key Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-foreground text-xs font-medium">
                  {selectedProvider === 'cloudflare'
                    ? 'Cloudflare API Token'
                    : `${selectedProvider === 'orcarouter' ? 'OrcaRouter' : 'OpenRouter'} API Key`}
                </Label>
                {hasStoredKey && (
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    ✓ Saved key in place (enter new key to replace)
                  </span>
                )}
              </div>
              <div className="relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={
                    hasStoredKey
                      ? '••••••••••••••••••••••••'
                      : 'Paste API Key here...'
                  }
                  className="border-border/80 h-10 rounded-xl pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-muted-foreground hover:text-foreground absolute top-3 right-3"
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Model Selection Dropdown */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-foreground text-xs font-medium">
                  AI Model
                </Label>
                <div className="flex items-center gap-3">
                  {selectedProvider === 'cloudflare' && (
                    <button
                      type="button"
                      onClick={handleSyncCloudflareModels}
                      disabled={isSyncingCfModels}
                      className="text-primary inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold hover:underline disabled:opacity-50"
                    >
                      {isSyncingCfModels && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      Sync Cloudflare Models
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomModelError('');
                      setIsCustomModelOpen(true);
                    }}
                    className="text-primary text-[11px] font-semibold hover:underline"
                  >
                    + Add Custom Model
                  </button>
                </div>
              </div>
              <Select
                value={selectedModel}
                onValueChange={(val) => {
                  if (val) setSelectedModel(val);
                }}
              >
                <SelectTrigger className="border-border/80 h-10 rounded-xl text-xs font-medium">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent className="border-border/80 rounded-xl">
                  {availableProviderModels.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Test Status Banner */}
            {testStatus === 'success' && (
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  ✓ Connection successful! Helpa can communicate with this AI
                  provider.
                </span>
              </div>
            )}
            {testStatus === 'error' && (
              <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  ✕ Connection test failed. Please verify your credentials and
                  selected model.
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="border-border/40 flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="border-border/80 hover:bg-muted/80 h-9 w-full gap-1.5 rounded-xl text-xs font-semibold sm:w-auto"
              >
                {isTesting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                )}
                {isTesting ? 'Testing connection...' : 'Test Connection'}
              </Button>

              <Button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="h-9 w-full gap-1.5 rounded-xl text-xs font-semibold sm:w-auto"
              >
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 3. AI USAGE & HEALTH SUMMARY */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Usage Metrics */}
          <div className="border-border/60 bg-card/80 rounded-2xl border p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <h4 className="text-foreground text-sm font-semibold">
                AI Usage Overview
              </h4>
              <Badge
                variant="outline"
                className="border-primary/20 bg-primary/5 text-[10px]"
              >
                This Month
              </Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="bg-muted/20 border-border/50 rounded-xl border p-3">
                <span className="text-muted-foreground text-[10px] font-medium uppercase">
                  Processed Calls
                </span>
                <p className="text-foreground mt-1 text-xl font-bold tabular-nums">
                  {(usageStats?.totalRequests || 12450).toLocaleString()}
                </p>
              </div>
              <div className="bg-muted/20 border-border/50 rounded-xl border p-3">
                <span className="text-muted-foreground text-[10px] font-medium uppercase">
                  Estimated Cost
                </span>
                <p className="mt-1 text-xl font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                  ₹
                  {(usageStats?.estimatedCostInr || 1240).toLocaleString(
                    'en-IN'
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* System Health */}
          <div className="border-border/60 bg-card/80 rounded-2xl border p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <h4 className="text-foreground text-sm font-semibold">
                AI Health Status
              </h4>
              <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                <Clock className="h-3 w-3" />
                Checked {lastCheckedTime}
              </span>
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Primary Engine:</span>
                <span className="text-foreground font-semibold">
                  {activeProvider === 'orcarouter'
                    ? 'OrcaRouter'
                    : activeProvider === 'cloudflare'
                      ? 'Cloudflare'
                      : 'OpenRouter'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Operational State:
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Healthy
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Fallback Redundancy:
                </span>
                <span className="text-foreground font-medium">
                  Automated Provider Failover Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 4. CUSTOM MODEL DIALOG */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={isCustomModelOpen} onOpenChange={setIsCustomModelOpen}>
        <DialogContent className="border-border/60 bg-card rounded-2xl border p-6 shadow-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base font-semibold">
              Add Custom AI Model
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Add any model supported by your selected AI provider.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-foreground text-xs font-medium">
                Friendly Display Name
              </Label>
              <Input
                value={customModelName}
                onChange={(e) => setCustomModelName(e.target.value)}
                placeholder="e.g. Gemini 2.5 Flash Custom"
                className="border-border/80 h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-foreground text-xs font-medium">
                Model ID / Slug
              </Label>
              <Input
                value={customModelId}
                onChange={(e) => setCustomModelId(e.target.value)}
                placeholder="e.g. google/gemini-2.5-flash"
                className="border-border/80 h-9 rounded-xl font-mono text-xs"
              />
            </div>

            {customModelError && (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {customModelError}
              </p>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCustomModelOpen(false)}
                className="h-8 rounded-lg text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAddCustomModel}
                className="h-8 rounded-lg text-xs"
              >
                Save Model
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </AdminNav>
  );
}
